import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, realpathSync } from 'node:fs';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

export const region = 'misty-bamboo-forest';
export const anchors = {
  'south-entry': [477, 766], fork: [515, 599], 'village-return': null,
  'lantern-practice': null, 'west-chest': [197, 416], 'falls-lookout': null,
  'bridge-west': [622, 451], 'bridge-east': [728, 451], 'east-junction': [850, 285],
  'east-skirmish': null, 'shrine-approach': [920, 145], 'guardian-entry': null,
  'guardian-retreat': null, 'east-return': [1085, 260],
};
const encounterAnchors = {
  'lantern-sprout': 'lantern-practice',
  'east-wind-pair': 'east-skirmish',
  'mosswood-guardian': 'guardian-entry',
};
const phases = ['AreaReady', 'AreaExit', 'ArenaEntered', 'ArenaExited'];
const attacks = ['AttackTelegraphed', 'HitWindowOpened', 'AttackEnded'];
const combatEvents = [...attacks, 'HitResolved', 'CounterOffered'];
const commitEvents = ['EncounterCleared', 'RewardCommitted'];
const types = {
  AreaReady: ['regionId', 'spawnId'], AreaExit: ['regionId', 'spawnId'],
  ArenaEntered: ['landmarkId', 'checkpointId'], ArenaExited: ['landmarkId', 'checkpointId'],
  AttackTelegraphed: ['attackId', 'sourceId', 'shape', 'origin', 'facing', 'opensAt', 'closesAt'],
  HitWindowOpened: ['attackId', 'sourceId', 'shape', 'origin', 'facing', 'opensAt', 'closesAt'],
  AttackEnded: ['attackId', 'sourceId', 'shape', 'origin', 'facing', 'opensAt', 'closesAt'],
  HitResolved: ['attackId', 'targetId', 'result', 'hpDelta', 'spiritDelta'],
  CounterOffered: ['windowId', 'deadline', 'windBladeReady', 'safeAnchorId'],
  CompanionSnapshot: ['companionId', 'collected', 'bondStage', 'visualReady'],
  EncounterCleared: ['encounterId', 'rewardId', 'firstClear'],
  RewardCommitted: ['encounterId', 'rewardId', 'firstClear'],
};
const budgets = {
  hayate: [800, 700], enemies: [512, 512], guardian: [768, 512],
  effects: [256, 256], hud: [512, 256],
};
const mib = 1024 ** 2;
const id = value => typeof value === 'string' && value.length > 0;
const digest = value => typeof value === 'string' && /^[0-9a-f]{64}$/.test(value);
const point = value => Array.isArray(value) && value.length === 2 && value.every(Number.isFinite);
const integer = value => Number.isSafeInteger(value) && value >= 0;
const has = (object, key) => Object.hasOwn(object, key);

function unique(rows, key, label) {
  const entries = new Map();
  for (const row of rows) {
    assert.ok(id(row[key]) && !entries.has(row[key]), label + ' duplicate or missing ' + key);
    entries.set(row[key], row);
  }
  return entries;
}

function exteriorAsset(root, path) {
  const resolvedRoot = realpathSync(root);
  assert.ok(id(path) && !isAbsolute(path));
  const file = realpathSync(resolve(resolvedRoot, path));
  const inside = relative(resolvedRoot, file);
  assert.ok(inside && !isAbsolute(inside) && !inside.split(sep).includes('..'), 'asset outside evidence root');
  return readFileSync(file);
}

function textureSize(bytes) {
  if (bytes.length >= 24 && bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))
    && bytes.toString('ascii', 12, 16) === 'IHDR') {
    return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
  }
  if (bytes.length >= 30 && bytes.toString('ascii', 0, 4) === 'RIFF'
    && bytes.toString('ascii', 8, 12) === 'WEBP') {
    const chunk = bytes.toString('ascii', 12, 16);
    if (chunk === 'VP8X') return [bytes.readUIntLE(24, 3) + 1, bytes.readUIntLE(27, 3) + 1];
    if (chunk === 'VP8L' && bytes[20] === 0x2f) {
      const packed = bytes.readUInt32LE(21);
      return [(packed & 0x3fff) + 1, ((packed >>> 14) & 0x3fff) + 1];
    }
    if (chunk === 'VP8 ' && bytes.subarray(23, 26).equals(Buffer.from('9d012a', 'hex'))) {
      return [bytes.readUInt16LE(26) & 0x3fff, bytes.readUInt16LE(28) & 0x3fff];
    }
  }
  assert.fail('unsupported texture header; expected PNG or WebP');
}

export function validateAssets(assets, readAsset) {
  assert.ok(assets.length > 0, 'asset evidence required');
  unique(assets, 'path', 'asset');
  const totals = new Map();
  let p0Bytes = 0;
  let residentP1Bytes = 0;
  for (const item of assets) {
    assert.ok([item.author, item.license, item.sourceRef, item.approvalRef].every(id), 'asset provenance');
    assert.ok(digest(item.sourceSha256) && digest(item.runtimeSha256), 'asset SHA-256');
    const runtime = readAsset(item.path);
    assert.equal(createHash('sha256').update(runtime).digest('hex'), item.runtimeSha256, item.path);
    if (item.kind === 'audio') continue;
    assert.equal(item.kind, 'texture');
    assert.equal(item.bytesPerPixel, 4);
    assert.ok([item.width, item.height].every(value => integer(value) && value > 0), 'dimensions');
    assert.deepEqual(textureSize(runtime), [item.width, item.height], item.path + ': declared dimensions');
    assert.equal(typeof item.resident, 'boolean');
    const bytes = item.width * item.height * item.bytesPerPixel;
    if (item.group === 'p1') {
      assert.ok(item.width <= 1024 && item.height <= 1024 && bytes <= 4 * mib, 'P1 page budget');
      if (item.resident) residentP1Bytes += bytes;
    } else {
      assert.ok(has(budgets, item.group), 'unknown P0 budget group');
      totals.set(item.group, (totals.get(item.group) ?? 0) + bytes);
      p0Bytes += bytes;
    }
  }
  for (const [group, [width, height]] of Object.entries(budgets)) {
    assert.ok(totals.has(group), group + ' missing from integration evidence');
    assert.ok(totals.get(group) <= width * height * 4, group + ' budget');
  }
  assert.ok(residentP1Bytes <= 8 * mib, 'P1 resident budget proposal');
  return { p0Bytes, residentP1Bytes };
}

/** Stable anchors and the producer's shortcut decision can be checked before integration. */
export function validateWorld(world) {
  assert.equal(world.regionId, region);
  assert.equal(world.phaserKey, 'misty-forest');
  assert.equal(world.hardCollisionOwner, 'A');
  assert.equal(world.combatHitOwner, 'C');
  assert.equal(world.hayateHardCollision, false);
  const landmarks = unique(world.landmarks, 'id', 'landmark');
  for (const [name, approved] of Object.entries(anchors)) {
    assert.ok(point(landmarks.get(name)?.position), name + ' XY required');
    if (approved) assert.deepEqual(landmarks.get(name).position, approved, name);
  }
  assert.deepEqual(world.returnShortcut, { from: 'east-return', to: 'south-entry', bidirectional: false });
  assert.equal(world.fastRevisitEnabled, false);
  return landmarks;
}

export function validateDomain({ encounters: encounterRows, events, save }, landmarks = new Set(Object.keys(anchors))) {
  const encounters = unique(encounterRows, 'id', 'encounter');
  for (const [encounterId, landmarkId] of Object.entries(encounterAnchors)) {
    assert.equal(encounters.get(encounterId)?.landmarkId, landmarkId);
  }
  for (const encounter of encounters.values()) {
    assert.ok(landmarks.has(encounter.landmarkId), 'encounter landmark reference');
  }

  const seqByAttempt = new Map();
  const commitReceiptIds = new Set();
  const damagingHits = new Set();
  for (const { type, payload, producer } of events) {
    assert.ok(has(types, type) && payload && typeof payload === 'object', 'unknown event');
    assert.equal(producer, phases.includes(type) ? 'A' : combatEvents.includes(type) ? 'C'
      : commitEvents.includes(type) ? 'integration' : 'B');
    for (const key of types[type]) assert.ok(has(payload, key), type + ' missing ' + key);
    if (combatEvents.includes(type)) {
      const { encounterId, attemptId, seq, atMs } = payload;
      const previous = seqByAttempt.get(attemptId);
      assert.ok(encounters.has(encounterId) && id(attemptId) && integer(seq) && Number.isFinite(atMs) && atMs >= 0);
      assert.ok(!previous || (previous.encounterId === encounterId && seq > previous.seq && atMs >= previous.atMs),
        'attempt sequence/time must increase');
      seqByAttempt.set(attemptId, { encounterId, seq, atMs });
    }
    if (attacks.includes(type)) {
      assert.ok([payload.attackId, payload.sourceId, payload.shape].every(id) && point(payload.origin)
        && (id(payload.facing) || point(payload.facing)));
      assert.ok([payload.opensAt, payload.closesAt].every(Number.isFinite)
        && payload.opensAt >= 0 && payload.closesAt > payload.opensAt, 'hit window');
    }
    if (type === 'HitResolved') {
      assert.ok([payload.attackId, payload.targetId, payload.result].every(id)
        && [payload.hpDelta, payload.spiritDelta].every(Number.isFinite));
      if (payload.hpDelta < 0) {
        const key = JSON.stringify([payload.attemptId, payload.attackId, payload.targetId]);
        assert.ok(!damagingHits.has(key), 'duplicate damaging hit');
        damagingHits.add(key);
      }
    }
    if (type === 'CounterOffered') {
      assert.ok(id(payload.windowId) && landmarks.has(payload.safeAnchorId)
        && typeof payload.windBladeReady === 'boolean' && Number.isFinite(payload.deadline)
        && payload.deadline >= payload.atMs);
    }
    if (type === 'AreaReady' || type === 'AreaExit') {
      assert.equal(payload.regionId, region);
      assert.ok(landmarks.has(payload.spawnId));
    }
    if (type === 'ArenaEntered' || type === 'ArenaExited') {
      assert.ok(landmarks.has(payload.landmarkId) && id(payload.checkpointId));
    }
    if (type === 'CompanionSnapshot') {
      assert.equal(payload.companionId, 'hayate');
      assert.ok([0, 1, 2].includes(payload.bondStage)
        && [payload.collected, payload.visualReady].every(value => typeof value === 'boolean'));
      assert.equal(payload.collected, payload.bondStage > 0);
    }
    if (commitEvents.includes(type)) {
      assert.ok(encounters.has(payload.encounterId) && id(payload.rewardId) && typeof payload.firstClear === 'boolean');
      if (payload.firstClear) commitReceiptIds.add(JSON.stringify([payload.encounterId, payload.rewardId]));
    }
  }
  for (const type of Object.keys(types)) assert.ok(events.some(event => event.type === type), type + ' sample required');

  assert.deepEqual(save.transactionOwners, ['integration']);
  assert.ok(id(save.slotId), 'slotId for the observed save and event trace');
  assert.ok(integer(save.schemaVersion) && save.schemaVersion > 0, 'final numeric schema version required');
  assert.equal(save.lastSafe.regionId, region);
  assert.ok(landmarks.has(save.lastSafe.spawnId));
  assert.equal(save.companion.companionId, 'hayate');
  assert.ok([0, 1, 2].includes(save.companion.bondStage));
  assert.equal(typeof save.companion.discovered, 'boolean');
  assert.equal(typeof save.companion.collected, 'boolean');
  assert.equal(save.companion.collected, save.companion.bondStage > 0);
  assert.ok(!save.companion.collected || save.companion.discovered);
  assert.ok(Array.isArray(save.companion.appliedGrowthKeys) && save.companion.appliedGrowthKeys.every(id)
    && new Set(save.companion.appliedGrowthKeys).size === save.companion.appliedGrowthKeys.length);
  assert.ok(save.encounters.cleared.every(encounterId => encounters.has(encounterId)));
  assert.ok(Array.isArray(save.treasures) && Array.isArray(save.unlockedShortcuts));
  const receipts = new Set();
  for (const { slotId, sourceId, rewardId } of save.rewardReceipts) {
    assert.ok([slotId, sourceId, rewardId].every(id));
    const key = JSON.stringify([slotId, sourceId, rewardId]);
    assert.ok(!receipts.has(key), 'duplicate receipt identity');
    receipts.add(key);
    if (slotId === save.slotId) commitReceiptIds.delete(JSON.stringify([sourceId, rewardId]));
  }
  assert.equal(commitReceiptIds.size, 0, 'first-clear event lacks persisted reward receipt');
}

export function validatePacket(packet, readAsset) {
  assert.match(packet.candidateSha, /^[0-9a-f]{40}$/);
  const landmarks = validateWorld(packet.world);
  validateDomain(packet, landmarks);
  return validateAssets(packet.assets, readAsset);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [path, root, scope = 'all'] = process.argv.slice(2);
  assert.ok(path && ['all', 'world', 'assets', 'domain'].includes(scope),
    'usage: node contract.mjs <packet.json> <asset-root-or-dash> [all|world|assets|domain]');
  const packet = JSON.parse(readFileSync(path, 'utf8'));
  assert.match(packet.candidateSha, /^[0-9a-f]{40}$/);
  const readAsset = file => exteriorAsset(root, file);
  if (scope === 'world') console.log(JSON.stringify({ landmarks: validateWorld(packet.world).size }));
  if (scope === 'assets') console.log(JSON.stringify(validateAssets(packet.assets, readAsset)));
  if (scope === 'domain') {
    validateDomain(packet);
    console.log(JSON.stringify({ checkedEvents: packet.events.length }));
  }
  if (scope === 'all') console.log(JSON.stringify(validatePacket(packet, readAsset)));
}
