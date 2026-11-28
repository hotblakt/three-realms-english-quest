import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const point = value => Array.isArray(value) && value.length === 2 && value.every(Number.isFinite);
const playerHalfSize = [9, 8];

// Clip the line segment against a rectangle expanded by the player half-size.
function intersects(from, to, { center, size }) {
  let entry = 0;
  let exit = 1;
  for (let axis = 0; axis < 2; axis += 1) {
    const radius = size[axis] / 2 + playerHalfSize[axis];
    const low = center[axis] - radius;
    const high = center[axis] + radius;
    const delta = to[axis] - from[axis];
    if (delta === 0) {
      if (from[axis] < low || from[axis] > high) return false;
      continue;
    }
    const times = [(low - from[axis]) / delta, (high - from[axis]) / delta].sort((a, b) => a - b);
    entry = Math.max(entry, times[0]);
    exit = Math.min(exit, times[1]);
    if (entry > exit) return false;
  }
  return true;
}

export function validateGeometry({ bounds, colliders, safeAnchors, paths }) {
  assert.ok(point(bounds.min) && point(bounds.max) && bounds.min.every((value, axis) =>
    value + 2 * playerHalfSize[axis] < bounds.max[axis]));
  assert.ok(Array.isArray(colliders) && colliders.length > 0, 'include actual hard-collision layers');
  for (const { center, size, owner, id } of colliders) {
    assert.ok(point(center) && point(size) && size.every(value => value > 0) && id);
    assert.equal(owner, 'A', 'hard collision owner: ' + id);
  }
  assert.ok(safeAnchors['guardian-retreat'], 'guardian retreat anchor required');
  const names = ['south-entry', 'fork', 'west-chest', 'falls-lookout', 'bridge-west', 'bridge-east',
    'east-junction', 'east-skirmish', 'shrine-approach', 'guardian-entry', 'guardian-retreat', 'east-return'];
  function checkPoint(p) {
    assert.ok(point(p) && p.every((value, axis) =>
      value >= bounds.min[axis] + playerHalfSize[axis] && value <= bounds.max[axis] - playerHalfSize[axis]),
    'foot point outside bounds');
  }
  for (const name of names) {
    checkPoint(safeAnchors[name]);
    for (const collider of colliders) {
      assert.ok(!intersects(safeAnchors[name], safeAnchors[name], collider), name + ' overlaps ' + collider.id);
    }
  }
  const stops = {
    main: ['south-entry', 'fork', 'bridge-west', 'bridge-east', 'east-junction', 'shrine-approach', 'guardian-entry'],
    west: ['fork', 'west-chest', 'falls-lookout'],
    retreat: ['guardian-entry', 'guardian-retreat', 'east-return'],
  };
  for (const [name, required] of Object.entries(stops)) {
    const polyline = paths[name];
    assert.ok(Array.isArray(polyline) && polyline.length >= required.length, name + ' missing path');
    assert.deepEqual(polyline[0], safeAnchors[required[0]]);
    assert.deepEqual(polyline.at(-1), safeAnchors[required.at(-1)]);
    let before = -1;
    for (const anchor of required) {
      const index = polyline.findIndex((p, i) =>
        i > before && point(p) && p.every((value, axis) => value === safeAnchors[anchor][axis]));
      assert.ok(index > before, name + ' missing ordered safe point ' + anchor);
      before = index;
    }
    if (name === 'main') {
      assert.ok(polyline.slice(0, -1).some(p => point(p) && p.every((value, axis) =>
        value === safeAnchors['east-skirmish'][axis])), 'main missing east-skirmish before guardian');
    }
    for (const [index, waypoint] of polyline.entries()) {
      checkPoint(waypoint);
      if (!index) continue;
      for (const collider of colliders) {
        assert.ok(!intersects(polyline[index - 1], waypoint, collider), name + ' crosses ' + collider.id);
      }
    }
  }
  // The west leg backtracks the same tested segments; there is no new shortcut.
  assert.deepEqual(paths.westReturn, [...paths.west].reverse());
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  validateGeometry(JSON.parse(readFileSync(process.argv[2], 'utf8')));
  console.log('geometry packet passed');
}
