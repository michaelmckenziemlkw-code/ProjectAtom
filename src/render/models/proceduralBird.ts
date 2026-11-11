import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Scene } from '@babylonjs/core/scene';
import type { Point } from '../../core/cinematic.ts';
import { ellipsoid, material, segment } from '../meshTools.ts';

export function createProceduralBird(scene: Scene, eagle = false) {
  const name = eagle ? 'eagle' : 'crow';
  const root = new TransformNode(name, scene);
  const feathers = material(scene, `${name}-feathers`, eagle ? '#62432b' : '#151b26', 22);
  const tips = material(scene, `${name}-wing-tips`, '#171b24', 12);
  const face = eagle ? material(scene, 'eagle-white-head', '#d6d3c3', 12) : feathers;
  const beak = material(scene, `${name}-beak`, eagle ? '#c99c42' : '#333944', 25);
  const eyes = material(scene, `${name}-eyes`, '#050608', 60);
  ellipsoid(
    scene,
    `${name}-body`,
    new Vector3(0, 0, 0),
    new Vector3(0.25, 0.29, 0.62),
    feathers,
    root,
  );
  ellipsoid(
    scene,
    `${name}-head`,
    new Vector3(0, 0.24, 0.52),
    new Vector3(0.22, 0.23, 0.24),
    face,
    root,
  );
  const bill = MeshBuilder.CreateCylinder(
    `${name}-bill`,
    { height: 0.34, diameterTop: 0, diameterBottom: 0.18, tessellation: 8 },
    scene,
  );
  bill.parent = root;
  bill.material = beak;
  bill.position.set(0, 0.2, 0.84);
  bill.rotation.x = Math.PI / 2;
  const wings = [-1, 1].map((side) => {
    ellipsoid(
      scene,
      `${name}-eye`,
      new Vector3(side * 0.18, 0.3, 0.64),
      new Vector3(0.035, 0.035, 0.035),
      eyes,
      root,
    );
    segment(
      scene,
      `${name}-leg`,
      new Vector3(side * 0.12, -0.15, -0.13),
      new Vector3(side * 0.13, -0.5, -0.03),
      0.025,
      beak,
      root,
    );
    for (let toe = 0; toe < 3; toe++)
      segment(
        scene,
        `${name}-talon`,
        new Vector3(side * 0.13, -0.5, -0.03),
        new Vector3(side * 0.13 + (toe - 1) * 0.045, -0.54, 0.13),
        0.014,
        beak,
        root,
      );
    const wing = new TransformNode(`${name}-wing`, scene);
    wing.parent = root;
    wing.position.set(side * 0.17, 0.1, 0);
    ellipsoid(
      scene,
      `${name}-wing-cover`,
      new Vector3(side * 0.5, 0, -0.05),
      new Vector3(0.64, 0.045, 0.31),
      feathers,
      wing,
    );
    for (let i = 0; i < 6; i++) {
      const feather = ellipsoid(
        scene,
        `${name}-primary`,
        new Vector3(side * (0.66 + i * 0.13), 0, -0.23 - i * 0.065),
        new Vector3(0.4 - i * 0.025, 0.025, 0.09),
        tips,
        wing,
      );
      feather.rotation.y = side * (0.45 + i * 0.09);
    }
    return { wing, side };
  });
  for (let i = -2; i <= 2; i++) {
    const tail = ellipsoid(
      scene,
      `${name}-tail`,
      new Vector3(i * 0.06, 0.04, -0.75),
      new Vector3(0.07, 0.03, 0.35),
      tips,
      root,
    );
    tail.rotation.y = i * 0.12;
  }
  root.scaling.setAll(eagle ? 1.6 : 1);
  root.setEnabled(false);
  return {
    present(position: Point, seconds: number, visible: boolean, attacking = false) {
      root.setEnabled(visible);
      root.position.copyFromFloats(...position);
      root.rotation.set(
        attacking ? 0.12 : -0.08,
        attacking ? -0.5 : 0,
        Math.sin(seconds * 0.7) * 0.08,
      );
      for (const { wing, side } of wings)
        wing.rotation.z = side * Math.sin(seconds * (eagle ? 4 : 6.4)) * 0.55;
    },
  };
}
