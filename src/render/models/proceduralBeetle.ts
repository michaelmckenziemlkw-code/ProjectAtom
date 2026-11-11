import { Color3 } from '@babylonjs/core/Maths/math.color';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Scene } from '@babylonjs/core/scene';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { sampleGesture } from '../../core/motion.ts';
import type { SymbolKind } from '../../core/observation.ts';
import type { BeetleActor } from './beetle.ts';
import { ellipsoid, material, moveSegment, segment } from '../meshTools.ts';

export function createProceduralBeetle(scene: Scene): BeetleActor {
  const root = new TransformNode('beetle', scene);
  const body = new TransformNode('beetle-body', scene);
  body.parent = root;
  const shell = material(scene, 'shell-jade', '#284e46', 90);
  shell.specularColor = new Color3(0.28, 0.36, 0.22);
  const edge = material(scene, 'shell-edge', '#6f8960', 45);
  const belly = material(scene, 'belly-ochre', '#9e743c', 20);
  const black = material(scene, 'eyes', '#0b1917', 110);
  const legMat = material(scene, 'jointed-legs', '#354438', 35);
  const ivory = material(scene, 'belly-ivory', '#ffdda1', 20);
  ivory.emissiveColor = new Color3(0.08, 0.035, 0.005);

  ellipsoid(
    scene,
    'abdomen',
    new Vector3(0, 0.93, 0.4),
    new Vector3(0.83, 0.57, 1.06),
    belly,
    body,
  );
  for (const side of [-1, 1]) {
    const wing = ellipsoid(
      scene,
      'elytron',
      new Vector3(side * 0.38, 1.14, 0.42),
      new Vector3(0.49, 0.54, 1.08),
      shell,
      body,
    );
    wing.rotation.z = -side * 0.08;
    // Fine ridges catch the light, keeping the two wing cases readable.
    for (let i = 0; i < 3; i++) {
      const ridge = MeshBuilder.CreateTube(
        'shell-ridge',
        {
          path: Array.from({ length: 13 }, (_, j) => {
            const t = (j / 12) * Math.PI;
            return new Vector3(
              side * (0.19 + i * 0.17) * Math.sin(t),
              1.18 + (0.47 - i * 0.045) * Math.sin(t),
              0.4 - 0.95 * Math.cos(t),
            );
          }),
          radius: 0.014,
          tessellation: 5,
        },
        scene,
      );
      ridge.material = edge;
      ridge.parent = body;
    }
  }
  ellipsoid(
    scene,
    'pronotum',
    new Vector3(0, 1.06, -0.65),
    new Vector3(0.67, 0.44, 0.45),
    shell,
    body,
  );
  ellipsoid(scene, 'head', new Vector3(0, 0.99, -1.12), new Vector3(0.47, 0.32, 0.4), shell, body);
  for (const side of [-1, 1]) {
    ellipsoid(
      scene,
      'compound-eye',
      new Vector3(side * 0.37, 1.08, -1.28),
      new Vector3(0.14, 0.17, 0.14),
      black,
      body,
    );
    const antenna = MeshBuilder.CreateTube(
      'antenna',
      {
        path: [
          new Vector3(side * 0.22, 1.16, -1.37),
          new Vector3(side * 0.43, 1.48, -1.62),
          new Vector3(side * 0.69, 1.53, -1.8),
        ],
        radius: 0.025,
        tessellation: 7,
      },
      scene,
    );
    antenna.material = legMat;
    antenna.parent = body;
    ellipsoid(
      scene,
      'antenna-tip',
      new Vector3(side * 0.69, 1.53, -1.8),
      new Vector3(0.055, 0.065, 0.11),
      edge,
      body,
    );
    segment(
      scene,
      'mandible',
      new Vector3(side * 0.2, 0.89, -1.4),
      new Vector3(side * 0.12, 0.76, -1.62),
      0.045,
      legMat,
      body,
    );
  }

  // The mark is on the underside, exposed by the rearing pose, never a HUD label.
  const chest = ellipsoid(
    scene,
    'ventral-plate',
    new Vector3(0, 0.65, -0.59),
    new Vector3(0.5, 0.37, 0.26),
    belly,
    body,
  );
  chest.rotation.x = -0.2;
  const marks = new Map<SymbolKind, TransformNode>();
  for (const kind of ['ring', 'fork', 'bars'] as const) {
    const mark = new TransformNode(`mark-${kind}`, scene);
    mark.parent = body;
    mark.position.set(0, 0.55, -0.846);
    marks.set(kind, mark);
    if (kind === 'ring') {
      const ring = MeshBuilder.CreateTorus(
        'mark-ring',
        { diameter: 0.37, thickness: 0.055, tessellation: 32 },
        scene,
      );
      ring.rotation.x = Math.PI / 2;
      ring.material = ivory;
      ring.parent = mark;
    } else if (kind === 'bars') {
      for (const x of [-0.11, 0.11])
        segment(
          scene,
          'mark-bar',
          new Vector3(x, -0.18, 0),
          new Vector3(x, 0.18, 0),
          0.026,
          ivory,
          mark,
        );
    } else {
      segment(
        scene,
        'mark-stem',
        new Vector3(0, -0.19, 0),
        new Vector3(0, 0.02, 0),
        0.026,
        ivory,
        mark,
      );
      for (const side of [-1, 1])
        segment(
          scene,
          'mark-fork',
          new Vector3(0, 0.02, 0),
          new Vector3(side * 0.16, 0.18, 0),
          0.026,
          ivory,
          mark,
        );
    }
  }

  const legs: {
    upper: Mesh;
    lower: Mesh;
    toe: Mesh;
    knee: Mesh;
    shoulder: Vector3;
    side: number;
    row: number;
  }[] = [];
  for (const side of [-1, 1])
    for (let row = 0; row < 3; row++) {
      const z = -0.65 + row * 0.75;
      const shoulder = new Vector3(side * 0.56, 0.83, z);
      const knee = new Vector3(side * 1.14, 0.65, z + (row - 1) * 0.3);
      const foot = new Vector3(side * 1.6, 0.12, z + (row - 1) * 0.55);
      legs.push({
        upper: segment(scene, 'femur', shoulder, knee, 0.09, legMat, root),
        lower: segment(scene, 'tibia', knee, foot, 0.06, legMat, root),
        toe: ellipsoid(scene, 'tarsus', foot, new Vector3(0.09, 0.07, 0.16), black, root),
        knee: ellipsoid(scene, 'knee', knee, new Vector3(0.1, 0.1, 0.1), edge, root),
        shoulder,
        side,
        row,
      });
    }
  return {
    root,
    present(state) {
      const breath = Math.sin(state.seconds * 1.8) * 0.015;
      body.rotation.x = (state.walking === undefined ? 0.6 : 0.16) + breath;
      for (const [kind, node] of marks) node.setEnabled(kind === state.symbol);
      for (const leg of legs) {
        const active = leg.side === 1 && leg.row === 0;
        const target = sampleGesture(state.gesture, state.seconds).foot;
        const phase =
          (state.walking ?? 0) * 8 + leg.row * Math.PI * 0.65 + (leg.side === 1 ? Math.PI : 0);
        const foot =
          state.walking !== undefined
            ? new Vector3(
                leg.side * 1.55,
                0.12 + Math.max(0, Math.sin(phase)) * 0.32,
                leg.shoulder.z + Math.cos(phase) * 0.42,
              )
            : active
              ? new Vector3(target.x, target.y, target.z)
              : new Vector3(leg.side * 1.6, 0.12, leg.shoulder.z + (leg.row - 1) * 0.55);
        // Bend outwards. The foot has a stable ground target while the body breathes.
        const knee = active
          ? new Vector3(1.05, 0.72 + foot.y * 0.42, -0.75 + (foot.z + 1) * 0.3)
          : new Vector3(leg.side * 1.14, 0.65, leg.shoulder.z + (leg.row - 1) * 0.3);
        moveSegment(leg.upper, leg.shoulder, knee);
        moveSegment(leg.lower, knee, foot);
        leg.knee.position.copyFrom(knee);
        leg.toe.position.copyFrom(foot);
      }
    },
    dispose() {
      root.dispose(false, true);
    },
  };
}
