import test from 'node:test';
import assert from 'node:assert/strict';
import { sampleIntro, INTRO_DURATION, COUGH_TIMES } from './cinematic.ts';

test('prologue has three deterministic shots, timed coughs and a completed standing pose', () => {
  assert.equal(sampleIntro(0).fade, 1);
  assert.equal(sampleIntro(2).fade, 0);
  assert.equal(sampleIntro(0).shot, 0);
  assert.equal(sampleIntro(8).shot, 1);
  assert.equal(sampleIntro(18).shot, 2);
  for (const cue of COUGH_TIMES) {
    assert.equal(sampleIntro(cue - 0.01).cough, 0);
    assert.ok(sampleIntro(cue + 0.1).cough > 0.2);
    assert.equal(sampleIntro(cue + 0.7).cough, 0);
  }
  const end = sampleIntro(INTRO_DURATION);
  assert.equal(end.done, true);
  assert.equal(end.rise, 1);
  assert.deepEqual(end.target, [0, 0.55, -5.2]);
  assert.deepEqual(sampleIntro(100).camera, end.camera);
});

test('camera/pose depend on elapsed time at 1, 5 and 165 FPS', () => {
  for (const fps of [1, 5, 165]) {
    let pose = sampleIntro(0);
    for (let frame = 0; frame <= 21 * fps; frame++) pose = sampleIntro(frame / fps);
    assert.deepEqual(pose, sampleIntro(21));
  }
});
