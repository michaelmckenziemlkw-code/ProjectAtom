import music from '../../assets/music/WormTheme.json' with { type: 'json' };

/** Choreography follows the complete user MIDI render, including its release tail. */
export const INTRO_DURATION = music.audioDuration;
export const RELEASE_TIME = 90;
export const IMPACT_TIME = 110;
export const COUGH_TIMES = [5.5, 6.4, 14, 119.2] as const;
export type Point = [number, number, number];
export const clamp = (x: number) => Math.max(0, Math.min(1, x));
const smooth = (x: number) => {
  const t = clamp(x);
  return t * t * (3 - 2 * t);
};
const mix = (a: Point, b: Point, t: number): Point => a.map((v, i) => v + (b[i]! - v) * t) as Point;
const add = (a: Point, b: Point): Point => a.map((v, i) => v + b[i]!) as Point;

export function sampleIntro(seconds: number) {
  const time = Math.max(0, Math.min(INTRO_DURATION, seconds));
  const phase =
    time < 18
      ? 'puddle'
      : time < 30
        ? 'approach'
        : time < 34
          ? 'capture'
          : time < 65
            ? 'ascent'
            : time < 82
              ? 'flight'
              : time < RELEASE_TIME
                ? 'attack'
                : time < IMPACT_TIME
                  ? 'fall'
                  : 'aftermath';
  const takeoff = smooth((time - 32) / 33);
  const returnAbovePuddle = 1 - smooth((time - 76) / 14);
  let crow: Point =
    time < 30
      ? mix([5, 5.5, -1], [0, 0.7, -5.65], smooth((time - 18) / 12))
      : [
          Math.sin((time - 34) * 0.13) * 5 * takeoff * returnAbovePuddle,
          0.7 + 44.3 * takeoff,
          -5.65 + Math.sin((time - 34) * 0.1) * 4 * takeoff * returnAbovePuddle,
        ];
  if (time >= RELEASE_TIME)
    crow = mix([0, 45, -5.65], [18, 56, 18], smooth((time - RELEASE_TIME) / 9));
  const carried = time >= 32 && time < RELEASE_TIME;
  const falling = phase === 'fall';
  const fall = clamp((time - RELEASE_TIME) / (IMPACT_TIME - RELEASE_TIME));
  const worm: Point = carried
    ? add(crow, [0, -0.7, 0.45])
    : falling
      ? [
          Math.sin(fall * Math.PI * 2) * 0.6,
          44.3 * (1 - fall * fall),
          -5.2 + Math.sin(fall * Math.PI) * 0.5,
        ]
      : [0, 0, -5.2];
  // Three slow rotations over twenty seconds. No scream, flailing or changing face.
  const rotation: Point = falling
    ? [fall * Math.PI * 2, fall * Math.PI * 0.8, fall * Math.PI * 2]
    : carried
      ? [0, 0, Math.sin(time * 1.7) * 0.06]
      : [0, 0, 0];
  const eagleVisible = time >= 80 && time < 102;
  const eagle: Point =
    time < RELEASE_TIME
      ? mix([14, 55, 4], [0.35, 45.1, -5.4], smooth((time - 80) / 10))
      : mix([0.35, 45.1, -5.4], [19, 57, 16], smooth((time - RELEASE_TIME) / 10));
  const cough = COUGH_TIMES.reduce((sum, cue) => {
    const dt = time - cue;
    return sum + (dt >= 0 && dt < 0.65 ? Math.sin((dt / 0.65) * Math.PI) * Math.exp(-dt * 3) : 0);
  }, 0);
  const shot =
    time < 10
      ? 0
      : time < 18
        ? 1
        : time < 30
          ? 2
          : time < 44
            ? 3
            : time < 65
              ? 4
              : time < 82
                ? 5
                : time < RELEASE_TIME
                  ? 6
                  : time < IMPACT_TIME
                    ? 7
                    : 8;
  let camera: Point, target: Point;
  if (shot === 0) {
    camera = mix([-2.8, 2.7, -7.3], [-1.25, 1.15, -6.6], smooth(time / 10));
    target = [0, 0.22, -5.6];
  } else if (shot === 1) {
    camera = mix([0.85, 1, -3.65], [0.42, 0.7, -4.25], smooth((time - 10) / 8));
    target = [0, 0.22, -5.5];
  } else if (shot === 2) {
    camera = add(crow, [2.8, 1.5, 3.3]);
    target = add(crow, [0, -0.3, 0]);
  } else if (shot === 3) {
    camera = add(crow, [-3.2, 1.3, 3.8]);
    target = add(crow, [0, -0.3, 0]);
  } else if (shot === 4 || shot === 5) {
    const angle = (time - 44) * 0.045;
    camera = add(crow, [Math.cos(angle) * 5, 1.5, Math.sin(angle) * 5]);
    target = add(crow, [0, -0.3, 0]);
  } else if (shot === 6) {
    target = mix(crow, eagle, 0.5);
    camera = add(target, mix([8, 4, 18], [3.8, 1.8, 5.5], smooth((time - 82) / 8)));
  } else if (shot === 7) {
    // Follow the rotated body's centre, not the head anchor: the whole worm stays in frame.
    const [rx, ry, rz] = rotation;
    const vx = -0.18 * Math.sin(rz),
      vy = 0.18 * Math.cos(rz);
    const by = vy * Math.cos(rx) + 0.7 * Math.sin(rx);
    const bz = vy * Math.sin(rx) - 0.7 * Math.cos(rx);
    target = add(worm, [
      vx * Math.cos(ry) + bz * Math.sin(ry),
      by,
      -vx * Math.sin(ry) + bz * Math.cos(ry),
    ]);
    camera = add(target, [2.8, 1.1, 4.1]);
  } else {
    camera = mix([1.2, 0.8, -3.8], [0, 2.38, -8.98], smooth((time - 124) / (INTRO_DURATION - 124)));
    target = mix([0, 0.16, -5.6], [0, 0.55, -5.2], smooth((time - 124) / (INTRO_DURATION - 124)));
  }
  return {
    time,
    phase,
    shot,
    done: seconds >= INTRO_DURATION,
    cough,
    camera,
    target,
    worm,
    rotation,
    crow,
    crowVisible: time >= 18 && time < 101,
    eagle,
    eagleVisible,
    carried,
    falling,
    impact: time >= IMPACT_TIME && time < IMPACT_TIME + 1.4 ? (time - IMPACT_TIME) / 1.4 : -1,
    // End lying in the puddle. Locomotion only takes over after the prologue.
    rise: 0,
    handoff: smooth((time - 128) / (INTRO_DURATION - 128)),
    fade: 1 - smooth(time / 1.5),
  };
}
