import music from '../../assets/music/WormTheme.json' with { type: 'json' };
import {
  add,
  mix,
  smooth,
  clamp,
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
export const COUGH_TIMES = [5.5, 6.4, 14, 119.2] as const;
const CONTACT: Point = [0, GRIP_SEGMENT[1], -5.2 + GRIP_SEGMENT[2]];
const groundCrow = add(CONTACT, beakLocal(1.3).map((v) => -v * CROW_SCALE) as Point);
function crowPath(t: number): Point {
  if (t < 30)
    return mix([groundCrow[0], 14, groundCrow[2] - 22], groundCrow, smooth((t - 18) / 12));
  if (t < RELEASE_TIME) {
    const lift = smooth((t - 32) / 24),
      returning = 1 - smooth((t - 62) / 13);
    return add(groundCrow, [
      Math.sin((t - 34) * 0.13) * 8 * lift * returning,
      44 * lift,
      Math.sin((t - 34) * 0.1) * 5 * lift * returning,
    ]);
  }
  return mix(add(groundCrow, [0, 44, 0]), [28, 61, 24], smooth((t - RELEASE_TIME) / 12));
}
function eaglePath(t: number): Point {
  const contact = add(groundCrow, [1, 47, -1.5]);
  return t < RELEASE_TIME
    ? mix(add(contact, [25, 16, -28]), contact, smooth((t - 65) / 10))
    : mix(contact, [26, 64, 20], smooth((t - RELEASE_TIME) / 12));
}
const velocity = (path: (t: number) => Point, t: number): Point =>
  path(t + 0.025).map((v, i) => (v - path(t - 0.025)[i]!) / 0.05) as Point;
function crowPose(t: number) {
  const grounded = t >= 29.9 && t <= 32;
  const dip = 1.3 * smooth((t - 30) / 2) * (1 - smooth((t - 32) / 6));
  const open =
    smooth((t - 30) / 0.8) * (1 - smooth((t - 31.6) / 0.4)) + 0.7 * smooth((t - 74.6) / 0.4);
  const pose = flightRig(t, crowPath(t), velocity(crowPath, t), false, dip, open, grounded);
  const lift = smooth((t - 32) / 3);
  if (t >= 30 && t < 35) pose.rotation = pose.rotation.map((v) => v * lift) as Point;
  // Settle into the escape bearing before release instead of turning at a zero-speed cusp.
  const escapeYaw = Math.atan2(28 - groundCrow[0], 24 - groundCrow[2]);
  const turn = smooth((t - 69) / 5);
  const delta = Math.atan2(
    Math.sin(escapeYaw - pose.rotation[1]),
    Math.cos(escapeYaw - pose.rotation[1]),
  );
  pose.rotation[1] += delta * turn;
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
const release = { ...baseRelease, position: add(baseRelease.position, [0, SKY_LIFT, 0]) };

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
  // A cinematic altitude cheat at the attack cut: birds, worm and camera move together.
  const altitude: Point = time >= 67 ? [0, SKY_LIFT, 0] : [0, 0, 0];
  const crowPoseSample = crowPose(time);
  crowPoseSample.position = add(crowPoseSample.position, altitude);
  const crow = crowPoseSample.position;
  const eaglePose = flightRig(time, eaglePath(time), velocity(eaglePath, time), true);
  eaglePose.position = add(eaglePose.position, altitude);
  const eagle = eaglePose.position;
  eaglePose.rotation[1] = -0.73 + 1.46 * smooth((time - 74) / 5);
  const carried = time >= 32 && time < RELEASE_TIME,
    falling = phase === 'fall';
  const fall = clamp((time - RELEASE_TIME) / (IMPACT_TIME - RELEASE_TIME));
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
  // Same slow angular speed as the previous 20-second fall, now over 35 seconds.
  const spin = (time - RELEASE_TIME) / 20;
  const rotation: Point = falling
    ? [spin * Math.PI * 2, release.rotation[1] + spin * Math.PI * 0.8, spin * Math.PI * 2]
    : carried
      ? attachment.rotation
      : [0, 0, 0];
  const cough = COUGH_TIMES.reduce((sum, cue) => {
    const dt = time - cue;
    return sum + (dt >= 0 && dt < 0.65 ? Math.sin((dt / 0.65) * Math.PI) * Math.exp(-dt * 3) : 0);
  }, 0);
  const closeup = (time >= 40 && time < 44) || (time >= 58 && time < 63);
  const shot = closeup
    ? 9
    : time < 10
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
    const push = smooth((time - (side === 1 ? 40 : 58)) / 5);
    target = add(worm, rotate([0, 0.2, -0.02], rotation));
    camera = add(
      target,
      rotate(
        [side * (1.8 - 0.15 * push), 0.55, 1.5 - 0.1 * push],
        [0, crowPoseSample.rotation[1], 0],
      ),
    );
  } else if (shot === 0) {
    camera = mix([-2.8, 2.7, -7.3], [-1.25, 1.15, -6.6], smooth(time / 10));
    target = [0, 0.22, -5.6];
  } else if (shot === 1) {
    camera = mix([0.85, 1, -3.65], [0.42, 0.7, -4.25], smooth((time - 10) / 8));
    target = [0, 0.22, -5.5];
  } else if (shot === 2 || shot === 3) {
    target = mix(crow, beakWorld(crow, crowPoseSample.rotation, crowPoseSample.dip), 0.4);
    camera = add(target, shot === 2 ? [11, 5, 16] : [-10, 4, 14]);
  } else if (shot === 4 || shot === 5) {
    const angle = (time - 44) * 0.035;
    target = mix(crow, attachment.position, 0.35);
    camera = add(target, [Math.cos(angle) * 19, 5, Math.sin(angle) * 19]);
  } else if (shot === 6) {
    target = mix(crow, eagle, 0.5);
    camera = add(target, mix([22, 10, 35], [14, 6, 24], smooth((time - 67) / 8)));
  } else if (shot === 7) {
    target = add(worm, rotate([0, 0.18, -0.7], rotation));
    camera = add(target, [2.8, 1.1, 4.1]);
  } else {
    camera = mix([1.2, 0.8, -3.8], [0, 2.38, -8.98], smooth((time - 124) / (INTRO_DURATION - 124)));
    target = mix([0, 0.16, -5.6], [0, 0.55, -5.2], smooth((time - 124) / (INTRO_DURATION - 124)));
  }
  return {
    time,
    phase,
    shot,
    closeup,
    fallSpeed: falling ? FALL_START_SPEED + (FALL_END_SPEED - FALL_START_SPEED) * fall : 0,
    done: seconds >= INTRO_DURATION,
    cough,
    camera,
    target,
    worm,
    rotation,
    crow,
    crowPose: crowPoseSample,
    crowVisible: time >= 18 && time < 91,
    eagle,
    eaglePose,
    eagleVisible: time >= 65 && time < 91,
    carried,
    falling,
    grip: attachment.grip,
    impact: time >= IMPACT_TIME && time < IMPACT_TIME + 1.4 ? (time - IMPACT_TIME) / 1.4 : -1,
    rise: smooth((time - 120) / (INTRO_DURATION - 120)),
    handoff: smooth((time - 124) / (INTRO_DURATION - 124)),
    fade: 1 - smooth(time / 1.5),
  };
}
