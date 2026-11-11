import { COUGH_TIMES } from '../core/cinematic.ts';
import { sampleGesture } from '../core/motion.ts';
import type { Gesture } from '../core/observation.ts';

/** Local soundtrack playback and synthesized effects; no microphone permissions. */
export class ContactAudio {
  private context: AudioContext | null = null;
  private scrape: { source: AudioBufferSourceNode; gain: GainNode } | null = null;
  private lastEvent = 0;
  private introVoices: AudioScheduledSourceNode[] = [];
  private introBytes: ArrayBuffer | null = null;
  private introBuffer: AudioBuffer | null = null;
  private introGeneration = 0;
  private menuBytes: ArrayBuffer | null = null;
  private menuBuffer: AudioBuffer | null = null;
  private menuVoice: { source: AudioBufferSourceNode; gain: GainNode } | null = null;
  private menuGeneration = 0;

  get menuPlaying() {
    return this.menuVoice !== null;
  }
  async loadMenu(): Promise<void> {
    const response = await fetch(`${import.meta.env.BASE_URL}music/AtomBackground.ogg`);
    if (!response.ok) throw new Error('Не удалось загрузить AtomBackground');
    this.menuBytes = await response.arrayBuffer();
  }
  async startMenu(): Promise<void> {
    this.stopMenu();
    const generation = this.menuGeneration,
      ctx = this.context;
    if (!ctx || !this.master || !this.menuBytes || !this.enabled) return;
    this.menuBuffer ??= await ctx.decodeAudioData(this.menuBytes.slice(0));
    if (generation !== this.menuGeneration || !this.enabled || ctx.state === 'closed') return;
    const source = ctx.createBufferSource(),
      gain = ctx.createGain();
    source.buffer = this.menuBuffer;
    source.loop = true;
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(2.2, ctx.currentTime + 1);
    source.connect(gain).connect(this.master);
    this.menuVoice = { source, gain };
    source.onended = () => {
      if (this.menuVoice?.source === source) this.menuVoice = null;
      source.disconnect();
      gain.disconnect();
    };
    source.start();
  }
  stopMenu(): void {
    this.menuGeneration++;
    const voice = this.menuVoice;
    this.menuVoice = null;
    if (!voice || !this.context) return;
    voice.gain.gain.cancelScheduledValues(this.context.currentTime);
    voice.gain.gain.setValueAtTime(voice.gain.gain.value, this.context.currentTime);
    voice.gain.gain.linearRampToValueAtTime(0, this.context.currentTime + 0.08);
    voice.source.stop(this.context.currentTime + 0.08);
  }

  async loadIntro(): Promise<void> {
    const response = await fetch(`${import.meta.env.BASE_URL}music/WormTheme.ogg`);
    if (!response.ok) throw new Error('Не удалось загрузить WormTheme');
    this.introBytes = await response.arrayBuffer();
  }
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
    const requestedEnabled = !this.enabled;
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
    this.enabled = requestedEnabled;
    if (!this.enabled) this.silence();
    else this.master!.gain.setTargetAtTime(this.volume, this.context.currentTime, 0.02);
    return this.enabled;
  }

  async startIntro(elapsed = 0): Promise<void> {
    this.stopMenu();
    this.stopIntro();
    const generation = this.introGeneration;
    const ctx = this.context;
    if (!ctx || !this.master || !this.introBytes) return;
    const requestedAt = performance.now();
    this.introBuffer ??= await ctx.decodeAudioData(this.introBytes.slice(0));
    if (generation !== this.introGeneration) return;
    elapsed += (performance.now() - requestedAt) / 1000;
    if (elapsed >= this.introBuffer.duration) return;
    const start = ctx.currentTime - elapsed;
    const track = (source: AudioScheduledSourceNode, nodes: AudioNode[]) => {
      this.introVoices.push(source);
      source.onended = () => {
        this.introVoices = this.introVoices.filter((voice) => voice !== source);
        source.disconnect();
        nodes.forEach((node) => node.disconnect());
      };
    };
    const music = ctx.createBufferSource();
    music.buffer = this.introBuffer;
    const musicGain = ctx.createGain();
    musicGain.gain.value = 2.2;
    music.connect(musicGain).connect(this.master);
    track(music, [musicGain]);
    music.start(ctx.currentTime, elapsed);
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
      gain.gain.value = 0.35;
      source.connect(filter).connect(gain).connect(this.master);
      track(source, [filter, gain]);
      source.start(start + at);
    }
    if (elapsed < 110) {
      const thud = ctx.createOscillator(),
        gain = ctx.createGain();
      const at = start + 110;
      thud.frequency.setValueAtTime(82, at);
      thud.frequency.exponentialRampToValueAtTime(28, at + 0.22);
      gain.gain.setValueAtTime(0, at);
      gain.gain.linearRampToValueAtTime(0.13, at + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.28);
      thud.connect(gain).connect(this.master);
      track(thud, [gain]);
      thud.start(at);
      thud.stop(at + 0.3);
    }
  }
  presentSoundtrack(hidden: boolean): void {
    this.scrape?.gain.gain.setTargetAtTime(0, this.context!.currentTime, 0.02);
    this.master?.gain.setTargetAtTime(
      this.enabled && !hidden ? this.volume : 0,
      this.context!.currentTime,
      0.02,
    );
  }
  stopIntro(): void {
    this.introGeneration++;
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
    this.stopMenu();
    this.stopIntro();
    this.scrape?.source.stop();
    void this.context?.close();
  }
}
