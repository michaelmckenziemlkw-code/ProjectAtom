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
} from './birds.ts';
import type { Point } from './birds.ts';
export type { Point } from './birds.ts';
export const INTRO_DURATION = music.audioDuration;
export const RELEASE_TIME = 75;
export const IMPACT_TIME = 110;
export const BULLET_DURATION = 0.7;
export const COUGH_TIMES = [5.5, 6.4, 14, 119.2] as const;
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
  const contact = add(cruise(RELEASE_TIME), [1, 3, -1.5]);
  if (t < RELEASE_TIME) return mix(add(contact, [25, 16, 28]), contact, smooth((t - 65) / 10));
  const s = t - RELEASE_TIME;
  const p1 = add(contact, [-3, -1, -3.4]),
    p2 = add(contact, [-6, 2, 8]),
    p3 = add(contact, [0, 6, 16]);
  if (s >= 3) return add(p3, [6 * (s - 3), 4 * (s - 3), 8 * (s - 3)]);
  const u = s / 3,
    v = 1 - u;
  return contact.map(
    (p, i) => v ** 3 * p + 3 * v * v * u * p1[i]! + 3 * v * u * u * p2[i]! + u ** 3 * p3[i]!,
  ) as Point;
}
const velocity = (path: (t: number) => Point, t: number): Point =>
  path(t + 0.025).map((v, i) => (v - path(t - 0.025)[i]!) / 0.05) as Point;
function crowPose(t: number) {
  const grounded = t >= 29.9 && t <= 32;
  const dip = 1.3 * smooth((t - 30) / 2) * (1 - smooth((t - 32) / 6));
  const open =
    smooth((t - 30) / 0.8) * (1 - smooth((t - 31.6) / 0.4)) + 0.7 * smooth((t - 74.6) / 0.4);
  const pose = flightRig(t, crowPath(t), velocity(crowPath, t), false, dip, open, grounded);
  if (t >= 30 && t < 35)
    pose.rotation = pose.rotation.map((v) => v * smooth((t - 32) / 3)) as Point;
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
export const SUN_POSITION = add(
  add(release.position, rotate([0, 0.17, -1.05], release.rotation)),
  SUN_DIRECTION.map((v) => v * 90) as Point,
);

/** Slow the release, then smoothly repay the lost motion time without changing the music/impact. */
export function fallClock(elapsed: number) {
  const s = Math.max(0, Math.min(FALL_SECONDS, elapsed)),
    slow = 0.12,
    ramp = 1;
  const fast =
    (FALL_SECONDS - slow * (BULLET_DURATION + ramp / 2)) /
    (FALL_SECONDS - BULLET_DURATION - ramp / 2);
  if (s <= BULLET_DURATION) return { seconds: slow * s, rate: slow };
  const u = Math.min(1, (s - BULLET_DURATION) / ramp);
  const integral = u ** 3 - 0.5 * u ** 4;
  return {
    seconds:
      slow * BULLET_DURATION +
      slow * u * ramp +
      (fast - slow) * ramp * integral +
      Math.max(0, s - BULLET_DURATION - ramp) * fast,
    rate: slow + (fast - slow) * smooth(u),
  };
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
  if (time >= 75 && time < 78) eaglePose.rotation[2] += Math.sin(((time - 75) / 3) * Math.PI) * 0.3;
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
      ? [
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
        ]
      : [0, 0, -5.2];
  const landingBlend = falling ? smooth((time - 109.4) / 0.6) : time >= IMPACT_TIME ? 1 : 0;
  const spin = clock.seconds / 20;
  let rotation: Point = falling
    ? [
        spin * Math.PI * 2,
        release.rotation[1] + spin * Math.PI * 0.8,
        release.rotation[2] + spin * Math.PI * 2,
      ]
    : carried
      ? attachment.rotation
      : [0, 0, 0];
  if (falling)
    rotation = rotation.map(
      (v) => v + (Math.round(v / (Math.PI * 2)) * Math.PI * 2 - v) * landingBlend,
    ) as Point;
  const cough = COUGH_TIMES.reduce((sum, cue) => {
    const dt = time - cue;
    return sum + (dt >= 0 && dt < 0.65 ? Math.sin((dt / 0.65) * Math.PI) * Math.exp(-dt * 3) : 0);
  }, 0);
  const closeup = (time >= 40 && time < 44) || (time >= 58 && time < 63);
  const bullet = falling && time < RELEASE_TIME + BULLET_DURATION;
  const shot = closeup
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
  if (shot === 9) {
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
    target = mix(crow, eagle, 0.5);
    camera = add(target, mix([66, 22.5, 18], [51, 15, 22.5], smooth((time - 67) / 8)));
  } else if (shot === 7) {
    target = add(worm, rotate([0, 0.17, -1.05], rotation));
    const solarOffset = SUN_DIRECTION.map((v) => -v * 8) as Point;
    const orbit = smooth((time - 75.7) / 4);
    const direction = mix(solarOffset, [3.8, 1.5, 5.5], orbit);
    const radius = 8 + (Math.hypot(3.8, 1.5, 5.5) - 8) * orbit;
    const offset = direction.map((v) => (v * radius) / Math.hypot(...direction)) as Point;
    camera = add(target, mix(offset, [0.45, 2.5, 4.3], smooth((time - 107) / 3)));
  } else {
    const after = time - IMPACT_TIME;
    camera = mix([0.15, 5.2, -6.2], [1.2, 0.8, -3.8], smooth(after - 1.1));
    target = [0, 0.12, -6.2];
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
    bullet,
    solarStrength: falling ? 1 - smooth((time - 75.7) / 1.3) : 0,
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
    // The release cuts to an isolated solar portrait; the pursuit stays outside this shot.
    crowVisible: time >= 18 && time < RELEASE_TIME,
    eagle,
    eaglePose,
    eagleVisible: time >= 65 && time < RELEASE_TIME,
    carried,
    falling,
    grip: attachment.grip,
    landingBlend,
    knockdown,
    headLift,
    impact: after >= 0 && after < 1.4 ? after / 1.4 : -1,
    rise: smooth((time - 120) / (INTRO_DURATION - 120)),
    handoff: smooth((time - 124) / (INTRO_DURATION - 124)),
    fade: 1 - smooth(time / 1.5),
  };
}
