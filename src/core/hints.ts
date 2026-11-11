export class HintBank {
  private readonly events: Record<string, number>;
  private readonly levels: Record<string, number> = Object.create(null);
  private points: number;
  constructor(events: Record<string, number>, initial = 10) {
    this.events = Object.fromEntries(
      Object.entries(events).map(([key, value]) => [
        key,
        Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0,
      ]),
    );
    this.points = Number.isFinite(initial) ? Math.max(0, Math.floor(initial)) : 0;
  }
  get remaining() {
    return this.points;
  }
  level(event: string) {
    return this.levels[event] ?? 0;
  }
  revealNext(event: string) {
    const level = this.level(event);
    if (this.points > 0 && Object.hasOwn(this.events, event) && level < this.events[event]) {
      this.levels[event] = level + 1;
      this.points--;
    }
    return this.level(event);
  }
}
