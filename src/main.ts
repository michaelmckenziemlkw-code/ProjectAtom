import { INTRO_DURATION, sampleIntro } from './core/cinematic.ts';
import './style.css';
import { ActiveClock, FramePacer, FrameMeter, UncappedFpsSampler } from './core/timing.ts';
import { effectiveFrameCap } from './core/graphics.ts';
import { ObservationSession } from './core/observation.ts';
import { WalkSession, beetleMotion } from './core/walk.ts';
import { createStudyScene } from './render/createStudyScene.ts';
import { ContactAudio } from './render/contactAudio.ts';
import { mountStudyView } from './ui/studyView.ts';
import { mountGraphicsPanel } from './ui/graphicsPanel.ts';

const seedValue = new URLSearchParams(location.search).get('seed');
const seed =
  seedValue !== null && /^\d{1,10}$/.test(seedValue)
    ? Number(seedValue) >>> 0
    : crypto.getRandomValues(new Uint32Array(1))[0];
const session = new ObservationSession(seed),
  walk = new WalkSession();
const app = document.querySelector<HTMLElement>('#app')!;
const view = mountStudyView(app, session),
  audio = new ContactAudio();
const graphics = mountGraphicsPanel(view.element('graphics-settings'));
const clock = new ActiveClock(performance.now()),
  pacer = new FramePacer(),
  meter = new FrameMeter(),
  baseline = new UncappedFpsSampler();
const held = new Set<string>();
let study: Awaited<ReturnType<typeof createStudyScene>> | null = null;
let entered = false,
  disposed = false,
  yaw = 0,
  pitch = 1.12,
  noticeUntil = 0;
let intro = false;
function advance() {
  const seconds = clock.read(performance.now());
  const controlled = entered && !intro; // Held input is drained before every menu/focus transition.
  walk.advance(seconds, {
    forward: controlled ? Number(held.has('KeyW')) - Number(held.has('KeyS')) : 0,
    right: controlled ? Number(held.has('KeyD')) - Number(held.has('KeyA')) : 0,
    yaw,
  });
  return seconds;
}
function release() {
  advance();
  held.clear();
  if (document.pointerLockElement === view.canvas) document.exitPointerLock();
}
async function resume() {
  if (!entered || !study) return;
  held.clear();
  view.enter();
  try {
    await view.canvas.requestPointerLock();
    if (!entered && document.pointerLockElement === view.canvas) document.exitPointerLock();
  } catch {
    if (entered)
      view.menu(
        'Не удалось захватить мышь. Нажми «Продолжить игру», чтобы повторить. Для встроенного окна может требоваться разрешение браузера.',
      );
  }
}
function enter(withIntro: boolean) {
  if (!study) return;
  const now = performance.now();
  walk.reset();
  clock.reset(now);
  clock.setActive(true, now);
  entered = true;
  intro = withIntro;
  audio.stopIntro();
  yaw = 0;
  pitch = 1.12;
  held.clear();
  view.resetTrial();
  baseline.reset();
  void resume();
  if (intro) {
    const enable = audio.enabled ? Promise.resolve(true) : audio.toggle();
    void enable
      .then(() => {
        view.element('audio').textContent = audio.enabled ? 'Звук: вкл.' : 'Звук: выкл.';
        view.element('audio').setAttribute('aria-pressed', String(audio.enabled));
        if (intro) return audio.startIntro(clock.read(performance.now()));
      })
      .catch(() => {
        view.element('audio').textContent = 'Звук недоступен';
      });
  }
}
view.element('enter').addEventListener('click', () => enter(false));
view.element('enter-cinematic').addEventListener('click', () => enter(true));
function finishIntro() {
  intro = false;
  audio.stopIntro();
  audio.silence();
  held.clear();
  baseline.reset();
}

app.addEventListener('request-resume', () => void resume());
app.addEventListener('request-quit', () => {
  advance();
  entered = false;
  finishIntro();
  release();
  audio.silence();
  clock.setActive(false, performance.now());
  clock.reset(performance.now());
  walk.reset();
  view.entry();
});
app.addEventListener('ui-mode-change', () => {
  if (view.mode !== 'playing') release();
});
document.addEventListener('pointerlockchange', () => {
  if (entered && document.pointerLockElement !== view.canvas && view.mode === 'playing')
    view.menu();
});
document.addEventListener('keydown', (event) => {
  if (event.defaultPrevented || !entered || view.mode !== 'playing') return;
  if (intro) {
    if (event.code === 'Space' && !event.repeat) {
      event.preventDefault();
      finishIntro();
    }
    return;
  }
  if (document.pointerLockElement !== view.canvas) return;
  if (['KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(event.code)) {
    event.preventDefault();
    advance();
    held.add(event.code);
  }
  if (event.code === 'KeyE' && !event.repeat) {
    event.preventDefault();
    const seconds = advance();
    view.element('notice').textContent = walk.placeBedding(seconds)
      ? 'Подстилка уложена.'
      : 'Слишком далеко.';
    noticeUntil = seconds + 2;
  }
});
document.addEventListener('keyup', (event) => {
  if (held.has(event.code)) {
    advance();
    held.delete(event.code);
  }
});
document.addEventListener('mousemove', (event) => {
  if (entered && !intro && view.mode === 'playing' && document.pointerLockElement === view.canvas) {
    advance();
    yaw += event.movementX * 0.0025;
    pitch = Math.max(0.45, Math.min(1.4, pitch - event.movementY * 0.002));
  }
});
window.addEventListener('blur', () => {
  advance();
  held.clear();
  if (entered && view.mode === 'playing') view.menu();
});
document.addEventListener('visibilitychange', () => {
  advance();
  held.clear();
  baseline.interrupt();
  if (document.hidden) {
    audio.silence();
    if (entered && view.mode === 'playing') view.menu();
  }
  // Running scene time intentionally continues. This is not a shared match clock yet.
});
for (const button of document.querySelectorAll<HTMLButtonElement>('[data-observation]'))
  button.addEventListener('click', () => {
    session.select(Number(button.dataset.observation));
    audio.silence();
    view.refresh();
  });
view.element('graphics-settings').addEventListener('video-quality-change', (event) => {
  study?.quality((event as CustomEvent<boolean>).detail);
  baseline.reset();
});
view.element<HTMLInputElement>('volume').addEventListener('input', (event) => {
  const value = Number((event.target as HTMLInputElement).value);
  audio.setVolume(value / 100);
  view.element('volume-value').textContent = `${value}%`;
});
view.element('audio').addEventListener('click', async () => {
  try {
    const enabled = await audio.toggle();
    view.element('audio').textContent = enabled ? 'Звук: вкл.' : 'Звук: выкл.';
    view.element('audio').setAttribute('aria-pressed', String(enabled));
  } catch {
    view.element('audio').textContent = 'Звук недоступен';
  }
});
view.canvas.addEventListener('render-failure', (event) => {
  study?.engine.stopRenderLoop();
  finishIntro();
  release();
  audio.silence();
  view.fail((event as CustomEvent<string>).detail);
});
window.addEventListener(
  'pagehide',
  () => {
    disposed = true;
    entered = false;
    held.clear();
    audio.dispose();
    study?.dispose();
    study = null;
  },
  { once: true },
);
async function start() {
  try {
    study = await createStudyScene(view.canvas);
    if (disposed) {
      study.dispose();
      study = null;
      return;
    }
    study.quality(false);
    // Art review only; this is not the future health mechanic.
    const conditionValue = new URLSearchParams(location.search).get('condition');
    if (
      conditionValue !== null &&
      conditionValue.trim() !== '' &&
      Number.isFinite(Number(conditionValue))
    )
      study.condition(Number(conditionValue));
    study.present(session.current, walk, 0, yaw, pitch);
    await Promise.all([study.scene.whenReadyAsync(), audio.loadIntro()]);
    if (disposed) {
      study?.dispose();
      study = null;
      return;
    }
    view.canvas.dataset.ready = 'true';
    view.ready();
    study.engine.runRenderLoop(() => {
      if (!study) return;
      const now = performance.now(),
        seconds = advance(),
        motion = beetleMotion(seconds, walk.beddingAt);
      if (intro && seconds >= INTRO_DURATION) finishIntro();
      if (intro) audio.presentIntro(document.hidden);
      else if (motion.stage === 'waiting')
        audio.present(session.current.gesture, seconds, !entered || document.hidden);
      else audio.silence();
      const inactive = !entered || document.hidden;
      if (inactive) baseline.interrupt();
      const calibrating = baseline.value === null && !inactive;
      const cap = calibrating ? 0 : effectiveFrameCap(graphics.settings, baseline.value);
      if (pacer.shouldRender(now, cap)) {
        if (intro) study.presentIntro(seconds, session.current);
        else study.present(session.current, walk, seconds, yaw, pitch);
        meter.record(now);
        if (calibrating) baseline.sample(now);
      }
      Object.assign(view.canvas.dataset, {
        cinematic: String(intro),
        animationTime: String(seconds),
        renderCount: String(meter.count),
        baselineFps: baseline.value === null ? '' : String(baseline.value),
        targetFps: String(cap),
        playerX: String(walk.x),
        playerZ: String(walk.z),
        cameraYaw: String(yaw),
        beetleStage: motion.stage,
        blocked: String(motion.blocked),
      });
      view.element('cinematic-hud').hidden = !intro || view.mode !== 'playing';
      view.element('study').classList.toggle('during-cinematic', intro);
      view.element('cinematic-fade').style.opacity = String(sampleIntro(seconds).fade);
      const fps = meter.fps(now);
      view.element('fps').textContent = `${fps} FPS`;
      graphics.updateMetrics(!entered, fps, baseline.value);
      view.element('interaction').textContent = walk.canPlace(seconds)
        ? 'E — положить подстилку сбоку'
        : '';
      if (seconds >= noticeUntil) view.element('notice').textContent = '';
    });
  } catch (error) {
    console.error(error);
    release();
    view.fail(
      'Браузер не смог запустить WebGL-сцену. ' + (error instanceof Error ? error.message : ''),
    );
  }
}
void start();
