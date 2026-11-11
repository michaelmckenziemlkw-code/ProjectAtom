import { mix, smooth } from './birds.ts';
import type { Point } from './birds.ts';
import type { sampleIntro } from './cinematic.ts';
import { WORM_SPACING } from './wormBody.ts';
export const WORM_RADIUS = 0.083;
export const WORM_IDLE_Y = 0.13;

function exhausted(sample: ReturnType<typeof sampleIntro>, i: number): Point {
  const tail = i / 10,
    still = sample.knockdown;
  const lift = sample.headLift * Math.exp(-i * 0.65);
  return [
    Math.sin(i * 0.48) * 0.17,
    0.115 +
      lift +
      Math.sin(sample.time * 1.3 - i * 0.2) * 0.002 * (1 - still) +
      sample.cough * Math.exp(-i * 0.35) * 0.04,
    -i * WORM_SPACING + Math.sin(i * 0.5) * 0.025 * tail,
  ];
}
/** Deformation is independent of global tumble. Motion follows the bullet-time clock. */
export function introSegment(sample: ReturnType<typeof sampleIntro>, i: number): Point {
  const t = sample.motionTime,
    tail = i / 10;
  const carried: Point = [
    0,
    i === 3 ? 0.16 : 0.16 - Math.abs(i - 3) * 0.04 + Math.sin(t * 1.8 - i * 0.2) * 0.007,
    -i * WORM_SPACING,
  ];
  if (sample.carried) return carried;
  if (sample.falling) {
    const wave = Math.pow(tail, 1.05);
    const free: Point = [
      Math.sin(t * 0.78 - i * 0.64) * 0.22 * wave,
      0.17 + Math.sin(t * 0.61 - i * 0.48) * 0.11 * wave,
      -i * WORM_SPACING + Math.sin(t * 0.5 - i * 0.4) * 0.025 * wave,
    ];
    const flex = mix(carried, free, smooth((t - 75) / 1.2));
    return mix(flex, exhausted(sample, i), sample.landingBlend);
  }
  const rest: Point =
    sample.phase === 'aftermath'
      ? exhausted(sample, i)
      : [
          Math.sin(i * 0.42) * 0.13,
          0.14 + Math.sin(t * 1.8 - i * 0.2) * 0.004 + sample.cough * Math.exp(-i * 0.35) * 0.05,
          -i * WORM_SPACING,
        ];
  const idle: Point = [0, WORM_IDLE_Y + Math.sin(sample.time * 1.5) * 0.005, -i * WORM_SPACING];
  const recovery = smooth((sample.rise - tail * 0.12) / 0.88);
  return recovery >= 1 ? idle : mix(rest, idle, recovery);
}
