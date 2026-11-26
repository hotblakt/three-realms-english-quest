import assert from 'node:assert/strict';
import test from 'node:test';
import { runDirection, recommendedScale, sanitizeScales, smoothVisualSize } from '../forest-preview/directionalScale.ts';
import { runSources } from '../forest-preview/runSources.ts';

test('only the four approved runs receive directional calibration', () => {
  const expected = { framesprite: 'east', 'west-run': 'west', 'north-run': 'north', 'south-run': 'south' };
  for (const [key, clip] of Object.entries(runSources)) {
    assert.equal(runDirection(clip.id), expected[key], key);
  }
  assert.deepEqual(recommendedScale, { east: 100, west: 100, north: 114, south: 95 });
});

test('persisted values clamp by direction and visual size eases without overshoot', () => {
  assert.deepEqual(sanitizeScales({ east: 200, north: 79, west: 91.6, south: NaN }),
    { east: 120, west: 92, north: 80, south: 95 });
  const frame = smoothVisualSize(80, 96, 16);
  assert.ok(frame > 80 && frame < 96);
  assert.equal(smoothVisualSize(frame, 96, 200), 96);
});
