import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { anchors, region, validatePacket } from './contract.mjs';

function fixture() {
  // A synthetic packet describes only the validator's adapter format.
  const files = new Map();
  const assets = ['hayate', 'enemies', 'guardian', 'effects', 'hud'].map(group => {
    const path = group + '.png';
    const bytes = Buffer.from('89504e470d0a1a0a0000000d494844520000002000000020', 'hex');
    files.set(path, bytes);
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    return { path, group, kind: 'texture', width: 32, height: 32, resident: true, bytesPerPixel: 4,
      author: 'fixture', license: 'fixture', approvalRef: 'fixture', sourceRef: 'fixture',
      sourceSha256: sha256, runtimeSha256: sha256 };
  });
  const attacks = { attackId: 'sweep-1', sourceId: 'guardian', shape: 'sector', origin: [100, 100],
    facing: 'south', opensAt: 100, closesAt: 200 };
  const combat = [
    ['AttackTelegraphed', 0, attacks], ['HitWindowOpened', 100, attacks],
    ['HitResolved', 110, { attackId: 'sweep-1', targetId: 'eiku', result: 'hit', hpDelta: -1, spiritDelta: 0 }],
    ['CounterOffered', 180, { windowId: 'counter-1', deadline: 300, windBladeReady: true, safeAnchorId: 'guardian-retreat' }],
    ['AttackEnded', 200, attacks],
  ];
  const reward = { encounterId: 'mosswood-guardian', rewardId: 'first-clear', firstClear: true };
  return {
    read: path => files.get(path),
    packet: {
      candidateSha: 'a'.repeat(40),
      world: {
        regionId: region, phaserKey: 'misty-forest', hardCollisionOwner: 'A', combatHitOwner: 'C',
        hayateHardCollision: false, fastRevisitEnabled: false,
        landmarks: Object.entries(anchors).map(([id, position]) => ({ id, position: position ?? [100, 100] })),
        returnShortcut: { from: 'east-return', to: 'south-entry', bidirectional: false },
      },
      encounters: [
        { id: 'lantern-sprout', landmarkId: 'lantern-practice' },
        { id: 'east-wind-pair', landmarkId: 'east-skirmish' },
        { id: 'mosswood-guardian', landmarkId: 'guardian-entry' },
      ],
      events: [
        { type: 'AreaReady', producer: 'A', payload: { regionId: region, spawnId: 'south-entry' } },
        { type: 'ArenaEntered', producer: 'A', payload: { landmarkId: 'guardian-entry', checkpointId: 'guardian-retreat' } },
        { type: 'CompanionSnapshot', producer: 'B', payload: {
          companionId: 'hayate', bondStage: 1, collected: true, visualReady: true } },
        ...combat.map(([type, atMs, payload], seq) => ({ type, producer: 'C',
          payload: { encounterId: 'mosswood-guardian', attemptId: 'attempt-1', atMs, seq, ...payload } })),
        { type: 'EncounterCleared', producer: 'integration', payload: reward },
        { type: 'RewardCommitted', producer: 'integration', payload: reward },
        { type: 'ArenaExited', producer: 'A', payload: { landmarkId: 'guardian-entry', checkpointId: 'guardian-retreat' } },
        { type: 'AreaExit', producer: 'A', payload: { regionId: region, spawnId: 'east-return' } },
      ],
      save: {
        schemaVersion: 2, slotId: 'one', transactionOwners: ['integration'], lastSafe: { regionId: region, spawnId: 'south-entry' },
        encounters: { cleared: ['mosswood-guardian'] }, treasures: [], unlockedShortcuts: [],
        rewardReceipts: [{ slotId: 'one', sourceId: 'mosswood-guardian', rewardId: 'first-clear' }],
        companion: { companionId: 'hayate', discovered: true, collected: true, bondStage: 2,
          appliedGrowthKeys: ['guardian:first-clear'] },
      },
      assets,
    },
  };
}

test('validator accepts a complete synthetic integration packet', () => {
  const { packet, read } = fixture();
  assert.deepEqual(validatePacket(packet, read), { p0Bytes: 5 * 32 * 32 * 4, residentP1Bytes: 0 });
});

const corruptions = [
  ['moved bridge anchor', packet => { packet.world.landmarks.find(item => item.id === 'bridge-west').position = [0, 0]; }, /bridge-west/],
  ['colliding companion', packet => { packet.world.hayateHardCollision = true; }, /true !== false/],
  ['fast revisit enabled', packet => { packet.world.fastRevisitEnabled = true; }, /true !== false/],
  ['wrong encounter anchor', packet => { packet.encounters[0].landmarkId = 'east-return'; }, /lantern-practice/],
  ['missing event property', packet => { delete packet.events.find(item => item.type === 'HitResolved').payload.hpDelta; }, /missing hpDelta/],
  ['unsequenced event', packet => { packet.events.find(item => item.type === 'HitResolved').payload.seq = 0; }, /attempt sequence/],
  ['invalid companion state', packet => { packet.save.companion.bondStage = 0; }, /true !== false/],
  ['competing save owner', packet => { packet.save.transactionOwners.push('C'); }, /deep-equal/],
  ['duplicate reward receipt', packet => { packet.save.rewardReceipts.push(packet.save.rewardReceipts[0]); }, /duplicate receipt/],
  ['reward event before persisted receipt', packet => { packet.save.rewardReceipts = []; }, /lacks persisted/],
  ['reward receipt in a different slot', packet => { packet.save.rewardReceipts[0].slotId = 'two'; }, /lacks persisted/],
  ['duplicate damaging hit', packet => {
    const index = packet.events.findIndex(item => item.type === 'HitResolved');
    const duplicate = structuredClone(packet.events[index]);
    duplicate.payload.seq += 1;
    packet.events.slice(index + 1).forEach(item => {
      if ('seq' in item.payload) item.payload.seq += 1;
    });
    packet.events.splice(index + 1, 0, duplicate);
  }, /duplicate damaging hit/],
  ['wrong runtime digest', packet => { packet.assets[0].runtimeSha256 = 'f'.repeat(64); }, /hayate.png/],
  ['wrong runtime dimensions', packet => { packet.assets[0].width = 64; }, /declared dimensions/],
  ['missing asset approval', packet => { packet.assets[0].approvalRef = ''; }, /asset provenance/],
  ['excess decoded bytes', packet => {
    for (let index = 0; index < 65; index++) {
      packet.assets.push({ ...packet.assets[3], path: 'extra-' + index + '.png' });
    }
  }, /effects budget/],
];
for (const [name, change, error] of corruptions) {
  test('validator rejects ' + name, () => {
    const { packet, read } = fixture();
    change(packet);
    assert.throws(() => validatePacket(packet, path => path.startsWith('extra-') ? read('effects.png') : read(path)), error);
  });
}
