import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Scene } from '@babylonjs/core/scene';
import type { sampleIntro } from '../../core/cinematic.ts';
import { WORM_SEGMENTS } from '../../core/wormBody.ts';
import type { WalkSession } from '../../core/walk.ts';
import { ellipsoid, material } from '../meshTools.ts';

export function createProceduralWorm(scene: Scene) {
  const root = new TransformNode('worm', scene);
  const skin = material(scene, 'worm-skin', '#bd8275', 38);
  const band = material(scene, 'worm-band', '#97574f', 25);
  const black = material(scene, 'worm-eyes', '#151318', 65);
  const pearl = material(scene, 'worm-eye-highlight', '#f3ded2', 40);
  const head = new TransformNode('worm-head', scene);
  head.parent = root;
  const segments = Array.from({ length: WORM_SEGMENTS }, (_, i) => {
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
      head,
    );
    ellipsoid(
      scene,
      'worm-eye-shine',
      new Vector3(side * 0.128, 0.328, 0.171),
      new Vector3(0.012, 0.012, 0.008),
      pearl,
      head,
    );
  }
  return {
    presentIntro(sample: ReturnType<typeof sampleIntro>) {
      root.position.set(0, 0, -5.2);
      const weakness = 1 - sample.rise;
      head.rotation.set(0, 0, -0.5 * weakness + sample.cough * 0.35);
      head.position.y = -0.07 * weakness + sample.cough * 0.08;
      segments.forEach((segment, i) => {
        segment.position.set(
          Math.sin(i * 0.42) * 0.17 * weakness,
          0.16 +
            0.06 * sample.rise +
            Math.sin(sample.time * 1.8 - i * 0.2) * 0.007 +
            sample.cough * Math.exp(-i * 0.35) * 0.08,
          -i * 0.14,
        );
        segment.rotation.set(0, Math.cos(i * 0.42) * 0.25 * weakness, -0.5 * weakness);
        segment.scaling.z = 0.19;
      });
    },
    present(walk: WalkSession, seconds: number) {
      root.position.set(walk.x, 0, walk.z);
      head.position.set(0, 0, 0);
      head.rotation.set(0, walk.heading, 0);
      segments.forEach((segment, i) => {
        const pose = walk.body.pose(i);
        const heading = i === 0 ? walk.heading : pose.heading;
        const sway = Math.sin(walk.distance * 9 - i * 0.6) * 0.018 * (i / 10);
        segment.position.x = pose.x - walk.x + Math.cos(heading) * sway;
        segment.position.z = pose.z - walk.z - Math.sin(heading) * sway;
        segment.rotation.set(0, heading, 0);
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
