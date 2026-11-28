import assert from 'node:assert/strict';
import test from 'node:test';
import { validateGeometry } from './geometry.mjs';

function geometryFixture() {
  const safeAnchors = {
    'south-entry': [100, 300], fork: [200, 300], 'west-chest': [100, 200], 'falls-lookout': [80, 160],
    'bridge-west': [250, 300], 'bridge-east': [350, 300], 'east-junction': [425, 300],
    'east-skirmish': [450, 260], 'shrine-approach': [500, 250], 'guardian-entry': [550, 300],
    'guardian-retreat': [550, 360], 'east-return': [595, 370],
  };
  const route = (...names) => names.map(name => safeAnchors[name]);
  const west = route('fork', 'west-chest', 'falls-lookout');
  return {
    bounds: { min: [0, 0], max: [700, 500] },
    safeAnchors,
    colliders: [{ center: [300, 245], size: [10, 70], owner: 'A', id: 'creek' }],
    paths: {
      main: route('south-entry', 'fork', 'bridge-west', 'bridge-east', 'east-junction',
        'east-skirmish', 'shrine-approach', 'guardian-entry'),
      west, westReturn: [...west].reverse(),
      retreat: route('guardian-entry', 'guardian-retreat', 'east-return'),
    },
  };
}

test('geometry checker validates separate west and main legs, bridge and retreat on synthetic data', () => {
  validateGeometry(geometryFixture());
});
test('geometry checker catches creek collision between otherwise clear waypoints', () => {
  const geometry = geometryFixture();
  geometry.colliders[0].center[1] = 300;
  assert.throws(() => validateGeometry(geometry), /main crosses creek/);
});
test('geometry checker includes player footprint when checking west path', () => {
  const geometry = geometryFixture();
  geometry.colliders[0] = { center: [146, 256], size: [2, 2], owner: 'A', id: 'rock' };
  assert.throws(() => validateGeometry(geometry), /west crosses rock/);
});
test('geometry checker rejects a west return that shortcuts the tested path', () => {
  const geometry = geometryFixture();
  geometry.paths.westReturn.splice(1, 1);
  assert.throws(() => validateGeometry(geometry), /deep-equal/);
});
test('geometry checker rejects hard collision exported with combat ownership', () => {
  const geometry = geometryFixture();
  geometry.colliders[0].owner = 'C';
  assert.throws(() => validateGeometry(geometry), /hard collision owner/);
});
