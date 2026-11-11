/** Milliseconds enter at event boundaries; animation time is active seconds. */
export class ActiveClock {
  private last: number;
  private active = false;
  private elapsed = 0;
  constructor(now = 0) {
    this.last = now;
  }
  read(now: number): number {
    if (this.active) this.elapsed += Math.max(0, now - this.last) / 1000;
    this.last = now;
    return this.elapsed;
  }
  setActive(active: boolean, now: number) {
    this.read(now);
    this.active = active;
  }
  reset(now: number) {
    this.elapsed = 0;
    this.last = now;
  }
}
export class FramePacer {
  private next = 0;
  private cap = 0;
  shouldRender(now: number, cap = 0): boolean {
    if (cap !== this.cap) {
      this.next = now;
      this.cap = cap;
    }
    if (cap <= 0) return true;
    if (now + 0.001 < this.next) return false;
    const period = 1000 / cap;
    this.next = now - this.next >= period ? now + period : this.next + period;
    return true;
  }
}
export class FrameMeter {
  count = 0;
  private samples: number[] = [];
  record(now: number) {
    this.count++;
    this.samples.push(now);
  }
  fps(now: number) {
    this.samples = this.samples.filter((time) => time > now - 1000);
    return this.samples.length;
  }
}

/** Samples only actual, unpaced renders. A completed estimate never feeds on capped FPS. */
export class UncappedFpsSampler {
  value: number | null = null;
  private first: number | null = null;
  private intervals = 0;
  sample(now: number) {
    if (this.value !== null) return;
    if (this.first === null) {
      this.first = now;
      return;
    }
    this.intervals++;
    const elapsed = now - this.first;
    if (elapsed >= 1500 && this.intervals >= 3) this.value = (this.intervals * 1000) / elapsed;
  }
  interrupt() {
    if (this.value === null) {
      this.first = null;
      this.intervals = 0;
    }
  }
  reset() {
    this.value = null;
    this.first = null;
    this.intervals = 0;
  }
}
