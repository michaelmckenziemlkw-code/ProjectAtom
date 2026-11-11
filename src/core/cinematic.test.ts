import test from 'node:test';
import assert from 'node:assert/strict';
import {
  sampleIntro,
  INTRO_DURATION,
  COUGH_TIMES,
  RELEASE_TIME,
  IMPACT_TIME,
} from './cinematic.ts';

test('MIDI-duration prologue has ordered capture, ascent, attack, 20-second fall and aftermath', () => {
  assert.ok(INTRO_DURATION > 134 && INTRO_DURATION < 135);
  assert.equal(sampleIntro(0).fade, 1);
  assert.equal(sampleIntro(2).fade, 0);
  for (const [time, phase] of [
    [0, 'puddle'],
    [20, 'approach'],
    [31, 'capture'],
    [45, 'ascent'],
    [70, 'flight'],
    [85, 'attack'],
    [100, 'fall'],
    [120, 'aftermath'],
  ] as const)
    assert.equal(sampleIntro(time).phase, phase);
  assert.equal(IMPACT_TIME - RELEASE_TIME, 20);
  assert.equal(sampleIntro(31.99).carried, false);
  assert.equal(sampleIntro(32).carried, true);
  for (const time of [32, 40, 65, 89.99]) {
    const sample = sampleIntro(time);
    assert.ok(Math.abs(sample.worm[0] - sample.crow[0]) < 1e-8);
    assert.equal(sample.worm[1], sample.crow[1] - 0.7);
  }
  assert.ok(sampleIntro(89.999).worm[1] - sampleIntro(90).worm[1] < 0.01);
  assert.ok(sampleIntro(85).eagleVisible);
});

test('fall is monotonic, rotates slowly and lands in the same puddle without rebound', () => {
  let previous = sampleIntro(RELEASE_TIME);
  for (let time = RELEASE_TIME + 0.1; time <= INTRO_DURATION; time += 0.1) {
    const sample = sampleIntro(time);
    assert.ok(sample.worm[1] <= previous.worm[1] + 1e-8);
    if (time < IMPACT_TIME) assert.ok(Math.abs(sample.rotation[0] - previous.rotation[0]) < 0.04);
    else assert.deepEqual(sample.worm, [0, 0, -5.2]);
    previous = sample;
  }
  assert.equal(sampleIntro(105).cough, 0);
  assert.equal(sampleIntro(INTRO_DURATION).rise, 0);
  assert.equal(sampleIntro(INTRO_DURATION).done, true);
  assert.deepEqual(sampleIntro(INTRO_DURATION).target, [0, 0.55, -5.2]);
});

test('cough cues and choreography are deterministic at 1, 5 and 165 FPS', () => {
  for (const cue of COUGH_TIMES) {
    assert.equal(sampleIntro(cue - 0.01).cough, 0);
    assert.ok(sampleIntro(cue + 0.1).cough > 0.2);
    assert.equal(sampleIntro(cue + 0.7).cough, 0);
  }
  for (const fps of [1, 5, 165]) {
    let pose = sampleIntro(0);
    for (let frame = 0; frame <= 100 * fps; frame++) pose = sampleIntro(frame / fps);
    assert.deepEqual(pose, sampleIntro(100));
  }
});

test('both birds fit the attack camera and the fall camera tracks the rotating body centre', () => {
  const dot = (a: number[], b: number[]) => a.reduce((sum, v, i) => sum + v * b[i]!, 0);
  const sub = (a: number[], b: number[]) => a.map((v, i) => v - b[i]!);
  const norm = (a: number[]) => a.map((v) => v / Math.hypot(...a));
  for (let time = 82; time < 90; time += 0.1) {
    const s = sampleIntro(time),
      forward = norm(sub(s.target, s.camera));
    const right = norm([forward[2]!, 0, -forward[0]!]);
    const up = [
      right[1]! * forward[2]! - right[2]! * forward[1]!,
      right[2]! * forward[0]! - right[0]! * forward[2]!,
      right[0]! * forward[1]! - right[1]! * forward[0]!,
    ];
    for (const bird of [s.crow, s.eagle]) {
      const relative = sub(bird, s.camera),
        depth = dot(relative, forward);
      assert.ok(depth > 0);
      assert.ok(Math.abs(dot(relative, right)) < depth * Math.tan(0.75 / 2) * 1.44);
      assert.ok(Math.abs(dot(relative, up)) < depth * Math.tan(0.75 / 2) * 0.8);
    }
  }
  for (let time = 90; time < 110; time += 0.1) {
    const s = sampleIntro(time);
    assert.ok(Math.hypot(...sub(s.target, s.worm)) < 0.8);
    assert.ok(Math.hypot(...sub(s.camera, s.target)) > 5);
  }
});
