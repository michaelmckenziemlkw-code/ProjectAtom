/** Visual condition only; gameplay HP and damage are not implemented yet. */
export const DEFAULT_WORM_CONDITION = 0.55;
export type RGB = [number, number, number];
const rgb = (hex: number): RGB => [
  ((hex >> 16) & 255) / 255,
  ((hex >> 8) & 255) / 255,
  (hex & 255) / 255,
];
export function wormAppearance(condition = DEFAULT_WORM_CONDITION) {
  const hp = Number.isFinite(condition) ? Math.max(0, Math.min(1, condition)) : 0;
  const blend = (sick: number, healthy: number): RGB =>
    rgb(sick).map((v, i) => v + (rgb(healthy)[i]! - v) * hp) as RGB;
  return {
    skin: blend(0x827973, 0x804c3a),
    band: blend(0x796760, 0x693e30),
    patch: blend(0xc4bbb5, 0x9e7163),
    face: blend(0xafaaa4, 0x9a6955),
    eye: blend(0x8f8b88, 0x4d4038),
    patchCoverage: 0.82 - hp * 0.68,
    droop: (1 - hp) * 0.022,
  };
}
