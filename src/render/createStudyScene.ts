import { Frustum } from '@babylonjs/core/Maths/math.frustum';
import { WORLD_PALETTE as palette } from './palette.ts';
import { createCinematicSky } from './cinematicSky.ts';
import { ColorCurves } from '@babylonjs/core/Materials/colorCurves';
import { MOUTH, crowGraspTargets, smooth as smoothGrade } from '../core/birds.ts';
import { createProceduralBird } from './models/proceduralBird.ts';
import { sampleIntro, SUN_POSITION } from '../core/cinematic.ts';
import { createIntroStage } from './introStage.ts';
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { Engine } from '@babylonjs/core/Engines/engine';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { Scene } from '@babylonjs/core/scene';
import { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator';
import { Matrix, Vector3 } from '@babylonjs/core/Maths/math.vector';
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
  const grade = new ColorCurves();
  scene.imageProcessingConfiguration.colorCurves = grade;
  scene.imageProcessingConfiguration.colorCurvesEnabled = true;
  scene.clearColor = new Color4(...palette.sky, 1);
  scene.ambientColor = new Color3(0.19, 0.16, 0.19);
  scene.fogMode = Scene.FOGMODE_EXP2;
  scene.fogDensity = 0.045;
  scene.fogColor = new Color3(...palette.fog);
  const camera = new ArcRotateCamera(
    'worm-camera',
    -Math.PI / 2,
    1.12,
    4.2,
    new Vector3(0, 0.55, -5.2),
    scene,
  );
  camera.fov = 1.0;
  camera.minZ = 0.08; // Controls are supplied by Pointer Lock, never by drag/orbit inputs.
  const fill = new HemisphericLight('sky', new Vector3(-0.5, 1, -0.4), scene);
  fill.intensity = 0.75;
  fill.diffuse = new Color3(...palette.fill);
  fill.groundColor = new Color3(0.32, 0.37, 0.4);
  const sun = new DirectionalLight('late-sun', new Vector3(-0.65, -1, 0.35), scene);
  sun.position.set(7, 10, -5);
  sun.intensity = 1.05;
  sun.diffuse = new Color3(...palette.sun);
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
  const crow = createProceduralBird(scene);
  const eagle = createProceduralBird(scene, true);
  const introStage = createIntroStage(scene);
  const sky = createCinematicSky(scene);
  introStage.present(null);
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
    if (mesh.name.startsWith('sky-')) continue;
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
    condition(hp: number) {
      worm.condition(hp);
    },
    presentIntro(seconds: number, observation: Observation) {
      const sample = sampleIntro(seconds);
      actor.root.setEnabled(true);
      actor.present({ ...observation, seconds });
      crow.present(sample.crowPose, seconds, sample.crowVisible);
      eagle.present(sample.eaglePose, seconds, sample.eagleVisible);
      scene.fogDensity = 0.006 + 0.039 * sample.handoff;
      leaf.setEnabled(false);
      sun.diffuse.set(...palette.sun);
      scene.clearColor.set(...palette.sky, 1);
      scene.fogColor.set(...palette.fog);
      sun.intensity = 1.05;
      fill.intensity = 0.75;
      fill.diffuse.set(...palette.fill);
      environment.present('tap', seconds, false);
      worm.presentIntro(sample);
      introStage.present(seconds, worm.mouthWorldPosition);
      sky.present(sample);
      if (
        sample.falling ||
        sample.phase === 'ascent' ||
        sample.phase === 'flight' ||
        sample.phase === 'attack'
      ) {
        scene.clearColor.set(...palette.sky, 1);
        scene.fogColor.set(...palette.fog);
        const settle = sample.falling ? sample.landingView : 0;
        scene.fogDensity = 0.002 + 0.004 * settle;
        fill.intensity = (0.85 - 0.6 * sample.solarStrength) * (1 - settle) + 0.75 * settle;
        fill.diffuse.set(0.68 + 0.02 * settle, 0.82 + 0.02 * settle, 1);
        sun.intensity = (0.95 - 0.55 * sample.solarStrength) * (1 - settle) + 1.05 * settle;
      } else fill.diffuse.set(...palette.fill);
      const exhaustion = smoothGrade((seconds - 109) / 1.8) * (1 - sample.handoff);
      grade.globalSaturation = -30 * exhaustion;
      scene.imageProcessingConfiguration.exposure = 1 - 0.16 * exhaustion;
      camera.fov = 0.75 + 0.25 * sample.handoff;
      camera.setTarget(Vector3.FromArray(sample.target));
      camera.setPosition(Vector3.FromArray(sample.camera));
      scene.render();
      const skinColor = scene.getMaterialByName(
        'worm-skin',
      ) as import('@babylonjs/core/Materials/standardMaterial').StandardMaterial;
      canvas.dataset.wormSkin = skinColor.metadata.baseColor;
      canvas.dataset.wormCondition = String(skinColor.metadata.condition);
      canvas.dataset.wormSurfaceMinY = String(worm.minimumSurfaceY);
      canvas.dataset.wormSurfaceVertices = String(
        scene.getMeshByName('worm-body-surface')!.getTotalVertices(),
      );
      canvas.dataset.eyeAnchor = String(
        Vector3.Distance(
          scene.getMeshByName('worm-eye')!.getAbsolutePosition(),
          scene.getMeshByName('worm-segment-0')!.getAbsolutePosition(),
        ),
      );
      canvas.dataset.localWormTail = scene
        .getMeshByName('worm-segment-10')!
        .position.asArray()
        .join(',');
      canvas.dataset.beetleVisible = String(actor.root.isEnabled());
      canvas.dataset.sceneFog = String(scene.fogDensity);
      canvas.dataset.sceneExposure = String(scene.imageProcessingConfiguration.exposure);
      canvas.dataset.sunTint = sun.diffuse.toHexString();
      const viewport = camera.viewport.toGlobal(engine.getRenderWidth(), engine.getRenderHeight());
      const projectedSun = Vector3.Project(
        Vector3.FromArray(SUN_POSITION),
        Matrix.Identity(),
        scene.getTransformMatrix(),
        viewport,
      );
      const projectedTarget = Vector3.Project(
        Vector3.FromArray(sample.target),
        Matrix.Identity(),
        scene.getTransformMatrix(),
        viewport,
      );
      const sight = Vector3.FromArray(sample.target).subtract(camera.position);
      const blockers = scene.multiPickWithRay(
        new Ray(camera.position, sight.normalizeToNew(), sight.length() - 0.2),
        (mesh) => mesh.name.startsWith('sky-cloud-bank') && mesh.visibility > 0.05,
      );
      canvas.dataset.cloudViewBlockers = String(blockers?.length ?? 0);
      canvas.dataset.skyColor = scene.clearColor.toHexString();
      canvas.dataset.wormRoll = String(sample.rotation[2]);
      canvas.dataset.introCamera = JSON.stringify(camera.position.asArray());
      canvas.dataset.introTarget = JSON.stringify(camera.getTarget().asArray());
      canvas.dataset.solarAlignment = String(
        Math.hypot(projectedSun.x - projectedTarget.x, projectedSun.y - projectedTarget.y) /
          engine.getRenderWidth(),
      );
      canvas.dataset.talonMaxSpan = String(
        Math.max(
          ...scene.meshes
            .filter((m) => m.name === 'eagle-curling-toe')
            .map((m) => Math.max(...m.getBoundingInfo().boundingBox.extendSizeWorld.asArray()) * 2),
        ),
      );
      const planes = Frustum.GetPlanes(scene.getTransformMatrix());
      canvas.dataset.eagleInFrame = String(
        scene
          .getTransformNodeByName('eagle')!
          .getChildMeshes()
          .some((mesh) => mesh.isEnabled() && mesh.isInFrustum(planes)),
      );
      canvas.dataset.eagleSpotting = String(sample.spotting);
      canvas.dataset.eagleGrasp = String(sample.eaglePose.grasp ?? 0);
      canvas.dataset.crowStartle = String(sample.crowPose.startle ?? 0);
      canvas.dataset.crowBeakOpen = String(sample.crowPose.open);
      const talonTargets = crowGraspTargets(sample.crowPose);
      canvas.dataset.talonGripError = String(
        Math.max(
          ...['left', 'right'].map((side, i) =>
            Vector3.Distance(
              scene.getTransformNodeByName('eagle-foot-' + side)!.getAbsolutePosition(),
              Vector3.FromArray(talonTargets[i]!),
            ),
          ),
        ),
      );
      const neck = scene.getTransformNodeByName('crow-neck')!;
      const mouth = Vector3.TransformCoordinates(Vector3.FromArray(MOUTH), neck.getWorldMatrix());
      const segment = scene.getMeshByName('worm-segment-3')!;
      Object.assign(canvas.dataset, {
        gripError: sample.carried
          ? String(Vector3.Distance(mouth, segment.getAbsolutePosition()))
          : '',
        introShot: String(sample.shot),
        cloudBanks: String(scene.meshes.filter((m) => m.name.startsWith('sky-cloud-bank')).length),
        cloudThickness: String(
          scene.getMeshByName('sky-cloud-bank-0')!.getBoundingInfo().boundingBox.extendSizeWorld.y *
            2,
        ),
        visibleMist: String(
          scene.meshes.filter((m) => m.name.startsWith('sky-near-mist') && m.isEnabled()).length,
        ),
        bloodDrops: String(
          scene.meshes.filter((m) => m.name === 'cough-drop' && m.isEnabled()).length,
        ),
        introPhase: sample.phase,
        introBullet: String(sample.bullet),
        introMotionTime: String(sample.motionTime),
        introKnockdown: String(sample.knockdown),
        introHeadLift: String(sample.headLift),
        introCrowZ: String(sample.crow[2]),
        introCloseup: String(sample.closeup),
        introFallSpeed: String(sample.fallSpeed),
        introRise: String(sample.rise),
        introWormY: String(sample.worm[1]),
        introRotation: sample.rotation.join(','),
        introCarried: String(sample.carried),
        introCrow: String(sample.crowVisible),
        introEagle: String(sample.eagleVisible),
        introCough: String(sample.cough),
        renderedCameraX: String(camera.position.x),
        renderedCameraY: String(camera.position.y),
        renderedCameraZ: String(camera.position.z),
      });
    },
    present(
      observation: Observation,
      walk: WalkSession,
      seconds: number,
      yaw: number,
      pitch: number,
    ) {
      actor.root.setEnabled(true);
      sky.present(null);
      grade.globalSaturation = 0;
      scene.imageProcessingConfiguration.exposure = 1;
      fill.diffuse.set(...palette.fill);
      crow.hide();
      eagle.hide();
      scene.fogDensity = 0.045;
      scene.clearColor.set(...palette.sky, 1);
      scene.fogColor.set(...palette.fog);
      sun.diffuse.set(...palette.sun);
      sun.intensity = 1.05;
      fill.intensity = 0.75;
      canvas.dataset.skyColor = scene.clearColor.toHexString();
      camera.fov = 1;
      introStage.present(null);
      const motion = beetleMotion(seconds, walk.beddingAt);
      actor.present({ ...observation, seconds, walking: motion.walking ? seconds : undefined });
      actor.root.position.set(motion.x, motion.y, motion.z);
      actor.root.rotation.y = motion.heading;
      environment.present(observation.gesture, seconds, motion.stage === 'waiting');
      worm.present(walk, seconds);
      leaf.setEnabled(walk.beddingAt !== null);
      if (motion.carrying) {
        const lift = Math.max(0, Math.min(1, (seconds - walk.beddingAt! - 2.3) / 0.3));
        const carry = new Vector3(
          motion.x - Math.sin(motion.heading) * 1.25,
          motion.y + 0.58,
          motion.z - Math.cos(motion.heading) * 1.25,
        );
        leaf.position.copyFrom(Vector3.Lerp(new Vector3(2.7, 0.95, -0.2), carry, lift));
        leaf.rotation.set(0.4 * lift, motion.heading * lift, 0);
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
      // setTarget normally rebuilds the orbit from the previous camera position.
      // Preserve the orbit and explicitly apply it around the new player anchor.
      camera.setTarget(target, false, false, true);
      camera.alpha = -Math.PI / 2 - yaw;
      camera.beta = pitch;
      camera.radius = hit?.hit ? Math.max(0.65, hit.distance - 0.18) : 4.2;
      scene.render();
      const skinColor = scene.getMaterialByName(
        'worm-skin',
      ) as import('@babylonjs/core/Materials/standardMaterial').StandardMaterial;
      canvas.dataset.wormSkin = skinColor.metadata.baseColor;
      canvas.dataset.wormCondition = String(skinColor.metadata.condition);
      canvas.dataset.wormSurfaceMinY = String(worm.minimumSurfaceY);
      canvas.dataset.wormSurfaceVertices = String(
        scene.getMeshByName('worm-body-surface')!.getTotalVertices(),
      );
      canvas.dataset.eyeAnchor = String(
        Vector3.Distance(
          scene.getMeshByName('worm-eye')!.getAbsolutePosition(),
          scene.getMeshByName('worm-segment-0')!.getAbsolutePosition(),
        ),
      );
      canvas.dataset.localWormTail = scene
        .getMeshByName('worm-segment-10')!
        .position.asArray()
        .join(',');
      canvas.dataset.beetleVisible = String(actor.root.isEnabled());
      canvas.dataset.sceneFog = String(scene.fogDensity);
      canvas.dataset.sceneExposure = String(scene.imageProcessingConfiguration.exposure);
      canvas.dataset.sunTint = sun.diffuse.toHexString();
      const tail = walk.body.pose(10);
      Object.assign(canvas.dataset, {
        renderedCameraX: String(camera.position.x),
        renderedCameraY: String(camera.position.y),
        renderedCameraZ: String(camera.position.z),
        cameraTargetX: String(target.x),
        cameraTargetY: String(target.y),
        cameraTargetZ: String(target.z),
        orbitAlpha: String(camera.alpha),
        orbitBeta: String(camera.beta),
        orbitRadius: String(camera.radius),
        renderedCameraYaw: String(yaw),
        renderedHeadX: String(walk.x),
        renderedHeadZ: String(walk.z),
        renderedTailX: String(tail.x),
        renderedTailZ: String(tail.z),
      });
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
