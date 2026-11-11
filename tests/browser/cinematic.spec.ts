import { test, expect } from '@playwright/test';

test('worm prologue renders shots with sound, hands off control, and can replay/skip', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  test.setTimeout(240000);
  await page.addInitScript(() => {
    const start = AudioBufferSourceNode.prototype.start;
    (window as any).__musicStarts = [];
    AudioBufferSourceNode.prototype.start = function (...args: Parameters<typeof start>) {
      if (this.buffer && this.buffer.duration > 100)
        (window as any).__musicStarts.push({
          duration: this.buffer.duration,
          offset: args[1] ?? 0,
        });
      return start.apply(this, args);
    };
  });
  await page.goto('/?seed=12');
  await page.locator('#enter-cinematic').click({ timeout: 45000 });
  const canvas = page.locator('#world');
  await expect(canvas).toHaveAttribute('data-cinematic', 'true');
  await expect.poll(() => page.evaluate(() => document.pointerLockElement?.id)).toBe('world');
  await expect.poll(() => page.evaluate(() => (window as any).__musicStarts.length)).toBe(1);
  const music = await page.evaluate(() => (window as any).__musicStarts[0]);
  expect(music.duration).toBeGreaterThan(134);
  expect(music.duration).toBeLessThan(135);
  expect(music.offset).toBeLessThan(5);
  await page.keyboard.down('w');
  await expect(canvas).toHaveAttribute('data-intro-shot', '1', { timeout: 20000 });
  expect(Number(await canvas.getAttribute('data-player-z'))).toBe(-5.2);
  await page.keyboard.up('w');
  await page.screenshot({ path: 'docs/images/worm-prologue.png' });
  await expect(canvas).toHaveAttribute('data-intro-phase', 'ascent', { timeout: 40000 });
  await expect(canvas).toHaveAttribute('data-intro-carried', 'true');
  await page.screenshot({ path: 'docs/images/worm-crow.png' });
  await expect(canvas).toHaveAttribute('data-intro-phase', 'attack', { timeout: 60000 });
  await expect(canvas).toHaveAttribute('data-intro-eagle', 'true');
  await page.screenshot({ path: 'docs/images/worm-eagle.png' });
  await expect(canvas).toHaveAttribute('data-intro-phase', 'fall', { timeout: 15000 });
  const height = Number(await canvas.getAttribute('data-intro-worm-y'));
  await page.waitForTimeout(5000);
  expect(Number(await canvas.getAttribute('data-intro-worm-y'))).toBeLessThan(height);
  await page.screenshot({ path: 'docs/images/worm-fall.png' });
  await expect(canvas).toHaveAttribute('data-intro-phase', 'aftermath', { timeout: 25000 });
  await expect(canvas).toHaveAttribute('data-intro-worm-y', '0');
  await expect(canvas).toHaveAttribute('data-cinematic', 'false', { timeout: 35000 });
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
