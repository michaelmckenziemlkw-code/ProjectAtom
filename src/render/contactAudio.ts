import { sampleGesture } from '../core/motion.ts';
import type { Gesture } from '../core/observation.ts';

/** Optional local synthesis: no audio files or microphone permissions. */
export class ContactAudio {
  private context: AudioContext | null = null;
  private scrape: { source: AudioBufferSourceNode; gain: GainNode } | null = null;
  private lastEvent = 0;
  enabled = false;

  async toggle(): Promise<boolean> {
    if (!this.context) {
      this.context = new AudioContext();
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
      source.connect(filter).connect(gain).connect(this.context.destination);
      source.start();
      this.scrape = { source, gain };
    }
    await this.context.resume();
    this.enabled = !this.enabled;
    if (!this.enabled) this.silence();
    return this.enabled;
  }

  present(gesture: Gesture, seconds: number, paused: boolean): void {
    const sample = sampleGesture(gesture, seconds);
    if (!this.context || !this.enabled || paused) {
      this.silence();
      return;
    }
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
      osc.connect(gain).connect(this.context.destination);
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
    if (this.context) this.scrape?.gain.gain.setTargetAtTime(0, this.context.currentTime, 0.02);
    this.lastEvent = 0;
  }
  dispose(): void {
    this.scrape?.source.stop();
    void this.context?.close();
  }
}
