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
  await expect(page.locator('#description')).toBeHidden();
  await expect(page.locator('#feedback')).toBeEmpty();
  await page.getByRole('button', { name: 'Приблизиться', exact: true }).click();
  await page.waitForTimeout(1200);
  await page.getByRole('button', { name: 'Пауза', exact: true }).click();
  await page.waitForTimeout(1000); // allow camera interpolation to settle
  const paused = await page.screenshot();
  await page.waitForTimeout(350);
  expect(Buffer.compare(paused, await page.screenshot())).toBe(0);
  await page.getByRole('button', { name: 'Продолжить', exact: true }).click();
  const before = await page.screenshot();
  await page.waitForTimeout(700);
  expect(Buffer.compare(before, await page.screenshot())).not.toBe(0);
  await page.getByRole('button', { name: 'Настройки', exact: true }).click();
  await page.getByLabel('Уменьшить качество').check();
  await page.getByRole('button', { name: 'Звук: выкл.', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Звук: вкл.', exact: true })).toBeVisible();
  await page.getByLabel('Текстовое описание жеста').check();
  await expect(page.locator('#description')).toBeVisible();
  await page.getByLabel('Текстовое описание жеста').uncheck();
  await expect(page.locator('#description')).toBeHidden();
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
