import { test, expect } from '@playwright/test';
import { createObservations, gestures, gestureLabels } from '../../src/core/observation.ts';

test('renders real animated WebGL, pauses, frames the model, and stays offline', async ({
  page,
}) => {
  const errors: string[] = [];
  const outbound: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('request', (request) => {
    if (!request.url().startsWith('http://127.0.0.1:4173')) outbound.push(request.url());
  });
  await page.goto('/?seed=12');
  await expect(page.locator('#world')).toHaveAttribute('data-ready', 'true', { timeout: 45000 });
  await page.getByRole('button', { name: 'Осмотреть место' }).click();
  const rendered = await page.locator('#world').evaluate((canvas: HTMLCanvasElement) => {
    const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
    if (!gl) return false;
    const pixels = new Uint8Array(40 * 40 * 4);
    gl.readPixels(
      Math.floor(canvas.width / 2) - 20,
      Math.floor(canvas.height / 2) - 20,
      40,
      40,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      pixels,
    );
    return new Set(pixels).size > 15;
  });
  expect(rendered).toBe(true);
  await expect(page.locator('#self-check')).not.toHaveAttribute('open', '');
  await expect(page.locator('#feedback')).toBeEmpty();
  await page.getByRole('button', { name: 'Приблизиться', exact: true }).click();
  await page.waitForTimeout(1200);
  await page.getByRole('button', { name: 'Пауза', exact: true }).click();
  // Wait for actual rendering to settle, rather than assuming a software GPU finishes in 1s.
  await expect
    .poll(
      async () => {
        const count = await page.locator('#world').getAttribute('data-render-count');
        await page.waitForTimeout(1200);
        return (await page.locator('#world').getAttribute('data-render-count')) === count;
      },
      { timeout: 15000 },
    )
    .toBe(true);
  await expect(page.locator('#fps')).toHaveText('Пауза');
  const pausedTime = await page.locator('#world').getAttribute('data-animation-time');
  const sceneImage = () =>
    page.locator('#world').evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL());
  const paused = await sceneImage();
  await page.waitForTimeout(350);
  expect(await sceneImage()).toBe(paused);
  await expect(page.locator('#world')).toHaveAttribute('data-animation-time', pausedTime!);
  await page.getByRole('button', { name: 'Продолжить', exact: true }).click();
  const before = await sceneImage();
  await page.waitForTimeout(700);
  expect(await sceneImage()).not.toBe(before);
  await page.getByRole('button', { name: 'Настройки', exact: true }).click();
  await page.getByLabel('Уменьшить качество').check();
  await page.getByRole('button', { name: 'Звук: выкл.', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Звук: вкл.', exact: true })).toBeVisible();
  await expect(page.getByLabel('Текстовое описание жеста')).toHaveCount(0);
  expect(outbound).toEqual([]);
  expect(errors).toEqual([]);
});

test('recognition is correct for all observations and can recover from wrong answers', async ({
  page,
}) => {
  await page.goto('/?seed=12');
  await page.getByRole('button', { name: 'Осмотреть место' }).click();
  // This test exercises answer state; motion itself is verified in the WebGL test.
  await page.getByRole('button', { name: 'Пауза', exact: true }).click();
  await page.locator('#self-check summary').click();
  const observations = createObservations(12);
  for (const observation of observations) {
    await page
      .getByRole('button', { name: `Наблюдение ${observation.id + 1}`, exact: true })
      .click();
    const wrong = gestures.find((item) => item !== observation.gesture)!;
    await page.getByLabel(gestureLabels[wrong], { exact: true }).check();
    await page.getByRole('button', { name: 'Проверить наблюдение', exact: true }).click();
    await expect(page.locator('#feedback')).toContainText('Посмотри ещё раз');
    await page.getByLabel(gestureLabels[observation.gesture], { exact: true }).check();
    await page.getByRole('button', { name: 'Проверить наблюдение', exact: true }).click();
  }
  await expect(page.locator('#progress')).toHaveText('Распознано: 3 / 3');
  await expect(page.locator('#feedback')).toContainText('Все три наблюдения распознаны');
  await page.reload();
  await page.getByRole('button', { name: 'Осмотреть место' }).click();
  await expect(page.locator('#progress')).toHaveText('Распознано: 0 / 3');
});

test('narrow viewport supports touch-sized controls without horizontal overflow', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?seed=12');
  await page.getByRole('button', { name: 'Осмотреть место' }).click();
  await page.getByRole('button', { name: 'Наблюдение 2', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Наблюдение 2', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('context loss shows a recovery action instead of silently freezing', async ({ page }) => {
  await page.goto('/?seed=12');
  await page.getByRole('button', { name: 'Осмотреть место' }).click();
  await page.locator('#world').evaluate((canvas: HTMLCanvasElement) => {
    const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
    const extension = gl?.getExtension('WEBGL_lose_context');
    if (!extension) throw new Error('Test browser lacks WEBGL_lose_context');
    extension.loseContext();
  });
  await expect(page.locator('#failure')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Повторить', exact: true })).toBeVisible();
});

test('five FPS preserves time, graphics controls respond and F8 resets', async ({ page }) => {
  await page.goto('/?seed=12');
  await page.locator('#enter').click();
  await page.locator('#settings-button').click();
  await page.getByRole('button', { name: 'Видео', exact: true }).click();
  await expect(page.locator('#graphics-settings')).not.toContainText(
    /пароди|понарошку|AAA EDITION|красивого названия/i,
  );
  await expect(page.locator('#graphics-settings input[type=checkbox]')).toHaveCount(0);
  await page.getByRole('combobox', { name: 'NVIDIA HairWorks', exact: true }).selectOption('true');
  await page.getByRole('combobox', { name: 'Ray Tracing', exact: true }).selectOption('true');
  await expect(page.locator('#graphics-cap')).toHaveText('Предел: 5 FPS');
  await page.waitForTimeout(500);
  const sample = () =>
    page.locator('#world').evaluate((e) => ({
      t: Number((e as HTMLElement).dataset.animationTime),
      n: Number((e as HTMLElement).dataset.renderCount),
      now: performance.now(),
    }));
  const a = await sample();
  await page.waitForTimeout(2200);
  const b = await sample();
  expect(b.n - a.n).toBeGreaterThan(0);
  expect(b.n - a.n).toBeLessThanOrEqual(Math.ceil((b.now - a.now) / 200) + 1);
  expect(Math.abs(b.t - a.t - (b.now - a.now) / 1000)).toBeLessThan(0.35);
  await page.keyboard.press('F8');
  await expect(page.locator('#graphics-cap')).toHaveText('Предел: без ограничения FPS');
  await page.getByRole('combobox', { name: 'Апскейлер', exact: true }).selectOption('xess');
  await expect(page.locator('#graphics-cap')).toHaveText('Предел: 50 FPS');
  await page
    .getByRole('combobox', { name: 'Режим апскейлинга', exact: true })
    .selectOption('ultra');
  await expect(page.locator('#graphics-cap')).toHaveText('Предел: 72 FPS');
  await page.locator('#graphics-reset').click();
  await expect(page.getByRole('combobox', { name: 'Апскейлер', exact: true })).toHaveValue('off');
  await expect(
    page.getByRole('combobox', { name: 'Режим апскейлинга', exact: true }),
  ).toBeDisabled();
  await page.getByRole('combobox', { name: 'Апскейлер', exact: true }).selectOption('dlss');
  await page
    .getByRole('combobox', { name: 'Режим апскейлинга', exact: true })
    .selectOption('balanced');
  await expect(page.locator('#graphics-cap')).toHaveText('Предел: 60 FPS');
  await page.locator('#settings').evaluate((e) => (e.scrollTop = 0));
  await page.screenshot({ path: 'docs/images/graphics-settings.png' });
});

test('hints cost points once per level across observation variants', async ({ page }) => {
  await page.goto('/?seed=12');
  await page.locator('#enter').click();
  await page.locator('#pause').click();
  await expect(page.locator('#self-check')).not.toHaveAttribute('open', '');
  await expect(page.locator('#hint-text')).toBeHidden();
  await page.locator('#hints summary').click();
  for (let i = 0; i < 3; i++) await page.locator('#hint-next').click();
  await expect(page.locator('#hint-budget')).toHaveText('7');
  await expect(page.locator('#hint-next')).toBeDisabled();
  for (const observation of createObservations(12)) {
    await page.locator(`[data-observation="${observation.id}"]`).click();
    await expect(page.locator('#hint-text')).toContainText(
      { wave: 'машет', tap: 'ударяет', scrape: 'тянет' }[observation.gesture],
    );
    await expect(page.locator('#hint-budget')).toHaveText('7');
  }
  await page.locator('#hints summary').click();
  await page.locator('#hints summary').click();
  await expect(page.locator('#hint-budget')).toHaveText('7');
  await page.reload();
  await page.locator('#enter').click();
  await expect(page.locator('#hint-budget')).toHaveText('10');
  await page.locator('#pause').click();
  await page.screenshot({ path: 'docs/images/beetle-study.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#settings-button').click();
  await page.locator('#graphics-tab').click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'docs/images/graphics-narrow.png', fullPage: true });
});
