import { introSegment, WORM_IDLE_Y } from '../../core/wormPose.ts';
import {
  buildWormSurface,
  groundWormControls,
  wormHeadAngles,
  HEAD_RADII,
} from '../../core/wormSurface.ts';
import { DEFAULT_WORM_CONDITION } from '../../core/wormAppearance.ts';
import type { Point } from '../../core/birds.ts';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Scene } from '@babylonjs/core/scene';
import type { sampleIntro } from '../../core/cinematic.ts';
import { WORM_SEGMENTS, WORM_SPACING } from '../../core/wormBody.ts';
import type { WalkSession } from '../../core/walk.ts';
import { ellipsoid, material } from '../meshTools.ts';
import { createWormSkin } from '../wormSkin.ts';

export function createProceduralWorm(scene: Scene) {
  const root = new TransformNode('worm', scene);
  const { skin, headSkin, condition: paint } = createWormSkin(scene);
  const eyeMat = material(scene, 'worm-eyes', '#68615c', 30);
  eyeMat.specularColor.set(0.12, 0.12, 0.11);
  const mouthMat = material(scene, 'worm-mouth', '#493b36', 10);
  const pearl = material(scene, 'worm-eye-highlight', '#b5ada2', 30);
  const head = new TransformNode('worm-head', scene);
  head.parent = root;
  ellipsoid(
    scene,
    'worm-head-shape',
    Vector3.Zero(),
    Vector3.FromArray(HEAD_RADII),
    headSkin,
    head,
  );
  // Non-rendering pose anchors preserve the walking/body and beak attachment contracts.
  const segments = Array.from({ length: WORM_SEGMENTS }, (_, i) => {
    const anchor = new Mesh(`worm-segment-${i}`, scene);
    anchor.parent = root;
    anchor.isVisible = false;
    anchor.position.set(0, WORM_IDLE_Y, -i * WORM_SPACING);
    return anchor;
  });
  const lids: Mesh[] = [];
  for (const side of [-1, 1]) {
    ellipsoid(
      scene,
      'worm-eye',
      new Vector3(side * 0.083, 0.025, 0.075),
      new Vector3(0.01, 0.02, 0.025),
      eyeMat,
      head,
    );
    const lid = ellipsoid(
      scene,
      'worm-tired-lid',
      new Vector3(side * 0.08, 0.039, 0.075),
      new Vector3(0.01, 0.006, 0.023),
      headSkin,
      head,
    );
    lid.rotation.z = side * -0.12;
    lids.push(lid);
    ellipsoid(
      scene,
      'worm-eye-shine',
      new Vector3(side * 0.092, 0.031, 0.077),
      new Vector3(0.0015, 0.002, 0.002),
      pearl,
      head,
    );
  }
  const mouth = MeshBuilder.CreateTube(
    'worm-small-mouth',
    {
      path: [
        new Vector3(-0.017, -0.027, 0.148),
        new Vector3(0, -0.022, 0.155),
        new Vector3(0.017, -0.027, 0.148),
      ],
      radius: 0.002,
      tessellation: 6,
    },
    scene,
  );
  mouth.parent = head;
  mouth.material = mouthMat;
  const body = new Mesh('worm-body-surface', scene);
  body.parent = root;
  body.material = skin;
  let points: Point[] = segments.map((s) => s.position.asArray() as Point);
  const first = buildWormSurface(points);
  const normals: number[] = [];
  VertexData.ComputeNormals(first.positions, first.indices, normals);
  const data = new VertexData();
  data.positions = first.positions;
  data.indices = first.indices;
  data.normals = normals;
  data.uvs = first.uvs;
  data.applyToMesh(body, true);
  const faceMeshes = scene.meshes.filter((mesh) => mesh.parent === head);
  const vertex = new Vector3(),
    world = new Vector3();
  let minWorldY = 0;
  function condition(hp = DEFAULT_WORM_CONDITION) {
    const palette = paint(hp);
    eyeMat.diffuseColor.set(...palette.eye);
  }
  condition();
  function presentPoints(raw: Point[], position: Point, rotation: Point) {
    root.position.copyFromFloats(...position);
    root.rotation.copyFromFloats(...rotation);
    root.scaling.setAll(1);
    points = groundWormControls(raw, position, rotation);
    const angles = wormHeadAngles(points);
    segments.forEach((segment, i) => segment.position.copyFromFloats(...points[i]!));
    head.position.copyFromFloats(...points[0]!);
    head.rotation.copyFromFloats(...angles);
    const surface = buildWormSurface(points, position, rotation);
    VertexData.ComputeNormals(surface.positions, surface.indices, normals);
    body.updateVerticesData(VertexBuffer.PositionKind, surface.positions, true);
    body.updateVerticesData(VertexBuffer.NormalKind, normals);
    body.refreshBoundingInfo();
    // Actual transformed surface bounds, not the centre/root, are reported for landing tests.
    root.computeWorldMatrix(true);
    body.computeWorldMatrix(true);
    const matrix = body.getWorldMatrix();
    minWorldY = Infinity;
    for (let i = 0; i < surface.positions.length; i += 3) {
      vertex.set(surface.positions[i]!, surface.positions[i + 1]!, surface.positions[i + 2]!);
      Vector3.TransformCoordinatesToRef(vertex, matrix, world);
      minWorldY = Math.min(minWorldY, world.y);
    }
  }
  return {
    condition,
    get mouthWorldPosition() {
      return Vector3.TransformCoordinates(
        new Vector3(0, -0.025, 0.153),
        head.computeWorldMatrix(true),
      );
    },
    get minimumSurfaceY() {
      let result = minWorldY;
      for (const mesh of faceMeshes) {
        const vertices = mesh.getVerticesData(VertexBuffer.PositionKind)!;
        const matrix = mesh.computeWorldMatrix(true);
        for (let i = 0; i < vertices.length; i += 3) {
          vertex.set(vertices[i]!, vertices[i + 1]!, vertices[i + 2]!);
          Vector3.TransformCoordinatesToRef(vertex, matrix, world);
          result = Math.min(result, world.y);
        }
      }
      return result;
    },
    presentIntro(sample: ReturnType<typeof sampleIntro>) {
      for (const lid of lids) {
        lid.position.y = 0.039 - sample.knockdown * 0.014;
        lid.scaling.y = 0.006 + sample.knockdown * 0.014;
      }
      presentPoints(
        segments.map((_, i) => introSegment(sample, i)),
        sample.worm,
        sample.rotation,
      );
    },
    present(walk: WalkSession, seconds: number) {
      for (const lid of lids) {
        lid.position.y = 0.039;
        lid.scaling.y = 0.006;
      }
      const raw = segments.map((_, i): Point => {
        const p = walk.body.pose(i),
          heading = i === 0 ? walk.heading : p.heading;
        const sway = Math.sin(walk.distance * 9 - i * 0.6) * 0.012 * (i / 10);
        return [
          p.x - walk.x + Math.cos(heading) * sway,
          WORM_IDLE_Y +
            Math.sin(walk.distance * 12 - i * 0.65) * 0.008 +
            Math.sin(seconds * 1.5) * 0.005,
          p.z - walk.z - Math.sin(heading) * sway,
        ];
      });
      presentPoints(raw, [walk.x, 0, walk.z], [0, 0, 0]);
      head.rotation.y = walk.heading;
    },
    dispose() {
      root.dispose(false, true);
    },
  };
}
