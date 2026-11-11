import { smooth } from './birds.ts';
import type { Point } from './birds.ts';

/** Conservative cloud sphere swept against the whole camera-to-subject corridor. */
export function cloudSightlineVisibility(
  centre: Point,
  radius: number,
  camera: Point,
  target: Point,
) {
  const d = target.map((v, i) => v - camera[i]!) as Point;
  const length2 = d.reduce((s, v) => s + v * v, 0);
  const u = Math.max(
    0,
    Math.min(
      1,
      centre.reduce((s, v, i) => s + (v - camera[i]!) * d[i]!, 0) / Math.max(length2, 1e-8),
    ),
  );
  const gap = Math.hypot(...centre.map((v, i) => v - camera[i]! - u * d[i]!)) - radius;
  return smooth((gap - 2.5) / 5);
}
