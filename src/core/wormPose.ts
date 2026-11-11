import { mix, smooth } from './birds.ts';
import type { Point } from './birds.ts';
import type { sampleIntro } from './cinematic.ts';
export const WORM_RADIUS = 0.19;

/** Local articulation independent of the body's global tumble and the render rate. */
export function introSegment(sample: ReturnType<typeof sampleIntro>, i: number): Point {
  const t = sample.time;
  const tail = i / 10;
  if (sample.carried)
    return [
      0,
      i === 3 ? 0.16 : 0.16 - Math.abs(i - 3) * 0.04 + Math.sin(t * 1.8 - i * 0.2) * 0.007,
      -i * 0.14,
    ];
  if (sample.falling) {
    const wave = Math.pow(tail, 1.3);
    return [
      Math.sin(i * 0.42) * 0.045 + Math.sin(t * 0.65 - i * 0.55) * 0.07 * wave,
      0.17 + Math.sin(t * 0.52 - i * 0.4) * 0.035 * wave,
      -i * 0.14 + Math.sin(t * 0.4 - i * 0.35) * 0.015 * wave,
    ];
  }
  const resting: Point = [
    Math.sin(i * 0.42) * 0.13,
    (sample.phase === 'aftermath' ? 0.12 : 0.16) +
      Math.sin(t * 1.8 - i * 0.2) * 0.007 +
      sample.cough * Math.exp(-i * 0.35) * 0.08,
    -i * 0.14,
  ];
  const idle: Point = [0, 0.22 + Math.sin(t * 1.5) * 0.005, -i * 0.14];
  // Head recovers first, tail follows, all reach the exact gameplay idle pose before handoff.
  const recovery = smooth((sample.rise - tail * 0.12) / 0.88);
  return recovery >= 1 ? idle : mix(resting, idle, recovery);
}
