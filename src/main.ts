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
let seconds = 0;
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
      const delta = Math.min(study.engine.getDeltaTime() / 1000, 0.1);
      const paused = session.state.paused || document.hidden || !entered;
      if (!paused) seconds += delta;
      study.present({ ...session.current, seconds }, delta);
      audio.present(session.current.gesture, seconds, paused);
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
  view.enter();
});
for (const button of document.querySelectorAll<HTMLButtonElement>('[data-observation]'))
  button.addEventListener('click', () => {
    session.select(Number(button.dataset.observation));
    seconds = 0;
    audio.silence();
    view.refresh();
  });
view.element('pause').addEventListener('click', () => {
  session.state.paused = !session.state.paused;
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
