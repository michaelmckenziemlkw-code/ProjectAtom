import music from '../../assets/music/WormTheme.json' with { type: 'json' };
import {
  add,
  mix,
  smooth,
  rotate,
  beakLocal,
  beakWorld,
  flightRig,
  CROW_SCALE,
  GRIP_SEGMENT,
  EAGLE_SCALE,
  crowGraspTargets,
  unrotate,
} from './birds.ts';
import type { Point } from './birds.ts';
export type { Point } from './birds.ts';
export const INTRO_DURATION = music.audioDuration;
export const RELEASE_TIME = 75;
export const IMPACT_TIME = 110;
export const BULLET_DURATION = 0.7;
export const SOLAR_TIME = RELEASE_TIME + 3;
export const COUGH_TIMES = [5.5, 6.4, 14, 112.4, 115.8, 119.2, 122.6, 126.1] as const;
const CONTACT: Point = [0, GRIP_SEGMENT[1], -5.2 + GRIP_SEGMENT[2]];
const groundCrow = add(CONTACT, beakLocal(1.3).map((v) => -v * CROW_SCALE) as Point);
const FORWARD_ACCEL = 0.04;
const FORWARD_AT_RELEASE = FORWARD_ACCEL * (RELEASE_TIME - 32) ** 2;
function cruise(t: number): Point {
  const age = Math.max(0, t - 32),
    lift = smooth(age / 24);
  return add(groundCrow, [
    2.2 * Math.sin(age / 18) * smooth(age / 5),
    44 * lift,
    FORWARD_ACCEL * age * age,
  ]);
}
function crowPath(t: number): Point {
  if (t < 30)
    return mix([groundCrow[0], 14, groundCrow[2] - 22], groundCrow, smooth((t - 18) / 12));
  if (t <= RELEASE_TIME) return cruise(t);
  const s = t - RELEASE_TIME;
  return add(cruise(RELEASE_TIME), [
    0.05 * s * s,
    0.12 * s * s,
    2 * FORWARD_ACCEL * (RELEASE_TIME - 32) * s + 0.06 * s * s,
  ]);
}
function eaglePath(t: number): Point {
  // Faster flight along the crow's heading: approach from behind, then carry the caught bird.
  const entry = mix([-60, 12, -35], [-4, 8, -11], smooth((t - 61) / 5.6));
  const offset = mix(entry, [0, 5.65, -0.8], smooth((t - 66.6) / 8));
  return add(crowPath(t), offset);
}
const velocity = (path: (t: number) => Point, t: number): Point =>
  path(t + 0.025).map((v, i) => (v - path(t - 0.025)[i]!) / 0.05) as Point;
function crowPose(t: number) {
  const grounded = t >= 29.9 && t <= 32;
  const startle = smooth((t - 74.65) / 0.2) * (1 - smooth((t - 77) / 1.5));
  const dip = 1.3 * smooth((t - 30) / 2) * (1 - smooth((t - 32) / 6)) - 0.15 * startle;
  const open = smooth((t - 30) / 0.8) * (1 - smooth((t - 31.6) / 0.4)) + 1.5 * startle;
  const pose = flightRig(t, crowPath(t), velocity(crowPath, t), false, dip, open, grounded);
  if (t >= 30 && t < 35)
    pose.rotation = pose.rotation.map((v) => v * smooth((t - 32) / 3)) as Point;
  pose.startle = startle;
  pose.rotation[2] += 0.12 * startle;
  pose.flap *= 1 - 0.6 * startle;
  return pose;
}
function carriedWorm(t: number) {
  const bird = crowPose(t),
    grip = beakWorld(bird.position, bird.rotation, bird.dip);
  const rotation: Point = [
    0,
    bird.rotation[1],
    Math.sin((t - 32) * 1.25) * smooth((t - 32) / 2) * 0.035,
  ];
  return {
    position: add(grip, rotate(GRIP_SEGMENT, rotation).map((v) => -v) as Point),
    rotation,
    grip,
  };
}
const baseRelease = carriedWorm(RELEASE_TIME);
const FALL_SECONDS = IMPACT_TIME - RELEASE_TIME;
export const FALL_REFERENCE_SPEED = baseRelease.position[1] / FALL_SECONDS;
export const FALL_START_SPEED = FALL_REFERENCE_SPEED * 3;
export const FALL_END_SPEED = FALL_REFERENCE_SPEED * 6;
export const FALL_HEIGHT = (FALL_START_SPEED + FALL_END_SPEED) * 0.5 * FALL_SECONDS;
export const SKY_LIFT = FALL_HEIGHT - baseRelease.position[1];
const release = {
  ...baseRelease,
  position: add(baseRelease.position, [0, SKY_LIFT, -FORWARD_AT_RELEASE]),
};
export const SUN_DIRECTION: Point = [1, 0.32, 0.08].map(
  (v) => v / Math.hypot(1, 0.32, 0.08),
) as Point;
export const SUN_RADIUS = 17;
function fallPosition(elapsed: number): Point {
  const fall = fallClock(elapsed).seconds / FALL_SECONDS;
  return [
    release.position[0] * (1 - smooth(fall)) + Math.sin(fall * Math.PI * 2) * 0.6,
    Math.max(
      0,
      FALL_HEIGHT -
        FALL_SECONDS *
          (FALL_START_SPEED * fall + 0.5 * (FALL_END_SPEED - FALL_START_SPEED) * fall * fall),
    ),
    release.position[2] +
      (-5.2 - release.position[2]) * smooth(fall) +
      Math.sin(fall * Math.PI) * 0.5,
  ];
}
/** Integrate smooth speed ramps: approach the portrait first, slow there, repay the lost time. */
export function fallClock(elapsed: number) {
  const s = Math.max(0, Math.min(FALL_SECONDS, elapsed));
  const fast = (FALL_SECONDS - (2.6 + 0.4 * 0.56 + 0.7 * 0.12 + 0.5 * 0.12)) / 30.8;
  const ramps = [
    [0, 2.6, 1, 1],
    [2.6, 0.4, 1, 0.12],
    [3, BULLET_DURATION, 0.12, 0.12],
    [3.7, 1, 0.12, fast],
    [4.7, FALL_SECONDS - 4.7, fast, fast],
  ];
  let seconds = 0,
    rate = 1;
  for (const [start, duration, from, to] of ramps as [number, number, number, number][]) {
    const u = Math.max(0, Math.min(1, (s - start) / duration));
    seconds += duration * (from * u + (to - from) * (u ** 3 - 0.5 * u ** 4));
    if (s >= start) rate = from + (to - from) * smooth(u);
  }
  return { seconds, rate };
}
function tumble(elapsed: number): Point {
  const spin = fallClock(elapsed).seconds / 20;
  return [
    spin * Math.PI * 2,
    release.rotation[1] + spin * Math.PI * 0.8,
    release.rotation[2] + spin * Math.PI * 2,
  ];
}
export const SUN_POSITION = add(
  add(fallPosition(3), rotate([0, 0.17, -1.05], tumble(3))),
  SUN_DIRECTION.map((v) => v * 90) as Point,
);
const RELEASE_OFFSET: Point = [3.2, 1.2, 5.8];
function attackFrame(t: number, crow: Point, eagle: Point, worm: Point, rotation: Point) {
  const push = smooth((t - 71.5) / 3);
  const target = mix(
    mix(crow, eagle, 0.35 * smooth((t - 68.5) / 2)),
    add(worm, rotate([0, 0.17, -1.05], rotation)),
    push,
  );
  return { target, camera: add(target, mix([43, 16, 36], RELEASE_OFFSET, push)) };
}
export function sampleIntro(seconds: number) {
  const time = Math.max(0, Math.min(INTRO_DURATION, seconds));
  const phase =
    time < 18
      ? 'puddle'
      : time < 30
        ? 'approach'
        : time < 34
          ? 'capture'
          : time < 56
            ? 'ascent'
            : time < 67
              ? 'flight'
              : time < RELEASE_TIME
                ? 'attack'
                : time < IMPACT_TIME
                  ? 'fall'
                  : 'aftermath';
  const altitude: Point = time >= 67 ? [0, SKY_LIFT, -FORWARD_AT_RELEASE] : [0, 0, 0];
  const crowPoseSample = crowPose(time);
  crowPoseSample.position = add(crowPoseSample.position, altitude);
  const crow = crowPoseSample.position,
    eaglePose = flightRig(time, eaglePath(time), velocity(eaglePath, time), true);
  eaglePose.position = add(eaglePose.position, altitude);
  const eagle = eaglePose.position;
  const reaching = smooth((time - 73) / 1.4);
  eaglePose.grasp = smooth((time - 74.25) / 0.35);
  eaglePose.rotation = mix(
    eaglePose.rotation,
    [0, crowPoseSample.rotation[1], crowPoseSample.rotation[2] * 0.3],
    reaching,
  );
  eaglePose.feet = crowGraspTargets(crowPoseSample).map((world, i) => {
    const local = unrotate(
      world.map((v, j) => (v - eagle[j]!) / EAGLE_SCALE) as Point,
      eaglePose.rotation,
    );
    return mix([i === 0 ? -0.13 : 0.13, -0.42, 0.21], local, reaching);
  }) as [Point, Point];
  eaglePose.flap *= 1 - eaglePose.grasp * 0.65;
  eaglePose.fold += eaglePose.grasp * 0.12;
  eaglePose.look = 0.55 * smooth((time - 53.35) / 0.7) * (1 - smooth((time - 55) / 1));
  eaglePose.dip = 0.12 * smooth((time - 53.35) / 0.7) * (1 - smooth((time - 55) / 1));
  const carried = time >= 32 && time < RELEASE_TIME,
    falling = phase === 'fall';
  const clock = fallClock(time - RELEASE_TIME),
    fall = clock.seconds / FALL_SECONDS;
  const attachment = carriedWorm(time);
  attachment.position = add(attachment.position, altitude);
  attachment.grip = add(attachment.grip, altitude);
  const worm: Point = carried
    ? attachment.position
    : falling
      ? fallPosition(time - RELEASE_TIME)
      : [0, 0, -5.2];
  const landingView = smooth((time - 107.5) / 2.5);
  const landingBlend = falling ? smooth((time - 109.4) / 0.6) : time >= IMPACT_TIME ? 1 : 0;
  const recoveryRoll = Math.PI * (1 - smooth((time - 111.3) / 12));
  let rotation: Point = falling
    ? tumble(time - RELEASE_TIME)
    : carried
      ? attachment.rotation
      : time >= IMPACT_TIME
        ? [0, 0, recoveryRoll]
        : [0, 0, 0];
  if (falling)
    rotation = rotation.map((v, i) => {
      const rest = i === 2 ? Math.PI : 0;
      const destination = rest + Math.round((v - rest) / (Math.PI * 2)) * Math.PI * 2;
      return v + (destination - v) * landingBlend;
    }) as Point;
  const cough = COUGH_TIMES.reduce((sum, cue) => {
    const dt = time - cue;
    return sum + (dt >= 0 && dt < 0.65 ? Math.sin((dt / 0.65) * Math.PI) * Math.exp(-dt * 3) : 0);
  }, 0);
  const closeup = (time >= 40 && time < 44) || (time >= 58 && time < 63);
  const bullet = falling && time >= SOLAR_TIME && time < SOLAR_TIME + BULLET_DURATION;
  const spotting = time >= 53 && time < 55;
  const shot = spotting
    ? 10
    : closeup
      ? 9
      : time < 4
        ? 0
        : time < 18
          ? 1
          : time < 30
            ? 2
            : time < 44
              ? 3
              : time < 56
                ? 4
                : time < 67
                  ? 5
                  : time < RELEASE_TIME
                    ? 6
                    : time < IMPACT_TIME
                      ? 7
                      : 8;
  let camera: Point, target: Point;
  if (shot === 10) {
    target = add(eagle, rotate([0, 0.22 * EAGLE_SCALE, 0.25 * EAGLE_SCALE], eaglePose.rotation));
    camera = add(target, [10, 3, 17]);
  } else if (shot === 9) {
    const side = time < 44 ? 1 : -1;
    target = add(worm, rotate([0, 0.16, -0.02], rotation));
    camera = add(target, rotate([side * 2.3, 0.7, 1.9], [0, crowPoseSample.rotation[1], 0]));
  } else if (shot === 0) {
    camera = mix([1.3, 1, -3.4], [0.65, 0.55, -3.9], smooth(time / 4));
    target = [0, 0.13, -5.3];
  } else if (shot === 1) {
    camera = mix([0.48, 0.4, -4.2], [0.28, 0.32, -4.35], smooth((time - 4) / 14));
    target = [0, 0.12, -5.08];
  } else if (shot === 2 || shot === 3) {
    target = mix(crow, beakWorld(crow, crowPoseSample.rotation, crowPoseSample.dip), 0.4);
    camera = add(target, shot === 2 ? [16.5, 7.5, 24] : [-15, 6, 21]);
  } else if (shot === 4 || shot === 5) {
    target = mix(crow, attachment.position, 0.35);
    camera = add(target, [24, 9, -34]);
  } else if (shot === 6) {
    ({ target, camera } = attackFrame(time, crow, eagle, worm, rotation));
  } else if (shot === 7) {
    const centre = add(worm, rotate([0, 0.17, -1.05], rotation));
    const u = smooth((time - RELEASE_TIME) / 3);
    const solarYaw = Math.atan2(-SUN_DIRECTION[0], -SUN_DIRECTION[2]);
    const startYaw = Math.atan2(RELEASE_OFFSET[0], RELEASE_OFFSET[2]);
    const orbitalTime = Math.max(0, time - SOLAR_TIME - BULLET_DURATION);
    const orbit = 0.48 * Math.sin(orbitalTime * 0.25) * smooth(orbitalTime / 3);
    const yaw = startYaw + (solarYaw - startYaw) * u + orbit;
    const radius = Math.hypot(...RELEASE_OFFSET) + (8 - Math.hypot(...RELEASE_OFFSET)) * u;
    const elevation =
      Math.asin(RELEASE_OFFSET[1] / Math.hypot(...RELEASE_OFFSET)) +
      (Math.asin(-SUN_DIRECTION[1]) -
        Math.asin(RELEASE_OFFSET[1] / Math.hypot(...RELEASE_OFFSET))) *
        u +
      0.16 * Math.sin(orbitalTime * 0.37) * smooth(orbitalTime / 3);
    const offset: Point = [
      Math.sin(yaw) * Math.cos(elevation) * radius,
      Math.sin(elevation) * radius,
      Math.cos(yaw) * Math.cos(elevation) * radius,
    ];
    // The resting frame travels down with the worm, then becomes the exact ground frame.
    target = mix(centre, add(worm, [0.6, 0.12, -0.5]), landingView);
    const frameOffset = mix(offset, [0.1, 5.08, 0], landingView);
    const frameRadius = radius * (1 - landingView) + Math.hypot(0.1, 5.08) * landingView;
    camera = add(
      target,
      frameOffset.map((v) => (v * frameRadius) / Math.hypot(...frameOffset)) as Point,
    );
  } else {
    const after = time - IMPACT_TIME;
    camera = mix([0.7, 5.2, -5.7], [1.4, 0.8, -3.8], smooth((after - 1.1) / 2.5));
    target = mix([0.6, 0.12, -5.7], [0, 0.12, -6.2], smooth((time - 119) / 5));
    camera = mix(camera, [0, 2.38, -8.98], smooth((time - 124) / (INTRO_DURATION - 124)));
    target = mix(target, [0, 0.55, -5.2], smooth((time - 124) / (INTRO_DURATION - 124)));
  }
  const after = time - IMPACT_TIME;
  const knockdown = after >= 0 ? 1 - smooth((after - 1.1) / 0.4) : 0;
  const headLift =
    after < 1.1
      ? 0
      : 0.055 * smooth((after - 1.1) / 1.5) * (1 - 0.7 * smooth((after - 2.6) / 0.8)) +
        0.035 * smooth((after - 3.6) / 1.4);
  return {
    time,
    motionTime: falling ? RELEASE_TIME + clock.seconds : time,
    phase,
    shot,
    closeup,
    spotting,
    bullet,
    solarStrength: falling ? smooth((time - 76.5) / 1.5) * (1 - smooth((time - 78.7) / 2)) : 0,
    fallSpeed: falling
      ? (FALL_START_SPEED + (FALL_END_SPEED - FALL_START_SPEED) * fall) * clock.rate
      : 0,
    done: seconds >= INTRO_DURATION,
    cough,
    camera,
    target,
    worm,
    rotation,
    crow,
    crowPose: crowPoseSample,
    // Birds remain in the continuous release shot, then leave the falling camera behind.
    crowVisible: time >= 18 && time < 85,
    eagle,
    eaglePose,
    // Enable while fully behind the camera; never toggle a bird on inside a shot.
    eagleVisible: time >= 51 && time < 85,
    carried,
    falling,
    grip: attachment.grip,
    landingBlend,
    landingView,
    knockdown,
    headLift,
    impact: after >= 0 && after < 1.4 ? after / 1.4 : -1,
    rise: smooth((time - 120) / (INTRO_DURATION - 120)),
    handoff: smooth((time - 124) / (INTRO_DURATION - 124)),
    fade: 1 - smooth(time / 1.5),
  };
}
