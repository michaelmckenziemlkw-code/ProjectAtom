import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WalkSession, beetleMotion } from './walk.ts';
import { ActiveClock } from './timing.ts';
const forward = { forward: 1, right: 0, yaw: 0 };
test('walking has equal speed at 1/5/60/165 updates per second', () => {
  for (const fps of [1, 5, 60, 165]) {
    const walk = new WalkSession();
    for (let i = 1; i <= fps; i++) walk.advance(i / fps, forward);
    assert.ok(Math.abs(walk.z + 3.4) < 1e-8);
    assert.ok(Math.abs(walk.distance - 1.8) < 1e-8);
  }
});
test('beetle and banks block the worm even after a long frame; diagonals are normalized', () => {
  const walk = new WalkSession();
  walk.advance(10, forward);
  assert.ok(walk.z <= -1.919);
  walk.advance(20, { ...forward, right: 1 });
  assert.ok(walk.x <= 1.35);
  assert.ok(Math.hypot(walk.x, walk.z) >= 1.919);
  const straight = new WalkSession(),
    diagonal = new WalkSession();
  straight.advance(0.5, forward);
  diagonal.advance(0.5, { ...forward, right: 1 });
  assert.ok(Math.abs(straight.distance - diagonal.distance) < 1e-8);
});
test('bedding requires approach, is placed once, opens the passage, is picked up and carried away', () => {
  const walk = new WalkSession();
  assert.equal(walk.placeBedding(0), false);
  walk.advance(1.3, forward);
  assert.equal(walk.placeBedding(1.3), true);
  assert.equal(walk.placeBedding(1.4), false);
  assert.equal(beetleMotion(2, 1.3).blocked, true);
  assert.equal(beetleMotion(3.8, 1.3).carrying, true);
  assert.equal(beetleMotion(5, 1.3).stage, 'leaving');
  assert.equal(beetleMotion(10, 1.3).stage, 'cleared');
  walk.advance(4, forward);
  assert.ok(walk.z > 0);
  walk.reset(20);
  assert.equal(walk.beddingAt, null);
  assert.equal(walk.z, -5.2);
});
test('camera-relative motion and idle menu do not create stored movement', () => {
  const walk = new WalkSession(),
    reference = new WalkSession();
  for (const state of [walk, reference]) {
    state.reset(0, Math.PI / 2);
    state.advance(1, { ...forward, yaw: Math.PI / 2 });
  }
  assert.ok(walk.x > 1.3);
  assert.ok(Math.abs(walk.z + 5.2) < 1e-8);
  walk.advance(100, { ...forward, forward: 0 });
  walk.advance(100.5, forward);
  reference.advance(1.5, forward);
  assert.ok(Math.abs(walk.x - reference.x) < 1e-8);
  assert.ok(Math.abs(walk.z - reference.z) < 1e-8);
});
test('running clock and beetle timeline continue across a menu and background interval', () => {
  const clock = new ActiveClock();
  clock.setActive(true, 0);
  assert.equal(clock.read(1000), 1);
  // Menus/visibility do not call setActive(false) in the playable study.
  assert.equal(clock.read(11000), 11);
  assert.equal(beetleMotion(clock.read(11000), 1).stage, 'cleared');
});
