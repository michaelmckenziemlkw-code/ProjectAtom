import { COUGH_TIMES } from '../core/cinematic.ts';
import { sampleGesture } from '../core/motion.ts';
import type { Gesture } from '../core/observation.ts';

/** Optional local synthesis: no audio files or microphone permissions. */
export class ContactAudio {
  private context: AudioContext | null = null;
  private scrape: { source: AudioBufferSourceNode; gain: GainNode } | null = null;
  private lastEvent = 0;
  private introVoices: AudioScheduledSourceNode[] = [];
  enabled = false;
  private master: GainNode | null = null;
  private volume = 0.7;

  setVolume(value: number) {
    this.volume = Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
    this.master?.gain.setTargetAtTime(
      this.enabled ? this.volume : 0,
      this.context!.currentTime,
      0.02,
    );
  }

  async toggle(): Promise<boolean> {
    if (!this.context) {
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.gain.value = 0;
      this.master.connect(this.context.destination);
      const source = this.context.createBufferSource();
      const buffer = this.context.createBuffer(1, this.context.sampleRate, this.context.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      source.buffer = buffer;
      source.loop = true;
      const filter = this.context.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 1100;
      const gain = this.context.createGain();
      gain.gain.value = 0;
      source.connect(filter).connect(gain).connect(this.master!);
      source.start();
      this.scrape = { source, gain };
    }
    await this.context.resume();
    this.enabled = !this.enabled;
    if (!this.enabled) this.silence();
    else this.master!.gain.setTargetAtTime(this.volume, this.context.currentTime, 0.02);
    return this.enabled;
  }

  startIntro(elapsed = 0): void {
    this.stopIntro();
    const ctx = this.context;
    if (!ctx || !this.master) return;
    const start = ctx.currentTime - elapsed;
    // Original sparse D-minor phrase; harmonics have a soft struck-string envelope.
    const notes = [
      [0, 146.83],
      [2.6, 220],
      [5.2, 174.61],
      [8, 130.81],
      [11.5, 164.81],
      [14.5, 146.83],
      [18, 110],
      [20, 146.83],
    ];
    const track = (source: AudioScheduledSourceNode, nodes: AudioNode[]) => {
      this.introVoices.push(source);
      source.onended = () => {
        this.introVoices = this.introVoices.filter((voice) => voice !== source);
        source.disconnect();
        nodes.forEach((node) => node.disconnect());
      };
    };
    for (const [at, frequency] of notes) {
      if (at! < elapsed) continue;
      for (const harmonic of [1, 2, 3]) {
        const osc = ctx.createOscillator(),
          gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = frequency! * harmonic;
        const t = start + at!;
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.055 / (harmonic * harmonic), t + 0.035);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 3.8);
        osc.connect(gain).connect(this.master);
        track(osc, [gain]);
        osc.start(t);
        osc.stop(t + 4);
      }
    }
    for (const at of COUGH_TIMES) {
      if (at < elapsed) continue;
      const source = ctx.createBufferSource();
      const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * 0.55), ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        const t = i / ctx.sampleRate;
        data[i] = (Math.random() * 2 - 1) * Math.exp(-t * 9) * (0.6 + 0.4 * Math.sin(t * 110));
      }
      source.buffer = buffer;
      const filter = ctx.createBiquadFilter(),
        gain = ctx.createGain();
      filter.type = 'bandpass';
      filter.frequency.value = 680;
      filter.Q.value = 0.8;
      gain.gain.value = 0.7;
      source.connect(filter).connect(gain).connect(this.master);
      track(source, [filter, gain]);
      source.start(start + at);
    }
  }
  presentIntro(hidden: boolean): void {
    this.scrape?.gain.gain.setTargetAtTime(0, this.context!.currentTime, 0.02);
    this.master?.gain.setTargetAtTime(
      this.enabled && !hidden ? this.volume : 0,
      this.context!.currentTime,
      0.02,
    );
  }
  stopIntro(): void {
    for (const voice of this.introVoices) voice.stop();
    this.introVoices = [];
  }
  present(gesture: Gesture, seconds: number, paused: boolean): void {
    const sample = sampleGesture(gesture, seconds);
    if (!this.context || !this.enabled || paused) {
      this.silence();
      return;
    }
    this.master!.gain.setTargetAtTime(this.volume, this.context.currentTime, 0.02);
    this.scrape?.gain.gain.setTargetAtTime(
      gesture === 'scrape' ? sample.contact * 0.055 : 0,
      this.context.currentTime,
      0.03,
    );
    if (gesture === 'tap' && sample.event !== 0 && this.lastEvent !== sample.event) {
      const osc = this.context.createOscillator();
      const gain = this.context.createGain();
      osc.frequency.setValueAtTime(150, this.context.currentTime);
      osc.frequency.exponentialRampToValueAtTime(50, this.context.currentTime + 0.1);
      gain.gain.setValueAtTime(0.15, this.context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.context.currentTime + 0.13);
      osc.connect(gain).connect(this.master!);
      osc.start();
      osc.stop(this.context.currentTime + 0.15);
      osc.onended = () => {
        osc.disconnect();
        gain.disconnect();
      };
    }
    this.lastEvent = sample.event;
  }
  silence(): void {
    if (this.context) {
      this.scrape?.gain.gain.setTargetAtTime(0, this.context.currentTime, 0.02);
      this.master?.gain.setTargetAtTime(0, this.context.currentTime, 0.02);
    }
    this.lastEvent = 0;
  }
  dispose(): void {
    this.stopIntro();
    this.scrape?.source.stop();
    void this.context?.close();
  }
}
