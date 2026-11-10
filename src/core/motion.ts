import type { Gesture } from './observation.ts';

export interface Point {
  x: number;
  y: number;
  z: number;
}
export interface GestureSample {
  foot: Point;
  contact: number;
  /** A new strike can occur only at a named contact event, not every frame. */
  event: number;
}
export const GESTURE_DURATION = 3.6;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (t: number) => t * t * (3 - 2 * t);

/** Foot targets are in world metres, relative to the stationary beetle. */
export function sampleGesture(gesture: Gesture, seconds: number): GestureSample {
  const t = ((seconds % GESTURE_DURATION) + GESTURE_DURATION) % GESTURE_DURATION;
  if (gesture === 'wave') {
    const angle = Math.sin((t / GESTURE_DURATION) * Math.PI * 2);
    return {
      foot: {
        x: 1.25 + angle * 0.35,
        y: 1.65 + Math.cos((t / GESTURE_DURATION) * Math.PI * 2) * 0.26,
        z: -1.4,
      },
      contact: 0,
      event: 0,
    };
  }
  if (gesture === 'tap') {
    // Slow lift, fast drop, distinct held contact; repeat twice, then rest.
    const hit = (time: number) => {
      if (time < 0.7) return lerp(0.12, 1.18, smooth(time / 0.7));
      if (time < 0.9) return lerp(1.18, 0.12, (time - 0.7) / 0.2);
      return 0.12;
    };
    const y = t < 1.15 ? hit(t) : t < 2.3 ? hit(t - 1.15) : 0.12;
    const event = t >= 0.9 && t < 1.15 ? 1 : t >= 2.05 && t < 2.3 ? 2 : 0;
    return { foot: { x: 1.5, y, z: -1.55 }, contact: event ? 1 : 0, event };
  }
  // Place the foot forward, drag it along the ground, lift and return.
  if (t < 0.5)
    return { foot: { x: 1.5, y: lerp(0.55, 0.12, smooth(t / 0.5)), z: -2 }, contact: 0, event: 0 };
  if (t < 2.4)
    return { foot: { x: 1.5, y: 0.12, z: lerp(-2, -0.55, (t - 0.5) / 1.9) }, contact: 1, event: 3 };
  const returning = (t - 2.4) / 1.2;
  return {
    foot: {
      x: 1.5,
      y: lerp(0.12, 0.55, smooth(returning)) + Math.sin(returning * Math.PI) * 0.55,
      z: lerp(-0.55, -2, smooth(returning)),
    },
    contact: 0,
    event: 0,
  };
}
