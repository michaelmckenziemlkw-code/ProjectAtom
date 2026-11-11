import { test, expect } from '@playwright/test';

test('worm prologue renders shots with sound, hands off control, and can replay/skip', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  test.setTimeout(300000);
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
  const skin = await canvas.getAttribute('data-worm-skin');
  await expect(canvas).toHaveAttribute('data-beetle-visible', 'true');
  await page.screenshot({ path: 'docs/images/worm-prologue.png' });
  await expect(canvas).toHaveAttribute('data-intro-phase', 'ascent', { timeout: 40000 });
  await expect(canvas).toHaveAttribute('data-intro-carried', 'true');
  expect(Number(await canvas.getAttribute('data-grip-error'))).toBeLessThan(0.001);
  await page.screenshot({ path: 'docs/images/worm-crow.png' });
  await expect(canvas).toHaveAttribute('data-intro-phase', 'attack', { timeout: 60000 });
  await expect(canvas).toHaveAttribute('data-intro-eagle', 'true');
  await page.screenshot({ path: 'docs/images/worm-eagle.png' });
  await expect(canvas).toHaveAttribute('data-intro-phase', 'fall', { timeout: 15000 });
  const height = Number(await canvas.getAttribute('data-intro-worm-y'));
  await page.waitForTimeout(5000);
  expect(Number(await canvas.getAttribute('data-intro-worm-y'))).toBeLessThan(height);
  await page.screenshot({ path: 'docs/images/worm-fall.png' });
  await expect(canvas).toHaveAttribute('data-intro-phase', 'aftermath', { timeout: 40000 });
  await expect(canvas).toHaveAttribute('data-intro-worm-y', '0');
  await expect(canvas).toHaveAttribute('data-cinematic', 'false', { timeout: 35000 });
  await expect(page.locator('#cinematic-hud')).toBeHidden();
  await expect(canvas).toHaveAttribute('data-worm-skin', skin!);
  await expect(canvas).toHaveAttribute('data-beetle-visible', 'true');
  expect(Number(await canvas.getAttribute('data-scene-fog'))).toBeCloseTo(0.045, 5);
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

test('beak rig and appearance stay continuous through the cinematic handoff', async ({ page }) => {
  // Advance only visual time here; the real-time scenario above checks the full score.
  await page.clock.install();
  await page.goto('/?seed=12');
  await page.locator('#enter-cinematic').click({ timeout: 45000 });
  const canvas = page.locator('#world');
  await expect(canvas).toHaveAttribute('data-cinematic', 'true');
  let time = Number(await canvas.getAttribute('data-animation-time'));
  await page.clock.fastForward((70 - time) * 1000);
  await expect(canvas).toHaveAttribute('data-intro-phase', 'attack');
  expect(Number(await canvas.getAttribute('data-grip-error'))).toBeLessThan(0.001);
  await page.screenshot({ path: 'docs/images/worm-eagle.png' });
  time = Number(await canvas.getAttribute('data-animation-time'));
  await page.clock.fastForward((85 - time) * 1000);
  await expect(canvas).toHaveAttribute('data-intro-phase', 'fall');
  const tail = await canvas.getAttribute('data-local-worm-tail');
  await page.clock.fastForward(3000);
  expect(await canvas.getAttribute('data-local-worm-tail')).not.toBe(tail);
  time = Number(await canvas.getAttribute('data-animation-time'));
  await page.clock.fastForward((133.5 - time) * 1000);
  await expect(canvas).toHaveAttribute('data-intro-phase', 'aftermath');
  const skin = await canvas.getAttribute('data-worm-skin');
  const fog = Number(await canvas.getAttribute('data-scene-fog'));
  const tint = await canvas.getAttribute('data-sun-tint');
  await expect(canvas).toHaveAttribute('data-beetle-visible', 'true');
  await page.clock.fastForward(1500);
  await expect(canvas).toHaveAttribute('data-cinematic', 'false');
  await expect(canvas).toHaveAttribute('data-worm-skin', skin!);
  await expect(canvas).toHaveAttribute('data-beetle-visible', 'true');
  expect(Math.abs(Number(await canvas.getAttribute('data-scene-fog')) - fog)).toBeLessThan(0.001);
  const afterTint = await canvas.getAttribute('data-sun-tint');
  for (const offset of [1, 3, 5])
    expect(
      Math.abs(
        parseInt(tint!.slice(offset, offset + 2), 16) -
          parseInt(afterTint!.slice(offset, offset + 2), 16),
      ),
    ).toBeLessThanOrEqual(3);
});

test('carried closeups keep the face in frame before the high-altitude accelerating fall', async ({
  page,
}) => {
  await page.clock.install();
  await page.goto('/?seed=12');
  await page.locator('#enter-cinematic').click({ timeout: 45000 });
  const canvas = page.locator('#world');
  for (const [target, file] of [
    [41, 'worm-beak-closeup'],
    [60, 'worm-beak-closeup-side'],
  ] as const) {
    const time = Number(await canvas.getAttribute('data-animation-time'));
    await page.clock.fastForward((target - time) * 1000);
    await expect(canvas).toHaveAttribute('data-intro-closeup', 'true');
    expect(Number(await canvas.getAttribute('data-grip-error'))).toBeLessThan(0.001);
    expect(Number(await canvas.getAttribute('data-eye-anchor'))).toBeLessThan(0.19);
    await page.screenshot({ path: `docs/images/${file}.png` });
  }
  let time = Number(await canvas.getAttribute('data-animation-time'));
  await page.clock.fastForward((77 - time) * 1000);
  expect(Number(await canvas.getAttribute('data-intro-worm-y'))).toBeGreaterThan(180);
  const speed = Number(await canvas.getAttribute('data-intro-fall-speed'));
  time = Number(await canvas.getAttribute('data-animation-time'));
  await page.clock.fastForward((104 - time) * 1000);
  expect(Number(await canvas.getAttribute('data-intro-fall-speed'))).toBeGreaterThan(speed * 1.5);
  await page.screenshot({ path: 'docs/images/worm-fast-fall.png' });
});

test('reference worm uses a textured surface and never crosses the ground around landing', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.clock.install();
  await page.goto('/?seed=12');
  await page.locator('#enter-cinematic').click({ timeout: 45000 });
  const canvas = page.locator('#world');
  expect(Number(await canvas.getAttribute('data-worm-surface-vertices'))).toBeGreaterThan(1500);
  await expect(canvas).toHaveAttribute('data-cinematic', 'true');
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 2000));
  let previous = Number(await canvas.getAttribute('data-animation-time'));
  for (const target of [109.7, 109.9, 109.94, 110.02, 110.12, 110.6, 111.2]) {
    await page.clock.fastForward(Math.max(1, (target - previous) * 1000));
    await page.clock.runFor(20);
    const min = Number(await canvas.getAttribute('data-worm-surface-min-y'));
    expect(min, `surface at ${target}s`).toBeGreaterThanOrEqual(0.0399);
    previous = Number(await canvas.getAttribute('data-animation-time'));
    if (target === 109.94) {
      await expect(canvas).toHaveAttribute('data-intro-phase', 'fall');
      await page.screenshot({ path: 'docs/images/worm-ground-contact.png' });
    }
  }
  await page.screenshot({ path: 'docs/images/worm-ground-rest.png' });
  expect(errors).toEqual([]);
});

test('healthy, weakened and dying reference palettes remain selectable without changing the performance', async ({
  page,
}) => {
  await page.clock.install();
  const skins: string[] = [];
  for (const [condition, label] of [
    [1, 'healthy'],
    [0.55, 'weakened'],
    [0, 'dying'],
  ] as const) {
    await page.goto(`/?seed=12&condition=${condition}`);
    await page.locator('#enter-cinematic').click({ timeout: 45000 });
    const canvas = page.locator('#world');
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 2000));
    const time = Number(await canvas.getAttribute('data-animation-time'));
    await page.clock.fastForward((104 - time) * 1000);
    await expect(canvas).toHaveAttribute('data-worm-condition', String(condition));
    skins.push((await canvas.getAttribute('data-worm-skin'))!);
    await page.screenshot({ path: `docs/images/worm-${label}.png` });
    await page.clock.resume();
  }
  expect(new Set(skins).size).toBe(3);
});

test('sun silhouette, cloud depth, forward flight and exhausted landing are readable in the new staging', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.clock.install();
  await page.goto('/?seed=12');
  await page.locator('#enter-cinematic').click({ timeout: 60000 });
  const canvas = page.locator('#world');
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
  const show = async (target: number, name: string) => {
    const time = Number(await canvas.getAttribute('data-animation-time'));
    await page.clock.fastForward(Math.max(1, (target - time) * 1000));
    await page.clock.runFor(16);
    if (target >= 109.5)
      expect(Number(await canvas.getAttribute('data-worm-surface-min-y'))).toBeGreaterThanOrEqual(
        0.0399,
      );
    await page.screenshot({ path: `docs/images/${name}.png` });
  };
  await show(5.7, 'worm-front-cough');
  expect(Number(await canvas.getAttribute('data-blood-drops'))).toBeGreaterThanOrEqual(6);
  await show(53, 'worm-forward-flight');
  expect(Number(await canvas.getAttribute('data-cloud-banks'))).toBeGreaterThanOrEqual(48);
  expect(Number(await canvas.getAttribute('data-cloud-thickness'))).toBeGreaterThan(5);
  const sky = await canvas.getAttribute('data-sky-color');
  for (const t of [60, 63.2, 64, 65, 66]) {
    await show(t, 'worm-clear-flight');
    expect(Number(await canvas.getAttribute('data-cloud-view-blockers'))).toBe(0);
  }
  await show(70, 'worm-larger-birds');
  await show(74.98, 'worm-release-before');
  const beforeCamera = JSON.parse((await canvas.getAttribute('data-intro-camera'))!);
  const beforeTarget = JSON.parse((await canvas.getAttribute('data-intro-target'))!);
  await show(75.02, 'worm-release-after');
  for (const [attr, before] of [
    ['data-intro-camera', beforeCamera],
    ['data-intro-target', beforeTarget],
  ] as const) {
    const after = JSON.parse((await canvas.getAttribute(attr))!);
    expect(Math.hypot(...after.map((v: number, i: number) => v - before[i]))).toBeLessThan(0.8);
  }
  await expect(canvas).toHaveAttribute('data-intro-bullet', 'false');
  await expect(canvas).toHaveAttribute('data-intro-eagle', 'true');
  await show(78.3, 'worm-sun-bullet');
  await expect(canvas).toHaveAttribute('data-intro-bullet', 'true');
  expect(Number(await canvas.getAttribute('data-solar-alignment'))).toBeLessThan(0.03);
  await show(84, 'worm-volume-clouds');
  expect(Number(await canvas.getAttribute('data-visible-mist'))).toBeGreaterThan(0);
  await show(110.5, 'worm-knockdown');
  expect(Number(await canvas.getAttribute('data-intro-knockdown'))).toBe(1);
  expect(Number(await canvas.getAttribute('data-worm-surface-min-y'))).toBeGreaterThanOrEqual(
    0.0399,
  );
  expect(Number(await canvas.getAttribute('data-worm-roll'))).toBeCloseTo(Math.PI, 4);
  await show(112.6, 'worm-weak-head-lift');
  expect(Number(await canvas.getAttribute('data-intro-head-lift'))).toBeGreaterThan(0.04);
  expect(Number(await canvas.getAttribute('data-blood-drops'))).toBeGreaterThanOrEqual(24);
  await show(121, 'worm-unwinding');
  expect(Number(await canvas.getAttribute('data-worm-roll'))).toBeGreaterThan(0);
  await show(135, 'worm-stylized-game');
  expect(await canvas.getAttribute('data-sky-color')).toBe(sky);
  await expect(canvas).toHaveAttribute('data-cinematic', 'false');
  expect(errors).toEqual([]);
});

test('eagle spotting insert leads to a rear talon grip, shocked beak and continuous release', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.clock.install();
  await page.goto('/?seed=12');
  await page.locator('#enter-cinematic').click({ timeout: 60000 });
  const canvas = page.locator('#world');
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
  const show = async (t: number, file: string) => {
    const now = Number(await canvas.getAttribute('data-animation-time'));
    await page.clock.fastForward((t - now) * 1000);
    await page.clock.runFor(16);
    await page.screenshot({ path: 'docs/images/' + file + '.png' });
  };
  await show(53.8, 'worm-eagle-notices');
  await expect(canvas).toHaveAttribute('data-eagle-spotting', 'true');
  await show(71, 'worm-rear-pursuit');
  await expect(canvas).toHaveAttribute('data-eagle-spotting', 'false');
  await show(74.45, 'worm-talons-closing');
  expect(Number(await canvas.getAttribute('data-eagle-grasp'))).toBeGreaterThan(0.5);
  await show(74.9, 'worm-crow-startled');
  expect(Number(await canvas.getAttribute('data-talon-max-span'))).toBeLessThan(3.5);
  expect(Number(await canvas.getAttribute('data-talon-grip-error'))).toBeLessThan(0.001);
  expect(Number(await canvas.getAttribute('data-crow-beak-open'))).toBeGreaterThan(1.4);
  await expect(canvas).toHaveAttribute('data-intro-carried', 'true');
  const camera = JSON.parse((await canvas.getAttribute('data-intro-camera'))!);
  await show(75.05, 'worm-grasp-release');
  await expect(canvas).toHaveAttribute('data-intro-carried', 'false');
  const after = JSON.parse((await canvas.getAttribute('data-intro-camera'))!);
  expect(Math.hypot(...after.map((v: number, i: number) => v - camera[i]))).toBeLessThan(1);
  expect(Number(await canvas.getAttribute('data-talon-grip-error'))).toBeLessThan(0.001);
  await show(78.3, 'worm-sun-bullet');
  expect(Number(await canvas.getAttribute('data-solar-alignment'))).toBeLessThan(0.03);
  expect(errors).toEqual([]);
});

test('eagle enters the returning flight shot before the cut to the attack', async ({ page }) => {
  await page.clock.install();
  await page.goto('/?seed=12');
  await page.locator('#enter-cinematic').click({ timeout: 60000 });
  const canvas = page.locator('#world');
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
  const show = async (t: number, file?: string) => {
    const now = Number(await canvas.getAttribute('data-animation-time'));
    await page.clock.fastForward((t - now) * 1000);
    await page.clock.runFor(16);
    if (file) await page.screenshot({ path: 'docs/images/' + file + '.png' });
  };
  for (const t of [51, 52.5]) {
    await show(t);
    await expect(canvas).toHaveAttribute('data-intro-eagle', 'true');
    await expect(canvas).toHaveAttribute('data-eagle-in-frame', 'false');
  }
  await show(53.8, 'worm-eagle-notices');
  await expect(canvas).toHaveAttribute('data-eagle-in-frame', 'true');
  for (const t of [55.2, 63]) {
    await show(t, t === 63 ? 'worm-eagle-before-entry' : undefined);
    await expect(canvas).toHaveAttribute('data-intro-eagle', 'true');
    await expect(canvas).toHaveAttribute('data-eagle-in-frame', 'false');
  }
  await show(64.5, 'worm-eagle-enters-edge');
  await show(65.8, 'worm-eagle-entered');
  await expect(canvas).toHaveAttribute('data-intro-shot', '5');
  await expect(canvas).toHaveAttribute('data-eagle-in-frame', 'true');
  await show(66.6, 'worm-eagle-in-flight-shot');
  await expect(canvas).toHaveAttribute('data-intro-shot', '5');
  await expect(canvas).toHaveAttribute('data-eagle-in-frame', 'true');
});

test('landing camera, exposure and fog remain continuous across the impact and handoff', async ({
  page,
}) => {
  await page.clock.install();
  await page.goto('/?seed=12');
  await page.locator('#enter-cinematic').click({ timeout: 60000 });
  const canvas = page.locator('#world');
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
  const show = async (t: number, name: string) => {
    const now = Number(await canvas.getAttribute('data-animation-time'));
    await page.clock.fastForward((t - now) * 1000);
    await page.clock.runFor(16);
    await page.screenshot({ path: 'docs/images/' + name + '.png' });
    expect(Number(await canvas.getAttribute('data-worm-surface-min-y'))).toBeGreaterThanOrEqual(
      0.0399,
    );
    const cinematic = (await canvas.getAttribute('data-cinematic')) === 'true';
    return {
      camera: cinematic
        ? JSON.parse((await canvas.getAttribute('data-intro-camera'))!)
        : await Promise.all(
            ['x', 'y', 'z'].map(async (axis) =>
              Number(await canvas.getAttribute('data-rendered-camera-' + axis)),
            ),
          ),
      target: cinematic
        ? JSON.parse((await canvas.getAttribute('data-intro-target'))!)
        : await Promise.all(
            ['x', 'y', 'z'].map(async (axis) =>
              Number(await canvas.getAttribute('data-camera-target-' + axis)),
            ),
          ),
      exposure: Number(await canvas.getAttribute('data-scene-exposure')),
      fog: Number(await canvas.getAttribute('data-scene-fog')),
    };
  };
  await show(109.6, 'worm-landing-approach');
  const a = await show(109.98, 'worm-landing-before');
  const b = await show(110.02, 'worm-landing-after');
  for (const key of ['camera', 'target'] as const)
    expect(Math.hypot(...a[key].map((v: number, i: number) => v - b[key][i]))).toBeLessThan(0.5);
  expect(Math.abs(a.exposure - b.exposure)).toBeLessThan(0.02);
  expect(Math.abs(a.fog - b.fog)).toBeLessThan(0.001);
  await show(110.8, 'worm-landing-rest');
  await show(113, 'worm-slow-recovery');
  const before = await show(133.9, 'worm-handoff-before');
  const after = await show(134.4, 'worm-handoff-after');
  for (const key of ['camera', 'target'] as const)
    expect(
      Math.hypot(...before[key].map((v: number, i: number) => v - after[key][i])),
    ).toBeLessThan(0.1);
  await expect(canvas).toHaveAttribute('data-cinematic', 'false');
});
