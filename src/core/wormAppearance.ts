/** Visual condition only; gameplay HP and damage are not implemented yet. */
export const DEFAULT_WORM_CONDITION = 0.35;
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
    skin: blend(0xb9b5ae, 0xbd8275),
    band: blend(0x96928d, 0x97574f),
    droop: (1 - hp) * 0.022,
  };
}
