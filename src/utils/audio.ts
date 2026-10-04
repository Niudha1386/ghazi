/**
 * Courtroom atmospheric sound effects with real MP3 audio asset support
 * and Web Audio API synthesizer fallback.
 */

export interface BackgroundTrack {
  id: string;
  title: string;
  url: string;
}

export const BACKGROUND_TRACKS: BackgroundTrack[] = [
  {
    id: 'vague-dark-2',
    title: 'قطعه اول: دارک و مه‌آلود ۲ (Vague Dark 2)',
    url: 'https://dl.sedatoseda.com/sound/vague-dark%20(2).mp3',
  },
  {
    id: 'vague-dark-4',
    title: 'قطعه دوم: دارک و مه‌آلود ۴ (Vague Dark 4)',
    url: 'https://dl.sedatoseda.com/sound/vague-dark%20(4).mp3',
  },
  {
    id: 'ein-mensch',
    title: 'قطعه سوم: انسان و پروانه (Ein Mensch - Ein Schmetterling)',
    url: 'https://dlw.webahang.ir/music/Track/Ein%20Mensch%20-%20Ein%20Schmetterling%20(128).mp3?_=2',
  },
];

const GAVEL_AUDIO_URL = 'https://sedatoseda.com/wp-content/uploads/gavel-of-justice-124029.mp3';

class SoundController {
  private ctx: AudioContext | null = null;
  private soundEnabled: boolean = true;
  private gavelAudio: HTMLAudioElement | null = null;

  // Background Playlist Audio State (Plays across ALL screens of the game sequentially & loops)
  private bgAudio: HTMLAudioElement | null = null;
  private currentTrackIndex: number = 0;
  private bgMusicVolume: number = 0.5; // 0.0 to 1.0 (50% default)
  private bgMusicEnabled: boolean = true;
  private isBgMusicPlayingState: boolean = false;

  // Dark Lobby Procedural Ambience Generator (Fallback)
  private darkAmbienceGain: GainNode | null = null;
  private darkAmbienceActive: boolean = false;
  private darkAmbienceNodes: Array<{ stop?: (time?: number) => void; disconnect: () => void }> = [];
  private darkAmbienceVolume: number = 0.35;
  private darkAmbienceEnabled: boolean = true;

  constructor() {
    if (typeof window !== 'undefined') {
      try {
        this.gavelAudio = new Audio(GAVEL_AUDIO_URL);
        this.gavelAudio.preload = 'auto';
      } catch (e) {
        console.warn('Could not initialize gavel audio element', e);
      }

      // Aggressive Audio Autoplay Unlocker on ANY user gesture
      const unlockAudio = () => {
        this.initContext();
        if (this.bgMusicEnabled && !this.isBgMusicPlayingState) {
          this.playBgMusic();
        }
      };

      if (typeof window !== 'undefined') {
        ['click', 'pointerdown', 'mousedown', 'touchstart', 'touchend', 'keydown', 'wheel', 'scroll'].forEach((evt) => {
          window.addEventListener(evt, unlockAudio, { passive: true });
        });
      }
    }
  }

  private initContext() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  public setSoundEnabled(enabled: boolean) {
    this.soundEnabled = enabled;
  }

  public isSoundEnabled(): boolean {
    return this.soundEnabled;
  }

  /**
   * Judge's wooden gavel strike (چکش دادگاه)
   * Plays the official audio file and falls back to Web Audio API synthesis if needed.
   */
  public playGavel() {
    if (!this.soundEnabled) return;

    if (this.gavelAudio) {
      try {
        this.gavelAudio.currentTime = 0;
        const playPromise = this.gavelAudio.play();
        if (playPromise !== undefined) {
          playPromise.catch(() => {
            this.playSynthesizedGavel();
          });
          return;
        }
      } catch {
        this.playSynthesizedGavel();
        return;
      }
    }

    this.playSynthesizedGavel();
  }

  private playSynthesizedGavel() {
    this.initContext();
    if (!this.ctx) return;

    const strikes = [0, 0.22, 0.44];
    strikes.forEach((delay, index) => {
      setTimeout(() => {
        this.synthesizeWoodHit(index === 2 ? 1.2 : 1.0);
      }, delay * 1000);
    });
  }

  private synthesizeWoodHit(volumeScale = 1.0) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    // Resonant wooden block
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(45, now + 0.08);

    gain.gain.setValueAtTime(0.7 * volumeScale, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.25);

    // Initial noise impact click
    const bufferSize = this.ctx.sampleRate * 0.04;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.005));
    }

    const whiteNoise = this.ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 800;

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.9 * volumeScale, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);

    whiteNoise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.ctx.destination);

    whiteNoise.start(now);
    whiteNoise.stop(now + 0.05);
  }

  /**
   * Tension heartbeat when suspect is nervous or cornered
   */
  public playHeartbeat() {
    if (!this.soundEnabled) return;
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;

    // First lub
    const osc1 = this.ctx.createOscillator();
    const gain1 = this.ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(65, now);
    osc1.frequency.exponentialRampToValueAtTime(35, now + 0.12);
    gain1.gain.setValueAtTime(0.4, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    osc1.connect(gain1);
    gain1.connect(this.ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.15);

    // Second dub
    const osc2 = this.ctx.createOscillator();
    const gain2 = this.ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(55, now + 0.16);
    osc2.frequency.exponentialRampToValueAtTime(30, now + 0.3);
    gain2.gain.setValueAtTime(0.5, now + 0.16);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
    osc2.connect(gain2);
    gain2.connect(this.ctx.destination);
    osc2.start(now + 0.16);
    osc2.stop(now + 0.33);
  }

  /**
   * Lawyer Objection sting ("اعتراض وکیل!")
   */
  public playObjection() {
    if (!this.soundEnabled) return;
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(440, now + 0.08);
    osc.frequency.exponentialRampToValueAtTime(330, now + 0.25);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 600;

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.35);
  }

  /**
   * Dramatic chord when contradiction or key evidence is revealed
   */
  public playDramaticSting() {
    if (!this.soundEnabled) return;
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const freqs = [110, 130.81, 164.81, 233.08]; // Diminished chord (dramatic tension)

    freqs.forEach((f) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();

      osc.type = 'sawtooth';
      osc.frequency.value = f;

      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

      const filter = this.ctx!.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1200, now);
      filter.frequency.exponentialRampToValueAtTime(300, now + 1.2);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx!.destination);

      osc.start(now);
      osc.stop(now + 1.2);
    });
  }

  /**
   * Paper rustle when inspecting evidence dossiers
   */
  public playPaperRustle() {
    if (!this.soundEnabled) return;
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const bufferSize = this.ctx.sampleRate * 0.15;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = (Math.random() * 2 - 1) * Math.sin((i / bufferSize) * Math.PI);
    }

    const whiteNoise = this.ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(2400, now);
    filter.Q.value = 1.2;

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.12, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    whiteNoise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.ctx.destination);

    whiteNoise.start(now);
    whiteNoise.stop(now + 0.15);
  }

  /* ====================================================================
   * Dark Lobby Ambience (Procedural Atmospheric Drone Soundscape)
   * Plays exclusively in the Courtroom Lobby to set a dark, tense criminal mood.
   * Synthesized via Web Audio API so it works instantaneously offline,
   * without broken external CDN URLs or latency.
   * ==================================================================== */

  public isAmbiencePlaying(): boolean {
    return this.darkAmbienceActive;
  }

  public isAmbienceEnabled(): boolean {
    return this.darkAmbienceEnabled;
  }

  public setAmbienceEnabled(enabled: boolean) {
    this.darkAmbienceEnabled = enabled;
    if (!enabled) {
      this.stopDarkLobbyAmbience();
    }
  }

  public getAmbienceVolume(): number {
    return this.darkAmbienceVolume;
  }

  public setAmbienceVolume(vol: number) {
    this.darkAmbienceVolume = Math.max(0, Math.min(1, vol));
    if (this.ctx && this.darkAmbienceGain && this.darkAmbienceActive) {
      const now = this.ctx.currentTime;
      this.darkAmbienceGain.gain.cancelScheduledValues(now);
      this.darkAmbienceGain.gain.linearRampToValueAtTime(this.darkAmbienceVolume, now + 0.1);
    }
  }

  /**
   * Starts dark, ominous ambient courtroom drone.
   * Safely idempotent: will not stack or duplicate sounds.
   */
  public startDarkLobbyAmbience() {
    if (!this.soundEnabled || !this.darkAmbienceEnabled) return;
    if (this.darkAmbienceActive) return;

    this.initContext();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;

      // Master Ambient Gain Node
      const masterGain = this.ctx.createGain();
      masterGain.gain.setValueAtTime(0.0001, now);
      masterGain.gain.exponentialRampToValueAtTime(Math.max(0.01, this.darkAmbienceVolume), now + 1.8);
      masterGain.connect(this.ctx.destination);
      this.darkAmbienceGain = masterGain;

      const activeNodes: Array<{ stop?: (time?: number) => void; disconnect: () => void }> = [];

      // 1. Deep sub-bass fundamental drone (Dark Ominous Chamber) - 44Hz (Low F/A#)
      const osc1 = this.ctx.createOscillator();
      osc1.type = 'sawtooth';
      osc1.frequency.setValueAtTime(43.65, now); // F1

      // 2. Secondary detuned drone (Minor Second / Minor Third tension) - 51.9Hz / 55Hz
      const osc2 = this.ctx.createOscillator();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(51.91, now); // G#1 / Ab1 detuned minor third interval

      // 3. Sub-bass ground pulse - 32.7Hz (C1)
      const oscSub = this.ctx.createOscillator();
      oscSub.type = 'sine';
      oscSub.frequency.setValueAtTime(32.7, now);

      // Lowpass resonant filter (Dark Room acoustics)
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(140, now);
      filter.Q.setValueAtTime(3.8, now);

      // LFO for slow eerie breathing frequency sweep
      const lfo = this.ctx.createOscillator();
      lfo.frequency.setValueAtTime(0.08, now); // 1 cycle every 12.5 seconds
      const lfoGain = this.ctx.createGain();
      lfoGain.gain.setValueAtTime(60, now); // sweeps between 80Hz and 200Hz
      lfo.connect(lfoGain);
      lfoGain.connect(filter.frequency);

      // Subtle texture noise (Dark vinyl room rumble)
      const bufferSize = this.ctx.sampleRate * 2;
      const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      let lastOut = 0.0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        output[i] = (lastOut + 0.02 * white) / 1.02; // Brown/pink noise filter
        lastOut = output[i];
      }
      const roomNoise = this.ctx.createBufferSource();
      roomNoise.buffer = noiseBuffer;
      roomNoise.loop = true;

      const noiseFilter = this.ctx.createBiquadFilter();
      noiseFilter.type = 'bandpass';
      noiseFilter.frequency.setValueAtTime(110, now);
      noiseFilter.Q.setValueAtTime(1.5, now);

      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(0.06, now);

      roomNoise.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(masterGain);

      // Mix oscillators through the lowpass resonant filter
      const oscGain = this.ctx.createGain();
      oscGain.gain.setValueAtTime(0.22, now);

      osc1.connect(filter);
      osc2.connect(filter);
      oscSub.connect(filter);
      filter.connect(oscGain);
      oscGain.connect(masterGain);

      // Start sound nodes
      osc1.start(now);
      osc2.start(now);
      oscSub.start(now);
      lfo.start(now);
      roomNoise.start(now);

      activeNodes.push(osc1, osc2, oscSub, lfo, roomNoise, masterGain, oscGain, noiseGain, filter, lfoGain, noiseFilter);
      this.darkAmbienceNodes = activeNodes;
      this.darkAmbienceActive = true;
    } catch (e) {
      console.warn('Could not start dark lobby ambience:', e);
      this.darkAmbienceActive = false;
    }
  }

  /**
   * Stops dark lobby ambience smoothly with a gentle fade-out.
   */
  public stopDarkLobbyAmbience() {
    if (!this.darkAmbienceActive) return;
    this.darkAmbienceActive = false;

    if (this.ctx && this.darkAmbienceGain) {
      try {
        const now = this.ctx.currentTime;
        this.darkAmbienceGain.gain.cancelScheduledValues(now);
        this.darkAmbienceGain.gain.setValueAtTime(this.darkAmbienceGain.gain.value, now);
        this.darkAmbienceGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);
      } catch (e) {
        // ignore
      }
    }

    const nodesToClean = [...this.darkAmbienceNodes];
    this.darkAmbienceNodes = [];
    this.darkAmbienceGain = null;

    setTimeout(() => {
      nodesToClean.forEach((node) => {
        try {
          if (node.stop) node.stop();
        } catch {}
        try {
          node.disconnect();
        } catch {}
      });
    }, 650);
  }

  /* ====================================================================
   * Background Music Playlist Controller (Sequential & Infinite Loop)
   * Plays across ALL screens of the game (Lobby, Consultation, Courtroom).
   * Tracks:
   * 1. vague-dark (2).mp3
   * 2. vague-dark (4).mp3
   * 3. Ein Mensch - Ein Schmetterling.mp3
   * ==================================================================== */

  private initBgAudio(index: number) {
    if (typeof window === 'undefined') return;

    if (this.bgAudio) {
      try {
        this.bgAudio.pause();
        this.bgAudio.src = '';
      } catch {}
    }

    const track = BACKGROUND_TRACKS[index];
    if (!track) return;

    try {
      this.bgAudio = new Audio(track.url);
      this.bgAudio.preload = 'auto';
      this.bgAudio.autoplay = true;
      this.bgAudio.volume = this.bgMusicVolume;

      // When track finishes, automatically advance to next track in playlist (sequential + infinite loop)
      this.bgAudio.addEventListener('ended', () => {
        this.nextBgTrack();
      });

      // Error fallback (if CDN or network fails) -> automatically advance to next track
      this.bgAudio.addEventListener('error', (e) => {
        console.warn(`Error playing track ${track.title}, advancing to next track...`, e);
        setTimeout(() => {
          this.nextBgTrack();
        }, 1000);
      });
    } catch (e) {
      console.warn('Could not initialize background audio element', e);
    }
  }

  public isBgMusicPlaying(): boolean {
    return this.isBgMusicPlayingState;
  }

  public isBgMusicEnabled(): boolean {
    return this.bgMusicEnabled;
  }

  public setBgMusicEnabled(enabled: boolean) {
    this.bgMusicEnabled = enabled;
    if (!enabled) {
      this.pauseBgMusic();
    } else {
      this.playBgMusic();
    }
  }

  public getBgMusicVolume(): number {
    return Math.round(this.bgMusicVolume * 100);
  }

  public setBgMusicVolume(volPercent: number) {
    const clamped = Math.max(0, Math.min(100, volPercent));
    this.bgMusicVolume = clamped / 100;
    if (this.bgAudio) {
      this.bgAudio.volume = this.bgMusicVolume;
    }
  }

  public playBgMusic() {
    if (!this.soundEnabled || !this.bgMusicEnabled) return;

    if (!this.bgAudio) {
      this.initBgAudio(this.currentTrackIndex);
    }

    if (this.bgAudio) {
      this.bgAudio.volume = this.bgMusicVolume;
      const playPromise = this.bgAudio.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            this.isBgMusicPlayingState = true;
          })
          .catch(() => {
            // Autoplay blocked by browser policy until user gesture
            this.isBgMusicPlayingState = false;
          });
      }
    }
  }

  public pauseBgMusic() {
    if (this.bgAudio) {
      try {
        this.bgAudio.pause();
      } catch {}
    }
    this.isBgMusicPlayingState = false;
  }

  public nextBgTrack() {
    this.currentTrackIndex = (this.currentTrackIndex + 1) % BACKGROUND_TRACKS.length;
    this.initBgAudio(this.currentTrackIndex);
    this.playBgMusic();
  }

  public prevBgTrack() {
    this.currentTrackIndex = (this.currentTrackIndex - 1 + BACKGROUND_TRACKS.length) % BACKGROUND_TRACKS.length;
    this.initBgAudio(this.currentTrackIndex);
    this.playBgMusic();
  }

  public getCurrentTrackInfo() {
    return {
      track: BACKGROUND_TRACKS[this.currentTrackIndex],
      index: this.currentTrackIndex,
      total: BACKGROUND_TRACKS.length,
      isPlaying: this.isBgMusicPlayingState,
      volume: Math.round(this.bgMusicVolume * 100),
    };
  }
}

export const soundManager = new SoundController();
