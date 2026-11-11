import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Scene } from '@babylonjs/core/scene';
import type { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import type { Point } from '../../core/birds.ts';
import { ellipsoid, moveSegment, segment } from '../meshTools.ts';

/** Two articulated bones and three curling toes; the palm is the shared world-space grip anchor. */
export function createRaptorLeg(
  scene: Scene,
  root: TransformNode,
  side: number,
  scales: StandardMaterial,
  claw: StandardMaterial,
) {
  const hip = new Vector3(side * 0.12, -0.15, -0.13);
  const knee = new Vector3(side * 0.15, -0.3, 0.05);
  const ankle = new Vector3(side * 0.13, -0.42, 0.21);
  const upper = segment(scene, 'eagle-thigh', hip, knee, 0.032, scales, root);
  const joint = ellipsoid(
    scene,
    'eagle-knee',
    knee,
    new Vector3(0.032, 0.032, 0.032),
    scales,
    root,
  );
  const lower = segment(scene, 'eagle-shin', knee, ankle, 0.023, scales, root);
  const foot = new TransformNode(side < 0 ? 'eagle-foot-left' : 'eagle-foot-right', scene);
  foot.parent = root;
  ellipsoid(scene, 'eagle-ankle', Vector3.Zero(), new Vector3(0.035, 0.025, 0.045), scales, foot);
  const toes = Array.from({ length: 3 }, (_, i) => {
    const path = Array.from(
      { length: 5 },
      (_, j) => new Vector3((i - 1) * 0.038, -j * 0.01, j * 0.04),
    );
    const mesh = MeshBuilder.CreateTube(
      'eagle-curling-toe',
      { path, radiusFunction: (j) => 0.015 - j * 0.002, tessellation: 8, updatable: true },
      scene,
    );
    mesh.parent = foot;
    mesh.material = scales;
    const tip = MeshBuilder.CreateTube(
      'eagle-claw-hook',
      {
        path: [path[3]!, path[4]!],
        radiusFunction: (j) => (j ? 0.002 : 0.009),
        tessellation: 8,
        updatable: true,
      },
      scene,
    );
    tip.parent = foot;
    tip.material = claw;
    return { path, mesh, tip, i };
  });
  return {
    present(target: Point | undefined, grasp: number) {
      ankle.copyFromFloats(...(target ?? [side * 0.13, -0.42, 0.21]));
      knee.copyFrom(Vector3.Lerp(hip, ankle, 0.48));
      knee.x += side * 0.025;
      knee.z += 0.09;
      joint.position.copyFrom(knee);
      moveSegment(upper, hip, knee);
      moveSegment(lower, knee, ankle);
      foot.position.copyFrom(ankle);
      foot.rotation.z = -side * (0.2 + 0.4 * grasp);
      toes.forEach(({ path, mesh, tip, i }) => {
        const spread = (i - 1) * (0.055 - grasp * 0.012);
        path[0]!.set((i - 1) * 0.025, 0, 0);
        path[1]!.set(spread, -0.025, 0.07);
        path[2]!.set(spread * 1.3, -0.04 - grasp * 0.035, 0.14);
        path[3]!.set(spread * 1.2, -0.06 - grasp * 0.075, 0.2 - grasp * 0.035);
        path[4]!.set(spread, -0.08 - grasp * 0.08, 0.23 - grasp * 0.16);
        MeshBuilder.CreateTube(
          'eagle-curling-toe',
          { path, radiusFunction: (j) => 0.015 - j * 0.002, instance: mesh },
          scene,
        );
        MeshBuilder.CreateTube(
          'eagle-claw-hook',
          { path: [path[3]!, path[4]!], radiusFunction: (j) => (j ? 0.002 : 0.009), instance: tip },
          scene,
        );
      });
    },
  };
}
