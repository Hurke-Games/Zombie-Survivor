/**
 * Web Audio API procedural sound synthesizer for gritty retro tactical survival atmosphere.
 */

class AudioController {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private rainNode: AudioNode | null = null;
  private rainGain: GainNode | null = null;
  private themeInterval: number | null = null;
  private themeMasterGain: GainNode | null = null;

  private initContext() {
    try {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext })?.webkitAudioContext;
        if (AudioCtx) {
          this.ctx = new AudioCtx();
        }
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
    } catch {
      // AudioContext unavailable or restricted by browser policy
    }
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.rainGain) {
      this.rainGain.gain.value = this.isMuted ? 0 : 0.08;
    }
    if (this.themeMasterGain && this.ctx) {
      this.themeMasterGain.gain.setValueAtTime(this.isMuted ? 0 : 0.16, this.ctx.currentTime);
    }
    return this.isMuted;
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  // Play satellite / terminal transmission teletype blip
  public playTerminalBlip() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1400 + Math.random() * 200, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(800, this.ctx.currentTime + 0.04);

    gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.04);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.05);
  }

  // Tactical alert / danger pulse
  public playAlarmBeep() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(440, this.ctx.currentTime);
    osc.frequency.setValueAtTime(880, this.ctx.currentTime + 0.1);

    gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.25);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.26);
  }

  // Wood chop / Hammer nail impact
  public playHammerSound() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    // Filtered noise snap
    const bufferSize = this.ctx.sampleRate * 0.08;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 650;
    filter.Q.value = 3.0;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.08);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    noise.start();
  }

  // Blunt weapon swing / Zombie hit impact
  public playMeleeHit(isCrit = false) {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(isCrit ? 160 : 110, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(30, this.ctx.currentTime + 0.15);

    gain.gain.setValueAtTime(0.25, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.15);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.16);
  }

  // Dull undead moan / guttural hollow groan (realistic, deep, low formant throat resonance)
  public playZombieGrowl(durationSec = 0.95) {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    
    // Dual detuned oscillators for guttural vocal cord shudder
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const subFilter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc1.type = 'sawtooth';
    osc2.type = 'triangle';

    // Deep human throat pitch (56 - 68 Hz)
    const baseFreq = 58 + Math.random() * 10;
    osc1.frequency.setValueAtTime(baseFreq, now);
    osc2.frequency.setValueAtTime(baseFreq + 1.2, now); // 1.2 Hz detune creates eerie hollow vibrato

    // Mournful downward slump characteristic of dull moans
    osc1.frequency.exponentialRampToValueAtTime(baseFreq * 0.78, now + durationSec);
    osc2.frequency.exponentialRampToValueAtTime(baseFreq * 0.76, now + durationSec);

    // Formant vocal tract filter: lowpass with warm vocal cavity Q
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(240, now);
    filter.frequency.linearRampToValueAtTime(170, now + durationSec);
    filter.Q.value = 2.4;

    subFilter.type = 'bandpass';
    subFilter.frequency.setValueAtTime(155, now);
    subFilter.Q.value = 1.2;

    // Slow, heavy attack -> sustained dull moan -> natural fade out
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.14, now + 0.22);
    gain.gain.setValueAtTime(0.13, now + durationSec * 0.6);
    gain.gain.exponentialRampToValueAtTime(0.001, now + durationSec);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(subFilter);
    subFilter.connect(gain);
    gain.connect(this.ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + durationSec + 0.05);
    osc2.stop(now + durationSec + 0.05);
  }

  public playZombieMoan(durationSec = 1.1) {
    this.playZombieGrowl(durationSec);
  }

  // Heartbeat when panic or blood loss is high
  public playHeartbeat() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(65, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(40, this.ctx.currentTime + 0.1);

    gain.gain.setValueAtTime(0.22, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.12);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.13);
  }

  // Start background rain ambience if raining
  public setWeatherAmbience(weather: string) {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const isRain = weather.toLowerCase().includes('rain');
    if (isRain && !this.rainNode) {
      const bufferSize = this.ctx.sampleRate * 2;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;
      noise.loop = true;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 1100;

      const gain = this.ctx.createGain();
      gain.gain.value = 0.05;

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      noise.start();
      this.rainNode = noise;
      this.rainGain = gain;
    } else if (!isRain && this.rainNode) {
      try {
        (this.rainNode as AudioBufferSourceNode).stop();
      } catch {
        // ignore
      }
      this.rainNode = null;
      this.rainGain = null;
    }
  }

  // Water bottle refill / drink slosh
  public playWaterSplash() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(180, this.ctx.currentTime + 0.12);

    gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.12);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.13);
  }

  // Wooden chest open / close latch
  public playChestSound() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(220, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(120, this.ctx.currentTime + 0.08);

    gain.gain.setValueAtTime(0.14, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.08);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.09);
  }

  // Vault over fence jump sound
  public playVaultSound() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(160, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(65, this.ctx.currentTime + 0.15);

    gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.15);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.16);
  }

  // Item pickup sound (light rustle / pack blip)
  public playItemPickup() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(520, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, this.ctx.currentTime + 0.08);

    gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.08);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.09);
  }

  // TV rotary click / switch
  public playTvClick() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(180, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(40, this.ctx.currentTime + 0.04);

    gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.04);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.05);
  }

  // Emergency Broadcast System Attention Signal (853 Hz & 960 Hz dual frequency alarm)
  public playEmergencyAlertTone(durationSec = 2.5) {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(853, now);

    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(960, now);

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.setValueAtTime(0.12, now + durationSec - 0.1);
    gain.gain.exponentialRampToValueAtTime(0.001, now + durationSec);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + durationSec);
    osc2.stop(now + durationSec);
  }

  // TV static burst
  public playTvStatic(durationSec = 0.5) {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const bufferSize = Math.floor(this.ctx.sampleRate * durationSec);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.15;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1200, this.ctx.currentTime);
    filter.Q.setValueAtTime(0.8, this.ctx.currentTime);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + durationSec);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    noise.start();
  }

  // Dramatic, dark, fast Ace Attorney style Pursuit theme for zombie outbreak cutscene
  public playAceAttorneyZombieTheme() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    // Stop existing theme if already running
    this.stopAceAttorneyZombieTheme();

    const masterGain = this.ctx.createGain();
    masterGain.gain.setValueAtTime(this.isMuted ? 0 : 0.16, this.ctx.currentTime);
    masterGain.connect(this.ctx.destination);
    this.themeMasterGain = masterGain;

    // 142 BPM: ~105ms per 16th note step
    const stepDurationMs = 105;
    let step = 0;

    // Bass note frequencies (Hz) for a 32-step Ace Attorney minor pursuit sequence
    const bassSeq: number[] = [
      // Bar 1: Dm pursuit drive (D2, D2, D3, D2, F2, D2, G2, D2, Ab2, G2, F2, D2, D3, C3, D2, D2)
      73.4, 73.4, 146.8, 73.4, 87.3, 73.4, 98.0, 73.4, 103.8, 98.0, 87.3, 73.4, 146.8, 130.8, 73.4, 73.4,
      // Bar 2: Bb -> A7 resolution
      58.3, 58.3, 116.5, 58.3, 73.4, 87.3, 73.4, 58.3, 55.0, 55.0, 110.0, 55.0, 69.3, 82.4, 98.0, 110.0,
    ];

    // Arpeggio lead sequence (Hz)
    const arpSeq: number[] = [
      // Bar 1: Dm arpeggio flurry
      293.7, 349.2, 440.0, 587.3, 440.0, 349.2, 293.7, 440.0,
      311.1, 370.0, 466.2, 622.3, 466.2, 370.0, 311.1, 440.0,
      // Bar 2: Bb to A7 arpeggio flurry
      233.1, 293.7, 349.2, 466.2, 349.2, 293.7, 233.1, 349.2,
      220.0, 277.2, 329.6, 440.0, 554.4, 440.0, 329.6, 277.2,
    ];

    const playStep = () => {
      if (!this.ctx || !this.themeMasterGain) return;
      const now = this.ctx.currentTime;
      const curStep = step % 32;

      // 1. Driving Synth Bass (Square/Sawtooth with tight decay)
      const bassFreq = bassSeq[curStep];
      if (bassFreq) {
        const bassOsc = this.ctx.createOscillator();
        const bassFilter = this.ctx.createBiquadFilter();
        const bassGain = this.ctx.createGain();

        bassOsc.type = 'sawtooth';
        bassOsc.frequency.setValueAtTime(bassFreq, now);

        bassFilter.type = 'lowpass';
        bassFilter.frequency.setValueAtTime(550, now);
        bassFilter.frequency.exponentialRampToValueAtTime(120, now + 0.09);

        bassGain.gain.setValueAtTime(0.24, now);
        bassGain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

        bassOsc.connect(bassFilter);
        bassFilter.connect(bassGain);
        bassGain.connect(this.themeMasterGain);

        bassOsc.start(now);
        bassOsc.stop(now + 0.1);
      }

      // 2. Fast Tension Arpeggio (Pulse / Sine fluttering)
      const arpFreq = arpSeq[curStep];
      if (arpFreq) {
        const arpOsc = this.ctx.createOscillator();
        const arpGain = this.ctx.createGain();

        arpOsc.type = 'triangle';
        arpOsc.frequency.setValueAtTime(arpFreq, now);

        arpGain.gain.setValueAtTime(0.08, now);
        arpGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

        arpOsc.connect(arpGain);
        arpGain.connect(this.themeMasterGain);

        arpOsc.start(now);
        arpOsc.stop(now + 0.09);
      }

      // 3. Kick Drum on driving beats (steps 0, 6, 8, 14, 16, 22, 24, 30)
      if ([0, 6, 8, 14, 16, 22, 24, 30].includes(curStep)) {
        const kickOsc = this.ctx.createOscillator();
        const kickGain = this.ctx.createGain();

        kickOsc.type = 'sine';
        kickOsc.frequency.setValueAtTime(140, now);
        kickOsc.frequency.exponentialRampToValueAtTime(38, now + 0.08);

        kickGain.gain.setValueAtTime(0.35, now);
        kickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

        kickOsc.connect(kickGain);
        kickGain.connect(this.themeMasterGain);

        kickOsc.start(now);
        kickOsc.stop(now + 0.1);
      }

      // 4. Snare / Dramatic Clap on beats 2 & 4 (steps 4, 12, 20, 28)
      if ([4, 12, 20, 28].includes(curStep)) {
        const bufferSize = Math.floor(this.ctx.sampleRate * 0.09);
        const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = Math.random() * 2 - 1;
        }

        const snareSource = this.ctx.createBufferSource();
        snareSource.buffer = noiseBuffer;

        const snareFilter = this.ctx.createBiquadFilter();
        snareFilter.type = 'bandpass';
        snareFilter.frequency.setValueAtTime(1400, now);

        const snareGain = this.ctx.createGain();
        snareGain.gain.setValueAtTime(0.2, now);
        snareGain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

        snareSource.connect(snareFilter);
        snareFilter.connect(snareGain);
        snareGain.connect(this.themeMasterGain);

        snareSource.start(now);
      }

      // 5. Hi-hat on even eighth notes
      if (curStep % 2 === 0 && ![0, 4, 8, 12, 16, 20, 24, 28].includes(curStep)) {
        const bufferSize = Math.floor(this.ctx.sampleRate * 0.03);
        const hatBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = hatBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = (Math.random() * 2 - 1) * 0.08;
        }

        const hatSource = this.ctx.createBufferSource();
        hatSource.buffer = hatBuffer;

        const hatFilter = this.ctx.createBiquadFilter();
        hatFilter.type = 'highpass';
        hatFilter.frequency.setValueAtTime(7000, now);

        const hatGain = this.ctx.createGain();
        hatGain.gain.setValueAtTime(0.09, now);
        hatGain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);

        hatSource.connect(hatFilter);
        hatFilter.connect(hatGain);
        hatGain.connect(this.themeMasterGain);

        hatSource.start(now);
      }

      // 6. Dramatic Ace Attorney Brass Chord Stabs on key syncopated moments
      if ([0, 6, 12, 16, 22, 28].includes(curStep)) {
        const chordPitches =
          curStep < 16
            ? [293.7, 349.2, 440.0, 587.3] // Dm / D5
            : curStep < 24
            ? [233.1, 293.7, 349.2, 466.2] // Bb
            : [220.0, 277.2, 329.6, 440.0]; // A7

        chordPitches.forEach((pitch) => {
          if (!this.ctx || !this.themeMasterGain) return;
          const osc = this.ctx.createOscillator();
          const filter = this.ctx.createBiquadFilter();
          const gain = this.ctx.createGain();

          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(pitch, now);

          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(1800, now);
          filter.frequency.exponentialRampToValueAtTime(600, now + 0.16);

          gain.gain.setValueAtTime(0.06, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

          osc.connect(filter);
          filter.connect(gain);
          gain.connect(this.themeMasterGain);

          osc.start(now);
          osc.stop(now + 0.17);
        });
      }

      step++;
    };

    // Run sequencer interval
    this.themeInterval = window.setInterval(playStep, stepDurationMs);
  }

  // Gracefully stop the Ace Attorney theme
  public stopAceAttorneyZombieTheme() {
    if (this.themeInterval !== null) {
      clearInterval(this.themeInterval);
      this.themeInterval = null;
    }
    if (this.themeMasterGain && this.ctx) {
      try {
        this.themeMasterGain.gain.linearRampToValueAtTime(0.001, this.ctx.currentTime + 0.3);
        setTimeout(() => {
          if (this.themeMasterGain) {
            this.themeMasterGain.disconnect();
            this.themeMasterGain = null;
          }
        }, 350);
      } catch {
        this.themeMasterGain = null;
      }
    }
  }
}

export const soundManager = new AudioController();
