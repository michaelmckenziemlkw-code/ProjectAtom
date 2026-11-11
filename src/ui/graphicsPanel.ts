import { defaultGraphics, effectiveFrameCap, graphicsMultiplier } from '../core/graphics.ts';
import type { GraphicsSettings } from '../core/graphics.ts';

const features = [
  ['hair', 'NVIDIA HairWorks', 'Технология визуализации волос и шерсти.', 'Множитель: ×0,7'],
  ['ray', 'Ray Tracing', 'Трассировка лучей для освещения, отражений и теней.', 'Множитель: ×0,2'],
  ['path', 'Path Tracing', 'Полная трассировка путей распространения света.', 'Множитель: ×0,3'],
  ['physx', 'NVIDIA PhysX', 'Технология расчёта физических взаимодействий.', 'Множитель: ×0,9'],
  [
    'generation',
    'Multi Frame Generation',
    'Генерация промежуточных кадров между отрисованными кадрами.',
    'Усиление частоты: ×2 / ×3 / ×4',
  ],
  [
    'ao',
    'HBAO+ / Ambient Occlusion',
    'Окружающее затенение в местах соприкосновения поверхностей.',
    'Множитель: ×0,9',
  ],
] as const;

export function mountGraphicsPanel(container: HTMLElement) {
  let settings = defaultGraphics();
  let applied = defaultGraphics();
  let appliedLowQuality = false;
  let baselineFps: number | null = null;
  const format = (value: number) =>
    new Intl.NumberFormat('ru', { maximumFractionDigits: 1 }).format(value);
  const options = (items: string[][]) =>
    items.map(([value, label]) => `<option value="${value}">${label}</option>`).join('');
  const row = (key: string, label: string, choices: string[][]) =>
    `<label class="graphics-row" data-row="${key}"><span>${label}</span><span class="graphics-control"><select aria-label="${label}" data-setting="${key}">${options(choices)}</select></span></label>`;
  container.innerHTML = `
    <header class="graphics-heading"><div><span class="eyebrow">ProjectAtom / Настройки</span><h2>Видео</h2></div><span class="graphics-heading-note">Настройки отображения</span></header>
    <div class="graphics-layout"><div class="graphics-options">
      <h3 class="graphics-section">Технологии рендеринга</h3>
      ${features
        .map(([key, label]) =>
          row(
            key,
            label,
            key === 'generation'
              ? [
                  ['off', 'Выкл.'],
                  ['2x', '×2'],
                  ['3x', '×3'],
                  ['4x', '×4'],
                ]
              : [
                  ['false', 'Выкл.'],
                  ['true', 'Вкл.'],
                ],
          ),
        )
        .join('')}
      <h3 class="graphics-section">Масштабирование и сглаживание</h3>
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
      <h3 class="graphics-section">Качество сцены</h3>
      <label class="graphics-row"><span>Качество сцены</span><span class="graphics-control"><select id="low-quality" aria-label="Качество сцены"><option value="full">Полное</option><option value="low">Уменьшенное</option></select></span></label>
      <h3 class="graphics-section">Частота кадров</h3>
      <label class="graphics-row" data-row="manual"><span>Ручной лимит кадров<span class="graphics-sub">0 — без ограничения</span></span><span class="graphics-control"><input aria-label="Ручной лимит кадров" data-setting="manual" type="number" min="0" max="240" step="1" value="0"></span></label>
    </div>
    <aside class="graphics-aside"><div class="graphics-performance"><span class="eyebrow">Производительность</span><div class="graphics-number"><span id="graphics-live-fps">—</span><small>FPS</small></div><p id="graphics-cap" aria-live="polite"></p><p id="graphics-preview" class="graphics-baseline"></p><p id="graphics-baseline" class="graphics-baseline">Базовая частота: измерение…</p><p id="graphics-factor" class="graphics-baseline"></p><p class="muted">Частота отрисовки за последнюю секунду.</p></div>
      <div class="graphics-context"><span class="eyebrow">Описание параметра</span><h3 id="graphics-detail-title">Параметры видео</h3><p id="graphics-detail-text">Выберите параметр для просмотра описания.</p><p id="graphics-detail-cost"></p></div>

      <div class="graphics-apply-area"><p id="graphics-pending" role="status"></p><button id="graphics-apply" disabled>Применить настройки</button></div>
    </aside></div>
    <footer class="graphics-footer"><span>Видео применяется кнопкой «Применить настройки»</span><button id="graphics-reset"><kbd>F8</kbd> Сбросить настройки</button></footer>`;
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
        'DLSS, FSR и XeSS — технологии реконструкции изображения. Режим определяет баланс качества и производительности.',
        'Quality → Balanced → Performance → Ultra Performance',
      ],
      quality: [
        'Режим апскейлинга',
        settings.upscaler === 'off'
          ? 'Для выбора режима включите апскейлер.'
          : `${select('upscaler').selectedOptions[0].textContent}: ${select('quality').selectedOptions[0].textContent}. ${{ quality: 'Приоритет детализации изображения.', balanced: 'Баланс качества изображения и производительности.', performance: 'Приоритет производительности.', ultra: 'Максимальное усиление производительности при снижении детализации.' }[settings.quality]}`,
        settings.upscaler === 'off'
          ? ''
          : `Выбранный множитель: ×${format(graphicsMultiplier({ ...defaultGraphics(), upscaler: settings.upscaler, quality: settings.quality }))}`,
      ],
      aa: [
        'Сглаживание',
        'Метод уменьшения ступенчатых краёв объектов. FXAA и MSAA обрабатывают контуры; TAA и DLAA используют временную информацию.',
        'Множители: FXAA ×0,97 · TAA ×0,95 · MSAA ×0,8 · DLAA ×0,9',
      ],
      manual: [
        'Ручной лимит кадров',
        'Верхняя граница частоты отрисовки. При сочетании параметров действует наименьший положительный предел.',
        '0 — без ограничения',
      ],
    };
    const [title, text, cost] = feature
      ? [feature[1], feature[2], feature[3]]
      : (info[key] ?? ['Параметры видео', 'Выберите параметр для просмотра описания.', '']);
    container.querySelector('#graphics-detail-title')!.textContent = title;
    container.querySelector('#graphics-detail-text')!.textContent = text;
    container.querySelector('#graphics-detail-cost')!.textContent = cost;
  }
  const refresh = () => {
    const cap = effectiveFrameCap(applied, baselineFps);
    const preview = effectiveFrameCap(settings, baselineFps);
    const caption = (value: number, valueSettings: GraphicsSettings) =>
      baselineFps === null && graphicsMultiplier(valueSettings) < 1
        ? 'измерение…'
        : `${value ? format(value) : 'без ограничения'} FPS`;
    container.querySelector('#graphics-cap')!.textContent =
      `Текущий предел: ${caption(cap, applied)}`;
    const dirty =
      JSON.stringify(settings) !== JSON.stringify(applied) ||
      (container.querySelector<HTMLSelectElement>('#low-quality')!.value === 'low') !==
        appliedLowQuality;
    container.querySelector('#graphics-preview')!.textContent = dirty
      ? `После применения: ${caption(preview, settings)}`
      : '';
    container.querySelector<HTMLButtonElement>('#graphics-apply')!.disabled = !dirty;
    container.querySelector('#graphics-pending')!.textContent = dirty
      ? 'Есть неприменённые изменения'
      : 'Настройки применены';
    container.querySelector('#graphics-baseline')!.textContent =
      baselineFps === null
        ? 'Базовая частота: измерение…'
        : `Базовая частота: ${format(baselineFps)} FPS`;
    container.querySelector('#graphics-factor')!.textContent =
      `Итоговый множитель: ×${new Intl.NumberFormat('ru', { maximumFractionDigits: 3 }).format(graphicsMultiplier(settings))}`;
    select('quality').disabled = settings.upscaler === 'off';
    container
      .querySelector('[data-row="quality"]')!
      .classList.toggle('is-disabled', settings.upscaler === 'off');
    if (selected) detail(selected);
  };
  container.addEventListener('input', (event) => {
    const input = event.target as HTMLInputElement;
    if (input.dataset.setting === 'manual') {
      settings = {
        ...settings,
        manual: Math.max(0, Math.min(240, Math.floor(Number(input.value) || 0))),
      };
      refresh();
    }
  });
  container.addEventListener('change', (event) => {
    const input = event.target as HTMLInputElement;
    const key = input.dataset.setting as keyof GraphicsSettings;
    if (!key) {
      if (input.id === 'low-quality') refresh();
      return;
    }
    const boolean = key !== 'generation' && features.some((item) => item[0] === key);
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
    container.querySelector<HTMLSelectElement>('#low-quality')!.value = 'full';
    selected = '';
    detail('');
    refresh();
  }
  container.querySelector('#graphics-apply')!.addEventListener('click', () => {
    applied = { ...settings };
    const lowQuality = container.querySelector<HTMLSelectElement>('#low-quality')!.value === 'low';
    const qualityChanged = lowQuality !== appliedLowQuality;
    appliedLowQuality = lowQuality;
    if (qualityChanged)
      container.dispatchEvent(new CustomEvent('video-quality-change', { detail: lowQuality }));
    refresh();
  });
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
      return applied;
    },
    updateMetrics(paused: boolean, fps: number, baseline: number | null) {
      if (baseline !== baselineFps) {
        baselineFps = baseline;
        refresh();
      }
      container.querySelector('#graphics-live-fps')!.textContent = paused ? 'Пауза' : String(fps);
    },
  };
}
