import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { createObservations, gestures, gestureLabels } from '../../src/core/observation.ts';
async function enter(page: Page) {
  await page.goto('/?seed=12');
  await page.locator('#enter').click({ timeout: 45000 });
  await expect
    .poll(() => page.evaluate(() => document.pointerLockElement?.id), { timeout: 15000 })
    .toBe('world');
}
async function menu(page: Page) {
  await page.keyboard.press('Escape');
  await expect(page.locator('#pause-menu')).toBeVisible();
}
async function settings(page: Page) {
  await menu(page);
  await page.locator('#open-settings').click();
  await expect(page.getByRole('dialog', { name: 'Настройки', exact: true })).toBeVisible();
}
const number = (page: Page, key: string) =>
  page.locator('#world').getAttribute(`data-${key}`).then(Number);

test('real WebGL, locked mouse, worm movement, blocked passage and bedding departure', async ({
  page,
}) => {
  const errors: string[] = [],
    outbound: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('request', (r) => {
    if (!r.url().startsWith('http://127.0.0.1:4173')) outbound.push(r.url());
  });
  await enter(page);
  expect(
    await page.locator('#world').evaluate((canvas: HTMLCanvasElement) => {
      const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
      if (!gl) return false;
      const pixels = new Uint8Array(canvas.width * canvas.height * 4);
      gl.readPixels(0,0,canvas.width,canvas.height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
      const colors=new Set<number>();
      for(let i=0;i<pixels.length;i+=64)colors.add(pixels[i]);
      return colors.size>15;
    }),
  ).toBe(true);
  await expect(page.locator('#study button')).toHaveCount(0);
  await expect(page.locator('#pause,#inspect,#wide,#settings-button')).toHaveCount(0);
  await page.screenshot({ path: 'docs/images/worm-play.png' });
  await page.keyboard.down('w');
  await page.waitForTimeout(2800);
  await page.keyboard.up('w');
  expect(await number(page, 'player-z')).toBeCloseTo(-1.92, 2);
  await expect(page.locator('#interaction')).toContainText('E —');
  await page.keyboard.press('e');
  await expect(page.locator('#world')).not.toHaveAttribute('data-beetle-stage', 'waiting');
  await page.waitForTimeout(1700);
  await page.screenshot({ path: 'docs/images/beetle-departure.png' });
  await expect(page.locator('#world')).toHaveAttribute('data-beetle-stage', 'cleared', {
    timeout: 15000,
  });
  await expect(page.locator('#world')).toHaveAttribute('data-blocked', 'false');
  await page.keyboard.down('w');
  await page.waitForTimeout(1600);
  await page.keyboard.up('w');
  expect(await number(page, 'player-z')).toBeGreaterThan(0);
  const yaw = await number(page, 'camera-yaw');
  await page.mouse.move(1000, 520);
  await expect.poll(() => number(page, 'camera-yaw')).not.toBe(yaw);
  expect(errors).toEqual([]);
  expect(outbound).toEqual([]);
});

test('Escape menu does not pause time, clears walking, resumes by Escape/button and quits to entry', async ({
  page,
}) => {
  await enter(page);
  await page.keyboard.down('w');
  await menu(page);
  await page.keyboard.up('w');
  const z = await number(page, 'player-z'),
    time = await number(page, 'animation-time');
  await page.waitForTimeout(1300);
  expect(await number(page, 'animation-time')).toBeGreaterThan(time + 1);
  expect(await number(page, 'player-z')).toBe(z);
  await page.screenshot({ path: 'docs/images/pause-menu.png' });
  await page.keyboard.press('Escape');
  await expect(page.locator('#pause-menu')).toBeHidden();
  await expect.poll(() => page.evaluate(() => document.pointerLockElement?.id)).toBe('world');
  await menu(page);
  await page.locator('#resume').click();
  await expect(page.locator('#pause-menu')).toBeHidden();
  await menu(page);
  await page.locator('#open-settings').click();
  await page.keyboard.press('Escape');
  await expect(page.locator('#pause-menu')).toBeVisible();
  await expect(page.locator('#settings')).toBeHidden();
  await page.locator('#quit').click();
  await expect(page.locator('#loading')).toBeVisible();
  const stopped = await number(page, 'animation-time');
  await page.waitForTimeout(400);
  expect(await number(page, 'animation-time')).toBe(stopped);
  await page.locator('#enter').click();
  await expect.poll(() => page.evaluate(() => document.pointerLockElement?.id)).toBe('world');
  expect(await number(page, 'player-z')).toBe(-5.2);
  await expect(page.locator('#world')).toHaveAttribute('data-beetle-stage', 'waiting');
});

test('video Apply, real quality, multipliers, manual pacing and clock continue inside settings', async ({
  page,
}) => {
  await enter(page);
  await expect.poll(() => number(page, 'baseline-fps'), { timeout: 30000 }).toBeGreaterThan(0);
  const base = await number(page, 'baseline-fps');
  await settings(page);
  await page.getByRole('tab', { name: 'Видео', exact: true }).click();
  await page.getByRole('combobox', { name: 'NVIDIA HairWorks', exact: true }).selectOption('true');
  await page.getByRole('combobox', { name: 'Ray Tracing', exact: true }).selectOption('true');
  await expect(page.locator('#world')).toHaveAttribute('data-target-fps', '0');
  await page.locator('#graphics-apply').click();
  const cap = Math.max(Math.min(1, base), base * 0.7 * 0.2);
  await expect.poll(() => number(page, 'target-fps')).toBeCloseTo(cap, 6);
  const t = await number(page, 'animation-time'),
    n = await number(page, 'render-count'),
    now = Date.now();
  await page.waitForTimeout(2400);
  const elapsed = (Date.now() - now) / 1000;
  expect(await number(page, 'animation-time')).toBeGreaterThan(t + 2);
  expect((await number(page, 'render-count')) - n).toBeLessThanOrEqual(
    Math.ceil(elapsed * cap) + 2,
  );
  expect((await number(page, 'render-count')) - n).toBeGreaterThan(0);
  await page
    .getByRole('combobox', { name: 'Multi Frame Generation', exact: true })
    .selectOption('4x');
  await page.locator('#graphics-apply').click();
  await expect
    .poll(() => number(page, 'target-fps'))
    .toBeCloseTo(Math.max(Math.min(1, base), base * 0.7 * 0.2 * 4), 6);
  await page.keyboard.press('F8');
  await page.locator('#graphics-apply').click();
  await expect(page.locator('#world')).toHaveAttribute('data-target-fps', '0');
  await page.getByRole('spinbutton', { name: 'Ручной лимит кадров', exact: true }).fill('5');
  await expect(page.locator('#world')).toHaveAttribute('data-target-fps', '0');
  await page.locator('#graphics-apply').click();
  await expect(page.locator('#world')).toHaveAttribute('data-target-fps', '5');
  await page.keyboard.press('F8');
  await page.locator('#graphics-apply').click();
  const width = await page.locator('#world').evaluate((e: HTMLCanvasElement) => e.width);
  await page.getByRole('combobox', { name: 'Качество сцены', exact: true }).selectOption('low');
  expect(await page.locator('#world').evaluate((e: HTMLCanvasElement) => e.width)).toBe(width);
  await page.locator('#graphics-apply').click();
  await expect
    .poll(() => page.locator('#world').evaluate((e: HTMLCanvasElement) => e.width))
    .toBeLessThan(width);
  await page.getByRole('combobox', { name: 'Ray Tracing', exact: true }).selectOption('true');
  const apply = (await page.locator('#graphics-apply').boundingBox())!,
    footer = (await page.locator('.graphics-footer').boundingBox())!;
  expect(apply.y + apply.height).toBeLessThanOrEqual(footer.y);
  await page.locator('.graphics-options').evaluate((e) => (e.scrollTop = 0));
  await page.screenshot({ path: 'docs/images/graphics-settings.png' });
});

test('shared sound/video dialog and real master volume', async ({ page }) => {
  await page.addInitScript(() => {
    const original = AudioContext.prototype.createGain;
    AudioContext.prototype.createGain = function () {
      const gain = original.call(this),
        connect = gain.connect.bind(gain);
      gain.connect = ((target: AudioNode) => {
        if (target instanceof AudioDestinationNode)
          (window as unknown as { audioMaster: GainNode }).audioMaster = gain;
        return connect(target);
      }) as typeof gain.connect;
      return gain;
    };
  });
  await enter(page);
  await settings(page);
  const box = await page.locator('#settings').boundingBox();
  await page.getByRole('tab', { name: 'Видео', exact: true }).click();
  expect(await page.locator('#settings').boundingBox()).toEqual(box);
  await page.getByRole('tab', { name: 'Звук', exact: true }).click();
  expect(await page.locator('#settings').boundingBox()).toEqual(box);
  await page.locator('#audio').click();
  const volume = page.getByRole('slider', { name: 'Общая громкость', exact: true });
  await volume.press('Home');
  await volume.press('ArrowRight');
  await expect(page.locator('#volume-value')).toHaveText('1%');
  await expect
    .poll(() =>
      page.evaluate(() => (window as unknown as { audioMaster: GainNode }).audioMaster.gain.value),
    )
    .toBeCloseTo(0.01, 3);
  await volume.press('Home');
  await expect
    .poll(() =>
      page.evaluate(() => (window as unknown as { audioMaster: GainNode }).audioMaster.gain.value),
    )
    .toBeCloseTo(0, 2);
  await page.locator('#audio').click();
  await page.screenshot({ path: 'docs/images/sound-settings.png' });
  await page.locator('#settings-close').click();
  await expect(page.locator('#pause-menu')).toBeVisible();
  await expect(page.locator('#resume')).toBeFocused();
});

test('paid hints and optional recognition remain available only through the menu', async ({
  page,
}) => {
  await enter(page);
  await expect(page.locator('#hints')).toBeHidden();
  await menu(page);
  await page.locator('#hints summary').click();
  for (let i = 0; i < 3; i++) await page.locator('#hint-next').click();
  await expect(page.locator('#hint-budget')).toHaveText('7');
  await expect(page.locator('#hint-next')).toBeDisabled();
  await page.locator('#technical > summary').click();
  await page.locator('#self-check summary').click();
  for (const observation of createObservations(12)) {
    await page.locator(`[data-observation="${observation.id}"]`).click();
    await expect(page.locator('#hint-budget')).toHaveText('7');
    const wrong = gestures.find((g) => g !== observation.gesture)!;
    await page.getByLabel(gestureLabels[wrong], { exact: true }).check();
    await page.locator('#answer-form button').click();
    await expect(page.locator('#feedback')).toContainText('Посмотри ещё раз');
    await page.getByLabel(gestureLabels[observation.gesture], { exact: true }).check();
    await page.locator('#answer-form button').click();
  }
  await expect(page.locator('#progress')).toHaveText('Распознано: 3 / 3');
  await page.locator('#quit').click();
  await page.locator('#enter').click();
  await menu(page);
  await expect(page.locator('#hint-budget')).toHaveText('10');
});

test('narrow viewport keeps menus and Apply reachable without horizontal overflow', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await enter(page);
  await settings(page);
  await page.getByRole('tab', { name: 'Видео', exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'docs/images/graphics-narrow.png', fullPage: true });
  await page.getByRole('combobox', { name: 'NVIDIA PhysX', exact: true }).selectOption('true');
  await page.locator('#graphics-apply').scrollIntoViewIfNeeded();
  await expect(page.locator('#graphics-apply')).toBeVisible();
  await page.locator('#graphics-apply').click();
  await page.keyboard.press('Escape');
  await expect(page.locator('#pause-menu')).toBeVisible();
});

test('WebGL context loss exposes recovery instead of freezing', async ({ page }) => {
  await enter(page);
  await page.locator('#world').evaluate((canvas: HTMLCanvasElement) => {
    const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
    const ext = gl?.getExtension('WEBGL_lose_context');
    if (!ext) throw Error('Missing extension');
    ext.loseContext();
  });
  await expect(page.locator('#failure')).toBeVisible();
  await expect(page.locator('#reload')).toBeVisible();
});

test('denied Pointer Lock keeps a usable retry menu', async ({ page }) => {
  await page.addInitScript(() => {
    HTMLCanvasElement.prototype.requestPointerLock = async () => {
      throw new DOMException('Denied', 'NotAllowedError');
    };
  });
  await page.goto('/?seed=12');
  await page.locator('#enter').click({ timeout: 45000 });
  await expect(page.locator('#pause-menu')).toBeVisible();
  await expect(page.locator('#control-error')).toContainText('Не удалось захватить мышь');
  await page.locator('#quit').click();
  await expect(page.locator('#loading')).toBeVisible();
});
