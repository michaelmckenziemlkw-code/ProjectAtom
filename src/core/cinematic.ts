/** The local worm prologue. All choreography is sampled in seconds, never frames. */
export const INTRO_DURATION = 24;
export const COUGH_TIMES = [9.2, 10.1, 16.3] as const;
const clamp = (x: number) => Math.max(0, Math.min(1, x));
const smooth = (x: number) => {
  const t = clamp(x);
  return t * t * (3 - 2 * t);
};
export function sampleIntro(seconds: number) {
  const time = Math.max(0, seconds);
  const shot = time < 8 ? 0 : time < 18 ? 1 : 2;
  const t = smooth(shot === 0 ? time / 8 : shot === 1 ? (time - 8) / 10 : (time - 18) / 6);
  const from = [
    [-2.8, 2.7, -7.3],
    [0.85, 1.0, -3.65],
    [-1.5, 0.9, -5.6],
  ][shot]!;
  const to = [
    [-1.25, 1.15, -6.6],
    [0.42, 0.7, -4.25],
    [0, 2.38, -8.98],
  ][shot]!;
  const cough = COUGH_TIMES.reduce((sum, cue) => {
    const dt = time - cue;
    return sum + (dt >= 0 && dt < 0.65 ? Math.sin((dt / 0.65) * Math.PI) * Math.exp(-dt * 3) : 0);
  }, 0);
  return {
    time,
    shot,
    done: time >= INTRO_DURATION,
    cough,
    camera: from.map((v, i) => v + (to[i]! - v) * t),
    target: [0, 0.22 + 0.33 * smooth((time - 18) / 6), -5.5 + 0.3 * smooth((time - 18) / 6)],
    rise: smooth((time - 20) / 4),
    handoff: smooth((time - 18) / 6),
    fade: 1 - smooth(time / 1.5),
  };
}
