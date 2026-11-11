import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ActiveClock, FramePacer, FrameMeter, UncappedFpsSampler } from './timing.ts';
import { defaultGraphics, effectiveFrameCap, graphicsMultiplier } from './graphics.ts';
import { HintBank } from './hints.ts';
test('active time retains ten seconds at every FPS and after delay', () => {
  for (const fps of [1, 5, 40, 144]) {
    const c = new ActiveClock();
    c.setActive(true, 0);
    for (let i = 1; i <= fps * 10; i++) c.read((i * 1000) / fps);
    assert.ok(Math.abs(c.read(10000) - 10) < 1e-9);
    assert.equal(Math.round(c.read(20000)), 20);
  }
});
test('pause, resume, reset happen at event boundaries', () => {
  const c = new ActiveClock();
  c.setActive(true, 0);
  c.setActive(false, 2500);
  assert.equal(c.read(9000), 2.5);
  c.setActive(true, 10000);
  assert.equal(c.read(11000), 3.5);
  c.reset(11000);
  assert.equal(c.read(12000), 1);
});
test('pacer distributes 40 FPS on 60 Hz and never catches up in a burst', () => {
  const p = new FramePacer();
  let n = 0;
  for (let i = 0; i < 60; i++) if (p.shouldRender((i * 1000) / 60, 40)) n++;
  assert.equal(n, 40);
  assert.equal(p.shouldRender(10000, 40), true);
  assert.equal(p.shouldRender(10001, 40), false);
});
test('five FPS and real render meter', () => {
  const p = new FramePacer(),
    m = new FrameMeter();
  for (let t = 0; t < 1000; t += 10) if (p.shouldRender(t, 5)) m.record(t);
  assert.equal(m.count, 5);
  assert.equal(m.fps(1000), 4);
  assert.equal(m.fps(2000), 0);
});
test('costs multiply from the 165 FPS baseline and boosts recover lost frames', () => {
  const s = defaultGraphics();
  const close = (actual: number, expected: number) =>
    assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);
  assert.equal(effectiveFrameCap(s, 165), 0);
  s.hair = true;
  close(effectiveFrameCap(s, 165), 115.5);
  s.hair = false;
  s.ray = true;
  close(effectiveFrameCap(s, 165), 33);
  s.path = true;
  close(effectiveFrameCap(s, 165), 9.9);
  close(graphicsMultiplier(s), 0.06);
  s.path = false;
  s.generation = '2x';
  close(effectiveFrameCap(s, 165), 66);
  s.generation = '3x';
  close(effectiveFrameCap(s, 165), 99);
  s.generation = '4x';
  close(effectiveFrameCap(s, 165), 132);
  s.upscaler = 'dlss';
  s.quality = 'balanced';
  assert.equal(effectiveFrameCap(s, 165), 0);
  s.manual = 60;
  assert.equal(effectiveFrameCap(s, 165), 60);
  assert.equal(effectiveFrameCap(s, 165, 30), 30);
});
test('upscaling gets faster with performance modes, caps stay finite during calibration', () => {
  const s = defaultGraphics();
  s.ray = true;
  for (const technology of ['dlss', 'fsr', 'xess'] as const) {
    s.upscaler = technology;
    let previous = 0;
    for (const quality of ['quality', 'balanced', 'performance', 'ultra'] as const) {
      s.quality = quality;
      const cap = effectiveFrameCap(s, 165);
      assert.ok(cap > previous);
      previous = cap;
    }
  }
  s.upscaler = 'off';
  s.path = true;
  assert.equal(effectiveFrameCap(s, null), 0);
  assert.equal(effectiveFrameCap(s, NaN), 0);
  assert.equal(effectiveFrameCap(s, Infinity), 0);
  assert.equal(effectiveFrameCap(s, 2), 1);
  assert.equal(effectiveFrameCap(s, 0.5), 0.5);
  s.manual = 5;
  assert.equal(effectiveFrameCap(s, null), 5);
});
test('baseline samples real unpaced renders once and ignores later capped FPS', () => {
  const s = new UncappedFpsSampler();
  for (let i = 0; i <= 300; i++) s.sample((i * 1000) / 165);
  assert.ok(Math.abs(s.value! - 165) < 1e-8);
  s.sample(20000);
  assert.ok(Math.abs(s.value! - 165) < 1e-8);
  s.reset();
  s.sample(0);
  s.sample(100);
  s.interrupt();
  s.sample(10000);
  s.sample(10500);
  s.sample(11000);
  s.sample(11500);
  assert.equal(s.value, 2);
});
test('shared hints spend 10 minus 2 minus 3 equals 5', () => {
  const h = new HintBank({ first: 3, second: 3, third: 3 });
  for (let i = 0; i < 2; i++) h.revealNext('second');
  for (let i = 0; i < 3; i++) h.revealNext('third');
  assert.equal(h.remaining, 5);
  assert.equal(h.level('third'), 3);
  h.revealNext('third');
  h.revealNext('unknown');
  assert.equal(h.remaining, 5);
});
test('hints cannot overspend or unlock out of order', () => {
  const h = new HintBank({ beetle: 3 }, 2);
  assert.equal(h.revealNext('beetle'), 1);
  assert.equal(h.revealNext('beetle'), 2);
  assert.equal(h.revealNext('beetle'), 2);
  assert.equal(h.remaining, 0);
});
