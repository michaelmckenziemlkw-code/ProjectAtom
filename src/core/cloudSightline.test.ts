import test from 'node:test';
import assert from 'node:assert/strict';
import { cloudSightlineVisibility as visibility } from './cloudSightline.ts';
test('clouds fade clear of the lens, subject and intervening view while distant banks stay solid', () => {
  const camera: [number, number, number] = [0, 0, 0],
    target: [number, number, number] = [0, 0, 20];
  for (const z of [0, 5, 10, 20]) assert.equal(visibility([0, 0, z], 4, camera, target), 0);
  assert.equal(visibility([25, 0, 10], 4, camera, target), 1);
  assert.ok(visibility([9, 0, 10], 4, camera, target) > 0);
  assert.ok(visibility([9, 0, 10], 4, camera, target) < 1);
});
