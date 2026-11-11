import { annulusGroove } from '../core/wormSurface.ts';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import type { Scene } from '@babylonjs/core/scene';
import { wormAppearance } from '../core/wormAppearance.ts';
import type { RGB } from '../core/wormAppearance.ts';
import { material } from './meshTools.ts';
const smooth = (v: number) => {
  const t = Math.max(0, Math.min(1, v));
  return t * t * (3 - 2 * t);
};
function hash(x: number, y: number, period: number) {
  const s = Math.sin((((x % period) + period) % period) * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
function noise(u: number, v: number, width: number, height: number) {
  const x = u * width,
    y = v * height,
    a = Math.floor(x),
    b = Math.floor(y),
    tx = smooth(x - a),
    ty = smooth(y - b);
  const top = hash(a, b, width) * (1 - tx) + hash(a + 1, b, width) * tx;
  const bottom = hash(a, b + 1, width) * (1 - tx) + hash(a + 1, b + 1, width) * tx;
  return top * (1 - ty) + bottom * ty;
}
export function createWormSkin(scene: Scene) {
  const skin = material(scene, 'worm-skin', '#ffffff', 70),
    headSkin = material(scene, 'worm-face-skin', '#ffffff', 60);
  for (const mat of [skin, headSkin]) mat.specularColor.set(0.28, 0.23, 0.2);
  const texture = new DynamicTexture(
    'worm-mottled-skin',
    { width: 256, height: 1024 },
    scene,
    false,
  );
  const faceTexture = new DynamicTexture(
    'worm-face-texture',
    { width: 256, height: 256 },
    scene,
    false,
  );
  texture.wrapV = 0;
  skin.diffuseTexture = texture;
  headSkin.diffuseTexture = faceTexture;
  function paint(target: DynamicTexture, hp: number, face: boolean) {
    const a = wormAppearance(hp),
      size = target.getSize(),
      ctx = target.getContext(),
      pixels = new ImageData(size.width, size.height);
    for (let y = 0; y < size.height; y++)
      for (let x = 0; x < size.width; x++) {
        const u = x / (size.width - 1),
          v = y / (size.height - 1);
        const n = noise(u, v, 12, face ? 10 : 32),
          fine = noise(u, v, 48, face ? 36 : 120);
        const mask = face
          ? smooth((n + fine * 0.16 - 0.63) / 0.12) * 0.23
          : smooth((n + (fine - 0.5) * 0.35 - (1 - a.patchCoverage)) / 0.18);
        const base: RGB = face
          ? (a.face.map((v, i) => v * 0.75 + a.skin[i]! * 0.25) as RGB)
          : a.skin;
        const girdle = face ? 0 : smooth((v - 0.205) / 0.015) * (1 - smooth((v - 0.3) / 0.015));
        const ring = face ? 1 : 1 - 0.22 * annulusGroove(v);
        const light = (face ? 0.96 : 0.88 + 0.1 * Math.sin(u * Math.PI * 2)) + (fine - 0.5) * 0.1;
        const offset = (y * size.width + x) * 4;
        for (let channel = 0; channel < 3; channel++) {
          const brown = base[channel]! * (1 - girdle * 0.25) + a.band[channel]! * girdle * 0.25;
          pixels.data[offset + channel] = Math.round(
            255 * (brown * (1 - mask) + a.patch[channel]! * mask) * light * ring,
          );
        }
        pixels.data[offset + 3] = 255;
      }
    ctx.putImageData(pixels, 0, 0);
    target.update(false);
  }
  function condition(hp = 0.55) {
    hp = Number.isFinite(hp) ? Math.max(0, Math.min(1, hp)) : 0;
    const a = wormAppearance(hp);
    paint(texture, hp, false);
    paint(faceTexture, hp, true);
    skin.metadata = {
      baseColor: Color3.FromArray(a.skin).toHexString(),
      condition: hp,
      pattern: 'reference-mottles-v1',
    };
    return a;
  }
  return { skin, headSkin, condition };
}
