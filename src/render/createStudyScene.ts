import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { Engine } from '@babylonjs/core/Engines/engine';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { Scene } from '@babylonjs/core/scene';
import { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Ray } from '@babylonjs/core/Culling/ray';
import type { BeetleFactory } from './models/beetle.ts';
import type { Observation } from '../core/observation.ts';
import { beetleMotion } from '../core/walk.ts';
import type { WalkSession } from '../core/walk.ts';
import { createProceduralBeetle } from './models/proceduralBeetle.ts';
import { createProceduralWorm } from './models/proceduralWorm.ts';
import { createEnvironment } from './environment.ts';
import { ellipsoid, material, segment } from './meshTools.ts';

export async function createStudyScene(
  canvas: HTMLCanvasElement,
  factory: BeetleFactory = createProceduralBeetle,
) {
  const engine = new Engine(canvas, true, {
    stencil: true,
    preserveDrawingBuffer: true,
    powerPreference: 'high-performance',
  });
  const scene = new Scene(engine);
  scene.clearColor = new Color4(0.14, 0.18, 0.15, 1);
  scene.ambientColor = new Color3(0.16, 0.18, 0.13);
  scene.fogMode = Scene.FOGMODE_EXP2;
  scene.fogDensity = 0.045;
  scene.fogColor = new Color3(0.23, 0.28, 0.22);
  const camera = new ArcRotateCamera(
    'worm-camera',
    -Math.PI / 2,
    1.12,
    4.2,
    new Vector3(0, 0.55, -5.2),
    scene,
  );
  camera.minZ = 0.08; // Controls are supplied by Pointer Lock, never by drag/orbit inputs.
  const fill = new HemisphericLight('sky', new Vector3(-0.5, 1, -0.4), scene);
  fill.intensity = 0.65;
  fill.diffuse = new Color3(0.77, 0.86, 0.82);
  fill.groundColor = new Color3(0.26, 0.2, 0.12);
  const sun = new DirectionalLight('late-sun', new Vector3(-0.65, -1, 0.35), scene);
  sun.position.set(7, 10, -5);
  sun.intensity = 1.05;
  sun.diffuse = new Color3(1, 0.87, 0.63);
  const environment = createEnvironment(scene);
  let actor;
  try {
    actor = await factory(scene);
  } catch (error) {
    scene.dispose();
    engine.dispose();
    throw error;
  }
  const worm = createProceduralWorm(scene);
  const leaf = ellipsoid(
    scene,
    'bedding-leaf',
    new Vector3(2.7, 0.95, -0.2),
    new Vector3(0.52, 0.035, 0.7),
    material(scene, 'bedding-amber', '#cfa25d', 8),
  );
  const veinMat = material(scene, 'leaf-veins', '#866330', 4);
  segment(
    scene,
    'leaf-vein',
    new Vector3(0, 0.045, -0.56),
    new Vector3(0, 0.045, 0.56),
    0.012,
    veinMat,
    leaf,
  );
  // The leaf's child is deliberately small; it follows placement and the carrying pose.
  leaf.setEnabled(false);
  const shadows = new ShadowGenerator(1024, sun);
  shadows.usePercentageCloserFiltering = true;
  shadows.filteringQuality = ShadowGenerator.QUALITY_LOW;
  shadows.bias = 0.0007;
  shadows.normalBias = 0.02;
  for (const mesh of scene.meshes) {
    mesh.receiveShadows = true;
    if (mesh.name !== 'soil' && !mesh.name.startsWith('dust')) shadows.addShadowCaster(mesh);
  }
  const resize = () => engine.resize();
  window.addEventListener('resize', resize);
  const onContextLost = (event: Event) => {
    event.preventDefault();
    canvas.dispatchEvent(
      new CustomEvent('render-failure', {
        detail:
          'Видеоконтекст потерян. Перезагрузи страницу; при повторении попробуй уменьшить качество.',
      }),
    );
  };
  canvas.addEventListener('webglcontextlost', onContextLost);
  return {
    scene,
    engine,
    quality(low: boolean) {
      shadows.mapSize = low ? 512 : 1024;
      engine.setHardwareScalingLevel(
        low ? Math.max(1.5, devicePixelRatio) : Math.max(1, devicePixelRatio / 1.5),
      );
    },
    present(
      observation: Observation,
      walk: WalkSession,
      seconds: number,
      yaw: number,
      pitch: number,
    ) {
      const motion = beetleMotion(seconds, walk.beddingAt);
      actor.present({ ...observation, seconds, walking: motion.walking ? seconds : undefined });
      actor.root.position.set(motion.x, motion.y, motion.z);
      actor.root.rotation.y = motion.heading;
      environment.present(observation.gesture, seconds, motion.stage === 'waiting');
      worm.present(walk, seconds);
      leaf.setEnabled(walk.beddingAt !== null);
      if (motion.carrying) {
        leaf.position.set(
          motion.x - Math.sin(motion.heading) * 1.25,
          motion.y + 0.58,
          motion.z - Math.cos(motion.heading) * 1.25,
        );
        leaf.rotation.set(0.4, motion.heading, 0);
      } else {
        leaf.position.set(2.7, 0.95, -0.2);
        leaf.rotation.set(0, 0, 0);
      }
      const target = new Vector3(walk.x, 0.55, walk.z);
      const desired = new Vector3(
        -Math.sin(yaw) * Math.sin(pitch),
        Math.cos(pitch),
        -Math.cos(yaw) * Math.sin(pitch),
      );
      const ray = new Ray(target, desired, 4.2);
      const hit = scene.pickWithRay(
        ray,
        (mesh) =>
          mesh.name === 'environment-moss' ||
          mesh.name === 'environment-bark' ||
          mesh.name === 'soil',
      );
      camera.alpha = -Math.PI / 2 - yaw;
      camera.beta = pitch;
      camera.radius = hit?.hit ? Math.max(0.65, hit.distance - 0.18) : 4.2;
      camera.setTarget(target);
      scene.render();
      return true;
    },
    dispose() {
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('webglcontextlost', onContextLost);
      worm.dispose();
      actor.dispose();
      scene.dispose();
      engine.dispose();
    },
  };
}
