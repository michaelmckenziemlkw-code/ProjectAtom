import { Color3 } from '@babylonjs/core/Maths/math.color';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Scene } from '@babylonjs/core/scene';
import type { Gesture } from '../core/observation.ts';
import { GESTURE_DURATION, sampleGesture } from '../core/motion.ts';
import { ellipsoid, material } from './meshTools.ts';

export function createEnvironment(scene: Scene) {
  const dirt = material(scene, 'loam', '#68543c');
  const moss = material(scene, 'moss', '#485841');
  const rockMat = material(scene, 'stone', '#77796a');
  const bark = material(scene, 'bark', '#44362a');
  const green = material(scene, 'leaves', '#5d7950');
  const leafGold = material(scene, 'fallen-leaf', '#bb8945');
  const grooveMat = material(scene, 'furrows', '#3c3022');
  for (const mat of [moss, rockMat, bark, green, leafGold, grooveMat])
    mat.specularColor = Color3.Black();
  // Local generated texture: no external images, CDN, or network during play.
  const texture = new DynamicTexture('soil-grain', { width: 512, height: 512 }, scene, false);
  const ctx = texture.getContext();
  ctx.fillStyle = '#897150';
  ctx.fillRect(0, 0, 512, 512);
  let seed = 1247;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let i = 0; i < 6500; i++) {
    ctx.fillStyle = random() > 0.5 ? '#947b58' : '#735e42';
    ctx.fillRect(random() * 512, random() * 512, 1 + random() * 3, 1 + random() * 3);
  }
  texture.update();
  texture.uScale = 10;
  texture.vScale = 10;
  dirt.diffuseTexture = texture;
  dirt.specularColor = Color3.Black();
  const floor = MeshBuilder.CreateGround('soil', { width: 40, height: 40 }, scene);
  floor.material = dirt;
  floor.receiveShadows = true;

  for (const side of [-1, 1]) {
    const bank = ellipsoid(
      scene,
      'earth-bank',
      new Vector3(side * 4.1, -0.35, 1),
      new Vector3(2.5, 1.75, 7),
      moss,
    );
    bank.receiveShadows = true;
    for (let i = 0; i < 16; i++) {
      const z = -5 + random() * 12;
      const stone = MeshBuilder.CreateIcoSphere(
        'pebble',
        { radius: 1, subdivisions: 1, flat: true },
        scene,
      );
      stone.position.set(side * (2.15 + random() * 1.2), 0.12 + random() * 0.18, z);
      const size = 0.12 + random() * 0.3;
      stone.scaling.set(size * 1.3, size * 0.65, size);
      stone.rotation.set(random(), random() * 6, random());
      stone.material = rockMat;
    }
    // Large roots frame the passage without covering the active foot.
    const root = MeshBuilder.CreateTube(
      'root',
      {
        path: [
          new Vector3(side * 4, 1.1, -4),
          new Vector3(side * 2.9, 0.5, -1),
          new Vector3(side * 3.2, 1, 2),
          new Vector3(side * 2.8, 2.5, 5),
        ],
        radius: 0.24,
        tessellation: 10,
      },
      scene,
    );
    root.material = bark;
    for (let plant = 0; plant < 9; plant++) {
      const x = side * (2.5 + random() * 1.4),
        z = -4 + random() * 10;
      const baseY =
        -0.35 +
        1.75 * Math.sqrt(Math.max(0, 1 - ((x - side * 4.1) / 2.5) ** 2 - ((z - 1) / 7) ** 2));
      for (let blade = 0; blade < 5; blade++) {
        const angle = (blade / 5) * Math.PI * 2;
        const height = 0.5 + random() * 0.55;
        const stem = MeshBuilder.CreateTube(
          'grass',
          {
            path: [
              new Vector3(x, baseY, z),
              new Vector3(
                x + Math.cos(angle) * 0.2,
                baseY + height * 0.8,
                z + Math.sin(angle) * 0.2,
              ),
              new Vector3(x + Math.cos(angle) * 0.55, baseY + height, z + Math.sin(angle) * 0.55),
            ],
            radius: 0.035,
            tessellation: 4,
          },
          scene,
        );
        stem.material = green;
        for (let l = 1; l <= 3; l++) {
          const leaf = ellipsoid(
            scene,
            'fern-leaf',
            new Vector3(
              x + Math.cos(angle) * l * 0.12,
              baseY + height * (l / 4),
              z + Math.sin(angle) * l * 0.12,
            ),
            new Vector3(0.1, 0.025, 0.24),
            green,
          );
          leaf.rotation.y = -angle;
          leaf.rotation.z = 0.3;
        }
      }
    }
  }
  for (let i = 0; i < 9; i++) {
    const x = (random() - 0.5) * 5,
      z = 2 + random() * 5;
    const leaf = ellipsoid(
      scene,
      'leaf',
      new Vector3(x, 0.08, z),
      new Vector3(0.18, 0.025, 0.4),
      leafGold,
    );
    leaf.rotation.y = random() * 6;
  }
  const arch = MeshBuilder.CreateTube(
    'root-arch',
    {
      path: [
        new Vector3(-4, 0.5, 4),
        new Vector3(-2, 3.4, 4.3),
        new Vector3(0.5, 4.3, 4.6),
        new Vector3(3, 2.5, 4.6),
        new Vector3(4, 0.5, 5),
      ],
      radius: 0.35,
      tessellation: 12,
    },
    scene,
  );
  arch.material = bark;
  for (let i = 0; i < 5; i++)
    ellipsoid(
      scene,
      'seed',
      new Vector3((i - 2) * 0.3, 0.12, 3.3 + (i % 2) * 0.2),
      new Vector3(0.16, 0.1, 0.23),
      leafGold,
    );

  const dustMat = material(scene, 'dust', '#c8aa75');
  dustMat.alpha = 0.5;
  dustMat.specularColor = Color3.Black();
  const dust = Array.from({ length: 8 }, (_, i) =>
    ellipsoid(scene, `dust-${i}`, Vector3.Zero(), new Vector3(0.04, 0.04, 0.04), dustMat),
  );
  const grooves = Array.from({ length: 3 }, (_, i) => {
    const mesh = MeshBuilder.CreateBox(
      'scratch-furrow',
      { width: 0.025, height: 0.008, depth: 1 },
      scene,
    );
    mesh.position.set(1.44 + i * 0.065, 0.009, -1.3);
    mesh.material = grooveMat;
    return mesh;
  });
  // Keep the hand-built foliage cheap: one static draw group per material.
  const batches = new Map<string, Mesh[]>();
  for (const mesh of scene.meshes) {
    if (
      !(mesh instanceof Mesh) ||
      mesh === floor ||
      mesh.name.startsWith('dust') ||
      mesh.name === 'scratch-furrow'
    )
      continue;
    const key = mesh.material!.name;
    const batch = batches.get(key) ?? [];
    batch.push(mesh);
    batches.set(key, batch);
  }
  for (const [name, meshes] of batches) {
    const merged = Mesh.MergeMeshes(meshes, true, true);
    if (merged) {
      merged.name = `environment-${name}`;
      merged.receiveShadows = true;
    }
  }
  return {
    present(gesture: Gesture, seconds: number, active = true) {
      const sample = sampleGesture(gesture, seconds);
      const phase = seconds % GESTURE_DURATION;
      const length =
        gesture === 'scrape' ? Math.max(0, Math.min(1, (phase - 0.5) / 1.9)) * 1.45 : 0;
      for (const groove of grooves) {
        groove.setEnabled(active && length > 0.01);
        groove.scaling.z = Math.max(0.01, length);
        groove.position.z = -2 + length / 2;
      }
      for (let i = 0; i < dust.length; i++) {
        const mote = dust[i];
        mote.setEnabled(active && sample.contact > 0);
        const f = (seconds * 2 + i * 0.13) % 1;
        mote.position.set(
          sample.foot.x + Math.sin(i * 2.1) * f * 0.4,
          0.08 + f * 0.35,
          sample.foot.z + Math.cos(i * 1.8) * f * 0.3,
        );
        mote.scaling.setAll(0.025 + (1 - f) * 0.04);
      }
    },
  };
}
