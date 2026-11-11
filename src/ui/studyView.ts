import { HintBank } from '../core/hints.ts';
import type { ObservationSession, Gesture } from '../core/observation.ts';
import { descriptions, gestureLabels, gestures } from '../core/observation.ts';

export function mountStudyView(container: HTMLElement, session: ObservationSession) {
  container.innerHTML = `
    <canvas id="world" tabindex="0" aria-label="Трёхмерный жук в земляном проходе. Перетаскивай мышью для осмотра, колесо приближает."></canvas>
    <header class="topbar"><a class="brand" href="./" aria-label="ProjectAtom — начать заново">A<span>PROJECT<br>ATOM</span></a><div class="chapter"><span class="eyebrow">Исследование 01 / 3D</span><p>У прохода</p></div><button id="settings-button" aria-expanded="false" aria-controls="settings">Настройки</button></header>
    <section id="settings" class="settings panel" hidden aria-label="Настройки сцены">
      <h2>Настройки</h2><div class="button-row"><button id="game-tab" aria-pressed="true">Игра</button><button id="graphics-tab" aria-pressed="false">Видео</button></div><div id="game-settings">
      <button id="audio" aria-pressed="false">Звук: выкл.</button>
      <label><input type="checkbox" id="low-quality"> Уменьшить качество</label>
      </div><div id="graphics-settings" hidden></div>
    </section>
    <div id="loading" class="entry"><div class="entry-card"><span class="eyebrow">ProjectAtom · технопроба</span><h1>По ту сторону<br>маленького мира.</h1><p>Здесь есть только ты, проход и его обитатель.</p><button id="enter" disabled>Подготовка сцены…</button><p class="muted">Это проверка 3D-модели и анимаций. Полная эстафета остаётся в предыдущем макете.</p></div></div>
    <main id="study" hidden>
      <section class="camera-tools" aria-label="Камера и воспроизведение"><div class="eyebrow">Мир червя</div><h1>Кто-то занял проход.</h1><p id="fps">Отрисовка: —</p><div class="button-row"><button id="inspect">Приблизиться</button><button id="wide">Общий план</button><button id="pause" aria-pressed="false">Пауза</button></div><p class="hint">Мышь — осмотреть · колесо — расстояние<br>Стрелки — повернуть камеру</p></section>
      <aside class="observation-panel panel"><div class="eyebrow">Наблюдения</div><nav id="observations" aria-label="Выбрать наблюдение">${session.observations.map((_, i) => `<button data-observation="${i}" aria-label="Наблюдение ${i + 1}" aria-pressed="${i === 0}">0${i + 1}</button>`).join('')}</nav><details id="self-check"><summary>Проверить себя · технопроба</summary><form id="answer-form"><fieldset><legend class="sr-only">Описание движения</legend>${gestures.map((gesture) => `<label class="answer"><input type="radio" name="answer" value="${gesture}" required><span>${gestureLabels[gesture]}</span></label>`).join('')}</fieldset><button class="primary" type="submit">Проверить наблюдение</button></form><p id="feedback" role="status" aria-live="polite"></p><p id="progress" class="muted"></p></details><details id="hints"><summary>Подсказки · <span id="hint-budget">10</span> очков</summary><div id="hint-text"></div><button id="hint-next">Открыть следующий уровень · 1 очко</button></details></aside>
    </main>
    <section id="failure" class="failure panel" hidden role="alert"><h1>Не удалось показать 3D-сцену</h1><p id="failure-message"></p><p>Проверь аппаратное ускорение браузера или попробуй другой актуальный браузер.</p><button id="reload">Повторить</button></section>
  `;
  const element = <T extends HTMLElement>(id: string) => container.querySelector<T>(`#${id}`)!;
  const canvas = element<HTMLCanvasElement>('world');
  const form = element<HTMLFormElement>('answer-form');
  const hints = new HintBank({ beetle: 3 });
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
  for (const tab of ['game', 'graphics'])
    element(`${tab}-tab`).addEventListener('click', () => {
      element('settings').classList.toggle('graphics-open', tab === 'graphics');
      for (const name of ['game', 'graphics']) {
        element(`${name}-settings`).hidden = name !== tab;
        element(`${name}-tab`).setAttribute('aria-pressed', String(name === tab));
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
  element('settings-button').addEventListener('click', () => {
    const settings = element('settings');
    settings.hidden = !settings.hidden;
    element('settings-button').setAttribute('aria-expanded', String(!settings.hidden));
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
      element<HTMLButtonElement>('enter').disabled = false;
      element('enter').textContent = 'Осмотреть место';
    },
    enter() {
      element('loading').hidden = true;
      element('study').hidden = false;
      canvas.focus();
    },
    fail(message: string) {
      element('loading').hidden = true;
      element('study').hidden = true;
      element('failure').hidden = false;
      element('failure-message').textContent = message;
    },
  };
}
