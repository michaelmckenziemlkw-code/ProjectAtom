import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ActiveClock, FramePacer, FrameMeter } from './timing.ts';
import { defaultGraphics, effectiveFrameCap } from './graphics.ts';
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
test('graphics combinations use minimum caps', () => {
  const s = defaultGraphics();
  assert.equal(effectiveFrameCap(s), 0);
  s.hair = true;
  assert.equal(effectiveFrameCap(s), 40);
  s.ray = true;
  assert.equal(effectiveFrameCap(s), 5);
  s.ray = false;
  s.path = true;
  assert.equal(effectiveFrameCap(s), 5);
  s.hair = false;
  assert.equal(effectiveFrameCap(s), 8);
  const u = defaultGraphics();
  u.upscaler = 'fsr';
  assert.equal(effectiveFrameCap(u), 52);
  u.quality = 'ultra';
  assert.equal(effectiveFrameCap(u), 76);
  assert.equal(effectiveFrameCap(u, 3), 3);
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
