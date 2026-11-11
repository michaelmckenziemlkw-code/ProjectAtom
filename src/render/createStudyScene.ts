import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { Engine } from '@babylonjs/core/Engines/engine';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { Scene } from '@babylonjs/core/scene';
import { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { BeetleFactory, BeetlePresentation } from './models/beetle.ts';
import { createProceduralBeetle } from './models/proceduralBeetle.ts';
import { createEnvironment } from './environment.ts';

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
    'observation-camera',
    -Math.PI / 2 + 0.4,
    1.12,
    9,
    new Vector3(0.2, 0.7, -0.2),
    scene,
  );
  camera.lowerRadiusLimit = 3.8;
  camera.upperRadiusLimit = 13;
  camera.lowerBetaLimit = 0.45;
  camera.upperBetaLimit = 1.44;
  camera.lowerAlphaLimit = -Math.PI + 0.15;
  camera.upperAlphaLimit = -0.1;
  camera.wheelPrecision = 40;
  camera.pinchPrecision = 80;
  camera.panningSensibility = 0;
  camera.attachControl(canvas, true);
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
  const shadows = new ShadowGenerator(1024, sun);
  shadows.usePercentageCloserFiltering = true;
  shadows.filteringQuality = ShadowGenerator.QUALITY_LOW;
  shadows.bias = 0.0007;
  shadows.normalBias = 0.02;
  for (const mesh of scene.meshes) {
    mesh.receiveShadows = true;
    if (mesh.name !== 'soil' && !mesh.name.startsWith('dust')) shadows.addShadowCaster(mesh);
  }
  let cameraMove: { alpha: number; beta: number; radius: number } | null = null;
  let dirty = true;
  let cameraDirtyUntil = 0;
  let lastPose = '';
  canvas.addEventListener('pointerdown', cancelCameraMove);
  canvas.addEventListener('wheel', cancelCameraMove);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('keydown', cancelCameraMove);
  canvas.addEventListener('keyup', cancelCameraMove);
  function cancelCameraMove() {
    cameraMove = null;
    cameraDirtyUntil = performance.now() + 1500;
  }
  function onPointerMove(event: PointerEvent) {
    if (event.buttons) cancelCameraMove();
  }
  const resize = () => {
    engine.resize();
    dirty = true;
  };
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
    invalidate() {
      dirty = true;
    },
    focus(close: boolean) {
      cameraMove = {
        alpha: -Math.PI / 2 + 0.4,
        beta: close ? 1.34 : 1.12,
        radius: close ? 5.9 : 9,
      };
    },
    quality(low: boolean) {
      shadows.mapSize = low ? 512 : 1024;
      engine.setHardwareScalingLevel(
        low ? Math.max(1.5, window.devicePixelRatio) : Math.max(1, window.devicePixelRatio / 1.5),
      );
      dirty = true;
    },
    present(state: BeetlePresentation, delta: number) {
      const pose = `${state.gesture}:${state.symbol}:${state.seconds}`;
      const poseChanged = pose !== lastPose;
      if (poseChanged) {
        actor.present(state);
        environment.present(state.gesture, state.seconds);
        lastPose = pose;
      }
      const moving = cameraMove !== null;
      if (cameraMove) {
        const f = 1 - Math.exp(-delta * 7);
        camera.alpha += (cameraMove.alpha - camera.alpha) * f;
        camera.beta += (cameraMove.beta - camera.beta) * f;
        camera.radius += (cameraMove.radius - camera.radius) * f;
        if (
          Math.abs(camera.alpha - cameraMove.alpha) +
            Math.abs(camera.beta - cameraMove.beta) +
            Math.abs(camera.radius - cameraMove.radius) <
          0.001
        ) {
          camera.alpha = cameraMove.alpha;
          camera.beta = cameraMove.beta;
          camera.radius = cameraMove.radius;
          cameraMove = null;
        }
      }
      if (poseChanged || moving || dirty || performance.now() < cameraDirtyUntil) {
        scene.render();
        dirty = false;
        return true;
      }
      return false;
    },
    dispose() {
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('pointerdown', cancelCameraMove);
      canvas.removeEventListener('wheel', cancelCameraMove);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('keydown', cancelCameraMove);
      canvas.removeEventListener('keyup', cancelCameraMove);
      canvas.removeEventListener('webglcontextlost', onContextLost);
      actor.dispose();
      scene.dispose();
      engine.dispose();
    },
  };
}
