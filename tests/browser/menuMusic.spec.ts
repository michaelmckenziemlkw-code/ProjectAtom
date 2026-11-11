import { test, expect } from '@playwright/test';

function soundProbe() {
  const state = window as any;
  state.musicStarts = [];
  const start = AudioBufferSourceNode.prototype.start;
  const stop = AudioBufferSourceNode.prototype.stop;
  AudioBufferSourceNode.prototype.start = function (...args: Parameters<typeof start>) {
    if (this.buffer && this.buffer.duration > 10) {
      const row = { duration: this.buffer.duration, loop: this.loop, stopped: false };
      state.musicStarts.push(row);
      (this as any).musicRow = row;
    }
    return start.apply(this, args);
  };
  AudioBufferSourceNode.prototype.stop = function (...args: Parameters<typeof stop>) {
    if ((this as any).musicRow) (this as any).musicRow.stopped = true;
    return stop.apply(this, args);
  };
  const create = AudioContext.prototype.createGain;
  AudioContext.prototype.createGain = function () {
    const gain = create.call(this),
      connect = gain.connect.bind(gain);
    gain.connect = ((target: AudioNode) => {
      if (target instanceof AudioDestinationNode) state.audioMaster = gain;
      return connect(target);
    }) as typeof gain.connect;
    return gain;
  };
}

test('AtomBackground plays in entry only, shares volume, mutes hidden tabs and returns without overlapping the prologue', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(soundProbe);
  await page.goto('/?seed=12');
  const music = page.locator('#menu-music'),
    canvas = page.locator('#world');
  await expect(music).toBeEnabled({ timeout: 60000 });
  expect(await page.evaluate(() => (window as any).musicStarts.length)).toBe(0);
  await music.click();
  await expect(canvas).toHaveAttribute('data-menu-music-playing', 'true');
  const first = await page.evaluate(() => (window as any).musicStarts[0]);
  expect(first.loop).toBe(true);
  expect(first.duration).toBeGreaterThan(55);
  expect(first.duration).toBeLessThan(56);
  await page.screenshot({ path: 'docs/images/menu-music.png' });
  await page.locator('#enter-cinematic').click();
  await expect(canvas).toHaveAttribute('data-menu-music-playing', 'false');
  await expect
    .poll(() => page.evaluate(() => (window as any).musicStarts.some((r: any) => r.duration > 130)))
    .toBe(true);
  expect(await page.evaluate(() => (window as any).musicStarts[0].stopped)).toBe(true);
  await page.keyboard.press('q');
  await page.locator('#open-settings').click();
  await page.locator('#volume').evaluate((el: HTMLInputElement) => {
    el.value = '25';
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.locator('#settings-close').click();
  await page.locator('#quit').click();
  await expect(canvas).toHaveAttribute('data-menu-music-playing', 'true');
  await expect
    .poll(() => page.evaluate(() => (window as any).audioMaster.gain.value))
    .toBeCloseTo(0.25, 3);
  expect(
    await page.evaluate(() => (window as any).musicStarts.filter((r: any) => !r.stopped).length),
  ).toBe(1);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect
    .poll(() => page.evaluate(() => (window as any).audioMaster.gain.value))
    .toBeLessThan(0.001);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect
    .poll(() => page.evaluate(() => (window as any).audioMaster.gain.value))
    .toBeCloseTo(0.25, 3);
  await music.click();
  await expect(canvas).toHaveAttribute('data-menu-music-playing', 'false');
  await music.click();
  await expect(canvas).toHaveAttribute('data-menu-music-playing', 'true');
  expect(
    await page.evaluate(() => (window as any).musicStarts.filter((r: any) => !r.stopped).length),
  ).toBe(1);
  await page.locator('#enter').click();
  await expect(canvas).toHaveAttribute('data-menu-music-playing', 'false');
  expect(errors).toEqual([]);
});

test('a delayed menu decode cannot start music after entering the game', async ({ page }) => {
  await page.addInitScript(soundProbe);
  await page.addInitScript(() => {
    const decode = AudioContext.prototype.decodeAudioData;
    let first = true;
    AudioContext.prototype.decodeAudioData = function (data: ArrayBuffer) {
      const result = decode.call(this, data);
      if (!first) return result;
      first = false;
      return result.then(
        (buffer) =>
          new Promise<AudioBuffer>((resolve) => {
            (window as any).releaseMenuDecode = () => resolve(buffer);
          }),
      );
    };
  });
  await page.goto('/?seed=12');
  await page.locator('#menu-music').click({ timeout: 60000 });
  await expect
    .poll(() => page.evaluate(() => typeof (window as any).releaseMenuDecode))
    .toBe('function');
  await page.locator('#enter').click();
  await page.evaluate(() => (window as any).releaseMenuDecode());
  await page.waitForTimeout(200);
  await expect(page.locator('#world')).toHaveAttribute('data-menu-music-playing', 'false');
  expect(await page.evaluate(() => (window as any).musicStarts.length)).toBe(0);
});

test('missing menu music keeps the demo and prologue launch available', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/music/AtomBackground.ogg', (route) => route.abort());
  await page.goto('/?seed=12');
  await expect(page.locator('#enter')).toBeEnabled({ timeout: 60000 });
  await expect(page.locator('#menu-music')).toBeDisabled();
  await expect(page.locator('#menu-music')).toHaveText('Музыка недоступна');
  await expect(page.locator('#enter-cinematic')).toBeEnabled();
  await page.locator('#enter').click();
  await expect(page.locator('#failure')).toBeHidden();
  expect(errors).toEqual([]);
});

test('starting the prologue during pending menu audio unlock keeps sound enabled', async ({
  page,
}) => {
  await page.addInitScript(soundProbe);
  await page.addInitScript(() => {
    const resume = AudioContext.prototype.resume;
    let first = true;
    AudioContext.prototype.resume = function () {
      if (!first) return resume.call(this);
      first = false;
      const context = this;
      return new Promise<void>((resolve, reject) => {
        (window as any).releaseMenuUnlock = () => resume.call(context).then(resolve, reject);
      });
    };
  });
  await page.goto('/?seed=12');
  await page.locator('#menu-music').click({ timeout: 60000 });
  await expect
    .poll(() => page.evaluate(() => typeof (window as any).releaseMenuUnlock))
    .toBe('function');
  await page.locator('#enter-cinematic').click();
  await expect
    .poll(() => page.evaluate(() => (window as any).musicStarts.some((r: any) => r.duration > 130)))
    .toBe(true);
  await page.evaluate(() => (window as any).releaseMenuUnlock());
  await expect(page.locator('#audio')).toHaveAttribute('aria-pressed', 'true');
  await expect
    .poll(() => page.evaluate(() => (window as any).audioMaster.gain.value))
    .toBeGreaterThan(0.6);
  expect(
    await page.evaluate(() => (window as any).musicStarts.some((r: any) => r.duration < 60)),
  ).toBe(false);
});
