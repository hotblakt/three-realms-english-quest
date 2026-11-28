import assert from 'node:assert/strict';
import test from 'node:test';
import { enemies, initialProgress, EventGate, animationCue, audioCue } from './index.ts';
import { fixture, mockWorld, point } from './fixtures.mjs';

const east = point(1);
const west = point(-1);
const guardianReady = { ...initialProgress(true), cleared: ['east-wind-pair'] };
const filter = (events, name) => events.filter(event => event.type === name);
const playerHits = events => filter(events, 'HitResolved').filter(event => event.sourceId === 'player');
const harm = events => filter(events, 'HitResolved').filter(event => event.targetId === 'player');
function strike(f) { f.step(0, { move: east, sword: true }); }
function defeatSprout(f) {
  strike(f);
  f.step(300);
  strike(f);
  f.step(300);
  strike(f);
  f.step(60);
}
function dodgeAtFirstAttack(f) {
  f.step(620);
  f.step(0, { move: east, dodge: true });
  f.step(81);
}

test('sword waits for 60 ms, then resolves once over the entire active window', () => {
  const f = fixture();
  assert(f.enter());
  strike(f);
  f.step(59);
  assert.equal(f.battle.enemyState[0].health, 3);
  f.step(1);
  assert.equal(f.battle.enemyState[0].health, 2);
  f.step(89);
  const hits = playerHits(f.events());
  assert.deepEqual(hits.map(hit => [hit.atMs, hit.hpDelta, hit.spiritDelta]), [[60, -1, 1]]);
  f.step(1);
  const [end] = filter(f.events(), 'AttackEnded');
  assert.equal(end.atMs, 150);
});

test('sword input buffered during recovery starts at the first legal instant', () => {
  const f = fixture();
  f.enter();
  strike(f);
  f.step(210);
  strike(f);
  f.step(90);
  assert.deepEqual(filter(f.events(), 'ActionStarted').map(event => event.atMs), [0, 300]);
});

test('hard terrain blocks sword even when a target is in the sector', () => {
  const f = fixture({ world: mockWorld({}, { wall: 15 }) });
  assert(f.enter());
  strike(f);
  f.step(150);
  assert.equal(playerHits(f.events()).length, 0);
  assert.equal(f.battle.hud.spirit, 2);
});

test('dodge suppresses damage and gives one counter opportunity from the first overlap', () => {
  const f = fixture();
  f.enter();
  dodgeAtFirstAttack(f);
  const events = f.events();
  assert.deepEqual(harm(events).map(event => event.result), ['dodge']);
  assert.equal(f.battle.hud.health, 5);
  assert.equal(filter(events, 'CounterOffered')[0].deadline, 1601);
  f.step(99);
  assert.equal(harm(f.events()).length, 0);
});

test('target-bound sword counter does two damage and expires at its boundary', () => {
  const setup = () => {
    const f = fixture();
    f.enter();
    f.step(630);
    f.step(0, { move: east, dodge: true });
    f.step(160);
    assert.ok(f.battle.hud.counterDeadline);
    return f;
  };
  const counter = setup();
  counter.step(0, { move: west, sword: true });
  counter.step(60);
  assert.equal(playerHits(counter.events()).at(-1).hpDelta, -2);
  assert.equal(counter.battle.hud.spirit, 4);
  const expired = setup();
  const deadline = expired.battle.hud.counterDeadline;
  expired.step(deadline - expired.battle.now);
  assert.equal(expired.battle.hud.counterDeadline, undefined);
  assert.equal(filter(expired.events(), 'CounterEnded')[0].atMs, deadline);
});

test('wind blade reuses chapter unlock, spends only on release and stops at the first target', () => {
  const locked = fixture({ progress: initialProgress() });
  locked.enter();
  locked.step(0, { move: east, windBlade: true });
  locked.step(300);
  assert.equal(locked.battle.hud.spirit, 2);
  assert.equal(playerHits(locked.events()).length, 0);
  const f = fixture();
  f.enter('east-wind-pair');
  f.step(0, { move: east, windBlade: true });
  f.step(119);
  assert.equal(f.battle.hud.spirit, 2);
  f.step(1);
  assert.equal(f.battle.hud.spirit, 0);
  f.step(300, { windBlade: true });
  assert.deepEqual(playerHits(f.events()).map(hit => hit.targetId), ['bamboo-sprout:0']);
  assert.equal(f.battle.hud.windBladeReady, false);
});

test('dodge cancels wind windup without paying spirit', () => {
  const f = fixture();
  f.enter();
  f.step(0, { move: east, windBlade: true });
  f.step(119);
  f.step(0, { move: west, dodge: true });
  f.step(121);
  assert.equal(f.battle.hud.spirit, 2);
  assert.equal(f.battle.projectileState.length, 0);
  assert.equal(filter(f.events(), 'AttackEnded').some(event => event.reason === 'cancelled'), true);
});

test('wind rune sets the outgoing projectile range without changing Chapter 1 unlock', () => {
  const f = fixture({ progress: { ...initialProgress(true), rune: true } });
  f.enter();
  f.step(0, { move: east, windBlade: true });
  f.step(120);
  assert.equal(filter(f.events(), 'HitWindowOpened')[0].shape.range, 168);
});

test('shared budget defers wind seed telegraph until the sprout ends plus 250 ms', () => {
  const f = fixture();
  f.enter('east-wind-pair');
  f.step(900);
  const events = f.events();
  const warnings = filter(events, 'AttackTelegraphed');
  assert.deepEqual(warnings.map(event => event.sourceId), ['bamboo-sprout:0', 'wind-seed:1']);
  assert.equal(warnings[1].atMs, filter(events, 'AttackEnded')[0].atMs + 250);
  f.step(1600);
  const next = f.events();
  const ended = filter(next, 'AttackEnded').find(event => event.sourceId === 'wind-seed:1');
  assert(ended);
  assert(filter(next, 'AttackTelegraphed').every(event => event.atMs >= ended.atMs + 250));
});

test('guardian shell blocks outside recovery and core takes damage during recovery', () => {
  const f = fixture({ progress: guardianReady });
  f.enter('mosswood-guardian');
  strike(f);
  f.step(300);
  assert.equal(playerHits(f.events())[0].result, 'shell');
  f.step(700);
  strike(f);
  f.step(60);
  assert.equal(playerHits(f.events())[0].result, 'hit');
  assert.equal(f.battle.enemyState[0].health, 11);
});

test('guardian transitions once and alternates attack shapes', () => {
  const guardian = { ...enemies['mosswood-guardian'], health: 7 };
  const f = fixture({ progress: guardianReady, overrides: { enemies: { ...enemies, 'mosswood-guardian': guardian } } });
  assert(f.enter('mosswood-guardian'));
  f.step(1000);
  strike(f);
  f.step(1241);
  assert.equal(f.battle.enemyState[0].phase, 'transition');
  f.step(600);
  assert.equal(f.battle.enemyState[0].stage, 2);
  assert.deepEqual(filter(f.events(), 'AttackTelegraphed').map(event => event.shape.kind), ['sector', 'strip']);
});

test('entry rejects invalid anchors, uncleared practice and guardian prerequisite', () => {
  const f = fixture();
  assert.equal(f.enter('lantern-sprout', { spawnId: 'missing' }), false);
  assert.equal(f.enter('lantern-sprout', { practice: true }), false);
  assert.equal(f.enter('mosswood-guardian'), false);
  assert.equal(f.battle.hud.phase, 'explore');
});

test('failed encounter resets on retry and safe retreat clears active state', () => {
  const f = fixture();
  f.enter();
  const previous = f.battle.currentAttempt;
  f.step(7500);
  assert.equal(f.battle.hud.phase, 'failed');
  assert.equal(filter(f.events(), 'EncounterFailed')[0].checkpointId, 'rest');
  assert(f.battle.retry());
  assert.notEqual(f.battle.currentAttempt, previous);
  assert.equal(f.battle.hud.health, 5);
  assert.equal(f.battle.hud.spirit, 2);
  assert.deepEqual(f.battle.retreat(), point(-10));
  assert.equal(f.battle.hud.phase, 'explore');
  assert.equal(f.battle.projectileState.length, 0);
});

test('pause freezes attack windows and resumes with a 300 ms grace and without buffered input', () => {
  const f = fixture();
  f.enter();
  strike(f);
  f.step(30);
  f.battle.pause();
  f.step(2600, { dodge: true });
  assert.equal(f.battle.now, 30);
  f.battle.resume();
  f.step(299, { dodge: true });
  assert.equal(f.battle.now, 30);
  f.step(31);
  assert.equal(f.battle.now, 60);
  assert.equal(playerHits(f.events()).length, 1);
});

test('sequenced presentation rejects old attempts and duplicate or reordered events', () => {
  const f = fixture();
  f.enter();
  strike(f);
  f.step(60);
  const events = f.events();
  const gate = new EventGate('lantern-sprout', f.battle.currentAttempt);
  const action = events[0];
  assert.equal(gate.accept({ ...action, attemptId: 'stale' }), false);
  assert.equal(gate.accept(action), true);
  assert.equal(gate.accept(action), false);
  assert.equal(animationCue(action).kind, 'sword-arc');
  assert.equal(audioCue(action).kind, 'swing');
  assert(gate.accept(events.at(-1)));
  assert(!gate.accept(events[1]));
});

test('clear waits for confirmation, stays pending after write rejection, then awards a single seal', async () => {
  const f = fixture();
  f.enter();
  defeatSprout(f);
  assert.equal(f.battle.hud.phase, 'settlement');
  assert.equal(filter(f.events(), 'EncounterCleared').length, 0);
  assert.equal((await f.storage.read('demo')).seals, 0);
  f.storage.rejectNext = true;
  assert.equal((await f.battle.settle()).status, 'rejected');
  assert.equal(f.battle.hud.phase, 'settlement');
  const [a, b] = await Promise.all([f.battle.settle(), f.battle.settle()]);
  assert.equal(a.status, 'confirmed');
  assert.deepEqual(a, b);
  assert.equal((await f.storage.read('demo')).seals, 1);
  assert.equal(filter(f.events(), 'EncounterCleared').length, 1);
});

test('practice runs with cleared progress without another reward submission', async () => {
  const f = fixture();
  f.enter();
  defeatSprout(f);
  const result = await f.battle.settle();
  const replay = fixture({ progress: result.progress, storage: f.storage });
  assert(replay.enter('lantern-sprout', { practice: true }));
  defeatSprout(replay);
  assert.equal(replay.battle.hud.phase, 'cleared');
  assert.equal(replay.battle.rewardProposal, undefined);
  assert.equal((await replay.storage.read('demo')).seals, 1);
  assert.equal(filter(replay.events(), 'EncounterCleared')[0].firstClear, false);
});

test('a buffered dodge starts at the exact closing boundary and moves for only 160 ms', () => {
  const f = fixture({ world: mockWorld({ front: point(0, 120) }) });
  f.enter();
  strike(f);
  f.step(100);
  f.step(0, { move: east, dodge: true });
  const start = f.battle.playerPosition;
  f.step(210);
  const end = f.battle.playerPosition;
  const events = f.events();
  assert.equal(filter(events, 'AttackEnded')[0].atMs, 150);
  assert.equal(filter(events, 'ActionStarted').at(-1).atMs, 150);
  assert.ok(Math.abs(end.x - start.x - 49.6) < 1e-9);
});

test('blocked enemy returns to its spawn without issuing a hidden warning', () => {
  const f = fixture({ world: mockWorld({ front: point(130) }, { wall: 50 }) });
  f.enter();
  f.step(3000);
  assert.equal(f.battle.enemyState[0].phase, 'retreat');
  assert.deepEqual(f.battle.enemyState[0].position, point(130));
  assert.equal(filter(f.events(), 'AttackTelegraphed').length, 0);
});

test('guardian settlement confirms its badge and proposes only the existing return link', async () => {
  const f = fixture({ progress: guardianReady, overrides: {
    enemies: { ...enemies, 'mosswood-guardian': { ...enemies['mosswood-guardian'], health: 1 } },
  } });
  f.enter('mosswood-guardian');
  // This fixture starts below the phase threshold, so allow transition and the first sweep.
  f.step(1550);
  strike(f);
  f.step(60);
  assert.equal(f.battle.hud.phase, 'settlement');
  assert.deepEqual(f.battle.rewardProposal, { kind: 'clear', encounterId: 'mosswood-guardian',
    reward: 'guardian-badge', shortcutId: 'east-return' });
  assert.equal((await f.storage.read('demo')).badge, false);
  const result = await f.battle.settle();
  assert.equal(result.progress.badge, true);
  assert.deepEqual(result.progress.unlockedShortcuts, ['east-return']);
});

test('a thrown write retains settlement and permits safe retreat without a receipt', async () => {
  const storage = { async commit() { throw new Error('unavailable'); } };
  const f = fixture({ storage });
  f.enter();
  defeatSprout(f);
  const result = await f.battle.settle();
  assert.deepEqual(result, { status: 'rejected', reason: 'write-failed' });
  assert.equal(f.battle.hud.phase, 'settlement');
  assert.deepEqual(f.battle.retreat(), point(-10));
  assert.equal(filter(f.events(), 'RewardCommitted').length, 0);
});
