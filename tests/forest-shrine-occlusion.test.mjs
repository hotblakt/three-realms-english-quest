import assert from 'node:assert/strict';
import test from 'node:test';
import { shrineOpacity } from '../forest-batch-c-preview/shrineOcclusion.ts';

const bounds = { left: 860, right: 980, top: 6 };

test('the shrine yields to a character behind the roof and keeps its sorting depth', () => {
  assert.ok(shrineOpacity(bounds, 117, 920, 101) < .3);
  assert.ok(shrineOpacity(bounds, 117, 920, 75) < .3);
  assert.equal(shrineOpacity(bounds, 117, 920, 117), 1);
  assert.equal(shrineOpacity(bounds, 117, 920, 137), 1);
});

test('the shrine stays solid outside its footprint and fades gradually at its sides', () => {
  assert.equal(shrineOpacity(bounds, 117, 860, 101), 1);
  assert.equal(shrineOpacity(bounds, 117, 982, 101), 1);
  assert.equal(shrineOpacity(bounds, 117, 920, 6), 1);
  const partial = shrineOpacity(bounds, 117, 971, 101);
  assert.ok(partial > .28 && partial < 1);
});
