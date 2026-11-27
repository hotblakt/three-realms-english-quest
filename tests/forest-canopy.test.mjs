import assert from 'node:assert/strict';
import test from 'node:test';
import { canopyOpacity } from '../forest-preview/environment/canopy.ts';

const crown = { x: 100, y: 350, displayWidth: 160, displayHeight: 120, originY: 1.75 };

test('canopy fades only where a player behind the sorting foot overlaps its leaves', () => {
  assert.equal(canopyOpacity(crown, 100, 360, 90), 1);
  assert.equal(canopyOpacity(crown, 180, 250, 90), 1);
  assert.equal(canopyOpacity(crown, 100, 100, 90), 1);
  assert.equal(canopyOpacity(crown, 100, 250, 90), .25);
});

test('lifted canopy retains opacity if the character walks entirely below it', () => {
  assert.equal(canopyOpacity(crown, 100, 345, 80), 1);
  const edge = canopyOpacity(crown, 100, 330, 80);
  assert.ok(edge > .25 && edge < 1);
});

test('existing foot-origin props preserve their original occlusion behavior', () => {
  const prop = { ...crown, originY: 1 };
  assert.equal(canopyOpacity(prop, 100, 349, 90), .25);
  assert.equal(canopyOpacity(prop, 100, 350, 90), 1);
});
