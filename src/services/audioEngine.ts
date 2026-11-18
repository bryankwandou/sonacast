/**
 * Sonacast Audio Engine
 * Zero-cutoff 100% full-length playback controller supporting:
 * 1. Bundled 100% Studio Master MP3 & Local File playback via HTMLAudioElement + Web Audio FFT AnalyserNode
 * 2. Official Full-Length streaming via documented YouTube IFrame Player API with multi-candidate error failover
 */

import type { EqPreset } from '../types';

export interface SpectrumData {
  frequencies: Uint8Array<ArrayBuffer>;
  waveformData: Uint8Array<ArrayBuffer>;
  bass: number;
  mid: number;
  treble: number;
  level: number;
}

export type AudioBackendType = 'none' | 'html5' | 'youtube';

const EQ_GAIN_PRESETS: Record<EqPreset, [number, number, number]> = {
  flat: [0, 0, 0],
  bass: [6.5, -1, 1.5],
  vocal: [-2, 5.5, 2.5],
  club: [5, 1.5, 4.5],
  acoustic: [2, 2.5, 3]
};

interface YTPlayerInstance {
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead?: boolean) => void;
  loadVideoById: (
    videoIdOrOptions: string | { videoId: string; startSeconds?: number }
  ) => void;
  setVolume: (volume: number) => void;
  unMute?: () => void;
  setPlaybackRate?: (rate: number) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  getPlayerState?: () => number;
  destroy?: () => void;
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
  private compressorNode: DynamicsCompressorNode | null = null;
  private gainNode: GainNode | null = null;
  private bypassGainNode: GainNode | null = null;
  private vocalOutGainNode: GainNode | null = null;
  private lowFilter: BiquadFilterNode | null = null;
  private midFilter: BiquadFilterNode | null = null;
  private highFilter: BiquadFilterNode | null = null;
  private audioElement: HTMLAudioElement | null = null;
  private mediaSourceNode: MediaElementAudioSourceNode | null = null;

  private eqPreset: EqPreset = 'flat';
  private playbackRate = 1;
  private crossfadeSeconds = 2;
  private normalizationEnabled = true;
  private vocalReductionEnabled = false;

  private activeBackend: AudioBackendType = 'none';
  private ytHostElement: HTMLElement | null = null;
  private ytPlayer: YTPlayerInstance | null = null;
  private ytReady = false;
  private ytApiPromise: Promise<void> | null = null;
  private ytApiStartedAt = 0;
  private ytPollInterval: number | null = null;
  private html5PollInterval: number | null = null;
  private ytWatchdogTimer: number | null = null;
  private ytResumeCheckTimer: number | null = null;
  private ytFadeTimer: number | null = null;
  private wakeRecoverTimer: number | null = null;
  private candidateIds: string[] = [];
  private candidateIndex = 0;
  private playGeneration = 0;
  private ytPlayerGen = 0;
  private ytTrackTransitionUntil = 0;
  private lastPauseCalledAt = 0;
  private lastEndedGeneration = -1;

  private lastAudioUrl: string | undefined = undefined;
  private streamAudioElement: HTMLAudioElement | null = null;
  private usingPassthroughStream = false;
  private isLiveStream = false;
  private fallbackStreamUrl: string | undefined = undefined;
  private currentTrackBpm = 120;
  private isPlaying = false;
  private wasPlayingBeforeSleep = false;
  private currentTime = 0;
  private duration = 210;
  private volume = 0.85;
  private lowCpuMode = false;
  private isDocumentHidden = false;
  private lastHtml5NotifyAt = 0;

  private freqArray: Uint8Array<ArrayBuffer> = new Uint8Array(new ArrayBuffer(256));
  private waveArray: Uint8Array<ArrayBuffer> = new Uint8Array(new ArrayBuffer(256));

  private onTimeUpdateCallbacks: Set<(time: number) => void> = new Set();
  private onStateChangeCallbacks: Set<(playing: boolean) => void> = new Set();
  private onTrackEndedCallbacks: Set<() => void> = new Set();
  private onDurationChangeCallbacks: Set<(duration: number) => void> = new Set();
  private onErrorCallbacks: Set<(message: string) => void> = new Set();
  private onVideoIdCallbacks: Set<(videoId: string) => void> = new Set();
  private onYtVisualReadyCallbacks: Set<(ready: boolean) => void> = new Set();
  private currentYtVideoId = '';
  private ytVisualReady = false;
  private ytVisualGraceTimer: number | null = null;
  private ytNearEndLastPos = -1;
  private ytNearEndStallSince = 0;
  private ytMaxPosSeen = 0;
  private html5LastPos = -1;
  private html5StallSince = 0;
  private audioBlobCache = new Map<string, string>();
  private audioBlobPromises = new Map<string, Promise<string | null>>();
  private audioBlobAbortControllers = new Map<string, AbortController>();
  private audioBlobPrefetchTimer: number | null = null;
  private blobRecoverInFlight = false;
  private html5PlayPending = false;
  private pendingHtml5SeekSeconds: number | null = null;
  private suppressPauseUntilMs = 0;
  private transitionKeepaliveTimer: number | null = null;
  private keepaliveOsc: OscillatorNode | null = null;
  private keepaliveGain: GainNode | null = null;
  private keepaliveAudioEl: HTMLAudioElement | null = null;
  private keepaliveWavUrl: string | null = null;
  private pendingYtSeekSeconds: number | null = null;
  private ytBgPauseRecoverCount = 0;
  private ytWallAnchorMs = 0;
  private ytWallAnchorPos = 0;

  constructor() {
    if (typeof document !== 'undefined') {
      this.isDocumentHidden = document.visibilityState === 'hidden';

      document.addEventListener('visibilitychange', () => {
        this.isDocumentHidden = document.visibilityState === 'hidden';
        if (this.isDocumentHidden) {
          if (this.isPlaying) {
            this.wasPlayingBeforeSleep = true;
            this.startTransitionKeepalive(0);
          }
          if (this.activeBackend === 'youtube' && this.isPlaying) {
            this.startYouTubePoll();
          } else if (this.activeBackend === 'html5' && this.isPlaying) {
            this.startHtml5Poll();
          }
          return;
        }
        if (this.activeBackend === 'youtube' && this.isPlaying) {
          this.stopTransitionKeepalive();
        }
        this.scheduleWakeRecovery();
      });

      document.addEventListener('freeze', () => {
        if (this.isPlaying) {
          this.wasPlayingBeforeSleep = true;
        }
        this.stopYouTubePoll();
        this.stopHtml5Poll();
        this.clearYouTubeWatchdog();
        this.clearYouTubeResumeCheck();
      });

      document.addEventListener('resume', () => {
        this.isDocumentHidden = document.visibilityState === 'hidden';
        this.scheduleWakeRecovery();
      });
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('pageshow', () => {
        this.isDocumentHidden =
          typeof document !== 'undefined' ? document.visibilityState === 'hidden' : false;
        this.scheduleWakeRecovery();
      });
      window.addEventListener('focus', () => {
        this.isDocumentHidden =
          typeof document !== 'undefined' ? document.visibilityState === 'hidden' : false;
        this.scheduleWakeRecovery();
      });
      window.addEventListener('online', () => {
        this.scheduleWakeRecovery();
      });
    }
  }

  private scheduleWakeRecovery() {
    if (typeof window === 'undefined') return;
    if (this.wakeRecoverTimer !== null) {
      clearTimeout(this.wakeRecoverTimer);
    }
    this.wakeRecoverTimer = window.setTimeout(() => {
      this.wakeRecoverTimer = null;
      this.reconcileAfterWake();
    }, 140);
  }

  private reconcileAfterWake() {
    if (typeof document !== 'undefined') {
      this.isDocumentHidden = document.visibilityState === 'hidden';
    }

    // Clear a stalled YouTube API script promise if laptop slept offline mid-load
    if (
      this.ytApiPromise &&
      !(window.YT && typeof window.YT.Player === 'function') &&
      Date.now() - this.ytApiStartedAt > 4000
    ) {
      this.ytApiPromise = null;
    }

    if (this.activeBackend === 'html5') {
      const activeEl = this.getActiveHtml5Element();
      if (!activeEl) return;
      if (
        !this.usingPassthroughStream &&
        this.ctx &&
        (this.ctx.state === 'suspended' || (this.ctx.state as string) === 'interrupted')
      ) {
        this.ctx.resume().catch(() => {});
      }
      if (
        !this.isLiveStream &&
        (activeEl.ended ||
          (activeEl.duration &&
            isFinite(activeEl.duration) &&
            activeEl.duration >= 10 &&
            activeEl.currentTime >= activeEl.duration - 0.3))
      ) {
        this.completeCurrentTrack(this.playGeneration);
        return;
      }
      if ((this.isPlaying || this.wasPlayingBeforeSleep) && activeEl.paused && !activeEl.ended) {
        this.resume(true, true);
        return;
      }
      if (!this.isPlaying && !activeEl.paused && !activeEl.ended) {
        this.isPlaying = true;
        this.notifyState();
      }
      return;
    }

    if (this.activeBackend === 'youtube') {
      let ytAlive = Boolean(this.ytPlayer && this.ytReady);
      let ytState: number | undefined;

      if (ytAlive && this.ytPlayer) {
        try {
          ytState = this.ytPlayer.getPlayerState?.();
          const ytPos = this.ytPlayer.getCurrentTime?.();
          if (typeof ytPos === 'number' && isFinite(ytPos) && ytPos >= 0) {
            this.ytMaxPosSeen = Math.max(this.ytMaxPosSeen, ytPos);
            if (Math.abs(ytPos - this.currentTime) > 1.5) {
              this.currentTime = this.duration > 0 ? Math.min(ytPos, this.duration) : ytPos;
              this.notifyTime();
            }
          }
        } catch {
          ytAlive = false;
        }
      }

      if (
        (this.isPlaying || this.wasPlayingBeforeSleep) &&
        (ytState === 0 ||
          (this.duration >= 30 && Math.max(this.currentTime, this.ytMaxPosSeen) >= this.duration - 1.5))
      ) {
        this.completeCurrentTrack(this.playGeneration);
        return;
      }

      if (!ytAlive) {
        this.ytReady = false;
        this.ytPlayer = null;
        if ((this.isPlaying || this.wasPlayingBeforeSleep) && this.candidateIds.length > 0) {
          this.playYouTubeTrack(
            this.candidateIds,
            this.duration,
            this.currentTrackBpm,
            Math.max(0, Math.floor(this.currentTime))
          );
        } else if (this.isPlaying) {
          this.isPlaying = false;
          this.notifyState();
        }
        return;
      }

      if (this.isPlaying || this.wasPlayingBeforeSleep) {
        this.startYouTubePoll();
        // Recover if YouTube iframe fell into unstarted/paused/cued limbo across OS sleep
        if (typeof ytState === 'number' && ytState !== 1 && ytState !== 3) {
          this.resume(true, true);
        }
      } else if (!this.isPlaying && ytState === 1) {
        this.isPlaying = true;
        this.notifyState();
        this.startYouTubePoll();
      }
    }
  }

  public setLowCpuMode(enabled: boolean) {
    this.lowCpuMode = Boolean(enabled);
    if (this.activeBackend === 'youtube' && this.isPlaying) {
      this.startYouTubePoll();
    } else if (this.activeBackend === 'html5' && this.isPlaying) {
      this.startHtml5Poll();
    }
  }

  public isLowCpuModeEnabled(): boolean {
    return this.lowCpuMode;
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
      this.gainNode.gain.value = 1;

      this.compressorNode = this.ctx.createDynamicsCompressor();
      this.compressorNode.threshold.value = -18;
      this.compressorNode.knee.value = 12;
      this.compressorNode.ratio.value = 3.5;
      this.compressorNode.attack.value = 0.005;
      this.compressorNode.release.value = 0.18;

      this.bypassGainNode = this.ctx.createGain();
      this.bypassGainNode.gain.value = 1;

      this.vocalOutGainNode = this.ctx.createGain();
      this.vocalOutGainNode.gain.value = 0;

      this.lowFilter = this.ctx.createBiquadFilter();
      this.lowFilter.type = 'lowshelf';
      this.lowFilter.frequency.value = 110;

      this.midFilter = this.ctx.createBiquadFilter();
      this.midFilter.type = 'peaking';
      this.midFilter.frequency.value = 1100;
      this.midFilter.Q.value = 0.85;

      this.highFilter = this.ctx.createBiquadFilter();
      this.highFilter.type = 'highshelf';
      this.highFilter.frequency.value = 4600;

      this.bypassGainNode.connect(this.lowFilter);
      this.vocalOutGainNode.connect(this.lowFilter);
      this.lowFilter.connect(this.midFilter);
      this.midFilter.connect(this.highFilter);
      this.highFilter.connect(this.compressorNode);
      this.compressorNode.connect(this.analyser);
      this.analyser.connect(this.gainNode);
      this.gainNode.connect(this.ctx.destination);
      this.applyEqFilters();
      this.applyDspSettings();

      this.freqArray = new Uint8Array(new ArrayBuffer(this.analyser.frequencyBinCount));
      this.waveArray = new Uint8Array(new ArrayBuffer(this.analyser.frequencyBinCount));

      this.audioElement = new Audio();
      this.audioElement.crossOrigin = 'anonymous';
      this.audioElement.preload = 'auto';
      this.audioElement.loop = false;
      this.audioElement.volume = this.volume;
      this.audioElement.playbackRate = this.playbackRate;

      try {
        this.mediaSourceNode = this.ctx.createMediaElementSource(this.audioElement);
        this.mediaSourceNode.connect(this.bypassGainNode);

        // Stereo center-channel attenuation (L-R / R-L) + sub-200Hz bass preservation
        const splitter = this.ctx.createChannelSplitter(2);
        const merger = this.ctx.createChannelMerger(2);
        const invertRight = this.ctx.createGain();
        invertRight.gain.value = -1;
        const invertLeft = this.ctx.createGain();
        invertLeft.gain.value = -1;
        const bassKeepFilter = this.ctx.createBiquadFilter();
        bassKeepFilter.type = 'lowpass';
        bassKeepFilter.frequency.value = 200;
        const bassKeepGain = this.ctx.createGain();
        bassKeepGain.gain.value = 0.68;

        this.mediaSourceNode.connect(splitter);
        splitter.connect(merger, 0, 0);
        splitter.connect(invertRight, 1);
        invertRight.connect(merger, 0, 0);

        splitter.connect(merger, 1, 1);
        splitter.connect(invertLeft, 0);
        invertLeft.connect(merger, 0, 1);

        merger.connect(this.vocalOutGainNode);

        this.mediaSourceNode.connect(bassKeepFilter);
        bassKeepFilter.connect(bassKeepGain);
        bassKeepGain.connect(this.vocalOutGainNode);
      } catch {
        // Safe fallback if browser blocks media source attachment
      }

      this.ctx.addEventListener('statechange', () => {
        if (!this.ctx || this.usingPassthroughStream) return;
        const st = this.ctx.state as string;
        if (this.activeBackend === 'html5' && (st === 'suspended' || st === 'interrupted')) {
          if (this.isPlaying && this.wasPlayingBeforeSleep && performance.now() - this.lastPauseCalledAt > 1200) {
            this.ctx.resume().catch(() => {});
            return;
          }
          if (this.audioElement && this.audioElement.paused && this.isPlaying) {
            this.isPlaying = false;
            this.notifyState();
          }
        }
      });

      this.audioElement.addEventListener('timeupdate', () => {
        if (this.activeBackend !== 'html5' || this.usingPassthroughStream || !this.audioElement || !this.isPlaying) return;
        this.currentTime = this.audioElement.currentTime;
        const now = performance.now();
        const minInterval = this.lowCpuMode || this.isDocumentHidden ? 350 : 90;
        if (now - this.lastHtml5NotifyAt >= minInterval) {
          this.lastHtml5NotifyAt = now;
          this.notifyTime();
        }
      });

      this.audioElement.addEventListener('play', () => {
        if (this.activeBackend === 'html5' && !this.usingPassthroughStream) {
          this.startHtml5Poll();
        }
      });

      this.audioElement.addEventListener('pause', () => {
        if (!this.usingPassthroughStream && performance.now() >= this.suppressPauseUntilMs) {
          this.stopHtml5Poll();
        }
      });

      this.audioElement.addEventListener('playing', () => {
        if (this.activeBackend !== 'html5' || this.usingPassthroughStream) return;
        this.suppressPauseUntilMs = 0;
        this.html5PlayPending = false;
        this.startTransitionKeepalive(0);
        if (this.ctx && this.ctx.state !== 'running') {
          this.ctx.resume().catch(() => {});
        }
        if (!this.isPlaying) {
          this.isPlaying = true;
          this.notifyState();
        }
        const activeUrl = this.lastAudioUrl ? this.isSameOriginAudioFile(this.lastAudioUrl) : null;
        if (activeUrl && !this.audioBlobCache.has(activeUrl) && this.audioBlobPrefetchTimer === null) {
          const playingGen = this.playGeneration;
          this.audioBlobPrefetchTimer = window.setTimeout(() => {
            this.audioBlobPrefetchTimer = null;
            if (
              playingGen === this.playGeneration &&
              this.activeBackend === 'html5' &&
              !this.usingPassthroughStream &&
              this.lastAudioUrl &&
              this.isSameOriginAudioFile(this.lastAudioUrl) === activeUrl
            ) {
              void this.prefetchSameOriginAudioBlob(activeUrl);
            }
          }, 2000);
        }
      });

      this.audioElement.addEventListener('pause', () => {
        if (performance.now() < this.suppressPauseUntilMs) {
          return;
        }
        if (this.activeBackend !== 'html5' || this.usingPassthroughStream || !this.audioElement || this.audioElement.ended) return;
        if (this.isPlaying) {
          this.isPlaying = false;
          this.notifyState();
        }
      });

      this.audioElement.addEventListener('error', () => {
        if (this.activeBackend !== 'html5' || this.usingPassthroughStream) return;
        if (this.lastAudioUrl && !this.lastAudioUrl.startsWith('blob:')) {
          this.tryPassthroughStreamFallback(
            this.lastAudioUrl,
            this.playGeneration,
            this.isLiveStream ? 0 : this.currentTime
          );
          return;
        }
        if (this.candidateIds.length > 0) {
          this.playYouTubeTrack(
            this.candidateIds,
            this.duration,
            this.currentTrackBpm,
            this.currentTime
          );
          return;
        }
        if (this.isPlaying) {
          this.isPlaying = false;
          this.notifyState();
        }
        this.notifyError('Audio stream interrupted after sleep. Press Play to reconnect.');
      });

      const syncHtml5Duration = () => {
        if (
          this.activeBackend === 'html5' &&
          !this.usingPassthroughStream &&
          !this.isLiveStream &&
          this.audioElement &&
          this.audioElement.duration &&
          isFinite(this.audioElement.duration) &&
          this.audioElement.duration > 0 &&
          this.audioElement.duration < 86400
        ) {
          const realDur = Math.floor(this.audioElement.duration);
          if (realDur >= 10 && Math.abs(realDur - this.duration) >= 1) {
            this.duration = realDur;
            this.notifyDurationChange();
          }
          if (this.pendingHtml5SeekSeconds !== null && this.audioElement.readyState >= 1) {
            const target = Math.max(
              0,
              Math.min(this.audioElement.duration - 0.15, this.pendingHtml5SeekSeconds)
            );
            this.pendingHtml5SeekSeconds = null;
            try {
              this.audioElement.currentTime = target;
              this.currentTime = target;
              this.html5LastPos = target;
              this.html5StallSince = performance.now();
              this.notifyTime();
            } catch {
              // Ignore seek failure
            }
          }
        }
      };

      this.audioElement.addEventListener('loadedmetadata', syncHtml5Duration);
      this.audioElement.addEventListener('durationchange', syncHtml5Duration);

      this.audioElement.addEventListener('ended', () => {
        const genAtEnd = this.playGeneration;
        if (this.activeBackend !== 'html5' || this.usingPassthroughStream || this.isLiveStream) return;
        this.completeCurrentTrack(genAtEnd);
      });
    }

    if (this.ctx.state === 'suspended' || (this.ctx.state as string) === 'interrupted') {
      this.ctx.resume().catch(() => {});
    }
  }

  private loadYouTubeApi(): Promise<void> {
    if (window.YT && typeof window.YT.Player === 'function') {
      return Promise.resolve();
    }
    if (this.ytApiPromise) {
      if (Date.now() - this.ytApiStartedAt < 6200) {
        return this.ytApiPromise;
      }
      this.ytApiPromise = null;
    }

    this.ytApiStartedAt = Date.now();
    this.ytApiPromise = new Promise<void>((resolve, reject) => {
      let settled = false;
      let pollId: number | null = null;
      let timeoutId: number | null = null;

      const finishResolve = () => {
        if (settled) return;
        settled = true;
        if (pollId !== null) clearInterval(pollId);
        if (timeoutId !== null) clearTimeout(timeoutId);
        resolve();
      };

      const finishReject = (err: Error) => {
        if (settled) return;
        settled = true;
        if (pollId !== null) clearInterval(pollId);
        if (timeoutId !== null) clearTimeout(timeoutId);
        this.ytApiPromise = null;
        reject(err);
      };

      const prevReady = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        if (prevReady) prevReady();
        finishResolve();
      };

      const existing = document.querySelector('script[src="https://www.youtube.com/iframe_api"]');
      if (existing && !(window.YT && typeof window.YT.Player === 'function')) {
        // Remove stale script node that may have stalled across sleep/offline transition
        existing.remove();
      }

      if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
        const script = document.createElement('script');
        script.src = 'https://www.youtube.com/iframe_api';
        script.async = true;
        script.onerror = () => finishReject(new Error('Failed to load YouTube IFrame API'));
        document.head.appendChild(script);
      }

      pollId = window.setInterval(() => {
        if (window.YT && typeof window.YT.Player === 'function') {
          finishResolve();
        }
      }, 150);

      timeoutId = window.setTimeout(() => {
        if (window.YT && typeof window.YT.Player === 'function') {
          finishResolve();
        } else {
          finishReject(new Error('Timed out loading YouTube IFrame API'));
        }
      }, 5500);
    });

    return this.ytApiPromise;
  }

  private clearYouTubeWatchdog() {
    if (this.ytWatchdogTimer !== null) {
      clearTimeout(this.ytWatchdogTimer);
      this.ytWatchdogTimer = null;
    }
  }

  private clearYouTubeResumeCheck() {
    if (this.ytResumeCheckTimer !== null) {
      clearTimeout(this.ytResumeCheckTimer);
      this.ytResumeCheckTimer = null;
    }
  }

  private armYouTubeResumeCheck(gen: number, expectedPos: number, allowRebuild = true) {
    this.clearYouTubeResumeCheck();
    const checkDelayMs = this.isDocumentHidden ? 3800 : 1800;
    this.ytResumeCheckTimer = window.setTimeout(() => {
      this.ytResumeCheckTimer = null;
      if (gen !== this.playGeneration || this.activeBackend !== 'youtube' || !this.isPlaying) {
        return;
      }
      let alive = Boolean(this.ytPlayer && this.ytReady);
      let state: number | undefined;
      let curPos = expectedPos;
      if (alive && this.ytPlayer) {
        try {
          state = this.ytPlayer.getPlayerState?.();
          const reportedPos = this.ytPlayer.getCurrentTime?.();
          if (typeof reportedPos === 'number' && isFinite(reportedPos)) {
            curPos = reportedPos;
          }
        } catch {
          alive = false;
        }
      }
      // Healthy playing (1) or active buffering (3)
      if (alive && (state === 1 || state === 3)) {
        return;
      }
      if (allowRebuild && this.candidateIds.length > 0) {
        this.playYouTubeTrack(
          this.candidateIds,
          this.duration,
          this.currentTrackBpm,
          Math.max(0, Math.floor(curPos || this.currentTime))
        );
      } else {
        this.isPlaying = false;
        this.wasPlayingBeforeSleep = false;
        this.notifyState();
      }
    }, checkDelayMs);
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
    }, 5500);
  }

  private advanceToNextCandidate(gen: number): boolean {
    if (gen !== this.playGeneration || this.activeBackend !== 'youtube') return false;
    this.candidateIndex += 1;
    if (this.candidateIndex < this.candidateIds.length && this.ytPlayer && this.ytReady) {
      const nextId = this.candidateIds[this.candidateIndex];
      const resumeSec = this.currentTime >= 2 && this.currentTime < Math.max(0, this.duration - 4)
        ? Math.floor(this.currentTime)
        : 0;
      try {
        this.ytPlayerGen = gen;
        this.ytTrackTransitionUntil = performance.now() + 4000;
        this.setYtVisualReady(false);
        this.armYtVisualGraceTimer(gen);
        this.notifyVideoId(nextId);
        this.ytPlayer.loadVideoById(
          resumeSec > 0 ? { videoId: nextId, startSeconds: resumeSec } : nextId
        );
        this.ytPlayer.playVideo();
        this.armYouTubeWatchdog(gen);
        return true;
      } catch {
        // Fall through to error stop
      }
    }
    this.clearYouTubeWatchdog();
    this.clearYouTubeResumeCheck();
    this.clearYtVisualGraceTimer();
    this.setYtVisualReady(false);
    this.isPlaying = false;
    this.wasPlayingBeforeSleep = false;
    this.stopYouTubePoll();
    this.notifyState();
    this.notifyError('Selected stream candidate unavailable for embedding. Try another search result.');
    return false;
  }

  private clearYouTubeFade() {
    if (this.ytFadeTimer !== null) {
      clearInterval(this.ytFadeTimer);
      this.ytFadeTimer = null;
    }
  }

  private applyYouTubeFadeIn(gen: number) {
    this.clearYouTubeFade();
    const targetVol = Math.round(this.volume * 100);
    if (!this.ytPlayer || !this.ytReady) return;
    if (this.crossfadeSeconds <= 0 || targetVol <= 5) {
      try {
        this.ytPlayer.setVolume(targetVol);
      } catch {
        // Ignore player volume sync errors
      }
      return;
    }
    const rampMs = Math.min(3000, this.crossfadeSeconds * 1000);
    const startAt = performance.now();
    const minVol = Math.max(8, Math.round(targetVol * 0.18));
    try {
      this.ytPlayer.setVolume(minVol);
    } catch {
      return;
    }
    this.ytFadeTimer = window.setInterval(() => {
      if (gen !== this.playGeneration || this.activeBackend !== 'youtube' || !this.ytPlayer || !this.ytReady) {
        this.clearYouTubeFade();
        return;
      }
      const elapsed = performance.now() - startAt;
      const ratio = Math.min(1, Math.max(0, elapsed / rampMs));
      const nextVol = Math.round(minVol + (targetVol - minVol) * ratio);
      try {
        this.ytPlayer.setVolume(nextVol);
      } catch {
        this.clearYouTubeFade();
        return;
      }
      if (ratio >= 1) {
        this.clearYouTubeFade();
      }
    }, 120);
  }

  private ensureKeepaliveAudioUrl(): string | null {
    if (this.keepaliveWavUrl) return this.keepaliveWavUrl;
    if (typeof Blob === 'undefined' || typeof URL === 'undefined') return null;
    try {
      const sampleCount = 4000;
      const dataSize = sampleCount * 2;
      const buf = new ArrayBuffer(44 + dataSize);
      const view = new DataView(buf);
      const writeStr = (offset: number, s: string) => {
        for (let i = 0; i < s.length; i += 1) view.setUint8(offset + i, s.charCodeAt(i));
      };
      writeStr(0, 'RIFF');
      view.setUint32(4, 36 + dataSize, true);
      writeStr(8, 'WAVE');
      writeStr(12, 'fmt ');
      view.setUint32(16, 16, true);
      view.setUint16(20, 1, true);
      view.setUint16(22, 1, true);
      view.setUint32(24, 8000, true);
      view.setUint32(28, 16000, true);
      view.setUint16(32, 2, true);
      view.setUint16(34, 16, true);
      writeStr(36, 'data');
      view.setUint32(40, dataSize, true);
      const blob = new Blob([buf], { type: 'audio/wav' });
      this.keepaliveWavUrl = URL.createObjectURL(blob);
      return this.keepaliveWavUrl;
    } catch {
      return null;
    }
  }

  private startTransitionKeepalive(maxMs = 10000) {
    if (typeof window === 'undefined') return;
    if (this.transitionKeepaliveTimer !== null) {
      clearTimeout(this.transitionKeepaliveTimer);
      this.transitionKeepaliveTimer = null;
    }
    try {
      if (!this.keepaliveAudioEl && typeof Audio !== 'undefined') {
        const wavUrl = this.ensureKeepaliveAudioUrl();
        if (wavUrl) {
          const el = new Audio(wavUrl);
          el.loop = true;
          el.volume = 0.01;
          this.keepaliveAudioEl = el;
        }
      }
      if (this.keepaliveAudioEl && this.keepaliveAudioEl.paused) {
        this.keepaliveAudioEl.play().catch(() => {});
      }
    } catch {
      // Safe fallback when Audio element keepalive is blocked
    }
    if (!this.keepaliveOsc) {
      try {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!this.ctx && AudioCtx) {
          this.ctx = new AudioCtx();
        }
        if (this.ctx) {
          if (this.ctx.state !== 'running') {
            this.ctx.resume().catch(() => {});
          }
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.frequency.value = 1;
          gain.gain.value = 0.00005;
          osc.connect(gain);
          gain.connect(this.ctx.destination);
          osc.start();
          this.keepaliveOsc = osc;
          this.keepaliveGain = gain;
        }
      } catch {
        // Safe fallback when AudioContext is restricted
      }
    }
    if (maxMs > 0) {
      this.transitionKeepaliveTimer = window.setTimeout(() => {
        if (this.activeBackend !== 'youtube' || !this.isPlaying) {
          this.stopTransitionKeepalive();
        }
      }, maxMs);
    }
  }

  private stopTransitionKeepalive() {
    if (this.transitionKeepaliveTimer !== null) {
      clearTimeout(this.transitionKeepaliveTimer);
      this.transitionKeepaliveTimer = null;
    }
    if (this.keepaliveAudioEl) {
      try {
        this.keepaliveAudioEl.pause();
      } catch {
        // Ignore pause errors
      }
    }
    if (this.keepaliveOsc) {
      try {
        this.keepaliveOsc.stop();
        this.keepaliveOsc.disconnect();
      } catch {
        // Ignore already stopped oscillator
      }
      this.keepaliveOsc = null;
    }
    if (this.keepaliveGain) {
      try {
        this.keepaliveGain.disconnect();
      } catch {
        // Ignore disconnect errors
      }
      this.keepaliveGain = null;
    }
  }

  public prepareTrackTransition(duration: number, bpm = 120) {
    ++this.playGeneration;
    this.activeBackend = 'none';
    this.pendingYtSeekSeconds = null;
    this.stopHtml5Poll();
    this.stopYouTubePoll();
    this.clearYouTubeWatchdog();
    this.clearYouTubeResumeCheck();
    this.clearYouTubeFade();
    this.stopHtml5Backend();
    this.stopYouTubeBackend();
    this.duration = Math.max(60, duration);
    this.currentTrackBpm = bpm;
    this.currentTime = 0;
    this.ytWallAnchorMs = 0;
    this.ytWallAnchorPos = 0;
    this.ytBgPauseRecoverCount = 0;
    this.wasPlayingBeforeSleep = true;
    this.isPlaying = true;
    this.startTransitionKeepalive(0);
    this.notifyTime();
    this.notifyState();
  }

  private completeCurrentTrack(expectedGen: number) {
    if (expectedGen !== this.playGeneration || this.lastEndedGeneration === expectedGen) {
      return;
    }
    this.lastEndedGeneration = expectedGen;
    this.stopHtml5Poll();
    this.stopYouTubePoll();
    this.clearYouTubeWatchdog();
    this.clearYouTubeResumeCheck();
    this.clearYouTubeFade();
    this.startTransitionKeepalive(8000);
    this.isPlaying = false;
    this.currentTime = this.duration;
    this.notifyTime();
    this.notifyState();
    this.notifyTrackEnded();
  }

  private async waitForVisibleYouTubeHost(): Promise<void> {
    if (!this.ytHostElement || this.isDocumentHidden) return;
    const deadline = performance.now() + 80;
    while (performance.now() < deadline) {
      const rect = this.ytHostElement.getBoundingClientRect();
      if (rect.width >= 2 && rect.height >= 2) {
        return;
      }
      await new Promise<void>((res) => window.setTimeout(res, 16));
    }
  }

  private stopYouTubeBackend() {
    this.clearYouTubeWatchdog();
    this.clearYouTubeResumeCheck();
    this.clearYouTubeFade();
    this.stopYouTubePoll();
    this.ytNearEndLastPos = -1;
    this.ytNearEndStallSince = 0;
    this.setYtVisualReady(false);
    if (this.ytPlayer && this.ytReady) {
      try {
        this.ytPlayer.pauseVideo();
      } catch {
        // Ignore if player not yet initialized
      }
    }
  }

  private getActiveHtml5Element(): HTMLAudioElement | null {
    return this.usingPassthroughStream ? this.streamAudioElement : this.audioElement;
  }

  private ensureStreamAudioElement(): HTMLAudioElement | null {
    if (typeof Audio === 'undefined') return null;
    if (this.streamAudioElement) return this.streamAudioElement;

    const el = new Audio();
    // Deliberately omit crossOrigin so live radio/podcast CDNs without permissive CORS headers stream cleanly.
    el.preload = 'none';
    el.loop = false;
    el.volume = this.volume;
    el.playbackRate = this.playbackRate;

    el.addEventListener('timeupdate', () => {
      if (this.activeBackend !== 'html5' || !this.usingPassthroughStream || !this.isPlaying) return;
      this.currentTime = el.currentTime;
      const now = performance.now();
      const minInterval = this.lowCpuMode || this.isDocumentHidden ? 350 : 90;
      if (now - this.lastHtml5NotifyAt >= minInterval) {
        this.lastHtml5NotifyAt = now;
        this.notifyTime();
      }
    });

    el.addEventListener('play', () => {
      if (this.activeBackend === 'html5' && this.usingPassthroughStream) {
        this.startHtml5Poll();
      }
    });

    el.addEventListener('playing', () => {
      if (this.activeBackend !== 'html5' || !this.usingPassthroughStream) return;
      if (!this.isPlaying) {
        this.isPlaying = true;
        this.notifyState();
      }
    });

    el.addEventListener('pause', () => {
      if (!this.usingPassthroughStream) return;
      this.stopHtml5Poll();
      if (this.activeBackend === 'html5' && !el.ended && this.isPlaying) {
        this.isPlaying = false;
        this.notifyState();
      }
    });

    const syncStreamDuration = () => {
      if (
        this.activeBackend === 'html5' &&
        this.usingPassthroughStream &&
        !this.isLiveStream &&
        el.duration &&
        isFinite(el.duration) &&
        el.duration > 0 &&
        el.duration < 86400
      ) {
        const realDur = Math.floor(el.duration);
        if (realDur >= 10 && Math.abs(realDur - this.duration) >= 1) {
          this.duration = realDur;
          this.notifyDurationChange();
        }
      }
    };

    el.addEventListener('loadedmetadata', syncStreamDuration);
    el.addEventListener('durationchange', syncStreamDuration);

    el.addEventListener('ended', () => {
      const genAtEnd = this.playGeneration;
      if (this.activeBackend !== 'html5' || !this.usingPassthroughStream || this.isLiveStream) return;
      this.completeCurrentTrack(genAtEnd);
    });

    el.addEventListener('error', () => {
      if (this.activeBackend !== 'html5' || !this.usingPassthroughStream) return;
      const fallbackUrl = this.fallbackStreamUrl;
      if (fallbackUrl) {
        const resolvedFallback = new URL(fallbackUrl, window.location.href).href;
        if (el.src !== resolvedFallback) {
          this.fallbackStreamUrl = undefined;
          this.lastAudioUrl = fallbackUrl;
          el.src = fallbackUrl;
          el.load();
          el.play().catch(() => {});
          return;
        }
      }
      if (this.candidateIds.length > 0) {
        this.playYouTubeTrack(
          this.candidateIds,
          this.duration,
          this.currentTrackBpm,
          this.isLiveStream ? 0 : this.currentTime
        );
        return;
      }
      if (this.isPlaying) {
        this.isPlaying = false;
        this.notifyState();
      }
      this.notifyError('Live stream unavailable or temporarily offline. Select another station or mix.');
    });

    this.streamAudioElement = el;
    return el;
  }

  private tryPassthroughStreamFallback(url: string, gen: number, fromOffset = 0): boolean {
    if (gen !== this.playGeneration) return false;
    const streamEl = this.ensureStreamAudioElement();
    if (!streamEl) return false;

    this.usingPassthroughStream = true;
    this.lastAudioUrl = url;
    if (this.audioElement) {
      try {
        this.audioElement.pause();
        this.audioElement.removeAttribute('src');
      } catch {
        // Ignore cleanup errors
      }
    }

    streamEl.volume = this.volume;
    streamEl.playbackRate = this.playbackRate;
    const resolvedSrc = new URL(url, window.location.href).href;
    if (streamEl.src !== resolvedSrc) {
      streamEl.src = url;
    }
    if (!this.isLiveStream && fromOffset > 1) {
      try {
        streamEl.currentTime = fromOffset;
      } catch {
        // Seek once metadata is ready
      }
    }

    streamEl
      .play()
      .then(() => {
        if (gen !== this.playGeneration) return;
        this.isPlaying = true;
        this.wasPlayingBeforeSleep = true;
        this.startHtml5Poll();
        this.notifyState();
      })
      .catch(() => {
        if (gen !== this.playGeneration) return;
        const fallbackUrl = this.fallbackStreamUrl;
        if (fallbackUrl && fallbackUrl !== url) {
          this.fallbackStreamUrl = undefined;
          this.tryPassthroughStreamFallback(fallbackUrl, gen, fromOffset);
          return;
        }
        if (this.candidateIds.length > 0) {
          this.playYouTubeTrack(this.candidateIds, Math.max(60, this.duration), this.currentTrackBpm);
        } else {
          this.isPlaying = false;
          this.wasPlayingBeforeSleep = false;
          this.notifyState();
          this.notifyError('Stream playback blocked or offline. Click Play to retry.');
        }
      });

    return true;
  }

  private isSameOriginAudioFile(rawUrl: string): string | null {
    if (typeof window === 'undefined' || !rawUrl || rawUrl.startsWith('blob:')) return null;
    try {
      const parsed = new URL(rawUrl, window.location.href);
      if (parsed.origin === window.location.origin && parsed.pathname.startsWith('/audio/')) {
        return parsed.href;
      }
    } catch {
      // Ignore malformed URL
    }
    return null;
  }

  private clearHtml5BlobPrefetch(keepUrl: string | null = null) {
    if (this.audioBlobPrefetchTimer !== null) {
      clearTimeout(this.audioBlobPrefetchTimer);
      this.audioBlobPrefetchTimer = null;
    }
    for (const [url, controller] of this.audioBlobAbortControllers.entries()) {
      if (!keepUrl || url !== keepUrl) {
        controller.abort();
        this.audioBlobAbortControllers.delete(url);
        this.audioBlobPromises.delete(url);
      }
    }
  }

  private prefetchSameOriginAudioBlob(resolvedUrl: string): Promise<string | null> {
    const cached = this.audioBlobCache.get(resolvedUrl);
    if (cached) return Promise.resolve(cached);
    const inFlight = this.audioBlobPromises.get(resolvedUrl);
    if (inFlight) return inFlight;

    const controller = new AbortController();
    this.audioBlobAbortControllers.set(resolvedUrl, controller);

    const task = fetch(resolvedUrl, { cache: 'no-store', signal: controller.signal })
      .then((res) => (res.ok ? res.blob() : null))
      .then((blob) => {
        if (!blob || blob.size < 1024) return null;
        if (this.audioBlobCache.size >= 6) {
          const oldestKey = this.audioBlobCache.keys().next().value;
          if (oldestKey) {
            const oldUrl = this.audioBlobCache.get(oldestKey);
            this.audioBlobCache.delete(oldestKey);
            if (oldUrl) URL.revokeObjectURL(oldUrl);
          }
        }
        const blobUrl = URL.createObjectURL(blob);
        this.audioBlobCache.set(resolvedUrl, blobUrl);
        return blobUrl;
      })
      .catch(() => null)
      .finally(() => {
        if (this.audioBlobAbortControllers.get(resolvedUrl) === controller) {
          this.audioBlobAbortControllers.delete(resolvedUrl);
        }
        if (this.audioBlobPromises.get(resolvedUrl) === task) {
          this.audioBlobPromises.delete(resolvedUrl);
        }
      });

    this.audioBlobPromises.set(resolvedUrl, task);
    return task;
  }

  private async recoverStalledHtml5Seek(expectedGen: number, targetSeconds: number) {
    if (
      this.blobRecoverInFlight ||
      expectedGen !== this.playGeneration ||
      this.activeBackend !== 'html5' ||
      this.isLiveStream ||
      this.usingPassthroughStream ||
      !this.audioElement ||
      !this.lastAudioUrl
    ) {
      return;
    }

    const sameOriginUrl = this.isSameOriginAudioFile(this.lastAudioUrl);
    if (sameOriginUrl) {
      const startedAt = performance.now();
      const shouldResume = this.isPlaying || this.html5PlayPending;
      this.blobRecoverInFlight = true;
      try {
        const blobUrl = await this.prefetchSameOriginAudioBlob(sameOriginUrl);
        if (
          blobUrl &&
          expectedGen === this.playGeneration &&
          this.activeBackend === 'html5' &&
          !this.usingPassthroughStream &&
          this.audioElement
        ) {
          const clamped = Math.max(0, Math.min(this.duration > 0 ? this.duration - 0.15 : targetSeconds, targetSeconds));
          const stillPlayingIntent = shouldResume && this.lastPauseCalledAt < startedAt;
          if (this.audioElement.src !== blobUrl) {
            this.suppressPauseUntilMs = stillPlayingIntent ? performance.now() + 250 : 0;
            this.audioElement.src = blobUrl;
            this.audioElement.load();
          }
          try {
            this.audioElement.currentTime = clamped;
          } catch {
            // Seek applied cleanly when loaded
          }
          this.html5LastPos = clamped;
          this.html5StallSince = performance.now();
          if (stillPlayingIntent) {
            this.isPlaying = true;
            this.wasPlayingBeforeSleep = true;
            this.notifyState();
            this.audioElement.play().catch(() => {
              this.suppressPauseUntilMs = 0;
            });
          } else {
            this.suppressPauseUntilMs = 0;
          }
          return;
        }
      } finally {
        this.blobRecoverInFlight = false;
      }
    }

    if (expectedGen === this.playGeneration && this.candidateIds.length > 0) {
      this.playYouTubeTrack(
        this.candidateIds,
        this.duration,
        this.currentTrackBpm,
        Math.max(0, Math.floor(targetSeconds))
      );
    }
  }

  private stopHtml5Backend() {
    this.stopHtml5Poll();
    this.clearHtml5BlobPrefetch();
    this.usingPassthroughStream = false;
    this.blobRecoverInFlight = false;
    this.html5PlayPending = false;
    this.pendingHtml5SeekSeconds = null;
    this.html5LastPos = -1;
    this.html5StallSince = 0;
    if (this.audioElement) {
      try {
        this.audioElement.pause();
      } catch {
        // Ignore
      }
    }
    if (this.streamAudioElement) {
      try {
        this.streamAudioElement.pause();
      } catch {
        // Ignore
      }
    }
  }

  private startHtml5Poll() {
    this.stopHtml5Poll();
    const intervalMs = this.isDocumentHidden ? 1000 : this.lowCpuMode ? 350 : 100;
    const pollGen = this.playGeneration;
    this.html5LastPos = this.getActiveHtml5Element()?.currentTime ?? -1;
    this.html5StallSince = performance.now();
    this.html5PollInterval = window.setInterval(() => {
      const activeEl = this.getActiveHtml5Element();
      if (this.activeBackend !== 'html5' || !activeEl || pollGen !== this.playGeneration) {
        if (pollGen !== this.playGeneration) this.stopHtml5Poll();
        return;
      }
      if (!this.isLiveStream && activeEl.ended) {
        this.completeCurrentTrack(pollGen);
        return;
      }
      if (!this.isPlaying && !this.html5PlayPending) {
        return;
      }
      const nowMs = performance.now();
      if (activeEl.paused) {
        const stalledMs = nowMs - this.html5StallSince;
        if (
          stalledMs >= 1800 &&
          !this.blobRecoverInFlight &&
          performance.now() - this.lastPauseCalledAt > 1200
        ) {
          this.html5StallSince = nowMs;
          if (this.usingPassthroughStream) {
            activeEl.play().catch(() => {
              this.resume(true, true);
            });
          } else {
            void this.recoverStalledHtml5Seek(pollGen, this.currentTime);
          }
        }
        return;
      }
      if (
        !this.isLiveStream &&
        activeEl.duration &&
        isFinite(activeEl.duration) &&
        activeEl.duration > 0 &&
        activeEl.duration < 86400
      ) {
        const realDur = Math.floor(activeEl.duration);
        if (realDur >= 10 && Math.abs(realDur - this.duration) >= 1) {
          this.duration = realDur;
          this.notifyDurationChange();
        }
        if (activeEl.duration >= 10 && activeEl.currentTime >= activeEl.duration - 0.25) {
          this.completeCurrentTrack(pollGen);
          return;
        }
        if (this.html5LastPos < 0 || Math.abs(activeEl.currentTime - this.html5LastPos) >= 0.08) {
          this.html5LastPos = activeEl.currentTime;
          this.html5StallSince = nowMs;
        } else {
          const stalledMs = nowMs - this.html5StallSince;
          if (activeEl.duration >= 10 && activeEl.currentTime >= activeEl.duration - 4.5 && stalledMs >= 2000) {
            this.completeCurrentTrack(pollGen);
            return;
          }
          if (stalledMs >= 1400 && !this.blobRecoverInFlight) {
            void this.recoverStalledHtml5Seek(pollGen, activeEl.currentTime);
          }
        }
      }
      if (!this.isPlaying || this.pendingHtml5SeekSeconds !== null) {
        return;
      }
      this.currentTime =
        !this.isLiveStream && this.duration > 0
          ? Math.min(activeEl.currentTime, this.duration)
          : activeEl.currentTime;
      if (!this.isLiveStream && this.duration >= 30 && this.currentTime >= this.duration - 0.35 && activeEl.ended) {
        this.completeCurrentTrack(pollGen);
        return;
      }
      this.lastHtml5NotifyAt = nowMs;
      this.notifyTime();
    }, intervalMs);
  }

  private stopHtml5Poll() {
    if (this.html5PollInterval !== null) {
      clearInterval(this.html5PollInterval);
      this.html5PollInterval = null;
    }
  }

  private startYouTubePoll() {
    this.stopYouTubePoll();
    const intervalMs = this.isDocumentHidden ? 1000 : this.lowCpuMode ? 350 : 100;
    const pollGen = this.playGeneration;
    this.ytPollInterval = window.setInterval(() => {
      if (pollGen !== this.playGeneration || this.activeBackend !== 'youtube') {
        this.stopYouTubePoll();
        return;
      }
      if (!this.ytPlayer || !this.ytReady) {
        return;
      }
      try {
        const ytState = this.ytPlayer.getPlayerState?.();
        if (ytState === 0) {
          this.completeCurrentTrack(pollGen);
          return;
        }
        if (
          this.isDocumentHidden &&
          this.isPlaying &&
          this.wasPlayingBeforeSleep &&
          performance.now() - this.lastPauseCalledAt > 1500 &&
          (ytState === 2 || ytState === 5 || ytState === -1) &&
          this.ytBgPauseRecoverCount < 4
        ) {
          this.ytBgPauseRecoverCount += 1;
          try {
            this.ytPlayer.unMute?.();
            this.ytPlayer.playVideo();
          } catch {
            // Ignore blocked background kick
          }
        }
        const realDur = this.ytPlayer.getDuration?.();
        if (typeof realDur === 'number' && isFinite(realDur) && realDur >= 30) {
          const rounded = Math.floor(realDur);
          if (Math.abs(rounded - this.duration) >= 1) {
            this.duration = rounded;
            this.notifyDurationChange();
          }
        }
        const pos = this.ytPlayer.getCurrentTime();
        if (typeof pos === 'number' && isFinite(pos) && pos >= 0) {
          if (pos > 0.4 && this.ytWallAnchorMs === 0) {
            this.ytWallAnchorMs = Date.now();
            this.ytWallAnchorPos = pos;
          } else if (pos > this.ytMaxPosSeen + 0.5) {
            this.ytWallAnchorMs = Date.now();
            this.ytWallAnchorPos = pos;
          }
          this.ytMaxPosSeen = Math.max(this.ytMaxPosSeen, pos);
          const effectivePos = Math.max(pos, this.ytMaxPosSeen >= this.duration - 3.5 && pos < 1 ? this.ytMaxPosSeen : pos);
          this.currentTime = this.duration > 0 ? Math.min(effectivePos, this.duration) : effectivePos;
          this.notifyTime();
          if (pos >= 0.3) {
            this.clearYouTubeWatchdog();
            this.startTransitionKeepalive(0);
          }
          const wallEstimatedPos =
            this.isDocumentHidden && this.ytWallAnchorMs > 0
              ? this.ytWallAnchorPos + ((Date.now() - this.ytWallAnchorMs) / 1000) * this.playbackRate
              : 0;
          const ytEndedNearRealDur =
            typeof realDur === 'number' &&
            isFinite(realDur) &&
            realDur >= 30 &&
            pos >= realDur - 0.6;
          if (
            this.isPlaying &&
            this.duration >= 30 &&
            (effectivePos >= this.duration - 0.6 ||
              ytEndedNearRealDur ||
              (wallEstimatedPos >= this.duration + 0.5 && (pos <= 1 || pos >= this.duration - 3.5)) ||
              ((ytState === 2 || ytState === 3 || ytState === 5 || ytState === -1) &&
                effectivePos >= this.duration - 2.5))
          ) {
            this.completeCurrentTrack(pollGen);
            return;
          }
          if (this.isPlaying && this.duration >= 30 && effectivePos >= this.duration - 4.0) {
            const nowMs = performance.now();
            if (this.ytNearEndStallSince === 0 || effectivePos - this.ytNearEndLastPos >= 0.3) {
              this.ytNearEndLastPos = effectivePos;
              this.ytNearEndStallSince = nowMs;
            } else if (nowMs - this.ytNearEndStallSince >= 2200) {
              this.completeCurrentTrack(pollGen);
              return;
            }
          } else {
            this.ytNearEndLastPos = -1;
            this.ytNearEndStallSince = 0;
          }
        }
        if (!this.isPlaying) {
          return;
        }
      } catch {
        // Safe poll fallback
      }
    }, intervalMs);
  }

  private stopYouTubePoll() {
    if (this.ytPollInterval !== null) {
      clearInterval(this.ytPollInterval);
      this.ytPollInterval = null;
    }
  }

  public async playYouTubeTrack(
    candidateIds: string[],
    duration: number,
    bpm = 120,
    startSeconds = 0
  ) {
    const validIds = Array.from(new Set(candidateIds.filter((id) => Boolean(id))));
    if (validIds.length === 0) {
      this.notifyError('No verified full-length stream IDs available for this track.');
      return;
    }

    const gen = ++this.playGeneration;
    const clampedStart = Math.max(0, Math.floor(startSeconds));
    this.suppressPauseUntilMs = 0;
    this.activeBackend = 'youtube';
    this.lastAudioUrl = undefined;
    this.usingPassthroughStream = false;
    this.isLiveStream = false;
    this.fallbackStreamUrl = undefined;
    this.stopHtml5Backend();
    this.clearYouTubeWatchdog();
    this.clearYouTubeResumeCheck();
    this.stopYouTubePoll();

    this.candidateIds = validIds;
    this.candidateIndex = 0;
    this.duration = Math.max(60, duration);
    this.currentTrackBpm = bpm;
    this.currentTime = clampedStart;
    this.ytMaxPosSeen = clampedStart;
    this.ytWallAnchorMs = Date.now();
    this.ytWallAnchorPos = clampedStart;
    this.ytBgPauseRecoverCount = 0;
    this.lastPauseCalledAt = 0;
    this.ytNearEndLastPos = -1;
    this.ytNearEndStallSince = 0;
    this.isPlaying = true;
    this.wasPlayingBeforeSleep = true;
    const carryPendingSeek = this.pendingYtSeekSeconds;
    this.pendingYtSeekSeconds = clampedStart > 0 ? clampedStart : carryPendingSeek;
    this.startTransitionKeepalive(0);
    this.notifyTime();
    this.notifyState();

    try {
      await Promise.all([this.loadYouTubeApi(), this.waitForVisibleYouTubeHost()]);
    } catch {
      if (gen === this.playGeneration) {
        this.isPlaying = false;
        this.wasPlayingBeforeSleep = false;
        this.notifyState();
        this.notifyError('Official stream player could not initialize. Click Play to retry.');
      }
      return;
    }

    if (gen !== this.playGeneration) return;

    const firstVideoId = validIds[0];
    this.notifyVideoId(firstVideoId);
    this.setYtVisualReady(false);
    this.armYtVisualGraceTimer(gen);

    if (this.ytPlayer && this.ytReady) {
      try {
        const immediateSeek =
          this.pendingYtSeekSeconds !== null ? this.pendingYtSeekSeconds : clampedStart;
        this.pendingYtSeekSeconds = null;
        if (this.duration >= 30 && immediateSeek >= this.duration - 0.8) {
          this.completeCurrentTrack(gen);
          return;
        }
        this.ytPlayerGen = gen;
        this.ytTrackTransitionUntil = performance.now() + 2600;
        this.applyYouTubeFadeIn(gen);
        this.ytPlayer.loadVideoById(
          immediateSeek > 0 ? { videoId: firstVideoId, startSeconds: immediateSeek } : firstVideoId
        );
        this.ytPlayer.unMute?.();
        this.ytPlayer.setPlaybackRate?.(this.playbackRate);
        this.ytPlayer.playVideo();
        this.startYouTubePoll();
        this.armYouTubeWatchdog(gen);
        return;
      } catch {
        // Rebuild player below if previous iframe was detached across sleep
      }
    }

    if (!this.ytHostElement) {
      this.isPlaying = false;
      this.wasPlayingBeforeSleep = false;
      this.notifyState();
      this.notifyError('Stream host container not mounted.');
      return;
    }

    if (this.ytPlayer) {
      try {
        this.ytPlayer.destroy?.();
      } catch {
        // Ignore stale iframe destroy error
      }
      this.ytPlayer = null;
    }

    this.ytHostElement.innerHTML = '';
    const targetNode = document.createElement('div');
    targetNode.id = 'sonacast-yt-player-frame';
    this.ytHostElement.appendChild(targetNode);

    const YT = window.YT;
    if (!YT || !YT.Player) {
      this.isPlaying = false;
      this.notifyState();
      return;
    }

    const playerVars: Record<string, string | number> = {
      autoplay: 1,
      controls: 1,
      modestbranding: 1,
      rel: 0,
      playsinline: 1,
      iv_load_policy: 3,
      origin: window.location.origin
    };
    if (clampedStart > 0) {
      playerVars.start = clampedStart;
    }

    this.ytReady = false;
    this.ytPlayerGen = gen;
    this.ytTrackTransitionUntil = performance.now() + 2600;
    this.ytPlayer = new YT.Player(targetNode, {
      width: '100%',
      height: '100%',
      videoId: firstVideoId,
      playerVars,
      events: {
        onReady: (event) => {
          const activeGen = this.ytPlayerGen;
          if (activeGen !== this.playGeneration || this.activeBackend !== 'youtube') return;
          this.ytReady = true;
          event.target.unMute?.();
          this.applyYouTubeFadeIn(activeGen);
          try {
            event.target.setPlaybackRate?.(this.playbackRate);
          } catch {
            // Ignore unsupported YT rate
          }
          const ytSeekTarget =
            this.pendingYtSeekSeconds !== null ? this.pendingYtSeekSeconds : clampedStart;
          this.pendingYtSeekSeconds = null;
          if (ytSeekTarget > 0) {
            try {
              event.target.seekTo(ytSeekTarget, true);
            } catch {
              // Ignore pre-start seek error
            }
          }
          event.target.playVideo();
          this.startYouTubePoll();
          this.armYouTubeWatchdog(activeGen);
        },
        onStateChange: (event) => {
          const activeGen = this.ytPlayerGen;
          if (this.activeBackend !== 'youtube' || activeGen !== this.playGeneration) return;
          const state = event.data;
          // 1 = PLAYING, 2 = PAUSED, 0 = ENDED, 5 = CUED
          if (state === 1) {
            if (!this.isPlaying && performance.now() - this.lastPauseCalledAt < 600) {
              try {
                event.target.pauseVideo();
              } catch {
                // Ignore
              }
              return;
            }
            this.isPlaying = true;
            this.wasPlayingBeforeSleep = true;
            this.ytTrackTransitionUntil = 0;
            this.ytBgPauseRecoverCount = 0;
            if (this.pendingYtSeekSeconds !== null) {
              const deferredSeek = this.pendingYtSeekSeconds;
              this.pendingYtSeekSeconds = null;
              if (this.duration >= 30 && deferredSeek >= this.duration - 0.8) {
                this.completeCurrentTrack(activeGen);
                return;
              }
              try {
                event.target.seekTo(deferredSeek, true);
              } catch {
                // Ignore deferred seek error
              }
            }
            this.startTransitionKeepalive(0);
            this.setYtVisualReady(true);
            this.clearYouTubeResumeCheck();
            this.notifyState();
            this.startYouTubePoll();
            try {
              const cur = event.target.getCurrentTime();
              if (typeof cur === 'number' && cur >= 0) {
                this.ytWallAnchorMs = Date.now();
                this.ytWallAnchorPos = cur;
                if (cur >= 0.3) {
                  this.clearYouTubeWatchdog();
                }
              }
              const realDur = event.target.getDuration();
              if (realDur && isFinite(realDur) && realDur >= 30) {
                const rounded = Math.floor(realDur);
                if (Math.abs(rounded - this.duration) >= 1) {
                  this.duration = rounded;
                  this.notifyDurationChange();
                }
              }
            } catch {
              // Ignore
            }
          } else if (state === 5 || state === -1) {
            if (
              this.isPlaying &&
              this.duration >= 30 &&
              (this.ytMaxPosSeen >= this.duration - 3.5 || this.currentTime >= this.duration - 2.5)
            ) {
              this.completeCurrentTrack(activeGen);
              return;
            }
            if (this.isPlaying) {
              try {
                event.target.playVideo();
              } catch {
                // Ignore
              }
            }
          } else if (state === 2) {
            // Ignore transient teardown pause emitted immediately after loadVideoById
            if (this.isPlaying && performance.now() < this.ytTrackTransitionUntil) {
              try {
                event.target.playVideo();
              } catch {
                // Ignore
              }
              return;
            }
            try {
              const curAtPause = event.target.getCurrentTime();
              if (typeof curAtPause === 'number' && isFinite(curAtPause) && curAtPause >= 0) {
                this.ytMaxPosSeen = Math.max(this.ytMaxPosSeen, curAtPause);
              }
              const nearEndReached =
                (typeof curAtPause === 'number' && curAtPause >= this.duration - 2.5) ||
                (this.ytMaxPosSeen >= this.duration - 3.5 &&
                  (typeof curAtPause !== 'number' || curAtPause <= 1.0 || curAtPause >= this.duration - 3.5));
              if (this.isPlaying && this.duration >= 30 && nearEndReached) {
                this.completeCurrentTrack(activeGen);
                return;
              }
            } catch {
              if (this.isPlaying && this.duration >= 30 && this.ytMaxPosSeen >= this.duration - 3.5) {
                this.completeCurrentTrack(activeGen);
                return;
              }
            }
            // In background tabs Chromium may temporarily pause cross-origin YT iframes across track transitions
            if (
              this.isDocumentHidden &&
              this.isPlaying &&
              this.wasPlayingBeforeSleep &&
              performance.now() - this.lastPauseCalledAt > 1200 &&
              this.ytBgPauseRecoverCount < 4
            ) {
              this.ytBgPauseRecoverCount += 1;
              try {
                event.target.unMute?.();
                event.target.playVideo();
              } catch {
                // Fall through if iframe rejects play
              }
              return;
            }
            this.clearYouTubeWatchdog();
            this.clearYouTubeResumeCheck();
            this.clearYouTubeFade();
            this.stopTransitionKeepalive();
            this.setYtVisualReady(true);
            this.isPlaying = false;
            this.stopYouTubePoll();
            this.notifyState();
          } else if (state === 0) {
            this.completeCurrentTrack(activeGen);
          }
        },
        onError: () => {
          const activeGen = this.ytPlayerGen;
          if (this.activeBackend !== 'youtube' || activeGen !== this.playGeneration) return;
          this.clearYouTubeResumeCheck();
          this.advanceToNextCandidate(activeGen);
        }
      }
    });
  }

  public playTrack(
    duration: number,
    bpm = 120,
    audioUrl?: string,
    candidateVideoIds?: string[],
    options?: { isLiveStream?: boolean; fallbackAudioUrl?: string }
  ) {
    if (audioUrl) {
      const gen = ++this.playGeneration;
      this.activeBackend = 'html5';
      this.usingPassthroughStream = false;
      this.isLiveStream = Boolean(options?.isLiveStream);
      this.fallbackStreamUrl = options?.fallbackAudioUrl;
      this.lastPauseCalledAt = 0;
      this.suppressPauseUntilMs = 0;
      this.pendingHtml5SeekSeconds = null;
      const sameOriginAudio = this.isSameOriginAudioFile(audioUrl);
      this.clearHtml5BlobPrefetch(sameOriginAudio);
      this.lastAudioUrl = audioUrl;
      this.candidateIds = candidateVideoIds ? [...candidateVideoIds] : [];
      this.stopYouTubeBackend();
      if (this.streamAudioElement) {
        try {
          this.streamAudioElement.pause();
        } catch {
          // Ignore
        }
      }
      this.initHtml5Context();

      this.duration = this.isLiveStream ? 0 : Math.max(60, duration);
      this.currentTrackBpm = bpm;
      this.currentTime = 0;
      this.wasPlayingBeforeSleep = true;
      this.notifyTime();

      const requiresDirectPassthrough =
        /^https?:\/\//i.test(audioUrl) &&
        /(?:^|\.)(?:rri\.co\.id|anchor\.fm|radioking\.com|listen2myradio\.com)/i.test(
          new URL(audioUrl, window.location.href).hostname
        );
      if (!this.audioElement || requiresDirectPassthrough) {
        this.tryPassthroughStreamFallback(audioUrl, gen, 0);
        return;
      }
      this.audioElement.loop = false;
      this.audioElement.volume = this.volume;
      this.audioElement.playbackRate = this.playbackRate;

      if (this.gainNode && this.ctx) {
        const now = this.ctx.currentTime;
        this.gainNode.gain.cancelScheduledValues(now);
        if (this.crossfadeSeconds > 0 && !this.isLiveStream) {
          const rampSecs = Math.min(4, this.crossfadeSeconds);
          this.gainNode.gain.setValueAtTime(0.08, now);
          this.gainNode.gain.linearRampToValueAtTime(1, now + rampSecs);
        } else {
          this.gainNode.gain.setValueAtTime(1, now);
        }
      }

      const cachedBlobUrl = sameOriginAudio ? this.audioBlobCache.get(sameOriginAudio) : undefined;
      const effectiveAudioSrc = cachedBlobUrl || audioUrl;
      const resolvedEffectiveSrc = new URL(effectiveAudioSrc, window.location.href).href;
      this.suppressPauseUntilMs = performance.now() + 700;
      if (this.audioElement.src !== resolvedEffectiveSrc) {
        this.audioElement.src = effectiveAudioSrc;
        this.audioElement.load();
      }
      this.html5LastPos = 0;
      this.html5StallSince = performance.now();
      this.blobRecoverInFlight = false;
      this.html5PlayPending = true;
      this.isPlaying = true;
      this.wasPlayingBeforeSleep = true;
      this.startTransitionKeepalive(4000);
      this.notifyState();
      this.startHtml5Poll();
      if (!this.isLiveStream) {
        try {
          this.audioElement.currentTime = 0;
        } catch {
          // Ignore before metadata ready
        }
      }

      if (this.ctx && this.ctx.state !== 'running') {
        this.ctx.resume().catch(() => {});
      }

      this.audioElement
        .play()
        .then(() => {
          if (gen !== this.playGeneration) return;
          this.html5PlayPending = false;
          this.isPlaying = true;
          this.notifyState();
        })
        .catch(() => {
          if (gen !== this.playGeneration) return;
          this.html5PlayPending = false;
          if (!this.usingPassthroughStream && !audioUrl.startsWith('blob:')) {
            this.tryPassthroughStreamFallback(audioUrl, gen, 0);
            return;
          }
          if (candidateVideoIds && candidateVideoIds.length > 0) {
            this.playYouTubeTrack(candidateVideoIds, duration, bpm);
          } else {
            this.isPlaying = false;
            this.wasPlayingBeforeSleep = false;
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

  public isPlaybackWedged(): boolean {
    if (!this.isPlaying) return false;
    if (this.activeBackend === 'none') return true;
    if (this.activeBackend === 'html5') {
      const activeEl = this.getActiveHtml5Element();
      if (!activeEl || !activeEl.src) return true;
      if (activeEl.paused || Boolean(activeEl.error)) return true;
      if (!this.usingPassthroughStream && this.ctx && this.ctx.state !== 'running') return true;
      return false;
    }
    if (this.activeBackend === 'youtube') {
      if (!this.ytPlayer || !this.ytReady || this.candidateIds.length === 0) return true;
      try {
        const st = this.ytPlayer.getPlayerState?.();
        if (typeof st === 'number' && st !== 1 && st !== 3) {
          return true;
        }
      } catch {
        return true;
      }
      return false;
    }
    return false;
  }

  public pause() {
    this.lastPauseCalledAt = performance.now();
    this.suppressPauseUntilMs = 0;
    this.html5PlayPending = false;
    this.pendingHtml5SeekSeconds = null;
    this.stopTransitionKeepalive();
    this.clearHtml5BlobPrefetch();
    this.ytTrackTransitionUntil = 0;
    this.ytNearEndLastPos = -1;
    this.ytNearEndStallSince = 0;
    this.isPlaying = false;
    this.wasPlayingBeforeSleep = false;
    this.clearYouTubeWatchdog();
    this.clearYouTubeResumeCheck();
    this.stopYouTubePoll();
    this.stopHtml5Poll();
    const activeEl = this.getActiveHtml5Element();
    if (this.activeBackend === 'html5' && activeEl) {
      try {
        activeEl.pause();
      } catch {
        // Ignore
      }
    } else if (this.activeBackend === 'youtube' && this.ytPlayer && this.ytReady) {
      try {
        this.ytPlayer.pauseVideo();
      } catch {
        // Ignore
      }
    }
    this.stopTransitionKeepalive();
    this.notifyState();
  }

  public resume(forceRecover = false, fromAutoWake = false) {
    if (!forceRecover && this.isPlaying && !this.isPlaybackWedged()) return;
    this.lastPauseCalledAt = 0;
    this.startTransitionKeepalive(0);
    if (this.currentTime < Math.max(1, this.duration - 2)) {
      this.lastEndedGeneration = -1;
    }

    if (!this.usingPassthroughStream && this.ctx && this.ctx.state !== 'running') {
      this.ctx.resume().catch(() => {});
    }

    if (this.activeBackend === 'html5') {
      if (this.usingPassthroughStream) {
        const streamEl = this.ensureStreamAudioElement();
        if (!streamEl) return;
        if ((Boolean(streamEl.error) || !streamEl.src) && this.lastAudioUrl) {
          streamEl.src = this.lastAudioUrl;
          streamEl.load();
        }
        if (!streamEl.src) {
          this.isPlaying = false;
          this.wasPlayingBeforeSleep = false;
          this.notifyState();
          return;
        }
        streamEl
          .play()
          .then(() => {
            this.isPlaying = true;
            this.wasPlayingBeforeSleep = true;
            this.notifyState();
          })
          .catch(() => {
            this.isPlaying = false;
            this.wasPlayingBeforeSleep = false;
            this.notifyState();
          });
        return;
      }

      if (!this.audioElement) {
        this.initHtml5Context();
      }
      const audio = this.audioElement;
      if (!audio) return;

      const needsReload = (Boolean(audio.error) || !audio.src) && Boolean(this.lastAudioUrl);
      if (needsReload && this.lastAudioUrl) {
        const resumeAt = this.isLiveStream ? 0 : Math.max(0, Math.min(this.duration, this.currentTime));
        audio.src = this.lastAudioUrl;
        audio.load();
        if (!this.isLiveStream) {
          try {
            audio.currentTime = resumeAt;
          } catch {
            // Will start near position once metadata loads
          }
        }
      }

      if (!audio.src) {
        this.isPlaying = false;
        this.wasPlayingBeforeSleep = false;
        this.notifyState();
        return;
      }

      audio
        .play()
        .then(() => {
          this.isPlaying = true;
          this.wasPlayingBeforeSleep = true;
          this.notifyState();
        })
        .catch(() => {
          // Retry once by rebinding stream URL in case sleep broke TCP/HTTP range socket
          if (this.lastAudioUrl && !needsReload) {
            const resumeAt = this.isLiveStream ? 0 : Math.max(0, Math.min(this.duration, this.currentTime));
            audio.src = this.lastAudioUrl;
            audio.load();
            if (!this.isLiveStream) {
              try {
                audio.currentTime = resumeAt;
              } catch {
                // Safe fallback
              }
            }
            audio
              .play()
              .then(() => {
                this.isPlaying = true;
                this.wasPlayingBeforeSleep = true;
                this.notifyState();
              })
              .catch(() => {
                if (!fromAutoWake && this.lastAudioUrl && !this.lastAudioUrl.startsWith('blob:')) {
                  this.tryPassthroughStreamFallback(this.lastAudioUrl, this.playGeneration, resumeAt);
                  return;
                }
                if (!fromAutoWake && this.candidateIds.length > 0) {
                  this.playYouTubeTrack(
                    this.candidateIds,
                    this.duration,
                    this.currentTrackBpm,
                    resumeAt
                  );
                } else {
                  this.isPlaying = false;
                  this.wasPlayingBeforeSleep = false;
                  this.notifyState();
                }
              });
            return;
          }

          if (!fromAutoWake && this.candidateIds.length > 0) {
            this.playYouTubeTrack(
              this.candidateIds,
              this.duration,
              this.currentTrackBpm,
              this.currentTime
            );
          } else {
            this.isPlaying = false;
            this.wasPlayingBeforeSleep = false;
            this.notifyState();
          }
        });
      return;
    }

    if (this.activeBackend === 'youtube') {
      if (this.candidateIds.length === 0) {
        this.isPlaying = false;
        this.wasPlayingBeforeSleep = false;
        this.notifyState();
        return;
      }

      const savedPos = Math.max(0, this.currentTime);
      let playerAlive = Boolean(this.ytPlayer && this.ytReady);
      if (playerAlive && this.ytPlayer) {
        try {
          this.ytPlayer.getPlayerState?.();
        } catch {
          playerAlive = false;
        }
      }

      if (!playerAlive || !this.ytPlayer) {
        this.ytReady = false;
        this.ytPlayer = null;
        this.playYouTubeTrack(
          this.candidateIds,
          this.duration,
          this.currentTrackBpm,
          Math.floor(savedPos)
        );
        return;
      }

      try {
        const curPos = this.ytPlayer.getCurrentTime?.() ?? 0;
        if (savedPos > 2 && (!isFinite(curPos) || Math.abs(curPos - savedPos) > 4)) {
          this.ytPlayer.seekTo(savedPos, true);
        }
        this.ytPlayer.playVideo();
        this.isPlaying = true;
        this.wasPlayingBeforeSleep = true;
        this.startYouTubePoll();
        this.notifyState();
        this.armYouTubeResumeCheck(this.playGeneration, savedPos, true);
      } catch {
        this.ytReady = false;
        this.ytPlayer = null;
        this.playYouTubeTrack(
          this.candidateIds,
          this.duration,
          this.currentTrackBpm,
          Math.floor(savedPos)
        );
      }
    }
  }

  public togglePlay() {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.resume(true);
    }
  }

  public seek(seconds: number) {
    if (this.isLiveStream) return;
    const clamped = Math.max(0, Math.min(this.duration, seconds));
    this.currentTime = clamped;
    this.html5LastPos = clamped;
    this.html5StallSince = performance.now();
    this.ytMaxPosSeen = clamped;
    this.ytNearEndLastPos = clamped >= this.duration - 3.5 ? clamped : -1;
    this.ytNearEndStallSince = clamped >= this.duration - 3.5 ? performance.now() : 0;
    if (clamped < Math.max(1, this.duration - 2)) {
      this.lastEndedGeneration = -1;
    }

    if (
      this.activeBackend === 'youtube' &&
      (this.isPlaying || this.wasPlayingBeforeSleep) &&
      this.duration >= 30 &&
      clamped >= this.duration - 0.8
    ) {
      this.notifyTime();
      this.completeCurrentTrack(this.playGeneration);
      return;
    }
    if (
      this.activeBackend === 'none' &&
      this.isPlaying &&
      this.duration >= 30 &&
      clamped >= this.duration - 0.8
    ) {
      this.pendingYtSeekSeconds = clamped;
      this.notifyTime();
      return;
    }
    if (
      this.activeBackend === 'html5' &&
      !this.isLiveStream &&
      (this.isPlaying || this.html5PlayPending) &&
      this.duration >= 10 &&
      clamped >= this.duration - 0.25
    ) {
      this.notifyTime();
      this.completeCurrentTrack(this.playGeneration);
      return;
    }

    const activeEl = this.getActiveHtml5Element();
    if (this.activeBackend === 'html5' && activeEl && activeEl.src) {
      if (
        !this.usingPassthroughStream &&
        this.audioElement &&
        this.lastAudioUrl
      ) {
        const sameOriginUrl = this.isSameOriginAudioFile(this.lastAudioUrl);
        if (sameOriginUrl) {
          const cachedBlobUrl = this.audioBlobCache.get(sameOriginUrl);
          if (cachedBlobUrl && this.audioElement.src !== cachedBlobUrl) {
            const shouldResume = this.isPlaying || this.html5PlayPending;
            this.suppressPauseUntilMs = shouldResume ? performance.now() + 250 : 0;
            this.audioElement.src = cachedBlobUrl;
            this.audioElement.load();
            try {
              this.audioElement.currentTime = clamped;
            } catch {
              this.pendingHtml5SeekSeconds = clamped;
            }
            if (shouldResume) {
              this.isPlaying = true;
              this.wasPlayingBeforeSleep = true;
              this.audioElement.play().catch(() => {
                this.suppressPauseUntilMs = 0;
              });
            } else {
              this.suppressPauseUntilMs = 0;
            }
            this.notifyTime();
            return;
          }
          if (this.audioElement.readyState >= 1) {
            this.pendingHtml5SeekSeconds = null;
            try {
              this.audioElement.currentTime = clamped;
            } catch {
              this.pendingHtml5SeekSeconds = clamped;
            }
          } else {
            this.pendingHtml5SeekSeconds = clamped;
          }
          let isBuffered = false;
          try {
            for (let i = 0; i < this.audioElement.buffered.length; i++) {
              if (
                clamped >= this.audioElement.buffered.start(i) &&
                clamped <= this.audioElement.buffered.end(i) - 0.5
              ) {
                isBuffered = true;
                break;
              }
            }
          } catch {
            // Ignore buffered check error
          }
          if (!cachedBlobUrl && !isBuffered && this.audioElement.readyState >= 1) {
            void this.recoverStalledHtml5Seek(this.playGeneration, clamped);
          }
          this.notifyTime();
          return;
        }
      }
      if (activeEl.readyState >= 1) {
        this.pendingHtml5SeekSeconds = null;
        try {
          activeEl.currentTime = clamped;
        } catch {
          this.pendingHtml5SeekSeconds = clamped;
        }
      } else {
        this.pendingHtml5SeekSeconds = clamped;
      }
    } else if (this.activeBackend === 'youtube') {
      if (this.ytPlayer && this.ytReady) {
        try {
          this.ytPlayer.seekTo(clamped, true);
        } catch {
          this.pendingYtSeekSeconds = clamped;
        }
      } else {
        this.pendingYtSeekSeconds = clamped;
      }
    }

    this.notifyTime();
  }

  public setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.gainNode && this.ctx) {
      this.gainNode.gain.setValueAtTime(1, this.ctx.currentTime);
    }
    if (this.audioElement) {
      this.audioElement.volume = this.volume;
    }
    if (this.streamAudioElement) {
      this.streamAudioElement.volume = this.volume;
    }
    if (this.ytPlayer && this.ytReady) {
      try {
        this.ytPlayer.setVolume(Math.round(this.volume * 100));
      } catch {
        // Ignore
      }
    }
  }

  private applyEqFilters() {
    if (!this.ctx || !this.lowFilter || !this.midFilter || !this.highFilter) return;
    const [lowGain, midGain, highGain] = EQ_GAIN_PRESETS[this.eqPreset] || [0, 0, 0];
    const now = this.ctx.currentTime;
    this.lowFilter.gain.setValueAtTime(lowGain, now);
    this.midFilter.gain.setValueAtTime(midGain, now);
    this.highFilter.gain.setValueAtTime(highGain, now);
  }

  private applyDspSettings() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (this.compressorNode) {
      this.compressorNode.threshold.setTargetAtTime(
        this.normalizationEnabled ? -18 : 0,
        now,
        0.04
      );
      this.compressorNode.ratio.setTargetAtTime(
        this.normalizationEnabled ? 3.5 : 1,
        now,
        0.04
      );
    }
    if (this.bypassGainNode && this.vocalOutGainNode) {
      this.bypassGainNode.gain.setTargetAtTime(
        this.vocalReductionEnabled ? 0 : 1,
        now,
        0.03
      );
      this.vocalOutGainNode.gain.setTargetAtTime(
        this.vocalReductionEnabled ? 0.92 : 0,
        now,
        0.03
      );
    }
  }

  public setNormalization(enabled: boolean) {
    this.normalizationEnabled = enabled;
    this.applyDspSettings();
  }

  public isNormalizationEnabled(): boolean {
    return this.normalizationEnabled;
  }

  public setVocalReduction(enabled: boolean) {
    this.vocalReductionEnabled = enabled;
    this.applyDspSettings();
  }

  public isVocalReductionEnabled(): boolean {
    return this.vocalReductionEnabled;
  }

  public setEqPreset(preset: EqPreset) {
    this.eqPreset = preset;
    this.applyEqFilters();
  }

  public getEqPreset(): EqPreset {
    return this.eqPreset;
  }

  public setPlaybackRate(rate: number) {
    this.playbackRate = Math.max(0.5, Math.min(2, rate));
    if (this.audioElement) {
      this.audioElement.playbackRate = this.playbackRate;
    }
    if (this.streamAudioElement) {
      this.streamAudioElement.playbackRate = this.playbackRate;
    }
    if (this.ytPlayer && this.ytReady) {
      try {
        this.ytPlayer.setPlaybackRate?.(this.playbackRate);
      } catch {
        // Ignore if YT player cannot change speed
      }
    }
  }

  public getPlaybackRate(): number {
    return this.playbackRate;
  }

  public setCrossfadeSeconds(seconds: number) {
    this.crossfadeSeconds = Math.max(0, Math.min(8, seconds));
  }

  public getCrossfadeSeconds(): number {
    return this.crossfadeSeconds;
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

  private clearYtVisualGraceTimer() {
    if (this.ytVisualGraceTimer !== null) {
      clearTimeout(this.ytVisualGraceTimer);
      this.ytVisualGraceTimer = null;
    }
  }

  private setYtVisualReady(ready: boolean) {
    if (ready) this.clearYtVisualGraceTimer();
    if (this.ytVisualReady === ready) return;
    this.ytVisualReady = ready;
    this.onYtVisualReadyCallbacks.forEach((cb) => cb(ready));
  }

  private armYtVisualGraceTimer(gen: number) {
    this.clearYtVisualGraceTimer();
    // Reveal iframe promptly once YT player loads so users are never trapped behind an opaque curtain or unable to click Play
    this.ytVisualGraceTimer = window.setTimeout(() => {
      this.ytVisualGraceTimer = null;
      if (
        gen === this.playGeneration &&
        this.activeBackend === 'youtube' &&
        this.ytPlayer
      ) {
        try {
          const st = this.ytPlayer.getPlayerState?.();
          if (st === 1 || st === 2 || st === 3 || st === 5 || st === -1) {
            this.setYtVisualReady(true);
          }
        } catch {
          if (this.ytReady) {
            this.setYtVisualReady(true);
          }
        }
      }
    }, 900);
  }

  public getYouTubeVisualReady(): boolean {
    return this.ytVisualReady;
  }

  public subscribeYouTubeVisualReady(callback: (ready: boolean) => void) {
    this.onYtVisualReadyCallbacks.add(callback);
    return () => this.onYtVisualReadyCallbacks.delete(callback);
  }

  public subscribeVideoIdChange(callback: (videoId: string) => void) {
    this.onVideoIdCallbacks.add(callback);
    return () => this.onVideoIdCallbacks.delete(callback);
  }

  public getCurrentYouTubeVideoId(): string {
    return this.currentYtVideoId;
  }

  public async switchYouTubeCandidate(
    videoId: string,
    candidateIds: string[],
    duration: number,
    bpm = 120,
    resumeAt?: number
  ): Promise<void> {
    if (!videoId) return;
    const ordered = [videoId, ...candidateIds.filter((id) => id && id !== videoId)];
    const resumeSec =
      typeof resumeAt === 'number' && Number.isFinite(resumeAt)
        ? Math.max(0, Math.floor(resumeAt))
        : Math.max(0, Math.floor(this.currentTime));
    await this.playYouTubeTrack(ordered, duration, bpm, resumeSec);
  }

  private notifyVideoId(videoId: string) {
    this.currentYtVideoId = videoId;
    this.onVideoIdCallbacks.forEach((cb) => cb(videoId));
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

    if (this.lowCpuMode || this.isDocumentHidden || !this.isPlaying) {
      this.freqArray.fill(0);
      this.waveArray.fill(128);
      return {
        frequencies: this.freqArray,
        waveformData: this.waveArray,
        bass: 0,
        mid: 0,
        treble: 0,
        level: 0
      };
    }

    if (
      this.activeBackend === 'html5' &&
      !this.usingPassthroughStream &&
      this.analyser &&
      this.isPlaying
    ) {
      this.analyser.getByteFrequencyData(this.freqArray);
      this.analyser.getByteTimeDomainData(this.waveArray);
    } else if (
      (this.activeBackend === 'youtube' ||
        (this.activeBackend === 'html5' && this.usingPassthroughStream)) &&
      this.isPlaying
    ) {
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
