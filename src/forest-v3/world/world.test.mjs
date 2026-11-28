import assert from 'node:assert/strict';
import test from 'node:test';
import { creekColliders, entrance, props, shortcut } from '../../../forest-preview/layout.ts';
import {
  canTraverse, canTraversePath, checkpoints, collidersIn, encounterAreas, encounterCameraBounds,
  encounterRetreatPath, findRoute, footprint, getSafeAnchors, guardianClearance, guardianGeometry,
  hardColliders, interactions, isClearArea, isEncounterWalkable, isRegionWalkable, isWalkable,
  landmarks, playerBody, regionsAt, returnShortcut, routes, safeAnchors, validateWorldGeometry, worldBounds,
} from './index.ts';

test('all world geometry checks pass', () => {
  assert.deepEqual(validateWorldGeometry().issues, []);
});

test('static creek, vegetation and landmark collider inventory matches Forest 2.0', () => {
  assert.deepEqual(worldBounds, { left: 24, top: 30, right: 1196, bottom: 864 });
  assert.deepEqual(playerBody, { width: 18, height: 16 });
  assert.deepEqual(hardColliders.filter(c => c.kind === 'creek').map(({ left, top, right, bottom }) =>
    ({ left, top, right, bottom })), creekColliders().map(({ x, y, width, height }) => {
    const left = x - Math.floor(width / 2);
    const top = y - Math.floor(height / 2);
    return { left, top, right: left + width, bottom: top + height };
  }));
  assert.equal(hardColliders.filter(c => c.kind === 'bamboo' || c.kind === 'rock').length,
    props.filter(prop => prop[3] !== 'underbrush').length);
  assert.equal(hardColliders.filter(c => c.kind === 'gate').length, 4);
  assert.equal(hardColliders.filter(c => c.kind === 'chest').length, 1);
});

test('collision rejects out-of-bounds and blocks the full swept player body', () => {
  assert.equal(isWalkable({ x: 32, y: 700 }), false);
  const from = { x: 197, y: 380 };
  const to = { x: 197, y: 440 };
  assert.ok(isWalkable(from) && isWalkable(to));
  assert.equal(canTraverse(from, to), false);
  assert.equal(canTraverse(to, from), false);
  assert.equal(canTraversePath([]), false);
  assert.deepEqual(collidersIn(footprint({ x: 197, y: 410 }, playerBody)).map(c => c.id), ['west-chest']);
  assert.equal(isWalkable({ x: 197, y: 426 }), true, 'edge contact is allowed');
  assert.equal(isWalkable({ x: 197, y: 425.99 }), false);
});

test('bridge opening supports both directions and exact player center limits', () => {
  const cross = y => [{ x: 622, y }, { x: 728, y }];
  for (const y of [437.5, 451, 466]) {
    assert.ok(canTraversePath(cross(y)));
    assert.ok(canTraversePath(cross(y).reverse()));
  }
  for (const y of [437.49, 466.01, 400, 500]) assert.equal(canTraversePath(cross(y)), false);
  assert.equal(canTraversePath(cross(451), { width: 54, height: 48 }), false);
});

test('stone lantern route reaches the east junction through the existing bridge', () => {
  assert.deepEqual(findRoute('south-entry', 'east-junction'),
    ['south-entry', 'fork', 'lantern-practice', 'bridge-west', 'bridge-east', 'east-junction']);
});

test('western route reaches treasure and lookout, retraces the same links, and rejoins at the fork', () => {
  const outbound = ['south-entry', 'fork', 'west-chest-interact', 'falls-lookout'];
  assert.deepEqual(findRoute('south-entry', 'falls-lookout'), outbound);
  assert.deepEqual(findRoute('falls-lookout', 'south-entry'), [...outbound].reverse());
  assert.deepEqual(findRoute('falls-lookout', 'east-junction'), [
    'falls-lookout', 'west-chest-interact', 'fork', 'lantern-practice', 'bridge-west', 'bridge-east', 'east-junction',
  ]);
});

test('route width checks retain narrow legacy segments and reject oversized bodies there', () => {
  const report = validateWorldGeometry();
  const lookout = report.clearanceByRoute.find(route => route.id === 'west-lookout');
  assert.ok(lookout.padding >= 3 && lookout.padding < 3.2);
  assert.equal(lookout.meetsTarget, false);
  assert.equal(findRoute('south-entry', 'falls-lookout', { body: { width: 54, height: 48 } }), undefined);
  assert.equal(Object.keys(routes).length, report.clearanceByRoute.length);
});

test('treasure interaction uses a reachable point clear of the chest body', () => {
  assert.deepEqual(landmarks['west-chest'].point, { x: 197, y: 416 });
  assert.equal(isWalkable(landmarks['west-chest'].point), false);
  const interaction = interactions['west-chest'];
  assert.deepEqual(safeAnchors[interaction.safeSpawnId].point, { x: 197, y: 440 });
  assert.ok(isRegionWalkable('misty-west-falls', safeAnchors[interaction.safeSpawnId].point));
  assert.ok(findRoute('fork', interaction.safeSpawnId));
});

test('habitat interaction and companion position have a return path without encounters', () => {
  assert.ok(regionsAt(landmarks['shrine-approach'].point).includes('misty-hayate-habitat'));
  assert.deepEqual(getSafeAnchors('misty-hayate-habitat', 'companion'), ['hayate-side']);
  assert.deepEqual(findRoute('hayate-side', 'east-junction'), ['hayate-side', 'shrine-approach', 'east-junction']);
  assert.deepEqual(findRoute('shrine-approach', 'south-entry').slice(1, 4), ['east-junction', 'bridge-east', 'bridge-west']);
});

test('legacy shortcut is an interactive one-way link and retains both original anchors', () => {
  assert.deepEqual(returnShortcut, { exitId: 'east-return', from: 'east-return', to: 'south-entry', activation: 'interact' });
  assert.deepEqual(landmarks['east-return'].point, shortcut);
  assert.deepEqual(landmarks['south-entry'].point, entrance);
  assert.deepEqual(findRoute('east-return', 'south-entry', { allowShortcut: true }), ['east-return', 'south-entry']);
  assert.deepEqual(findRoute('south-entry', 'east-return', { allowShortcut: true }), findRoute('south-entry', 'east-return'));
  assert.ok(findRoute('east-return', 'south-entry').includes('bridge-west'));
});

test('encounters have legal enemy footprints, independent retreats and connected checkpoints', () => {
  for (const [id, area] of Object.entries(encounterAreas)) {
    for (const spawn of area.spawns) {
      assert.ok(isClearArea(footprint(spawn.point, { width: 2 * spawn.radius, height: 2 * spawn.radius }), area.bounds));
    }
    const retreat = safeAnchors[area.retreatId].point;
    assert.ok(isEncounterWalkable(id, area.entry));
    assert.equal(isEncounterWalkable(id, retreat), false);
    assert.ok(canTraversePath(encounterRetreatPath(id)));
    assert.ok(findRoute(area.retreatId, checkpoints[area.checkpointId]));
  }
});

test('guardian east-facing shockwave, fan, side dodges and outside retreat fit', () => {
  const report = guardianClearance();
  assert.deepEqual(report.shockwaveBounds, { left: 1069, right: 1189, top: 396, bottom: 430 });
  assert.ok(report.shockwaveClear && report.fanClear && report.companionClear);
  assert.equal(report.dodgeLanes.length, 2);
  for (const lane of report.dodgeLanes) {
    assert.ok(lane.clear && lane.retreatClear);
    assert.ok(Math.abs(Math.abs(lane.from.y - lane.to.y) - 49.6) < 0.001);
  }
  assert.ok(encounterCameraBounds('mosswood-guardian').top < encounterAreas['mosswood-guardian'].bounds.top);
  const { origin, shockwave } = guardianGeometry;
  assert.equal(isClearArea({
    ...report.shockwaveBounds, left: origin.x - shockwave.length, right: origin.x,
  }, encounterAreas['mosswood-guardian'].bounds), false, 'west-facing shockwave extends outside the arena');
});
