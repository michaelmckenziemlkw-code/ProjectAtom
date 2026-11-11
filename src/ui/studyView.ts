import { HintBank } from '../core/hints.ts';
import type { ObservationSession, Gesture } from '../core/observation.ts';
import { descriptions, gestureLabels, gestures } from '../core/observation.ts';

export function mountStudyView(container: HTMLElement, session: ObservationSession) {
  container.innerHTML = `
    <canvas id="world" tabindex="0" aria-label="Управление червём от третьего лица. WASD — движение, мышь — обзор, Q — меню."></canvas>
    <div id="settings-backdrop" hidden></div><section id="settings" class="settings panel graphics-open" hidden role="dialog" aria-modal="true" aria-label="Настройки" tabindex="-1">
      <h2>Настройки</h2><button id="settings-close" aria-label="Закрыть настройки">×</button>
      <div class="button-row" role="tablist" aria-label="Раздел настроек"><button id="game-tab" role="tab" aria-selected="true" aria-controls="game-settings">Звук</button><button id="graphics-tab" role="tab" aria-selected="false" aria-controls="graphics-settings" tabindex="-1">Видео</button></div>
      <div id="game-settings" role="tabpanel" aria-labelledby="game-tab">
        <header class="graphics-heading"><div><span class="eyebrow">ProjectAtom / Настройки</span><h2>Звук</h2></div><span class="graphics-heading-note">Звуковое окружение</span></header>
        <div class="graphics-layout"><div>
          <h3 class="graphics-section">Громкость</h3>
          <div class="audio-settings-row"><span>Звук</span><button id="audio" aria-pressed="false">Звук: выкл.</button></div>
          <label class="audio-settings-row" for="volume"><span>Общая громкость</span><span class="volume-control"><input id="volume" type="range" min="0" max="100" step="1" value="70"><output id="volume-value" for="volume">70%</output></span></label>
        </div><aside class="graphics-aside"><div class="graphics-context"><span class="eyebrow">Описание параметра</span><h3>Звук</h3><p>Громкость музыки, звуков окружения и взаимодействий. Нулевое значение отключает звучание.</p></div></aside></div>
      </div><div id="graphics-settings" role="tabpanel" aria-labelledby="graphics-tab" hidden></div>
    </section>
    <div id="loading" class="entry"><div class="entry-card"><span class="eyebrow">ProjectAtom · технопроба</span><h1>По ту сторону<br>маленького мира.</h1><p>WASD — движение. Мышь — обзор. Q — меню.<br>Для начала потребуется захват указателя мыши.</p><p class="muted">Пролог — 2 мин 14 с · Пробел — пропустить.</p><button id="enter-cinematic" class="primary" disabled>Пролог червя · со звуком</button><button id="enter" disabled>Подготовка сцены…</button><p class="muted">Технодемка управления червём. Полная голосовая эстафета остаётся в предыдущем макете.</p></div></div>
    <section id="pause-menu" class="pause-menu panel" hidden role="dialog" aria-modal="true" aria-label="Меню игры" tabindex="-1"><span class="eyebrow">ProjectAtom</span><h1>Меню</h1><nav class="pause-actions" aria-label="Действия меню"><button id="resume">Продолжить игру</button><button id="open-settings">Настройки</button><button id="quit">Выйти из игры</button></nav><p class="muted">Время игры продолжается</p><p id="control-error" role="status"></p><details id="hints"><summary>Подсказки · <span id="hint-budget">10</span> очков</summary><div id="hint-text"></div><button id="hint-next">Открыть следующий уровень · 1 очко</button></details><details id="technical"><summary>Техническая проверка</summary><div class="eyebrow">Наблюдения</div><nav id="observations" aria-label="Выбрать наблюдение">${session.observations.map((_, i) => `<button data-observation="${i}" aria-label="Наблюдение ${i + 1}" aria-pressed="${i === 0}">0${i + 1}</button>`).join('')}</nav><details id="self-check"><summary>Проверить себя · технопроба</summary><form id="answer-form"><fieldset><legend class="sr-only">Описание движения</legend>${gestures.map((gesture) => `<label class="answer"><input type="radio" name="answer" value="${gesture}" required><span>${gestureLabels[gesture]}</span></label>`).join('')}</fieldset><button class="primary" type="submit">Проверить наблюдение</button></form><p id="feedback" role="status" aria-live="polite"></p><p id="progress" class="muted"></p></details></details></section>
    <div id="cinematic-hud" hidden><div class="cinematic-bar top"></div><div class="cinematic-bar bottom"><span>ПРОБЕЛ — ПРОПУСТИТЬ · Q — МЕНЮ</span></div><div id="cinematic-fade"></div></div>
    <main id="study" class="play-hud" hidden><p id="fps"></p><div class="crosshair" aria-hidden="true">·</div><p id="interaction"></p><p id="notice" role="status"></p><p class="play-keys">WASD — движение · мышь — обзор · Q — меню</p></main>
    <section id="failure" class="failure panel" hidden role="alert"><h1>Не удалось показать 3D-сцену</h1><p id="failure-message"></p><p>Проверь аппаратное ускорение браузера или попробуй другой актуальный браузер.</p><button id="reload">Повторить</button></section>
  `;
  const element = <T extends HTMLElement>(id: string) => container.querySelector<T>(`#${id}`)!;
  const canvas = element<HTMLCanvasElement>('world');
  const form = element<HTMLFormElement>('answer-form');
  let hints = new HintBank({ beetle: 3 });
  function refreshHints() {
    const symbol = { ring: 'кольцо', fork: 'развилка', bars: 'полосы' }[session.current.symbol];
    const texts = [
      'Не каждое препятствие нужно преодолевать силой.',
      'Опиши партнёру необычное во внешности и поведении.',
      `Знак: ${symbol}. ${descriptions[session.current.gesture]} Сообщи партнёру оба признака.`,
    ];
    element('hint-budget').textContent = String(hints.remaining);
    element('hint-text').replaceChildren(
      ...texts.slice(0, hints.level('beetle')).map((text) => {
        const p = document.createElement('p');
        p.textContent = text;
        return p;
      }),
    );
    element<HTMLButtonElement>('hint-next').disabled =
      hints.remaining === 0 || hints.level('beetle') === 3;
  }
  element('hint-next').addEventListener('click', () => {
    hints.revealNext('beetle');
    refreshHints();
  });
  const tabs = ['game', 'graphics'];
  function selectTab(tab: string, focus = false) {
    for (const name of tabs) {
      const selected = name === tab;
      element(`${name}-settings`).hidden = !selected;
      element(`${name}-tab`).setAttribute('aria-selected', String(selected));
      element(`${name}-tab`).tabIndex = selected ? 0 : -1;
    }
    if (focus) element(`${tab}-tab`).focus();
  }
  for (const tab of tabs) {
    element(`${tab}-tab`).addEventListener('click', () => selectTab(tab));
    element(`${tab}-tab`).addEventListener('keydown', (event) => {
      const key = (event as KeyboardEvent).key;
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(key)) return;
      event.preventDefault();
      selectTab(
        key === 'Home' ? tabs[0] : key === 'End' ? tabs[1] : tabs[1 - tabs.indexOf(tab)],
        true,
      );
    });
  }
  type Mode = 'entry' | 'playing' | 'menu' | 'settings' | 'failure';
  let mode: Mode = 'entry';
  const emit = (name: string) => container.dispatchEvent(new CustomEvent(name));
  function show(next: Mode) {
    mode = next;
    element('loading').hidden = next !== 'entry';
    element('study').hidden = next !== 'playing';
    if (next !== 'playing') element('cinematic-hud').hidden = true;
    element('pause-menu').hidden = next !== 'menu';
    element('settings').hidden = next !== 'settings';
    element('failure').hidden = next !== 'failure';
    element('settings-backdrop').hidden = next !== 'menu' && next !== 'settings';
    container.dispatchEvent(new CustomEvent('ui-mode-change', { detail: next }));
    if (next === 'menu') element('resume').focus();
    if (next === 'settings')
      element('settings').querySelector<HTMLElement>('[role=tab][aria-selected=true]')!.focus();
  }
  element('resume').addEventListener('click', () => emit('request-resume'));
  element('quit').addEventListener('click', () => emit('request-quit'));
  element('open-settings').addEventListener('click', () => show('settings'));
  element('settings-close').addEventListener('click', () => show('menu'));
  element('settings-backdrop').addEventListener('click', () =>
    mode === 'settings' ? show('menu') : emit('request-resume'),
  );
  document.addEventListener('keydown', (event) => {
    if (mode === 'entry' || mode === 'failure') return;
    if (event.code === 'KeyQ' && !event.repeat) {
      event.preventDefault();
      if (mode === 'menu') emit('request-resume');
      else show('menu');
    }
    if (event.key === 'Escape' && (mode === 'playing' || mode === 'settings')) {
      // Browser escape/unlock is one-way; only Q or Continue requests capture again.
      show('menu');
    }
    if (event.key === 'Tab' && (mode === 'menu' || mode === 'settings')) {
      const dialog = element(mode === 'menu' ? 'pause-menu' : 'settings');
      const controls = [
        ...dialog.querySelectorAll<HTMLElement>('button,input,select,summary,[tabindex="0"]'),
      ].filter(
        (el) =>
          !el.closest('[hidden]') &&
          el.getClientRects().length > 0 &&
          !(el as HTMLInputElement).disabled &&
          el.tabIndex >= 0,
      );
      const first = controls[0],
        last = controls.at(-1)!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  });
  let answered = false;
  function refresh() {
    for (const button of container.querySelectorAll<HTMLButtonElement>('[data-observation]'))
      button.setAttribute(
        'aria-pressed',
        String(Number(button.dataset.observation) === session.state.index),
      );
    refreshHints();
    const correct = session.observations.filter(
      (item) => session.state.answers[item.id] === item.gesture,
    ).length;
    element('progress').textContent = `Распознано: ${correct} / 3`;
    element('feedback').textContent = '';
    form.reset();
    const previous = session.state.answers[session.state.index];
    if (previous) {
      form.querySelector<HTMLInputElement>(`[value="${previous}"]`)!.checked = true;
      element('feedback').textContent =
        previous === session.current.gesture
          ? 'Это наблюдение уже распознано.'
          : 'Можно попробовать другое описание.';
    }
    answered = false;
  }
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const gesture = new FormData(form).get('answer') as Gesture;
    if (!gestures.includes(gesture)) return;
    const correct = session.answer(gesture);
    const count = session.observations.filter(
      (item) => session.state.answers[item.id] === item.gesture,
    ).length;
    element('feedback').textContent = correct
      ? 'Да, это описание подходит. Попробуй следующее наблюдение.'
      : 'Посмотри ещё раз или открой подсказку по своему желанию.';
    if (correct && count === 3)
      element('feedback').textContent =
        'Все три наблюдения распознаны. Теперь попробуйте описать жесты друг другу голосом, не называя готовые варианты.';
    element('progress').textContent = `Распознано: ${count} / 3`;
    answered = true;
  });
  element('reload').addEventListener('click', () => location.reload());
  refresh();
  return {
    canvas,
    element,
    refresh,
    get answered() {
      return answered;
    },
    ready() {
      element<HTMLButtonElement>('enter-cinematic').disabled = false;
      element<HTMLButtonElement>('enter').disabled = false;
      element('enter').textContent = 'Начать технодемку';
    },
    get mode() {
      return mode;
    },
    enter() {
      show('playing');
      canvas.focus();
    },
    menu(error = '') {
      element('control-error').textContent = error;
      show('menu');
    },
    entry() {
      show('entry');
      element('enter').focus();
    },
    resetTrial() {
      hints = new HintBank({ beetle: 3 });
      session.state.index = 0;
      session.state.answers = {};
      refresh();
    },
    fail(message: string) {
      element('failure-message').textContent = message;
      show('failure');
    },
  };
}
