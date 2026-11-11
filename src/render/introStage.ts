import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import type { Scene } from '@babylonjs/core/scene';
import { COUGH_TIMES, IMPACT_TIME } from '../core/cinematic.ts';
import { ellipsoid, material, segment } from './meshTools.ts';

/** Small persistent set at the player spawn: wet mud, leaves, water, tiny blood flecks. */
export function createIntroStage(scene: Scene) {
  const mud = material(scene, 'wet-mud', '#302e2c', 90);
  const water = material(scene, 'puddle-water', '#394c56', 150);
  water.specularColor = new Color3(0.7, 0.8, 0.9);
  ellipsoid(scene, 'puddle-bank', new Vector3(0, -0.04, -6.1), new Vector3(1.5, 0.08, 1.9), mud);
  ellipsoid(scene, 'puddle', new Vector3(0, 0.018, -6.1), new Vector3(1.25, 0.018, 1.65), water);
  const deadLeaf = material(scene, 'wet-leaf', '#524135', 65);
  const vein = material(scene, 'wet-leaf-vein', '#80705a', 30);
  for (let i = 0; i < 12; i++) {
    const angle = i * 2.399;
    const radius = 0.9 + (i % 3) * 0.25;
    const paths = [-1, 0, 1].map((side) =>
      Array.from({ length: 9 }, (_, j) => {
        const t = j / 8;
        return new Vector3(
          side * Math.pow(Math.sin(t * Math.PI), 0.8) * 0.19,
          Math.sin(t * Math.PI) * (side === 0 ? 0.055 : 0.012) + t * t * 0.04,
          (t - 0.5) * 0.68,
        );
      }),
    );
    const leaf = MeshBuilder.CreateRibbon(
      'intro-dead-leaf',
      { pathArray: paths, sideOrientation: 2 },
      scene,
    );
    leaf.material = deadLeaf;
    leaf.position.set(Math.cos(angle) * radius, 0.055, -6.1 + Math.sin(angle) * radius * 1.2);
    leaf.rotation.set(0.08, angle, (i % 2 ? -1 : 1) * 0.12);
    segment(
      scene,
      'intro-leaf-vein',
      new Vector3(0, 0.015, -0.34),
      new Vector3(0, 0.075, 0.34),
      0.004,
      vein,
      leaf,
    );
    for (const side of [-1, 1])
      for (let j = 0; j < 3; j++) {
        segment(
          scene,
          'intro-leaf-vein',
          new Vector3(0, 0.06, -0.17 + j * 0.14),
          new Vector3(side * 0.14, 0.03, -0.08 + j * 0.14),
          0.002,
          vein,
          leaf,
        );
      }
  }
  const blood = material(scene, 'cough-blood', '#631e26', 30);
  const drops = Array.from({ length: COUGH_TIMES.length * 6 }, (_, i) =>
    ellipsoid(
      scene,
      'cough-drop',
      Vector3.Zero(),
      new Vector3(0.016 + (i % 3) * 0.004, 0.01, 0.022),
      blood,
    ),
  );
  const rippleMat = material(scene, 'impact-ripple', '#7f9aa7', 80);
  const ripples = [0, 1, 2].map((i) => {
    const ring = MeshBuilder.CreateTorus(
      'impact-ripple',
      { diameter: 1, thickness: 0.018, tessellation: 48 },
      scene,
    );
    ring.position.set(0, 0.045, -5.5);
    ring.material = rippleMat;
    ring.setEnabled(false);
    return { ring, delay: i * 0.18 };
  });
  const origins = COUGH_TIMES.map(() => new Vector3(0, 0.13, -5.04));
  let lastTime = -1;
  return {
    present(seconds: number | null, mouth?: Vector3) {
      if (seconds === null || seconds < lastTime)
        origins.forEach((origin) => origin.set(0, 0.13, -5.04));
      if (seconds !== null)
        COUGH_TIMES.forEach((cue, i) => {
          if (lastTime < cue && seconds >= cue && seconds - cue < 0.8 && mouth)
            origins[i]!.copyFrom(mouth);
        });
      lastTime = seconds ?? -1;
      for (const { ring, delay } of ripples) {
        const dt = seconds === null ? -1 : seconds - IMPACT_TIME - delay;
        ring.setEnabled(dt >= 0 && dt < 1.2);
        ring.scaling.setAll(0.25 + Math.max(0, dt) * 1.7);
        ring.scaling.y = 0.25;
      }
      drops.forEach((drop, i) => {
        const dt = seconds === null ? -1 : seconds - COUGH_TIMES[Math.floor(i / 6)]!;
        drop.setEnabled(dt >= 0);
        const t = Math.min(0.45, Math.max(0, dt));
        const origin = origins[Math.floor(i / 6)]!;
        drop.position.set(
          origin.x + t * (-0.25 + (i % 6) * 0.12),
          Math.max(0.047, origin.y + t * 0.35 - t * t * 2.2),
          origin.z + t * (0.65 + (i % 3) * 0.2),
        );
        drop.scaling.y = dt > 0.45 ? 0.003 : 0.008;
      });
    },
  };
}
