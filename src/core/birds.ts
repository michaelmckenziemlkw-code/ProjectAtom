import { WORM_SPACING } from './wormBody.ts';
/** Shared rig math: the worm attachment uses exactly the rendered bird transforms. */
export type Point = [number, number, number];
export const CROW_SCALE = 5.25;
export const EAGLE_SCALE = 8.7;
export const NECK: Point = [0, 0.15, 0.34];
export const MOUTH: Point = [0, 0.04, 0.69];
export const GRIP_SEGMENT: Point = [0, 0.16, -3 * WORM_SPACING];
export const add = (a: Point, b: Point): Point => a.map((v, i) => v + b[i]!) as Point;
export const mix = (a: Point, b: Point, t: number): Point =>
  a.map((v, i) => v + (b[i]! - v) * t) as Point;
export const clamp = (x: number) => Math.max(0, Math.min(1, x));
export const smooth = (x: number) => {
  const t = clamp(x);
  return t * t * (3 - 2 * t);
};
export function rotate([x, y, z]: Point, [pitch, yaw, roll]: Point): Point {
  const xx = x * Math.cos(roll) - y * Math.sin(roll);
  const yy = x * Math.sin(roll) + y * Math.cos(roll);
  const yyy = yy * Math.cos(pitch) - z * Math.sin(pitch);
  const zz = yy * Math.sin(pitch) + z * Math.cos(pitch);
  return [xx * Math.cos(yaw) + zz * Math.sin(yaw), yyy, -xx * Math.sin(yaw) + zz * Math.cos(yaw)];
}
export function beakLocal(dip: number): Point {
  return add(NECK, rotate(MOUTH, [dip, 0, 0]));
}
export function beakWorld(
  position: Point,
  rotation: Point,
  dip: number,
  scale = CROW_SCALE,
): Point {
  return add(position, rotate(beakLocal(dip).map((v) => v * scale) as Point, rotation));
}
export function unrotate(p: Point, rotation: Point): Point {
  return [0, 1, 2].map((i) => {
    const axis: Point = [0, 0, 0];
    axis[i] = 1;
    return rotate(axis, rotation).reduce((sum, v, j) => sum + v * p[j]!, 0);
  }) as Point;
}
export function crowGraspTargets(crow: { position: Point; rotation: Point }): [Point, Point] {
  return [-1, 1].map((side) =>
    add(
      crow.position,
      rotate([side * 0.19 * CROW_SCALE, 0.22 * CROW_SCALE, -0.28 * CROW_SCALE], crow.rotation),
    ),
  ) as [Point, Point];
}
export interface BirdPose {
  position: Point;
  rotation: Point;
  dip: number;
  open: number;
  flap: number;
  fold: number;
  spread: number;
  grasp?: number;
  startle?: number;
  look?: number;
  feet?: [Point, Point];
}
export function flightRig(
  time: number,
  position: Point,
  velocity: Point,
  eagle: boolean,
  dip = 0,
  open = 0,
  grounded = false,
): BirdPose {
  const speed = Math.hypot(velocity[0], velocity[2]);
  const yaw = speed > 0.0001 ? Math.atan2(velocity[0], velocity[2]) : 0;
  const cycle = (((time * (eagle ? 0.64 : 1.0)) % 1) + 1) % 1;
  // Fast powered downstroke, slower folded recovery; a separate wrist follows the shoulder.
  const beat =
    cycle < 0.36
      ? Math.cos((cycle / 0.36) * Math.PI)
      : -Math.cos(((cycle - 0.36) / 0.64) * Math.PI);
  const glide = eagle ? 0.28 + 0.72 * smooth(Math.sin(time * 0.55)) : 1;
  const flap = grounded ? 0.1 : beat * 0.62 * glide;
  const pitch = grounded ? 0 : -Math.atan2(velocity[1], Math.max(1, speed)) * 0.18 + beat * 0.025;
  return {
    position,
    rotation: [pitch, yaw, grounded ? 0 : Math.sin(time * 0.32) * (eagle ? 0.13 : 0.08)],
    dip,
    open,
    flap,
    fold: grounded ? 0.8 : Math.max(0, -beat) * 0.28 * glide,
    spread: grounded ? 0.75 : 1,
  };
}
