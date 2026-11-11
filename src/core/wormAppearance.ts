/** Visual condition only; gameplay HP and damage are not implemented yet. */
export const DEFAULT_WORM_CONDITION = 0.55;
type RGB = [number, number, number];
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
    skin: blend(0xb9a69b, 0x98634f),
    band: blend(0x98887e, 0x794c3a),
    droop: (1 - hp) * 0.022,
  };
}
