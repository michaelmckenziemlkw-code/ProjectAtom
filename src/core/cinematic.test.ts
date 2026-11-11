import { WORM_SPACING } from './wormBody.ts';
import { introSegment, WORM_IDLE_Y } from './wormPose.ts';
import { add, rotate, GRIP_SEGMENT, CROW_SCALE, EAGLE_SCALE, crowGraspTargets } from './birds.ts';
import { wormAppearance } from './wormAppearance.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  sampleIntro,
  INTRO_DURATION,
  COUGH_TIMES,
  RELEASE_TIME,
  IMPACT_TIME,
  FALL_REFERENCE_SPEED,
  FALL_START_SPEED,
  FALL_END_SPEED,
  FALL_HEIGHT,
  SKY_LIFT,
  fallClock,
  BULLET_DURATION,
  SUN_POSITION,
  SUN_DIRECTION,
  SUN_RADIUS,
  SOLAR_TIME,
} from './cinematic.ts';

test('MIDI-duration prologue has ordered capture, ascent, attack, 35-second fall and aftermath', () => {
  assert.ok(INTRO_DURATION > 134 && INTRO_DURATION < 135);
  assert.equal(sampleIntro(0).fade, 1);
  assert.equal(sampleIntro(2).fade, 0);
  for (const [time, phase] of [
    [0, 'puddle'],
    [20, 'approach'],
    [31, 'capture'],
    [45, 'ascent'],
    [60, 'flight'],
    [70, 'attack'],
    [100, 'fall'],
    [120, 'aftermath'],
  ] as const)
    assert.equal(sampleIntro(time).phase, phase);
  assert.equal(IMPACT_TIME - RELEASE_TIME, 35);
  assert.equal(sampleIntro(31.99).carried, false);
  assert.equal(sampleIntro(32).carried, true);
  for (const time of [32, 40, 60, 74.99]) {
    const s = sampleIntro(time);
    const point = add(s.worm, rotate(GRIP_SEGMENT, s.rotation));
    assert.ok(Math.hypot(...point.map((v, i) => v - s.grip[i]!)) < 1e-8);
  }
  const before = sampleIntro(RELEASE_TIME - 0.001),
    after = sampleIntro(RELEASE_TIME);
  assert.ok(Math.hypot(...before.worm.map((v, i) => v - after.worm[i]!)) < 0.02);
  assert.ok(sampleIntro(70).eagleVisible);
});

test('fall is monotonic, rotates slowly and lands in the same puddle without rebound', () => {
  let previous = sampleIntro(RELEASE_TIME);
  for (let time = RELEASE_TIME + 0.1; time <= INTRO_DURATION; time += 0.1) {
    const sample = sampleIntro(time);
    assert.ok(sample.worm[1] <= previous.worm[1] + 1e-8);
    if (time < IMPACT_TIME - 0.7)
      assert.ok(Math.abs(sample.rotation[0] - previous.rotation[0]) < 0.04);
    if (time >= IMPACT_TIME) assert.deepEqual(sample.worm, [0, 0, -5.2]);
    previous = sample;
  }
  assert.equal(sampleIntro(105).cough, 0);
  assert.equal(sampleIntro(INTRO_DURATION).rise, 1);
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
  for (let time = 67; time < 72; time += 0.1) {
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
  for (let time = 75; time < 110; time += 0.1) {
    const s = sampleIntro(time);
    assert.ok(Math.hypot(...sub(s.target, s.worm)) < 1.2);
    assert.ok(Math.hypot(...sub(s.camera, s.target)) > 3.8);
  }
});

test('birds are substantially larger; capture closes the beak at the puddle and wings articulate', () => {
  assert.equal(CROW_SCALE, 5.25);
  assert.ok(EAGLE_SCALE > CROW_SCALE * 1.5);
  const capture = sampleIntro(32);
  assert.ok(Math.hypot(...capture.worm.map((v, i) => v - [0, 0, -5.2][i]!)) < 1e-8);
  assert.ok(sampleIntro(31).crowPose.open > 0.9);
  assert.equal(capture.crowPose.open, 0);
  assert.ok(sampleIntro(74.99).crowPose.open > 0.6);
  const a = sampleIntro(45).crowPose,
    b = sampleIntro(45.36).crowPose;
  assert.ok(Math.abs(a.flap - b.flap) > 0.5);
  assert.notEqual(a.fold, b.fold);
});

test('visual health parameter is finite, clamped and preserves a moderately pale default', () => {
  assert.deepEqual(wormAppearance(-1), wormAppearance(0));
  assert.deepEqual(wormAppearance(2), wormAppearance(1));
  assert.deepEqual(wormAppearance(NaN), wormAppearance(0));
  const sick = wormAppearance(0).skin,
    normal = wormAppearance().skin,
    healthy = wormAppearance(1).skin;
  for (let i = 0; i < 3; i++)
    assert.ok(
      normal[i]! >= Math.min(sick[i]!, healthy[i]!) &&
        normal[i]! <= Math.max(sick[i]!, healthy[i]!),
    );
  assert.ok(normal[0] < 0.8); // Avoid the previous near-white cinematic skin.
});

test('artistic altitude gives a 3x to 6x accelerating fall while keeping the 35-second landing', () => {
  assert.ok(SKY_LIFT > 100);
  assert.equal(FALL_START_SPEED / FALL_REFERENCE_SPEED, 3);
  assert.equal(FALL_END_SPEED / FALL_REFERENCE_SPEED, 6);
  assert.equal(sampleIntro(RELEASE_TIME).worm[1], FALL_HEIGHT);
  let previousSpeed = 0;
  for (let t = RELEASE_TIME; t < IMPACT_TIME - 0.01; t += 0.1) {
    const sample = sampleIntro(t);
    const measured = (sample.worm[1] - sampleIntro(t + 0.01).worm[1]) / 0.01;
    if (t >= SOLAR_TIME + 1.7) assert.ok(measured >= previousSpeed);
    assert.ok(Math.abs(measured - sample.fallSpeed) < 0.12);
    previousSpeed = measured;
  }
  assert.equal(sampleIntro(IMPACT_TIME).worm[1], 0);
  assert.ok(sampleIntro(66.99).crow[1] < 60);
  assert.ok(sampleIntro(67).crow[1] > 180);
});

test('two side closeups show the carried worm and its local tail flexes independently of tumble', () => {
  for (const t of [41, 60]) {
    const s = sampleIntro(t);
    assert.ok(s.closeup && s.carried);
    const distance = Math.hypot(...s.camera.map((v, i) => v - s.target[i]!));
    assert.ok(distance > 2 && distance < 3.5);
  }
  assert.equal(sampleIntro(46).closeup, false);
  const a = introSegment(sampleIntro(80), 10),
    b = introSegment(sampleIntro(84), 10);
  assert.ok(Math.hypot(...a.map((v, i) => v - b[i]!)) > 0.02);
  for (const time of [78, 83, 91, 103])
    for (let i = 1; i < 11; i++) {
      const head = introSegment(sampleIntro(time), i - 1),
        tail = introSegment(sampleIntro(time), i);
      const distance = Math.hypot(...head.map((v, j) => v - tail[j]!));
      assert.ok(distance > 0.18 && distance < 0.29);
    }
});

test('long recovery converges continuously to the exact gameplay idle before handoff', () => {
  assert.ok(sampleIntro(124).rise > 0 && sampleIntro(124).rise < 0.5);
  const end = sampleIntro(INTRO_DURATION);
  for (let i = 0; i < 11; i++) {
    const pose = introSegment(end, i);
    assert.deepEqual(pose, [0, WORM_IDLE_Y + Math.sin(end.time * 1.5) * 0.005, -i * WORM_SPACING]);
    const near = introSegment(sampleIntro(INTRO_DURATION - 0.02), i);
    assert.ok(Math.hypot(...pose.map((v, j) => v - near[j]!)) < 0.001);
  }
  const skin = wormAppearance().skin;
  assert.ok(skin[0] - skin[1] > 0.08 && skin[1] > skin[2]);
});

test('sun release gets at least half a second of bullet time, then catches up to the unchanged impact', () => {
  assert.ok(BULLET_DURATION >= 0.5);
  assert.ok(fallClock(3.6).seconds - fallClock(3).seconds < 0.1);
  assert.ok(Math.abs(fallClock(35).seconds - 35) < 1e-8);
  const s = sampleIntro(SOLAR_TIME + 0.3);
  assert.ok(s.bullet && s.solarStrength === 1);
  const towardSun = SUN_POSITION.map((v, i) => v - s.target[i]!);
  const towardCamera = s.camera.map((v, i) => v - s.target[i]!);
  const dot = towardSun.reduce((sum, v, i) => sum + v * towardCamera[i]!, 0);
  assert.ok(dot / (Math.hypot(...towardSun) * Math.hypot(...towardCamera)) < -0.999);
  assert.ok(SUN_RADIUS / 90 > 2.1 / 8 / 2);
  assert.ok(SUN_DIRECTION[1] > 0);
});

test('crow gains forward distance with increasing speed, without pirouetting in the wide shot', () => {
  const a = sampleIntro(45),
    b = sampleIntro(55),
    c = sampleIntro(65);
  assert.ok(b.crow[2] - a.crow[2] > 10);
  assert.ok(c.crow[2] - b.crow[2] > b.crow[2] - a.crow[2]);
  for (let t = 44; t < 66; t += 0.1) assert.ok(Math.abs(sampleIntro(t).crowPose.rotation[1]) < 0.2);
});

test('impact is followed by stillness and a weak, faltering head lift before recovery', () => {
  assert.equal(sampleIntro(110.5).knockdown, 1);
  assert.equal(sampleIntro(110.5).headLift, 0);
  assert.ok(sampleIntro(112.6).headLift > 0.04);
  assert.ok(sampleIntro(113.5).headLift < sampleIntro(112.6).headLift);
  assert.ok(sampleIntro(115.5).headLift > sampleIntro(113.5).headLift);
  const early = introSegment(sampleIntro(110.2), 0),
    still = introSegment(sampleIntro(110.8), 0);
  assert.deepEqual(early, still);
});

test('release camera and look target remain continuous while approaching the solar portrait', () => {
  let previous = sampleIntro(74.5);
  for (let t = 74.502; t < 79; t += 0.002) {
    const s = sampleIntro(t);
    assert.ok(Math.hypot(...s.camera.map((v, i) => v - previous.camera[i]!)) < 0.1);
    assert.ok(Math.hypot(...s.target.map((v, i) => v - previous.target[i]!)) < 0.04);
    previous = s;
  }
  assert.ok(sampleIntro(76).crowVisible && sampleIntro(76).eagleVisible);
  assert.equal(sampleIntro(75.3).bullet, false);
  for (const t of [68, 70, 72]) {
    const s = sampleIntro(t),
      forward = rotate([0, 0, 1], s.eaglePose.rotation);
    const eye = s.camera.map((v, i) => v - s.eagle[i]!);
    assert.ok(forward.reduce((sum, v, i) => sum + v * eye[i]!, 0) / Math.hypot(...eye) > 0.5);
  }
});
test('worm lands on its back curled up, then rolls and unfolds with repeated coughs', () => {
  assert.equal(sampleIntro(110.5).rotation[2], Math.PI);
  assert.ok(sampleIntro(118).rotation[2] > 0 && sampleIntro(118).rotation[2] < Math.PI);
  assert.equal(sampleIntro(INTRO_DURATION).rotation[2], 0);
  const s = sampleIntro(110.5);
  const points = Array.from({ length: 11 }, (_, i) => introSegment(s, i));
  const span = Math.hypot(...points[10]!.map((v, i) => v - points[0]![i]!));
  assert.ok(span < 1.7);
  for (const t of [112.5, 115.9, 119.3, 122.7, 126.2]) assert.ok(sampleIntro(t).cough > 0.2);
});

test('the eagle notices the crow in a short insert, overtakes from behind and closes both feet before surprise', () => {
  assert.ok(sampleIntro(53.5).spotting && sampleIntro(54.8).spotting);
  assert.equal(sampleIntro(55.1).spotting, false);
  for (const t of [65, 68, 71, 73]) {
    const s = sampleIntro(t);
    assert.ok(s.eagle[2] < s.crow[2]);
    assert.ok(s.eaglePose.rotation[1] > -0.3 && s.eaglePose.rotation[1] < 0.1);
  }
  assert.equal(sampleIntro(74.1).eaglePose.grasp, 0);
  assert.equal(sampleIntro(74.65).eaglePose.grasp, 1);
  assert.equal(sampleIntro(74.65).crowPose.startle, 0);
  assert.ok(sampleIntro(74.9).crowPose.startle! > 0.9);
  assert.ok(sampleIntro(74.9).crowPose.open > 1.4);
  for (const t of [74.6, 74.9, 75.2, 78, 82]) {
    const s = sampleIntro(t),
      targets = crowGraspTargets(s.crowPose);
    s.eaglePose.feet!.forEach((foot, i) => {
      const world = add(
        s.eagle,
        rotate(foot.map((v) => v * EAGLE_SCALE) as [number, number, number], s.eaglePose.rotation),
      );
      assert.ok(Math.hypot(...world.map((v, j) => v - targets[i]![j]!)) < 1e-8);
    });
  }
});
