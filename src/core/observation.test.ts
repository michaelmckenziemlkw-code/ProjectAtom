import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createObservations, gestures, ObservationSession } from './observation.ts';
import { sampleGesture, GESTURE_DURATION } from './motion.ts';

test('each seed includes all gestures, reproducibly, with varied order', () => {
  const orders = new Set<string>();
  for (let seed = 0; seed < 50; seed++) {
    const observations = createObservations(seed);
    assert.deepEqual(observations, createObservations(seed));
    assert.deepEqual(observations.map((item) => item.gesture).sort(), [...gestures].sort());
    orders.add(observations.map((item) => item.gesture).join(','));
  }
  assert.ok(orders.size >= 3);
});

test('answers belong to each local observation', () => {
  const session = new ObservationSession(12);
  assert.equal('description' in session.state, false);
  const first = session.current;
  const wrong = gestures.find((gesture) => gesture !== first.gesture)!;
  assert.equal(session.answer(wrong), false);
  assert.equal(session.answer(first.gesture), true);
  session.select(2);
  assert.equal(session.state.answers[2], undefined);
  session.select(0);
  assert.equal(session.state.answers[0], first.gesture);
  session.select(99);
  assert.equal(session.current.id, 0);
});

test('wave stays airborne; tap has two distinct ground contacts and no drag', () => {
  const contacts = new Set<number>();
  let previous = 0,
    strikes = 0;
  for (let t = 0; t < GESTURE_DURATION; t += 0.01) {
    const wave = sampleGesture('wave', t);
    assert.ok(wave.foot.y > 1.3);
    assert.equal(wave.contact, 0);
    const tap = sampleGesture('tap', t);
    assert.equal(tap.foot.z, -1.55);
    if (tap.event && tap.event !== previous) strikes++;
    if (tap.contact) {
      contacts.add(tap.event);
      assert.equal(tap.foot.y, 0.12);
    }
    previous = tap.event;
  }
  assert.equal(strikes, 2);
  assert.deepEqual([...contacts], [1, 2]);
});

test('scrape drags along the floor then lifts; gestures loop continuously', () => {
  const from = sampleGesture('scrape', 0.5),
    to = sampleGesture('scrape', 2.39);
  assert.equal(from.foot.y, 0.12);
  assert.equal(to.foot.y, 0.12);
  assert.ok(to.foot.z - from.foot.z > 1.4);
  assert.ok(sampleGesture('scrape', 3).foot.y > 0.5);
  for (const gesture of gestures) {
    const start = sampleGesture(gesture, 0).foot;
    const end = sampleGesture(gesture, GESTURE_DURATION - 0.00001).foot;
    assert.ok(Math.hypot(start.x - end.x, start.y - end.y, start.z - end.z) < 0.001);
  }
});
