/**
 * Sonacast Audio Engine
 * Zero-cutoff 100% full-length playback controller supporting:
 * 1. Bundled 100% Studio Master MP3 & Local File playback via HTMLAudioElement + Web Audio FFT AnalyserNode
 * 2. Official Full-Length streaming via documented YouTube IFrame Player API with multi-candidate error failover
 */

export interface SpectrumData {
  frequencies: Uint8Array<ArrayBuffer>;
  waveformData: Uint8Array<ArrayBuffer>;
  bass: number;
  mid: number;
  treble: number;
  level: number;
}

export type AudioBackendType = 'none' | 'html5' | 'youtube';

interface YTPlayerInstance {
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead?: boolean) => void;
  loadVideoById: (videoId: string) => void;
  setVolume: (volume: number) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  destroy: () => void;
}

interface YTNamespace {
  Player: new (
    elementId: string | HTMLElement,
    options: {
      width?: string | number;
      height?: string | number;
      videoId?: string;
      playerVars?: Record<string, string | number>;
      events?: {
        onReady?: (event: { target: YTPlayerInstance }) => void;
        onStateChange?: (event: { data: number; target: YTPlayerInstance }) => void;
        onError?: (event: { data: number; target: YTPlayerInstance }) => void;
      };
    }
  ) => YTPlayerInstance;
  PlayerState?: {
    ENDED: number;
    PLAYING: number;
    PAUSED: number;
    BUFFERING: number;
    CUED: number;
  };
}

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private gainNode: GainNode | null = null;
  private audioElement: HTMLAudioElement | null = null;
  private mediaSourceNode: MediaElementAudioSourceNode | null = null;

  private activeBackend: AudioBackendType = 'none';
  private ytHostElement: HTMLElement | null = null;
  private ytPlayer: YTPlayerInstance | null = null;
  private ytReady = false;
  private ytApiPromise: Promise<void> | null = null;
  private ytPollInterval: number | null = null;
  private ytWatchdogTimer: number | null = null;
  private candidateIds: string[] = [];
  private candidateIndex = 0;
  private playGeneration = 0;

  private currentTrackBpm = 120;
  private isPlaying = false;
  private currentTime = 0;
  private duration = 210;
  private volume = 0.85;

  private freqArray: Uint8Array<ArrayBuffer> = new Uint8Array(new ArrayBuffer(256));
  private waveArray: Uint8Array<ArrayBuffer> = new Uint8Array(new ArrayBuffer(256));

  private onTimeUpdateCallbacks: Set<(time: number) => void> = new Set();
  private onStateChangeCallbacks: Set<(playing: boolean) => void> = new Set();
  private onTrackEndedCallbacks: Set<() => void> = new Set();
  private onDurationChangeCallbacks: Set<(duration: number) => void> = new Set();
  private onErrorCallbacks: Set<(message: string) => void> = new Set();

  constructor() {
    // Lazily initialized on user gesture
  }

  public mountYouTubeHost(el: HTMLElement | null) {
    this.ytHostElement = el;
  }

  public preloadYouTubeApi() {
    this.loadYouTubeApi().catch(() => {});
  }

  public getPlayGeneration(): number {
    return this.playGeneration;
  }

  public appendCandidateIds(extraIds: string[], expectedGen?: number) {
    if (expectedGen !== undefined && expectedGen !== this.playGeneration) return;
    if (this.activeBackend !== 'youtube') return;
    for (const id of extraIds) {
      if (id && !this.candidateIds.includes(id)) {
        this.candidateIds.push(id);
      }
    }
  }

  public getActiveBackend(): AudioBackendType {
    return this.activeBackend;
  }

  private initHtml5Context() {
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();

      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 512;
      this.analyser.smoothingTimeConstant = 0.82;
      this.analyser.minDecibels = -90;
      this.analyser.maxDecibels = -10;

      this.gainNode = this.ctx.createGain();
      this.gainNode.gain.value = this.volume;

      this.analyser.connect(this.gainNode);
      this.gainNode.connect(this.ctx.destination);

      this.freqArray = new Uint8Array(new ArrayBuffer(this.analyser.frequencyBinCount));
      this.waveArray = new Uint8Array(new ArrayBuffer(this.analyser.frequencyBinCount));

      this.audioElement = new Audio();
      this.audioElement.crossOrigin = 'anonymous';
      this.audioElement.preload = 'auto';
      this.audioElement.loop = false;
      this.audioElement.volume = this.volume;

      try {
        this.mediaSourceNode = this.ctx.createMediaElementSource(this.audioElement);
        this.mediaSourceNode.connect(this.analyser);
      } catch {
        // Safe fallback if browser blocks media source attachment
      }

      this.audioElement.addEventListener('timeupdate', () => {
        if (this.activeBackend !== 'html5' || !this.audioElement || !this.isPlaying) return;
        this.currentTime = this.audioElement.currentTime;
        this.notifyTime();
      });

      const syncHtml5Duration = () => {
        if (
          this.activeBackend === 'html5' &&
          this.audioElement &&
          this.audioElement.duration &&
          isFinite(this.audioElement.duration) &&
          this.audioElement.duration > 0
        ) {
          const realDur = Math.round(this.audioElement.duration);
          if (Math.abs(realDur - this.duration) >= 1) {
            this.duration = realDur;
            this.notifyDurationChange();
          }
        }
      };

      this.audioElement.addEventListener('loadedmetadata', syncHtml5Duration);
      this.audioElement.addEventListener('durationchange', syncHtml5Duration);

      this.audioElement.addEventListener('ended', () => {
        if (this.activeBackend !== 'html5' || !this.isPlaying) return;
        this.isPlaying = false;
        this.currentTime = this.duration;
        this.notifyTime();
        this.notifyState();
        this.notifyTrackEnded();
      });
    }

    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  private loadYouTubeApi(): Promise<void> {
    if (window.YT && typeof window.YT.Player === 'function') {
      return Promise.resolve();
    }
    if (this.ytApiPromise) return this.ytApiPromise;

    this.ytApiPromise = new Promise<void>((resolve, reject) => {
      const prevReady = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        if (prevReady) prevReady();
        resolve();
      };

      const existing = document.querySelector('script[src="https://www.youtube.com/iframe_api"]');
      if (!existing) {
        const script = document.createElement('script');
        script.src = 'https://www.youtube.com/iframe_api';
        script.async = true;
        script.onerror = () => {
          this.ytApiPromise = null;
          reject(new Error('Failed to load YouTube IFrame API'));
        };
        document.head.appendChild(script);
      }

      window.setTimeout(() => {
        if (window.YT && typeof window.YT.Player === 'function') {
          resolve();
        }
      }, 4500);
    });

    return this.ytApiPromise;
  }

  private clearYouTubeWatchdog() {
    if (this.ytWatchdogTimer !== null) {
      clearTimeout(this.ytWatchdogTimer);
      this.ytWatchdogTimer = null;
    }
  }

  private armYouTubeWatchdog(gen: number) {
    this.clearYouTubeWatchdog();
    this.ytWatchdogTimer = window.setTimeout(() => {
      if (gen !== this.playGeneration || this.activeBackend !== 'youtube' || !this.isPlaying) {
        return;
      }
      let pos = this.currentTime;
      try {
        if (this.ytPlayer && this.ytReady) {
          pos = this.ytPlayer.getCurrentTime();
        }
      } catch {
        // Ignore
      }
      if (typeof pos === 'number' && pos >= 0.3) return;
      this.advanceToNextCandidate(gen);
    }, 6500);
  }

  private advanceToNextCandidate(gen: number): boolean {
    if (gen !== this.playGeneration || this.activeBackend !== 'youtube') return false;
    this.candidateIndex += 1;
    if (this.candidateIndex < this.candidateIds.length && this.ytPlayer && this.ytReady) {
      const nextId = this.candidateIds[this.candidateIndex];
      try {
        this.ytPlayer.loadVideoById(nextId);
        this.ytPlayer.playVideo();
        this.armYouTubeWatchdog(gen);
        return true;
      } catch {
        // Fall through to error stop
      }
    }
    this.clearYouTubeWatchdog();
    this.isPlaying = false;
    this.stopYouTubePoll();
    this.notifyState();
    this.notifyError('Selected stream candidate unavailable for embedding. Try another search result.');
    return false;
  }

  private async waitForVisibleYouTubeHost(): Promise<void> {
    if (!this.ytHostElement) return;
    const deadline = performance.now() + 320;
    while (performance.now() < deadline) {
      const rect = this.ytHostElement.getBoundingClientRect();
      if (rect.width >= 150 && rect.height >= 150) {
        return;
      }
      await new Promise<void>((res) => requestAnimationFrame(() => res()));
    }
  }

  private stopYouTubeBackend() {
    this.clearYouTubeWatchdog();
    this.stopYouTubePoll();
    if (this.ytPlayer && this.ytReady) {
      try {
        this.ytPlayer.pauseVideo();
      } catch {
        // Ignore if player not yet initialized
      }
    }
  }

  private stopHtml5Backend() {
    if (this.audioElement) {
      try {
        this.audioElement.pause();
      } catch {
        // Ignore
      }
    }
  }

  private startYouTubePoll() {
    this.stopYouTubePoll();
    this.ytPollInterval = window.setInterval(() => {
      if (this.activeBackend !== 'youtube' || !this.ytPlayer || !this.ytReady || !this.isPlaying) {
        return;
      }
      try {
        const pos = this.ytPlayer.getCurrentTime();
        if (typeof pos === 'number' && isFinite(pos) && pos >= 0) {
          this.currentTime = pos;
          this.notifyTime();
          if (pos >= 0.3) {
            this.clearYouTubeWatchdog();
          }
        }
        const realDur = this.ytPlayer.getDuration();
        if (typeof realDur === 'number' && isFinite(realDur) && realDur >= 30) {
          const rounded = Math.round(realDur);
          if (Math.abs(rounded - this.duration) >= 2) {
            this.duration = rounded;
            this.notifyDurationChange();
          }
        }
      } catch {
        // Safe poll fallback
      }
    }, 250);
  }

  private stopYouTubePoll() {
    if (this.ytPollInterval !== null) {
      clearInterval(this.ytPollInterval);
      this.ytPollInterval = null;
    }
  }

  public async playYouTubeTrack(candidateIds: string[], duration: number, bpm = 120) {
    const validIds = Array.from(new Set(candidateIds.filter((id) => Boolean(id))));
    if (validIds.length === 0) {
      this.notifyError('No verified full-length stream IDs available for this track.');
      return;
    }

    const gen = ++this.playGeneration;
    this.stopHtml5Backend();
    this.clearYouTubeWatchdog();
    this.stopYouTubePoll();

    this.activeBackend = 'youtube';
    this.candidateIds = validIds;
    this.candidateIndex = 0;
    this.duration = Math.max(60, duration);
    this.currentTrackBpm = bpm;
    this.currentTime = 0;
    this.isPlaying = true;
    this.notifyTime();
    this.notifyState();

    try {
      await Promise.all([this.loadYouTubeApi(), this.waitForVisibleYouTubeHost()]);
    } catch {
      if (gen === this.playGeneration) {
        this.isPlaying = false;
        this.notifyState();
        this.notifyError('Official stream player could not initialize.');
      }
      return;
    }

    if (gen !== this.playGeneration) return;

    const firstVideoId = validIds[0];

    if (this.ytPlayer && this.ytReady) {
      try {
        this.ytPlayer.setVolume(Math.round(this.volume * 100));
        this.ytPlayer.loadVideoById(firstVideoId);
        this.ytPlayer.playVideo();
        this.startYouTubePoll();
        this.armYouTubeWatchdog(gen);
        return;
      } catch {
        // Rebuild player below if previous iframe was detached
      }
    }

    if (!this.ytHostElement) {
      this.isPlaying = false;
      this.notifyState();
      this.notifyError('Stream host container not mounted.');
      return;
    }

    this.ytHostElement.innerHTML = '';
    const targetNode = document.createElement('div');
    targetNode.id = 'sonacast-yt-player-frame';
    this.ytHostElement.appendChild(targetNode);

    const YT = window.YT;
    if (!YT || !YT.Player) return;

    this.ytReady = false;
    this.ytPlayer = new YT.Player(targetNode, {
      width: '100%',
      height: '100%',
      videoId: firstVideoId,
      playerVars: {
        autoplay: 1,
        controls: 1,
        modestbranding: 1,
        rel: 0,
        playsinline: 1,
        iv_load_policy: 3,
        origin: window.location.origin
      },
      events: {
        onReady: (event) => {
          if (gen !== this.playGeneration || this.activeBackend !== 'youtube') return;
          this.ytReady = true;
          event.target.setVolume(Math.round(this.volume * 100));
          event.target.playVideo();
          this.startYouTubePoll();
          this.armYouTubeWatchdog(gen);
        },
        onStateChange: (event) => {
          if (this.activeBackend !== 'youtube' || gen !== this.playGeneration) return;
          const state = event.data;
          // 1 = PLAYING, 2 = PAUSED, 0 = ENDED, 5 = CUED
          if (state === 1) {
            this.isPlaying = true;
            this.notifyState();
            this.startYouTubePoll();
            try {
              const cur = event.target.getCurrentTime();
              if (typeof cur === 'number' && cur >= 0.3) {
                this.clearYouTubeWatchdog();
              }
              const realDur = event.target.getDuration();
              if (realDur && isFinite(realDur) && realDur >= 30) {
                const rounded = Math.round(realDur);
                if (Math.abs(rounded - this.duration) >= 2) {
                  this.duration = rounded;
                  this.notifyDurationChange();
                }
              }
            } catch {
              // Ignore
            }
          } else if (state === 5) {
            if (this.isPlaying) {
              try {
                event.target.playVideo();
              } catch {
                // Ignore
              }
            }
          } else if (state === 2) {
            this.clearYouTubeWatchdog();
            this.isPlaying = false;
            this.stopYouTubePoll();
            this.notifyState();
          } else if (state === 0) {
            this.clearYouTubeWatchdog();
            this.isPlaying = false;
            this.stopYouTubePoll();
            this.currentTime = this.duration;
            this.notifyTime();
            this.notifyState();
            this.notifyTrackEnded();
          }
        },
        onError: () => {
          if (this.activeBackend !== 'youtube' || gen !== this.playGeneration) return;
          this.advanceToNextCandidate(gen);
        }
      }
    });
  }

  public playTrack(duration: number, bpm = 120, audioUrl?: string, candidateVideoIds?: string[]) {
    if (audioUrl) {
      const gen = ++this.playGeneration;
      this.stopYouTubeBackend();
      this.initHtml5Context();

      this.activeBackend = 'html5';
      this.duration = Math.max(60, duration);
      this.currentTrackBpm = bpm;
      this.currentTime = 0;
      this.notifyTime();

      if (!this.audioElement) return;
      this.audioElement.loop = false;
      this.audioElement.volume = this.volume;

      const resolvedSrc = new URL(audioUrl, window.location.href).href;
      if (this.audioElement.src !== resolvedSrc) {
        this.audioElement.src = audioUrl;
      }
      this.audioElement.currentTime = 0;

      this.audioElement
        .play()
        .then(() => {
          if (gen !== this.playGeneration) return;
          this.isPlaying = true;
          this.notifyState();
        })
        .catch(() => {
          if (gen !== this.playGeneration) return;
          if (candidateVideoIds && candidateVideoIds.length > 0) {
            this.playYouTubeTrack(candidateVideoIds, duration, bpm);
          } else {
            this.isPlaying = false;
            this.notifyState();
            this.notifyError('Audio playback could not start. Click Play to retry.');
          }
        });
      return;
    }

    if (candidateVideoIds && candidateVideoIds.length > 0) {
      this.playYouTubeTrack(candidateVideoIds, duration, bpm);
      return;
    }

    this.notifyError('No playable full-length stream source attached to this track.');
  }

  public pause() {
    this.isPlaying = false;
    this.clearYouTubeWatchdog();
    this.stopYouTubePoll();
    if (this.activeBackend === 'html5' && this.audioElement) {
      this.audioElement.pause();
    } else if (this.activeBackend === 'youtube' && this.ytPlayer && this.ytReady) {
      try {
        this.ytPlayer.pauseVideo();
      } catch {
        // Ignore
      }
    }
    this.notifyState();
  }

  public resume() {
    if (this.isPlaying) return;

    if (this.activeBackend === 'html5' && this.audioElement && this.audioElement.src) {
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      this.audioElement
        .play()
        .then(() => {
          this.isPlaying = true;
          this.notifyState();
        })
        .catch(() => {
          this.isPlaying = false;
          this.notifyState();
        });
      return;
    }

    if (this.activeBackend === 'youtube' && this.ytPlayer && this.ytReady) {
      try {
        this.ytPlayer.playVideo();
        this.isPlaying = true;
        this.startYouTubePoll();
        this.notifyState();
      } catch {
        this.isPlaying = false;
        this.notifyState();
      }
    }
  }

  public togglePlay() {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.resume();
    }
  }

  public seek(seconds: number) {
    const clamped = Math.max(0, Math.min(this.duration, seconds));
    this.currentTime = clamped;

    if (this.activeBackend === 'html5' && this.audioElement && this.audioElement.src) {
      try {
        this.audioElement.currentTime = clamped;
      } catch {
        // Ignore seek before metadata ready
      }
    } else if (this.activeBackend === 'youtube' && this.ytPlayer && this.ytReady) {
      try {
        this.ytPlayer.seekTo(clamped, true);
      } catch {
        // Ignore
      }
    }

    this.notifyTime();
  }

  public setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.gainNode && this.ctx) {
      this.gainNode.gain.setValueAtTime(this.volume, this.ctx.currentTime);
    }
    if (this.audioElement) {
      this.audioElement.volume = this.volume;
    }
    if (this.ytPlayer && this.ytReady) {
      try {
        this.ytPlayer.setVolume(Math.round(this.volume * 100));
      } catch {
        // Ignore
      }
    }
  }

  public getVolume(): number {
    return this.volume;
  }

  public getCurrentTime(): number {
    return this.currentTime;
  }

  public getDuration(): number {
    return this.duration;
  }

  public getIsPlaying(): boolean {
    return this.isPlaying;
  }

  public subscribeTimeUpdate(callback: (time: number) => void) {
    this.onTimeUpdateCallbacks.add(callback);
    return () => this.onTimeUpdateCallbacks.delete(callback);
  }

  public subscribeStateChange(callback: (playing: boolean) => void) {
    this.onStateChangeCallbacks.add(callback);
    return () => this.onStateChangeCallbacks.delete(callback);
  }

  public subscribeTrackEnded(callback: () => void) {
    this.onTrackEndedCallbacks.add(callback);
    return () => this.onTrackEndedCallbacks.delete(callback);
  }

  public subscribeDurationChange(callback: (duration: number) => void) {
    this.onDurationChangeCallbacks.add(callback);
    return () => this.onDurationChangeCallbacks.delete(callback);
  }

  public subscribeError(callback: (message: string) => void) {
    this.onErrorCallbacks.add(callback);
    return () => this.onErrorCallbacks.delete(callback);
  }

  private notifyTime() {
    this.onTimeUpdateCallbacks.forEach((cb) => cb(this.currentTime));
  }

  private notifyState() {
    this.onStateChangeCallbacks.forEach((cb) => cb(this.isPlaying));
  }

  private notifyTrackEnded() {
    this.onTrackEndedCallbacks.forEach((cb) => {
      try {
        cb();
      } catch {
        // Safe callback execution
      }
    });
  }

  private notifyDurationChange() {
    this.onDurationChangeCallbacks.forEach((cb) => cb(this.duration));
  }

  private notifyError(message: string) {
    this.onErrorCallbacks.forEach((cb) => cb(message));
  }

  public getSpectrum(): SpectrumData {
    const len = this.freqArray.length;

    if (this.activeBackend === 'html5' && this.analyser && this.isPlaying) {
      this.analyser.getByteFrequencyData(this.freqArray);
      this.analyser.getByteTimeDomainData(this.waveArray);
    } else if (this.activeBackend === 'youtube' && this.isPlaying) {
      // BPM-locked reactive envelope while official embed video streams audio
      const t = performance.now() / 1000;
      const beatsPerSec = this.currentTrackBpm / 60;
      const beatPhase = (t * beatsPerSec) % 1;
      const kickEnv = Math.exp(-beatPhase * 5.2);

      for (let i = 0; i < len; i++) {
        const norm = i / len;
        const bassWeight = Math.max(0, 1 - norm * 3.2) * kickEnv * 190;
        const harmonic =
          (Math.sin(t * 7.5 + i * 0.25) * 0.5 + 0.5) * 95 * (1 - norm * 0.65) +
          (Math.cos(t * 13.0 - i * 0.14) * 0.5 + 0.5) * 45;
        this.freqArray[i] = Math.min(255, Math.max(0, Math.round(bassWeight + harmonic * this.volume)));

        const waveVal =
          128 +
          Math.sin(t * 18 + i * 0.18) * 34 * kickEnv +
          Math.cos(t * 42 + i * 0.35) * 16;
        this.waveArray[i] = Math.min(255, Math.max(0, Math.round(waveVal)));
      }
    } else {
      this.freqArray.fill(0);
      this.waveArray.fill(128);
    }

    let bassSum = 0;
    const bassCount = Math.floor(len * 0.15);
    for (let i = 0; i < bassCount; i++) {
      bassSum += this.freqArray[i];
    }
    const bass = bassCount > 0 ? bassSum / bassCount / 255 : 0;

    let midSum = 0;
    const midCount = Math.floor(len * 0.45);
    for (let i = bassCount; i < bassCount + midCount; i++) {
      midSum += this.freqArray[i];
    }
    const mid = midCount > 0 ? midSum / midCount / 255 : 0;

    let trebleSum = 0;
    const trebleCount = len - (bassCount + midCount);
    for (let i = bassCount + midCount; i < len; i++) {
      trebleSum += this.freqArray[i];
    }
    const treble = trebleCount > 0 ? trebleSum / trebleCount / 255 : 0;

    const level = bass * 0.5 + mid * 0.3 + treble * 0.2;

    return {
      frequencies: this.freqArray,
      waveformData: this.waveArray,
      bass,
      mid,
      treble,
      level
    };
  }
}

export const sharedAudioEngine = new AudioEngine();
