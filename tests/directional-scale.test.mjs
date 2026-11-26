import assert from 'node:assert/strict';
import test from 'node:test';
import { calibrationFor, clipCalibration, recommendedScale, sanitizeScales, smoothBodyHeight } from '../forest-preview/directionalScale.ts';

test('the recommended defaults preserve the side-facing run benchmarks', () => {
  for (const direction of ['east', 'west']) {
    const { target, artwork } = calibrationFor(direction, 'run', recommendedScale);
    assert.equal(target, artwork);
  }
  assert.ok(calibrationFor('north', 'run', recommendedScale).target > 189);
  assert.ok(calibrationFor('south', 'run', recommendedScale).target < 202);
});

test('run, idle, cast and stance share a target but retain per-artwork proportions', () => {
  for (const direction of ['east', 'west', 'north', 'south']) {
    const idle = calibrationFor(direction, 'idle', recommendedScale);
    for (const action of ['run', 'cast', 'stance']) {
      assert.equal(calibrationFor(direction, action, recommendedScale).target, idle.target);
    }
  }
  assert.equal(clipCalibration('eiku-chatgpt-run-review'), undefined);
  assert.deepEqual(clipCalibration('eiku-west-cast'), { direction: 'west', action: 'cast' });
});

test('persisted values clamp by direction and visual height eases without overshoot', () => {
  assert.deepEqual(sanitizeScales({ east: 200, north: 79, west: 91.6, south: NaN }),
    { east: 120, north: 80, west: 92, south: 95 });
  const frame = smoothBodyHeight(80, 96, 16);
  assert.ok(frame > 80 && frame < 96);
  assert.equal(smoothBodyHeight(frame, 96, 200), 96);
});
