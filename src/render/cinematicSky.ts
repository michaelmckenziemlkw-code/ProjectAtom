import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Scene } from '@babylonjs/core/scene';
import { SUN_POSITION, SUN_RADIUS } from '../core/cinematic.ts';
import type { sampleIntro } from '../core/cinematic.ts';
import { material } from './meshTools.ts';

export function createCinematicSky(scene: Scene) {
  const cloudMat = material(scene, 'sky-cloud-volume', '#e4edf9', 1);
  cloudMat.specularColor.setAll(0);
  cloudMat.emissiveColor.set(0.1, 0.14, 0.21);
  const clouds: Mesh[] = [];
  for (let layer = 0; layer < 12; layer++)
    for (let bank = 0; bank < 4; bank++) {
      const i = layer * 4 + bank,
        angle = (bank * Math.PI) / 2 + layer * 0.37;
      const radius = 23 + (i % 4) * 7;
      const centre = new Vector3(
        Math.cos(angle) * radius,
        18 + layer * 18 + Math.sin(i) * 2,
        -6 + Math.sin(angle) * radius,
      );
      const lobes: Mesh[] = [];
      for (let lobe = 0; lobe < 6; lobe++) {
        const a = lobe * 2.4;
        const mesh = MeshBuilder.CreateIcoSphere(
          'sky-cloud-lobe',
          { radius: 1, subdivisions: 4, flat: false },
          scene,
        );
        mesh.position.copyFrom(
          centre.add(
            new Vector3(Math.cos(a) * (lobe ? 4 : 0), Math.sin(a * 1.7) * 1.5, Math.sin(a) * 3),
          ),
        );
        const size = lobe === 0 ? 1.25 : 0.65 + (lobe % 3) * 0.16;
        mesh.scaling.set(
          (6 + (i % 3)) * size,
          (3.6 + (i % 2)) * size,
          (4.5 + (i % 4) * 0.4) * size,
        );
        mesh.material = cloudMat;
        lobes.push(mesh);
      }
      const merged = Mesh.MergeMeshes(lobes, true, true)!;
      merged.name = `sky-cloud-bank-${i}`;
      merged.receiveShadows = false;
      merged.setEnabled(false);
      clouds.push(merged);
    }
  const mistTex = new DynamicTexture('sky-mist-noise', { width: 256, height: 256 }, scene, false);
  const mctx = mistTex.getContext() as CanvasRenderingContext2D;
  for (let i = 0; i < 9; i++) {
    const x = 45 + ((i * 67) % 170),
      y = 35 + ((i * 43) % 180);
    const gradient = mctx.createRadialGradient(x, y, 2, x, y, 65);
    gradient.addColorStop(0, 'rgba(220,238,255,0.18)');
    gradient.addColorStop(1, 'rgba(220,238,255,0)');
    mctx.fillStyle = gradient;
    mctx.fillRect(0, 0, 256, 256);
  }
  mistTex.hasAlpha = true;
  mistTex.update();
  const mistMat = material(scene, 'sky-near-mist', '#ffffff', 1);
  mistMat.diffuseTexture = mistTex;
  mistMat.useAlphaFromDiffuseTexture = true;
  mistMat.emissiveColor.set(0.65, 0.78, 0.9);
  mistMat.disableLighting = true;
  mistMat.disableDepthWrite = true;
  const mist = Array.from({ length: 25 }, (_, i) => {
    const plane = MeshBuilder.CreatePlane(`sky-near-mist-${i}`, { width: 13, height: 7 }, scene);
    plane.billboardMode = Mesh.BILLBOARDMODE_ALL;
    plane.position.set(-1 + Math.sin(i * 1.6) * 2.5, 12 + i * 10, -1 + (i % 3) * 0.8);
    plane.material = mistMat;
    plane.setEnabled(false);
    return plane;
  });
  const sunTex = new DynamicTexture('sky-sun-radiance', { width: 256, height: 256 }, scene, false);
  const ctx = sunTex.getContext() as CanvasRenderingContext2D;
  const glow = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  glow.addColorStop(0, 'rgba(255,255,243,1)');
  glow.addColorStop(0.48, 'rgba(255,253,220,1)');
  glow.addColorStop(0.61, 'rgba(255,238,172,0.88)');
  glow.addColorStop(0.8, 'rgba(255,226,146,0.18)');
  glow.addColorStop(1, 'rgba(255,226,146,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 256, 256);
  sunTex.hasAlpha = true;
  sunTex.update();
  const sunMat = material(scene, 'sky-sun-light', '#ffffff', 1);
  sunMat.diffuseTexture = sunTex;
  sunMat.useAlphaFromDiffuseTexture = true;
  sunMat.emissiveTexture = sunTex;
  sunMat.emissiveColor.setAll(1);
  sunMat.disableLighting = true;
  sunMat.disableDepthWrite = true;
  const sun = MeshBuilder.CreatePlane('sky-sun-disc', { size: (SUN_RADIUS * 2) / 0.61 }, scene);
  sun.position.copyFromFloats(...SUN_POSITION);
  sun.billboardMode = Mesh.BILLBOARDMODE_ALL;
  sun.material = sunMat;
  sun.setEnabled(false);
  return {
    present(sample: ReturnType<typeof sampleIntro> | null) {
      const visible = sample !== null && sample.time >= 18 && sample.time < 112;
      clouds.forEach((cloud) => cloud.setEnabled(visible));
      sun.setEnabled(sample !== null && sample.falling);
      mist.forEach((plane) => {
        const distance = sample ? Math.abs(plane.position.y - sample.worm[1]) : Infinity;
        plane.setEnabled(!!sample?.falling && distance < 7 && !sample.bullet);
        plane.visibility = Math.max(0, 1 - distance / 7) * 0.65;
      });
    },
  };
}
