import { introSegment, WORM_RADIUS } from '../../core/wormPose.ts';
import { wormAppearance } from '../../core/wormAppearance.ts';
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
  function condition(hp?: number) {
    const appearance = wormAppearance(hp);
    skin.diffuseColor.set(...appearance.skin);
    band.diffuseColor.set(...appearance.band);
  }
  condition();
  const black = material(scene, 'worm-eyes', '#151318', 65);
  const pearl = material(scene, 'worm-eye-highlight', '#f3ded2', 40);
  const head = new TransformNode('worm-head', scene);
  head.parent = root;
  const segments = Array.from({ length: WORM_SEGMENTS }, (_, i) => {
    const radius = WORM_RADIUS * (1 - i * 0.045);
    return ellipsoid(
      scene,
      `worm-segment-${i}`,
      new Vector3(0, 0.22, -i * 0.14),
      new Vector3(radius, radius * 0.78, 0.19),
      i === 3 || i === 4 ? band : skin,
      root,
    );
  });
  const lids: ReturnType<typeof ellipsoid>[] = [];
  for (const side of [-1, 1]) {
    ellipsoid(
      scene,
      'worm-eye',
      new Vector3(side * 0.078, 0.055, 0.15),
      new Vector3(0.041, 0.043, 0.033),
      black,
      head,
    );
    const lid = ellipsoid(
      scene,
      'worm-tired-lid',
      new Vector3(side * 0.078, 0.083, 0.164),
      new Vector3(0.044, 0.024, 0.025),
      skin,
      head,
    );
    lid.setEnabled(true);
    lids.push(lid);
    ellipsoid(
      scene,
      'worm-eye-shine',
      new Vector3(side * 0.08, 0.07, 0.176),
      new Vector3(0.012, 0.012, 0.008),
      pearl,
      head,
    );
  }
  function syncHead() {
    head.position.copyFrom(segments[0]!.position);
    head.rotation.copyFrom(segments[0]!.rotation);
  }
  return {
    condition,
    presentIntro(sample: ReturnType<typeof sampleIntro>) {
      lids.forEach((lid) => lid.setEnabled(true));
      root.position.copyFromFloats(...sample.worm);
      root.rotation.copyFromFloats(...sample.rotation);
      const compression =
        sample.impact >= 0 ? Math.sin(Math.min(1, sample.impact * 3) * Math.PI) * 0.15 : 0;
      root.scaling.set(1 + compression * 0.3, 1 - compression, 1);
      const weakness = 1 - sample.rise;
      segments.forEach((segment, i) => {
        const pose = introSegment(sample, i);
        segment.position.copyFromFloats(...pose);
        const forward = introSegment(sample, i > 0 ? i - 1 : 0);
        const back = introSegment(sample, i > 0 ? i : 1);
        const dx = forward[0] - back[0],
          dy = forward[1] - back[1],
          dz = forward[2] - back[2];
        segment.rotation.set(
          -Math.atan2(dy, Math.hypot(dx, dz)),
          Math.atan2(dx, dz),
          sample.falling ? 0 : -0.5 * weakness,
        );
        segment.scaling.z = 0.19;
      });
      syncHead();
    },
    present(walk: WalkSession, seconds: number) {
      lids.forEach((lid) => lid.setEnabled(true));
      root.position.set(walk.x, 0, walk.z);
      root.rotation.setAll(0);
      root.scaling.setAll(1);
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
      syncHead();
    },
    dispose() {
      root.dispose(false, true);
    },
  };
}
