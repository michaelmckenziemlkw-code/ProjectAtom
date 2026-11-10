/** Domain data has no dependency on Babylon, the DOM, or frame timing. */
export const gestures = ['wave', 'tap', 'scrape'] as const;
export type Gesture = (typeof gestures)[number];
export type SymbolKind = 'ring' | 'fork' | 'bars';
export interface Observation {
  id: number;
  gesture: Gesture;
  symbol: SymbolKind;
}

// Labels stay in the optional description/answer UI, never in the normal HUD.
export const gestureLabels: Record<Gesture, string> = {
  wave: 'Машет лапой в воздухе',
  tap: 'Стучит лапой по земле',
  scrape: 'Скребёт землю',
};
export const descriptions: Record<Gesture, string> = {
  wave: 'Передняя лапа поднята: жук широко машет ею, не касаясь земли.',
  tap: 'Жук дважды резко ударяет передней лапой по земле и делает паузу.',
  scrape: 'Жук прижимает переднюю лапу к земле и тянет её назад, оставляя борозду.',
};

export function createObservations(seed: number): readonly Observation[] {
  let state = seed >>> 0;
  const next = (max: number) => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state % max;
  };
  const order: Gesture[] = [...gestures];
  for (let i = order.length - 1; i > 0; i--) {
    const j = next(i + 1);
    [order[i], order[j]] = [order[j], order[i]];
  }
  const symbols: SymbolKind[] = ['ring', 'fork', 'bars'];
  return order.map((gesture, id) => ({ id, gesture, symbol: symbols[next(3)] }));
}

export interface ObservationState {
  index: number;
  paused: boolean;
  description: boolean;
  answers: Partial<Record<number, Gesture>>;
}

export class ObservationSession {
  readonly observations: readonly Observation[];
  readonly state: ObservationState = { index: 0, paused: false, description: false, answers: {} };
  constructor(seed: number) {
    this.observations = createObservations(seed);
  }
  get current(): Observation {
    return this.observations[this.state.index];
  }
  select(index: number): void {
    if (!Number.isInteger(index) || index < 0 || index >= this.observations.length) return;
    this.state.index = index;
  }
  answer(gesture: Gesture): boolean {
    this.state.answers[this.state.index] = gesture;
    return gesture === this.current.gesture;
  }
}
