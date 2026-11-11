import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildWormSurface,
  groundWormControls,
  headVerticalExtent,
  WORM_FLOOR,
  wormRadius,
  HEAD_RADII,
  WORM_ANNULI,
} from './wormSurface.ts';
import { WORM_SPACING } from './wormBody.ts';
import { introSegment } from './wormPose.ts';
import { sampleIntro } from './cinematic.ts';
import { add, rotate } from './birds.ts';

test('reference body is one closed indexed surface with fine rings and a full rounded tail', () => {
  const s = sampleIntro(90),
    p = Array.from({ length: 11 }, (_, i) => introSegment(s, i));
  const mesh = buildWormSurface(p);
  assert.equal(mesh.positions.length % 3, 0);
  assert.equal(mesh.uvs.length, (mesh.positions.length / 3) * 2);
  assert.ok(mesh.positions.length / 3 > 1500);
  assert.ok(wormRadius(0.9) > wormRadius(0.1) * 0.9);
  assert.ok(wormRadius(0.97) > 0.07);
  assert.ok(HEAD_RADII[0] <= wormRadius(0));
  assert.ok(HEAD_RADII[2] / HEAD_RADII[0] < 1.2);
  const crest = wormRadius(4 / WORM_ANNULI),
    seam = wormRadius(4.5 / WORM_ANNULI);
  assert.ok((crest - seam) / crest >= 0.1 && (crest - seam) / crest <= 0.15);
  const edges = new Map<string, number>();
  // UV seam has duplicate positions; weld before checking watertightness.
  const keys = mesh.positions.reduce<string[]>((out, _, i) => {
    if (i % 3 === 0)
      out.push(
        mesh.positions
          .slice(i, i + 3)
          .map((v) => v.toFixed(6))
          .join(','),
      );
    return out;
  }, []);
  for (let i = 0; i < mesh.indices.length; i += 3)
    for (const [a, b] of [
      [0, 1],
      [1, 2],
      [2, 0],
    ]) {
      const key = [keys[mesh.indices[i + a]!], keys[mesh.indices[i + b]!]].sort().join('/');
      edges.set(key, (edges.get(key) ?? 0) + 1);
    }
  assert.ok([...edges.values()].every((count) => count === 2));
});

test('rotating head and every surface vertex stay above ground through impact and unwinding', () => {
  let checked = 0;
  for (let time = 109.5; time <= 134.174; time += time < 110.5 ? 0.0125 : 0.25) {
    const s = sampleIntro(time),
      raw = Array.from({ length: 11 }, (_, i) => introSegment(s, i));
    const points = groundWormControls(raw, s.worm, s.rotation);
    const mesh = buildWormSurface(points, s.worm, s.rotation);
    for (let i = 0; i < mesh.positions.length; i += 3) {
      const y =
        s.worm[1] +
        rotate([mesh.positions[i]!, mesh.positions[i + 1]!, mesh.positions[i + 2]!], s.rotation)[1];
      assert.ok(y >= WORM_FLOOR - 1e-8, `${time}: surface crossed the floor (${y})`);
      checked++;
    }
    const headY =
      add(s.worm, rotate(points[0]!, s.rotation))[1] - headVerticalExtent(points, s.rotation);
    assert.ok(headY >= WORM_FLOOR - 1e-6, `${time}: head crossed the floor (${headY})`);
  }
  assert.ok(checked > 100000);
});

test('skin normals face outward so the upper surface receives the sunset key light', () => {
  const points: [number, number, number][] = Array.from({ length: 11 }, (_, i) => [
    0,
    0.13,
    -i * WORM_SPACING,
  ]);
  const s = buildWormSurface(points),
    normals: number[] = [];
  VertexData.ComputeNormals(s.positions, s.indices, normals);
  const top = (50 * 17 + 4) * 3;
  assert.ok(normals[top + 1]! > 0.9);
  assert.ok(normals[normals.length - 4]! > 0.9);
  assert.ok(normals[normals.length - 1]! < -0.9);
});

test('floor correction preserves the tail cross-section instead of flattening it into the water', () => {
  const s = sampleIntro(110.3),
    raw = Array.from({ length: 11 }, (_, i) => introSegment(s, i));
  const controls = groundWormControls(raw, s.worm, s.rotation),
    surface = buildWormSurface(controls, s.worm, s.rotation);
  const ring = 100,
    heights = Array.from({ length: 17 }, (_, i) => surface.positions[(ring * 17 + i) * 3 + 1]!);
  assert.ok(Math.max(...heights) - Math.min(...heights) > 0.12);
});
