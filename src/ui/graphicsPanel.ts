import { defaultGraphics, effectiveFrameCap } from '../core/graphics.ts';
import type { GraphicsSettings } from '../core/graphics.ts';

const features = [
  [
    'hair',
    'HairWorks',
    'Даже у жука есть право на дорогую причёску.',
    '40 FPS · вместе с трассировкой — 5',
  ],
  [
    'ray',
    'Ray tracing',
    'Лучей больше. Свободного времени у видеокарты меньше.',
    '20 FPS · с HairWorks — 5',
  ],
  [
    'path',
    'Path tracing',
    'Самый длинный путь от одного кадра к следующему.',
    '8 FPS · с HairWorks — 5',
  ],
  ['physx', 'NVIDIA PhysX', 'Весомый аргумент в пользу низкой частоты кадров.', '24 FPS'],
  ['generation', 'Multi Frame Generation', 'Генерирует ожидание следующего кадра.', '30 FPS'],
  [
    'ao',
    'HBAO+ / Ambient Occlusion',
    'У каждого камня должна быть своя драматичная тень.',
    '45 FPS',
  ],
] as const;

export function mountGraphicsPanel(container: HTMLElement) {
  let settings = defaultGraphics();
  const options = (items: string[][]) =>
    items.map(([value, label]) => `<option value="${value}">${label}</option>`).join('');
  const row = (key: string, label: string, choices: string[][]) =>
    `<label class="graphics-row" data-row="${key}"><span>${label}</span><span class="graphics-control"><select aria-label="${label}" data-setting="${key}">${options(choices)}</select></span></label>`;
  container.innerHTML = `
    <header class="graphics-heading"><div><span class="eyebrow">Система / 02</span><h2>Графика<span class="graphics-dot">.</span></h2><p>Всё на максимум. Почти всё — понарошку.</p></div><span class="graphics-badge">EXPERIMENTAL<br><b>AAA EDITION</b></span></header>
    <div class="graphics-layout"><div class="graphics-options">
      <h3 class="graphics-section">01 / Технологии</h3>
      ${features
        .map(([key, label]) =>
          row(key, label, [
            ['false', 'Выкл.'],
            ['true', 'Вкл.'],
          ]),
        )
        .join('')}
      <h3 class="graphics-section">02 / Реконструкция изображения</h3>
      ${row('upscaler', 'Апскейлер', [
        ['off', 'Выкл.'],
        ['dlss', 'NVIDIA DLSS'],
        ['fsr', 'AMD FSR'],
        ['xess', 'Intel XeSS'],
      ])}
      ${row('quality', 'Режим апскейлинга', [
        ['quality', 'Quality'],
        ['balanced', 'Balanced'],
        ['performance', 'Performance'],
        ['ultra', 'Ultra Performance'],
      ])}
      ${row('aa', 'Сглаживание', [
        ['off', 'Выкл.'],
        ['fxaa', 'FXAA'],
        ['taa', 'TAA'],
        ['msaa', 'MSAA 8×'],
        ['dlaa', 'NVIDIA DLAA'],
      ])}
      <h3 class="graphics-section">03 / Частота кадров</h3>
      <label class="graphics-row" data-row="manual"><span>Ручной лимит кадров<span class="graphics-sub">0 — без ограничения</span></span><span class="graphics-control"><input aria-label="Ручной лимит кадров" data-setting="manual" type="number" min="0" max="240" step="1" value="0"></span></label>
    </div>
    <aside class="graphics-aside"><div class="graphics-performance"><span class="eyebrow">Бюджет производительности</span><div class="graphics-number"><span id="graphics-live-fps">—</span><small>FPS / ФАКТИЧЕСКИ</small></div><p id="graphics-cap" aria-live="polite"></p><div class="graphics-budget-line"></div><p class="muted">Счётчик реальных отрисовок за последнюю секунду. Частота зависит от устройства.</p></div>
      <div class="graphics-context"><span class="eyebrow">Выбранный параметр</span><h3 id="graphics-detail-title">Без компромиссов</h3><p id="graphics-detail-text">Выбери строку, чтобы узнать цену красивого названия.</p><p id="graphics-detail-cost"></p></div>
      <p class="graphics-disclaimer">Пародийный режим. Настройки только снижают частоту отрисовки: SDK, разрешение, материалы и физика не меняются. Время продолжает идти с обычной скоростью.</p>
    </aside></div>
    <footer class="graphics-footer"><span>Настройки сбрасываются после перезагрузки.</span><button id="graphics-reset"><kbd>F8</kbd> Вернуть обычную графику</button></footer>`;
  const select = (key: string) =>
    container.querySelector<HTMLSelectElement>(`[data-setting="${key}"]`)!;
  let selected = '';
  function detail(key: string) {
    selected = key;
    container
      .querySelectorAll<HTMLElement>('[data-row]')
      .forEach((row) => row.classList.toggle('is-selected', row.dataset.row === key));
    const feature = features.find((item) => item[0] === key);
    const info: Record<string, string[]> = {
      upscaler: [
        'Апскейлер',
        'DLSS, FSR или XeSS: выбери технологию, затем её режим. Настоящее масштабирование здесь не подключено.',
        'Quality → Balanced → Performance → Ultra Performance',
      ],
      quality: [
        'Режим апскейлинга',
        `${settings.upscaler === 'off' ? 'Сначала выбери апскейлер.' : select('upscaler').selectedOptions[0].textContent + ': ' + select('quality').selectedOptions[0].textContent + '.'} Quality / Balanced / Performance / Ultra задают пределы 55 / 60 / 70 / 80 FPS до множителя технологии.`,
        'DLSS ×1 · FSR ×0,95 · XeSS ×0,9',
      ],
      aa: [
        'Сглаживание',
        'Выбор красивого сокращения. Само сглаживание остаётся прежним.',
        'FXAA 90 · TAA 60 · MSAA 30 · DLAA 50 FPS',
      ],
      manual: [
        'Ручной лимит кадров',
        'Твой предел. Сочетания настроек используют самый низкий положительный лимит.',
        '0 — без искусственного ограничения',
      ],
    };
    const [title, text, cost] = feature
      ? [feature[1], feature[2], feature[3]]
      : (info[key] ?? [
          'Без компромиссов',
          'Выбери строку, чтобы узнать цену красивого названия.',
          '',
        ]);
    container.querySelector('#graphics-detail-title')!.textContent = title;
    container.querySelector('#graphics-detail-text')!.textContent = text;
    container.querySelector('#graphics-detail-cost')!.textContent = cost;
  }
  const refresh = () => {
    const cap = effectiveFrameCap(settings);
    container.querySelector('#graphics-cap')!.textContent =
      `Предел: ${cap || 'без ограничения'} FPS`;
    select('quality').disabled = settings.upscaler === 'off';
    container
      .querySelector('[data-row="quality"]')!
      .classList.toggle('is-disabled', settings.upscaler === 'off');
    if (selected) detail(selected);
  };
  container.addEventListener('change', (event) => {
    const input = event.target as HTMLInputElement;
    const key = input.dataset.setting as keyof GraphicsSettings;
    if (!key) return;
    const boolean = features.some((item) => item[0] === key);
    settings = {
      ...settings,
      [key]: boolean
        ? input.value === 'true'
        : key === 'manual'
          ? Math.max(0, Math.min(240, Math.floor(Number(input.value) || 0)))
          : input.value,
    };
    detail(key);
    refresh();
  });
  container.addEventListener('focusin', (event) => {
    const key = (event.target as HTMLElement).dataset.setting;
    if (key) detail(key);
  });
  for (const row of container.querySelectorAll<HTMLElement>('[data-row]'))
    row.addEventListener('pointerenter', () => detail(row.dataset.row!));
  function reset() {
    settings = defaultGraphics();
    container
      .querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-setting]')
      .forEach(
        (input) =>
          (input.value = String(settings[input.dataset.setting as keyof GraphicsSettings])),
      );
    selected = '';
    detail('');
    refresh();
  }
  container.querySelector('#graphics-reset')!.addEventListener('click', reset);
  window.addEventListener('keydown', (event) => {
    if (event.key === 'F8') {
      event.preventDefault();
      reset();
    }
  });
  refresh();
  return {
    get settings() {
      return settings;
    },
    updateMetrics(paused: boolean, fps: number) {
      container.querySelector('#graphics-live-fps')!.textContent = paused ? 'Пауза' : String(fps);
    },
  };
}
