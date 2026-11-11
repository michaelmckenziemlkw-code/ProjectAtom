import { test, expect } from '@playwright/test';

test('worm prologue renders shots with sound, hands off control, and can replay/skip', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => {
    const starts = AudioScheduledSourceNode.prototype.start;
    (window as any).__scheduledAudio = 0;
    AudioScheduledSourceNode.prototype.start = function (...args: Parameters<typeof starts>) {
      (window as any).__scheduledAudio++;
      return starts.apply(this, args);
    };
  });
  await page.goto('/?seed=12');
  await page.locator('#enter-cinematic').click({ timeout: 45000 });
  const canvas = page.locator('#world');
  await expect(canvas).toHaveAttribute('data-cinematic', 'true');
  await expect.poll(() => page.evaluate(() => document.pointerLockElement?.id)).toBe('world');
  await expect
    .poll(() => page.evaluate(() => (window as any).__scheduledAudio))
    .toBeGreaterThan(20);
  await page.keyboard.down('w');
  await expect(canvas).toHaveAttribute('data-intro-shot', '1', { timeout: 20000 });
  expect(Number(await canvas.getAttribute('data-player-z'))).toBe(-5.2);
  await page.keyboard.up('w');
  await page.screenshot({ path: 'docs/images/worm-prologue.png' });
  await expect(canvas).toHaveAttribute('data-intro-shot', '2', { timeout: 20000 });
  await expect(canvas).toHaveAttribute('data-cinematic', 'false', { timeout: 20000 });
  await expect(page.locator('#cinematic-hud')).toBeHidden();
  await page.keyboard.down('w');
  await expect
    .poll(async () => Number(await canvas.getAttribute('data-player-z')))
    .toBeGreaterThan(-4.9);
  await page.keyboard.up('w');
  await page.keyboard.press('q');
  await page.locator('#quit').click();
  await page.locator('#enter-cinematic').click();
  await expect(canvas).toHaveAttribute('data-cinematic', 'true');
  await page.keyboard.press('q');
  await expect(page.locator('#pause-menu')).toBeVisible();
  const time = Number(await canvas.getAttribute('data-animation-time'));
  await expect
    .poll(async () => Number(await canvas.getAttribute('data-animation-time')))
    .toBeGreaterThan(time + 0.2);
  await page.keyboard.press('q');
  await expect.poll(() => page.evaluate(() => document.pointerLockElement?.id)).toBe('world');
  await page.keyboard.press('Space');
  await expect(canvas).toHaveAttribute('data-cinematic', 'false');
  expect(errors).toEqual([]);
});

test('prologue survives unavailable audio and removes its overlay on context loss', async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.AudioContext = class {
      constructor() {
        throw new Error('Audio unavailable');
      }
    } as unknown as typeof AudioContext;
  });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/?seed=12');
  await page.locator('#enter-cinematic').click({ timeout: 45000 });
  await expect(page.locator('#world')).toHaveAttribute('data-cinematic', 'true');
  await expect(page.locator('#cinematic-hud')).toBeVisible();
  await page
    .locator('#world')
    .evaluate((canvas) =>
      canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true })),
    );
  await expect(page.locator('#failure')).toBeVisible();
  await expect(page.locator('#cinematic-hud')).toBeHidden();
  expect(errors).toEqual([]);
});
