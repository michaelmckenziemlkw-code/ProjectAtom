import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WormBody, WORM_SEGMENTS, WORM_SPACING } from './wormBody.ts';
import { WalkSession } from './walk.ts';

test('head follows a corner before the middle and tail, even when render samples are skipped', () => {
  const body = new WormBody(0, 0);
  body.record(0, 0.7);
  const tail = body.pose(10),
    middle = body.pose(5);
  body.record(0.1, 0.7);
  assert.ok(body.pose(0).x > 0);
  assert.equal(body.pose(5).x, 0);
  assert.equal(body.pose(10).x, 0);
  assert.ok(Math.abs(body.pose(5).z - middle.z - 0.1) < 1e-8);
  body.record(1.2, 0.7);
  assert.ok(body.pose(5).x > 0);
  assert.equal(body.pose(10).x, 0);
  body.record(2.7, 0.7);
  assert.ok(body.pose(10).x > 0);
  assert.ok(tail.z < 0.7);
});
test('body samples preserve spacing along the path and resetting removes old turns', () => {
  const body = new WormBody(0, 0);
  body.record(0, 2);
  body.record(3, 2);
  for (let i = 1; i < WORM_SEGMENTS; i++)
    assert.ok(
      Math.abs(
        Math.hypot(body.pose(i).x - body.pose(i - 1).x, body.pose(i).z - body.pose(i - 1).z) -
          WORM_SPACING,
      ) < 1e-8,
    );
  body.reset(0, -5.2);
  assert.equal(body.pose(0).x, 0);
  assert.ok(Math.abs(body.pose(10).z + 5.2 + 10 * WORM_SPACING) < 1e-8);
});
test('head turns progressively, stationary mouse direction does not rotate the body', () => {
  const walk = new WalkSession();
  walk.advance(0.5, { forward: 1, right: 0, yaw: 0 });
  const tail = walk.body.pose(10);
  walk.advance(0.55, { forward: 1, right: 0, yaw: Math.PI / 2 });
  assert.ok(walk.heading > 0 && walk.heading < Math.PI / 2);
  assert.ok(Math.abs(walk.body.pose(10).x - tail.x) < 1e-8);
  const before = Array.from({ length: 11 }, (_, i) => walk.body.pose(i));
  const heading = walk.heading;
  walk.advance(10, { forward: 0, right: 0, yaw: Math.PI });
  assert.equal(walk.heading, heading);
  assert.deepEqual(
    Array.from({ length: 11 }, (_, i) => walk.body.pose(i)),
    before,
  );
});
test('curved locomotion remains consistent across 5/60/165 Hz and body follows the actual clamped head', () => {
  const results = [];
  for (const fps of [5, 60, 165]) {
    const walk = new WalkSession();
    for (let i = 1; i <= Math.ceil(fps * 0.5); i++)
      walk.advance(Math.min(i / fps, 0.5), { forward: 1, right: 0, yaw: Math.PI / 2 });
    results.push(walk);
    assert.ok(Math.abs(walk.body.pose(0).x - walk.x) < 1e-8);
  }
  for (const walk of results) {
    assert.ok(Math.abs(walk.x - results[0].x) < 0.015);
    assert.ok(Math.abs(walk.z - results[0].z) < 0.015);
  }
});
