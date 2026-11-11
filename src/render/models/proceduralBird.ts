import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Scene } from '@babylonjs/core/scene';
import { CROW_SCALE, EAGLE_SCALE, NECK } from '../../core/birds.ts';
import type { BirdPose } from '../../core/birds.ts';
import { ellipsoid, material, segment } from '../meshTools.ts';

export function createProceduralBird(scene: Scene, eagle = false) {
  const name = eagle ? 'eagle' : 'crow';
  const root = new TransformNode(name, scene);
  const feathers = material(scene, `${name}-feathers`, eagle ? '#493122' : '#151b26', 22);
  const tips = material(scene, `${name}-wing-tips`, '#10151d', 12);
  const face = eagle ? material(scene, 'eagle-white-head', '#c2beb0', 12) : feathers;
  const beak = material(scene, `${name}-beak`, eagle ? '#a78232' : '#333944', 25);
  const eyes = material(scene, `${name}-eyes`, eagle ? '#b98030' : '#050608', 60);
  const pupil = material(scene, `${name}-pupil`, '#06080b', 50);
  ellipsoid(
    scene,
    `${name}-body`,
    new Vector3(0, 0, 0),
    new Vector3(eagle ? 0.3 : 0.25, 0.29, 0.62),
    feathers,
    root,
  );
  const head = new TransformNode(`${name}-neck`, scene);
  head.parent = root;
  head.position.copyFromFloats(...NECK);
  ellipsoid(
    scene,
    `${name}-head`,
    new Vector3(0, 0.09, 0.18),
    new Vector3(eagle ? 0.19 : 0.22, 0.2, eagle ? 0.29 : 0.24),
    face,
    head,
  );
  const bill = MeshBuilder.CreateCylinder(
    `${name}-bill`,
    { height: 0.34, diameterTop: 0, diameterBottom: eagle ? 0.21 : 0.16, tessellation: 8 },
    scene,
  );
  bill.parent = head;
  bill.material = beak;
  bill.position.set(0, 0.04, 0.52);
  bill.rotation.x = Math.PI / 2;
  const jaw = new TransformNode(`${name}-jaw`, scene);
  jaw.parent = head;
  jaw.position.set(0, 0.015, 0.35);
  ellipsoid(
    scene,
    `${name}-lower-beak`,
    new Vector3(0, 0, 0.16),
    new Vector3(0.065, 0.018, 0.18),
    beak,
    jaw,
  );
  if (eagle) {
    const hook = MeshBuilder.CreateTube(
      'eagle-hook',
      {
        path: [
          new Vector3(0, 0.04, 0.63),
          new Vector3(0, 0.025, 0.69),
          new Vector3(0, -0.025, 0.72),
          new Vector3(0, -0.08, 0.71),
        ],
        radiusFunction: (i) => [0.035, 0.028, 0.016, 0.003][i]!,
        tessellation: 8,
      },
      scene,
    );
    hook.parent = head;
    hook.material = beak;
  }
  const wings = [-1, 1].map((side) => {
    ellipsoid(
      scene,
      `${name}-eye`,
      new Vector3(side * 0.18, 0.15, 0.3),
      new Vector3(0.033, 0.029, 0.035),
      eyes,
      head,
    );
    if (eagle) {
      ellipsoid(
        scene,
        'eagle-pupil',
        new Vector3(side * 0.2, 0.15, 0.32),
        new Vector3(0.013, 0.021, 0.019),
        pupil,
        head,
      );
      const brow = ellipsoid(
        scene,
        'eagle-brow',
        new Vector3(side * 0.17, 0.19, 0.31),
        new Vector3(0.085, 0.028, 0.09),
        feathers,
        head,
      );
      brow.rotation.z = side * 0.28;
    }
    const leg = new TransformNode(`${name}-leg-root`, scene);
    leg.parent = root;
    segment(
      scene,
      `${name}-leg`,
      new Vector3(side * 0.12, -0.15, -0.13),
      new Vector3(side * 0.13, -0.5, -0.03),
      0.025,
      beak,
      leg,
    );
    for (let toe = 0; toe < 3; toe++)
      segment(
        scene,
        `${name}-talon`,
        new Vector3(side * 0.13, -0.5, -0.03),
        new Vector3(side * 0.13 + (toe - 1) * 0.045, -0.54, 0.13),
        0.014,
        beak,
        leg,
      );
    const wing = new TransformNode(`${name}-shoulder`, scene);
    wing.parent = root;
    wing.position.set(side * 0.17, 0.1, 0);
    ellipsoid(
      scene,
      `${name}-wing-cover`,
      new Vector3(side * 0.35, 0, -0.05),
      new Vector3(0.48, 0.045, 0.31),
      feathers,
      wing,
    );
    const wrist = new TransformNode(`${name}-wrist`, scene);
    wrist.parent = wing;
    wrist.position.set(side * 0.65, 0, -0.08);
    for (let i = 0; i < 7; i++) {
      const feather = ellipsoid(
        scene,
        `${name}-primary`,
        new Vector3(side * (0.13 + i * 0.11), 0, -0.12 - i * 0.065),
        new Vector3(0.42 - i * 0.025, 0.022, 0.085),
        tips,
        wrist,
      );
      feather.rotation.y = side * (0.42 + i * 0.09);
    }
    return { wing, wrist, side, leg };
  });
  const tailRoot = new TransformNode(`${name}-tail-root`, scene);
  tailRoot.parent = root;
  for (let i = -2; i <= 2; i++) {
    const tail = ellipsoid(
      scene,
      `${name}-tail`,
      new Vector3(i * 0.06, 0.04, -0.75),
      new Vector3(0.07, 0.03, 0.35),
      tips,
      tailRoot,
    );
    tail.rotation.y = i * (eagle ? 0.18 : 0.12);
  }
  root.scaling.setAll(eagle ? EAGLE_SCALE : CROW_SCALE);
  root.setEnabled(false);
  return {
    present(pose: BirdPose, seconds: number, visible: boolean) {
      root.setEnabled(visible);
      root.position.copyFromFloats(...pose.position);
      root.rotation.copyFromFloats(...pose.rotation);
      head.rotation.x = pose.dip;
      jaw.rotation.x = pose.open * 0.55;
      tailRoot.rotation.x = Math.sin(seconds * 1.4) * 0.05;
      for (const { wing, wrist, side, leg } of wings) {
        wing.rotation.z = side * pose.flap;
        wing.rotation.y = side * (1 - pose.spread) * 0.45;
        wrist.rotation.z = side * (pose.flap * 0.3 - pose.fold * 0.8);
        wrist.rotation.y = side * pose.fold * 0.75;
        leg.rotation.x = pose.dip > 0.9 ? 0 : -0.65 * (1 - Math.min(1, pose.dip));
      }
    },
    hide() {
      root.setEnabled(false);
    },
  };
}
