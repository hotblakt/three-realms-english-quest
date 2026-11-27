import assert from 'node:assert/strict';
import test from 'node:test';
import { bankSamples, bridge, chest, creekColliders, entrance, height, routes, shortcut, spirit, streamCenter } from '../forest-preview/layout.ts';

test('visual banks vary independently and stay centered near the bridge', () => {
  const samples = bankSamples();
  assert.equal(samples[0].y, 0);
  assert.ok(samples.at(-1).y >= height);
  assert.ok(samples.every(s => s.west >= 32 && s.east >= 32));
  assert.ok(samples.some(s => Math.abs(s.east - s.west) > 8));
  const bridgeSample = samples.reduce((a, b) => Math.abs(a.y - bridge.y) < Math.abs(b.y - bridge.y) ? a : b);
  assert.ok(Math.abs(bridgeSample.x - streamCenter(bridgeSample.y)) < 1);
});

test('creek colliders seal both banks and preserve the existing bridge opening', () => {
  const colliders = creekColliders();
  const spans = colliders.map(({ x, y, width, height }) => {
    assert.equal(width, 75);
    assert.equal(x, streamCenter(y));
    return [y - height / 2, y + height / 2];
  });
  assert.equal(spans[0][0], -.5);
  assert.equal(spans.at(-1)[1], height + .5);
  const gaps = spans.slice(1).flatMap(([top], i) => top > spans[i][1] ? [[spans[i][1], top]] : []);
  assert.deepEqual(gaps, [[429.5, 473.5]]);
  assert.ok(451 - 8 > gaps[0][0] && 451 + 8 < gaps[0][1]);
});

test('primary and branch paths still lead to the entrance, treasure, shrine and shortcut', () => {
  assert.ok(routes[0].some(([x,y]) => x === entrance.x && y === entrance.y));
  for (const [route, landmark] of [[routes[0], spirit], [routes[1], chest], [routes[2], shortcut]]) {
    const [x, y] = route.at(-1);
    assert.ok(Math.hypot(x - landmark.x, y - landmark.y) < 53);
  }
});
