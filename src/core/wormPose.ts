import { mix, smooth, rotate } from './birds.ts';
import type { Point } from './birds.ts';
import type { sampleIntro } from './cinematic.ts';
import { WORM_SPACING } from './wormBody.ts';
export const WORM_RADIUS = 0.083;
export const WORM_IDLE_Y = 0.13;

function exhausted(sample: ReturnType<typeof sampleIntro>, i: number): Point {
  const still = sample.knockdown;
  const lift = sample.headLift * Math.exp(-i * 0.65);
  const unwind = 0.35 * smooth((sample.time - 112) / 7) + 0.65 * sample.rise;
  const curl = 1 - unwind;
  let x = 0,
    z = 0;
  for (let j = 1; j <= i; j++) {
    const angle = curl * (1.2 * Math.sin(j * 0.7) + j * 0.25);
    x += Math.sin(angle) * WORM_SPACING;
    z -= Math.cos(angle) * WORM_SPACING;
  }
  const world: Point = [
    x,
    0.13 +
      curl * Math.sin(i * 0.8) ** 2 * 0.035 +
      lift +
      Math.sin(sample.time * 1.3 - i * 0.2) * 0.002 * (1 - still) +
      sample.cough * Math.exp(-i * 0.35) * 0.035,
    z,
  ];
  // Keep the body on the water while the whole character slowly rolls off its back.
  return rotate(world, [0, 0, -sample.rotation[2]]);
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
    const free: Point = [0, 0.17, 0];
    for (let j = 1; j <= i; j++) {
      const bend = 0.9 * Math.sin(t * 0.9 - j * 0.65) + 0.45 * Math.sin(t * 0.5 + j * 0.36);
      const arch = 0.5 * Math.sin(t * 0.7 - j * 0.8);
      free[0] += Math.sin(bend) * Math.cos(arch) * WORM_SPACING;
      free[1] += Math.sin(arch) * WORM_SPACING;
      free[2] -= Math.cos(bend) * Math.cos(arch) * WORM_SPACING;
    }
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
