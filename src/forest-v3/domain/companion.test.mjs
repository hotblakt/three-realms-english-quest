import assert from 'node:assert/strict';
import test from 'node:test';
import { companionSnapshot, Hayate, initialProgress, MemoryRewardStorage, proposeWindRune, Recruitment, recruitmentPhrase } from './index.ts';
import { fixture, mockWorld, point } from './fixtures.mjs';

const slot = 'test-save';
const guardian = { kind: 'clear', encounterId: 'mosswood-guardian', reward: 'guardian-badge', shortcutId: 'east-return' };
const recruited = { companionId: 'hayate', discovered: true, collected: true, bondStage: 1, visualReady: false };
const followInput = {
  ready: true, regionId: 'forest', companion: { id: 'hayate', position: point(0), radius: 5 },
  player: point(50), trailAnchorIds: ['front'], recoveryAnchorIds: [],
};

test('assisted English grants equivalent recruitment through a confirmed transaction without audio data', async () => {
  const storage = new MemoryRewardStorage();
  const recruit = new Recruitment();
  assert.equal(recruitmentPhrase, 'Come with me.');
  assert.equal(recruit.discover(false, true), undefined);
  assert.equal(recruit.begin(companionSnapshot(await storage.read(slot), false), true, true), false);
  const discovery = await storage.commit(slot, recruit.discover(true, true));
  assert(recruit.begin(companionSnapshot(discovery.progress, false), true, true));
  recruit.cancel();
  assert.equal(recruit.complete('assisted'), undefined);
  assert(recruit.begin(companionSnapshot(discovery.progress, false), true, true));
  const proposal = recruit.complete('assisted');
  assert.deepEqual(proposal, { kind: 'recruit', mode: 'assisted' });
  assert.equal((await storage.read(slot)).companion.collected, false);
  const result = await storage.commit(slot, proposal);
  assert.equal(result.progress.companion.bondStage, 1);
  assert.equal(recruit.complete('recognized'), undefined);
});

test('recognized practice can recruit after a safe, discovered interaction', async () => {
  const storage = new MemoryRewardStorage();
  assert.equal((await storage.commit(slot, { kind: 'recruit', mode: 'recognized' })).status, 'rejected');
  const result = await storage.commit(slot, { kind: 'discover' });
  const recruit = new Recruitment();
  assert(!recruit.begin(companionSnapshot(result.progress, true), true, false));
  assert(recruit.begin(companionSnapshot(result.progress, true), true, true));
  const recruited = await storage.commit(slot, recruit.complete('recognized'));
  assert.equal(recruited.progress.companion.collected, true);
});

test('follow uses reachable same-region anchors, hysteresis and single-file trail order', () => {
  const world = mockWorld({ wrong: { id: 'wrong', point: point(2), regionId: 'another' }, trail: point(24) });
  const fox = new Hayate(world, () => 0);
  assert.deepEqual(fox.follow(recruited, { ...followInput, trailAnchorIds: ['wrong', 'trail', 'front'] }),
    { kind: 'follow', target: point(24), speedRatio: 0.95 });
  assert.equal(fox.follow(recruited, { ...followInput, player: point(30) }).kind, 'follow');
  assert.equal(fox.follow(recruited, { ...followInput, player: point(25) }).kind, 'wait');
  assert.equal(fox.follow(recruited, { ...followInput, player: point(30) }).kind, 'wait');
});

test('blocked companion waits on camera and only recovers to an off-camera safe point', () => {
  let now = 0;
  let visible = true;
  const fox = new Hayate(mockWorld({ remote: point(55) }, { wall: 15, camera: () => visible }), () => now);
  const input = { ...followInput, recoveryAnchorIds: ['remote'] };
  assert.equal(fox.follow(recruited, input).kind, 'wait');
  now = 2000;
  assert.equal(fox.follow(recruited, input).kind, 'wait');
  visible = false;
  assert.deepEqual(fox.follow(recruited, input), { kind: 'recover', target: point(55) });
  assert.equal(fox.follow(recruited, { ...input, ready: false }).kind, 'loading');
});

test('exploration checks accessibility and combat requests a safe side without requiring visuals', () => {
  const fox = new Hayate(mockWorld({ 'falls-lookout': point(-45) }), () => 0);
  assert.deepEqual(fox.explorationHint(recruited, followInput, 'falls-lookout', false), point(-45));
  assert.equal(fox.explorationHint(recruited, followInput, 'falls-lookout', true), undefined);
  assert.equal(fox.follow(recruited, { ...followInput, combat: true }).kind, 'hidden');
  assert.equal(fox.follow(recruited, { ...followInput, combat: true, safeAnchorId: 'safe' }).kind, 'safe-side');
});

test('counter hint consumes the current sequence once and expires on the encounter clock', () => {
  const f = fixture();
  const fox = new Hayate(f.world, () => f.battle.now);
  f.enter();
  fox.beginAttempt(f.battle.currentAttempt);
  f.step(620);
  f.step(0, { move: point(1), dodge: true });
  f.step(81);
  const event = f.events().find(event => event.type === 'CounterOffered');
  assert(event);
  assert.equal(fox.consume(recruited, { ...event, attemptId: 'old' }), undefined);
  assert.match(fox.consume(recruited, event).text, /風刃/);
  assert.equal(fox.consume(recruited, { ...event, seq: event.seq + 1 }), undefined);
  const expiry = fox.hint.deadline;
  f.step(expiry - f.battle.now);
  assert.equal(fox.hint, undefined);
  fox.beginAttempt('next');
  assert.equal(fox.consume(recruited, event), undefined);
});

test('guardian receipt promotes existing Hayate once and preserves the original return link', async () => {
  const storage = new MemoryRewardStorage({ ...initialProgress(true), unlockedShortcuts: ['east-return'] });
  await storage.commit(slot, { kind: 'discover' });
  await storage.commit(slot, { kind: 'recruit', mode: 'assisted' });
  const results = await Promise.all([storage.commit(slot, guardian), storage.commit(slot, guardian)]);
  assert.deepEqual(results.map(result => result.firstClear), [true, false]);
  const progress = await storage.read(slot);
  assert.equal(progress.badge, true);
  assert.equal(progress.companion.bondStage, 2);
  assert.deepEqual(progress.companion.appliedGrowthKeys, [results[0].receipt.key]);
  assert.deepEqual(progress.unlockedShortcuts, ['east-return']);
});

test('guardian before recruitment backfills bond progression after recruiting', async () => {
  const storage = new MemoryRewardStorage();
  const clear = await storage.commit(slot, guardian);
  assert.equal(clear.progress.companion.bondStage, 0);
  await storage.commit(slot, { kind: 'discover' });
  const recruit = await storage.commit(slot, { kind: 'recruit', mode: 'assisted' });
  assert.equal(recruit.progress.companion.bondStage, 2);
  assert.deepEqual(recruit.progress.companion.appliedGrowthKeys, [clear.receipt.key]);
});

test('route seal and chest are idempotent and rune is gated by Chapter 1 and a safe point', async () => {
  const storage = new MemoryRewardStorage(initialProgress(true));
  const chest = { kind: 'treasure', landmarkId: 'west-chest' };
  const main = { kind: 'clear', encounterId: 'lantern-sprout', reward: 'wind-seal' };
  const mix = { kind: 'clear', encounterId: 'east-wind-pair', reward: 'encounter-clear' };
  await Promise.all([storage.commit(slot, chest), storage.commit(slot, chest), storage.commit(slot, main), storage.commit(slot, mix)]);
  const progress = await storage.read(slot);
  assert.equal(progress.seals, 2);
  assert.equal(proposeWindRune(progress, false), undefined);
  assert.equal(proposeWindRune({ ...progress, chapterWindBlade: false }, true), undefined);
  const result = await storage.commit(slot, proposeWindRune(progress, true));
  assert.equal(result.progress.rune, true);
  assert.equal(result.progress.chapterWindBlade, true);
  assert.equal(proposeWindRune(result.progress, true), undefined);
});
