import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Scene } from '@babylonjs/core/scene';
import type { WalkSession } from '../../core/walk.ts';
import { ellipsoid, material } from '../meshTools.ts';

export function createProceduralWorm(scene: Scene) {
  const root = new TransformNode('worm', scene);
  const skin = material(scene, 'worm-skin', '#bd8275', 38);
  const band = material(scene, 'worm-band', '#97574f', 25);
  const black = material(scene, 'worm-eyes', '#151318', 65);
  const pearl = material(scene, 'worm-eye-highlight', '#f3ded2', 40);
  const segments = Array.from({ length: 11 }, (_, i) => {
    const radius = 0.235 * (1 - i * 0.045);
    return ellipsoid(
      scene,
      `worm-segment-${i}`,
      new Vector3(0, 0.22, -i * 0.14),
      new Vector3(radius, radius * 0.78, 0.19),
      i === 3 || i === 4 ? band : skin,
      root,
    );
  });
  for (const side of [-1, 1]) {
    ellipsoid(
      scene,
      'worm-eye',
      new Vector3(side * 0.125, 0.31, 0.145),
      new Vector3(0.041, 0.043, 0.033),
      black,
      root,
    );
    ellipsoid(
      scene,
      'worm-eye-shine',
      new Vector3(side * 0.128, 0.328, 0.171),
      new Vector3(0.012, 0.012, 0.008),
      pearl,
      root,
    );
  }
  return {
    present(walk: WalkSession, seconds: number) {
      root.position.set(walk.x, 0, walk.z);
      root.rotation.y = walk.heading;
      segments.forEach((segment, i) => {
        segment.position.x = Math.sin(walk.distance * 9 - i * 0.6) * 0.045 * (i / 10);
        segment.position.y =
          0.22 + Math.sin(walk.distance * 12 - i * 0.65) * 0.018 + Math.sin(seconds * 1.5) * 0.005;
        segment.scaling.z = 0.19 * (1 + Math.sin(walk.distance * 12 - i * 0.65) * 0.1);
      });
    },
    dispose() {
      root.dispose(false, true);
    },
  };
}
