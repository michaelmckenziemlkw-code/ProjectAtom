import { ActiveClock, FramePacer, FrameMeter } from './core/timing.ts';
import { effectiveFrameCap } from './core/graphics.ts';
import { mountGraphicsPanel } from './ui/graphicsPanel.ts';
import './style.css';
import { ObservationSession } from './core/observation.ts';
import { createStudyScene } from './render/createStudyScene.ts';
import { ContactAudio } from './render/contactAudio.ts';
import { mountStudyView } from './ui/studyView.ts';

// This lab is local: it has no multiplayer transport or UTC dependency.
const seedValue = new URLSearchParams(location.search).get('seed');
const seed =
  seedValue !== null && /^\d{1,10}$/.test(seedValue)
    ? Number(seedValue) >>> 0
    : crypto.getRandomValues(new Uint32Array(1))[0];
const session = new ObservationSession(seed);
const view = mountStudyView(document.querySelector<HTMLElement>('#app')!, session);
const audio = new ContactAudio();
let study: Awaited<ReturnType<typeof createStudyScene>> | null = null;
let entered = false;
const clock = new ActiveClock(performance.now());
const pacer = new FramePacer();
const meter = new FrameMeter();
const graphics = mountGraphicsPanel(view.element('graphics-settings'));
let lastRender = performance.now();
const updateClock = () =>
  clock.setActive(entered && !session.state.paused && !document.hidden, performance.now());
let disposed = false;

async function start() {
  try {
    study = await createStudyScene(view.canvas);
    if (disposed) {
      study.dispose();
      study = null;
      return;
    }
    study.quality(false);
    // Warm up materials before exposing a blank or half-compiled scene.
    study.present({ ...session.current, seconds: 0 }, 0);
    await study.scene.whenReadyAsync();
    if (disposed) {
      study?.dispose();
      study = null;
      return;
    }
    study.invalidate();
    study.present({ ...session.current, seconds: 0 }, 0);
    view.canvas.dataset.ready = 'true';
    view.ready();
    study.engine.runRenderLoop(() => {
      if (!study) return;
      const now = performance.now();
      const seconds = clock.read(now);
      const paused = session.state.paused || document.hidden || !entered;
      audio.present(session.current.gesture, seconds, paused);
      view.canvas.dataset.animationTime = String(seconds);
      if (pacer.shouldRender(now, effectiveFrameCap(graphics.settings))) {
        const rendered = study.present({ ...session.current, seconds }, (now - lastRender) / 1000);
        lastRender = now;
        if (rendered) meter.record(now);
      }
      view.canvas.dataset.renderCount = String(meter.count);
      const fps = meter.fps(now);
      view.element('fps').textContent = paused ? 'Пауза' : `Отрисовка: ${fps} FPS`;
      graphics.updateMetrics(paused, fps);
    });
  } catch (error) {
    console.error(error);
    view.fail(
      'Браузер не смог запустить сцену WebGL. ' + (error instanceof Error ? error.message : ''),
    );
  }
}
view.element('enter').addEventListener('click', () => {
  entered = true;
  updateClock();
  view.enter();
});
for (const button of document.querySelectorAll<HTMLButtonElement>('[data-observation]'))
  button.addEventListener('click', () => {
    session.select(Number(button.dataset.observation));
    clock.reset(performance.now());
    audio.silence();
    view.refresh();
  });
view.element('pause').addEventListener('click', () => {
  session.state.paused = !session.state.paused;
  updateClock();
  view.element('pause').textContent = session.state.paused ? 'Продолжить' : 'Пауза';
  view.element('pause').setAttribute('aria-pressed', String(session.state.paused));
  if (session.state.paused) audio.silence();
});
view.element('inspect').addEventListener('click', () => study?.focus(true));
view.element('wide').addEventListener('click', () => study?.focus(false));
view
  .element<HTMLInputElement>('low-quality')
  .addEventListener('change', (event) =>
    study?.quality((event.target as HTMLInputElement).checked),
  );
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
  audio.silence();
  view.fail((event as CustomEvent<string>).detail);
});
document.addEventListener('visibilitychange', () => {
  updateClock();
  if (document.hidden) audio.silence();
});
window.addEventListener(
  'pagehide',
  () => {
    disposed = true;
    audio.dispose();
    study?.dispose();
    study = null;
  },
  { once: true },
);
void start();
