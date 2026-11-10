/**
 * Sonacast Audio Engine
 * High-performance Web Audio API controller supporting:
 * 1. Real-time media streaming via HTMLAudioElement + AnalyserNode (with crossOrigin = anonymous)
 * 2. Real-time 512-bin FFT frequency and waveform extraction
 * 3. Procedural multi-oscillator polyphonic synthesizer fallback
 * 4. Local custom audio file streaming (Blob / File / URL.createObjectURL)
 */

export interface SpectrumData {
  frequencies: Uint8Array<ArrayBuffer>;
  waveformData: Uint8Array<ArrayBuffer>;
  bass: number;
  mid: number;
  treble: number;
  level: number;
}

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private gainNode: GainNode | null = null;
  private audioElement: HTMLAudioElement | null = null;
  private mediaSourceNode: MediaElementAudioSourceNode | null = null;

  private isSynthesizing = false;
  private synthInterval: number | null = null;
  private currentTrackBpm = 120;
  private isPlaying = false;
  private currentTime = 0;
  private duration = 180;
  private volume = 0.85;

  private freqArray: Uint8Array<ArrayBuffer> = new Uint8Array(new ArrayBuffer(256));
  private waveArray: Uint8Array<ArrayBuffer> = new Uint8Array(new ArrayBuffer(256));

  private onTimeUpdateCallbacks: Set<(time: number) => void> = new Set();
  private onStateChangeCallbacks: Set<(playing: boolean) => void> = new Set();

  constructor() {
    // Initialized on user interaction
  }

  private initContext() {
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

      // Create persistent HTMLAudioElement
      this.audioElement = new Audio();
      this.audioElement.crossOrigin = 'anonymous';
      this.audioElement.preload = 'auto';

      try {
        this.mediaSourceNode = this.ctx.createMediaElementSource(this.audioElement);
        this.mediaSourceNode.connect(this.analyser);
      } catch {
        // Fallback if media element source fails
      }

      this.audioElement.addEventListener('timeupdate', () => {
        if (this.audioElement && !this.isSynthesizing) {
          this.currentTime = this.audioElement.currentTime;
          this.notifyTime();
        }
      });

      this.audioElement.addEventListener('ended', () => {
        this.pause();
      });

      this.audioElement.addEventListener('durationchange', () => {
        if (this.audioElement && this.audioElement.duration && !isNaN(this.audioElement.duration)) {
          this.duration = this.audioElement.duration;
        }
      });
    }

    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.gainNode && this.ctx) {
      this.gainNode.gain.setValueAtTime(this.volume, this.ctx.currentTime);
    }
    if (this.audioElement) {
      this.audioElement.volume = this.volume;
    }
  }

  public getVolume(): number {
    return this.volume;
  }

  public subscribeTimeUpdate(callback: (time: number) => void) {
    this.onTimeUpdateCallbacks.add(callback);
    return () => this.onTimeUpdateCallbacks.delete(callback);
  }

  public subscribeStateChange(callback: (playing: boolean) => void) {
    this.onStateChangeCallbacks.add(callback);
    return () => this.onStateChangeCallbacks.delete(callback);
  }

  public playTrack(duration: number, bpm = 120, audioUrl?: string) {
    this.initContext();
    this.duration = duration;
    this.currentTrackBpm = bpm;

    if (audioUrl && this.audioElement) {
      this.stopProceduralSynthesizer();
      this.audioElement.src = audioUrl;
      this.audioElement.currentTime = 0;
      this.audioElement
        .play()
        .then(() => {
          this.isPlaying = true;
          this.notifyState();
        })
        .catch(() => {
          // If network / CORS blocked, seamlessly fall back to procedural synth
          this.isPlaying = true;
          this.startProceduralSynthesizer();
          this.notifyState();
        });
    } else {
      if (this.audioElement) {
        this.audioElement.pause();
      }
      this.isPlaying = true;
      this.startProceduralSynthesizer();
      this.notifyState();
    }
  }

  public pause() {
    this.isPlaying = false;
    if (this.audioElement) {
      this.audioElement.pause();
    }
    this.stopProceduralSynthesizer();
    this.notifyState();
  }

  public resume() {
    if (!this.isPlaying) {
      this.initContext();
      this.isPlaying = true;

      if (this.audioElement && this.audioElement.src && !this.isSynthesizing) {
        this.audioElement
          .play()
          .then(() => {
            this.notifyState();
          })
          .catch(() => {
            this.startProceduralSynthesizer();
            this.notifyState();
          });
      } else {
        this.startProceduralSynthesizer();
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
    this.currentTime = Math.max(0, Math.min(this.duration, seconds));
    if (this.audioElement && this.audioElement.src && !this.isSynthesizing) {
      try {
        this.audioElement.currentTime = this.currentTime;
      } catch {
        // Safe seek fallback
      }
    }
    this.notifyTime();
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

  /**
   * Generates rich harmonic procedural chords, basslines, and beats
   * when playing without an external audio URL or in offline mode.
   */
  private startProceduralSynthesizer() {
    if (this.isSynthesizing) return;
    this.isSynthesizing = true;

    const intervalMs = Math.round((60 / this.currentTrackBpm) * 500); // 8th note
    let step = 0;

    const bassNotes = [110.0, 110.0, 130.81, 146.83, 164.81, 130.81, 98.0, 110.0];
    const chordNotes = [
      [220.0, 261.63, 329.63],
      [174.61, 220.0, 261.63],
      [196.0, 246.94, 293.66],
      [164.81, 196.0, 246.94]
    ];

    this.synthInterval = window.setInterval(() => {
      if (!this.isPlaying || !this.ctx || !this.analyser) return;

      this.currentTime += intervalMs / 1000;
      if (this.currentTime >= this.duration) {
        this.currentTime = 0;
      }
      this.notifyTime();

      const now = this.ctx.currentTime;

      // Bass oscillator
      const bassOsc = this.ctx.createOscillator();
      const bassGain = this.ctx.createGain();
      bassOsc.type = 'sawtooth';
      const note = bassNotes[step % bassNotes.length];
      bassOsc.frequency.setValueAtTime(note, now);

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(450, now);
      filter.Q.setValueAtTime(4, now);

      bassGain.gain.setValueAtTime(0.24, now);
      bassGain.gain.exponentialRampToValueAtTime(0.001, now + (intervalMs / 1000) * 0.9);

      bassOsc.connect(filter);
      filter.connect(bassGain);
      bassGain.connect(this.analyser);

      bassOsc.start(now);
      bassOsc.stop(now + intervalMs / 1000);

      // Pad chord chords
      if (step % 2 === 0) {
        const chordIndex = Math.floor(step / 8) % chordNotes.length;
        const currentChord = chordNotes[chordIndex];
        currentChord.forEach((freq, idx) => {
          if (!this.ctx || !this.analyser) return;
          const padOsc = this.ctx.createOscillator();
          const padGain = this.ctx.createGain();
          padOsc.type = 'triangle';
          padOsc.frequency.setValueAtTime(freq * 1.5, now);

          padGain.gain.setValueAtTime(0.08 / (idx + 1), now);
          padGain.gain.exponentialRampToValueAtTime(0.0005, now + 0.6);

          padOsc.connect(padGain);
          padGain.connect(this.analyser);

          padOsc.start(now);
          padOsc.stop(now + 0.65);
        });
      }

      // Kick impact
      if (step % 4 === 0) {
        const kickOsc = this.ctx.createOscillator();
        const kickGain = this.ctx.createGain();
        kickOsc.type = 'sine';
        kickOsc.frequency.setValueAtTime(140, now);
        kickOsc.frequency.exponentialRampToValueAtTime(38, now + 0.12);

        kickGain.gain.setValueAtTime(0.35, now);
        kickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

        kickOsc.connect(kickGain);
        kickGain.connect(this.analyser);

        kickOsc.start(now);
        kickOsc.stop(now + 0.25);
      }

      step++;
    }, intervalMs);
  }

  private stopProceduralSynthesizer() {
    this.isSynthesizing = false;
    if (this.synthInterval !== null) {
      clearInterval(this.synthInterval);
      this.synthInterval = null;
    }
  }

  private notifyTime() {
    this.onTimeUpdateCallbacks.forEach((cb) => cb(this.currentTime));
  }

  private notifyState() {
    this.onStateChangeCallbacks.forEach((cb) => cb(this.isPlaying));
  }

  public getSpectrum(): SpectrumData {
    if (!this.analyser) {
      return {
        frequencies: this.freqArray,
        waveformData: this.waveArray,
        bass: 0,
        mid: 0,
        treble: 0,
        level: 0
      };
    }

    this.analyser.getByteFrequencyData(this.freqArray);
    this.analyser.getByteTimeDomainData(this.waveArray);

    const len = this.freqArray.length;
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
