import assert from 'node:assert/strict';
import test from 'node:test';
import { ChapterProgress } from '../src/progression/ChapterProgress.ts';
import { loadChapter, saveChapter } from '../src/save/chapterSave.ts';
import { groves, trialCheckpoint, guardianSite } from '../src/quests/trialLayout.ts';
import { inAttackArea } from '../src/combat/trialRules.ts';

const legacyKey = 'three-realms:awakening-of-wind:v1';
const key = 'three-realms:awakening-of-wind:v2';
const store = entries => {
  const values = new Map(entries);
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
};

test('fresh chapter follows the village, three groves, speaking, guardian and unlock order', () => {
  const chapter = new ChapterProgress();
  assert.equal(chapter.advance('defeat-guardian'), false);
  for (const [action, step] of [
    ['talk', 'slash'], ['strike', 'dodge'], ['dodge', 'enter'], ['enter', 'lower-grove'],
    ['clear-grove', 'upper-grove'], ['clear-grove', 'east-grove'], ['clear-grove', 'fragment'],
    ['collect', 'speaking'], ['confirm-practice', 'guardian'], ['defeat-guardian', 'complete'],
  ]) {
    assert.equal(chapter.windBlade, false);
    assert.equal(chapter.advance(action), true);
    assert.equal(chapter.step, step);
  }
  assert.equal(chapter.windBlade, true);
  assert.equal(chapter.advance('confirm-practice'), false);
});

test('legacy training checkpoints migrate without granting chapter completion', () => {
  assert.equal(loadChapter(store([[legacyKey, 'strike-dummy']])), 'slash');
  const saved = store([[legacyKey, 'complete']]);
  const chapter = new ChapterProgress(loadChapter(saved));
  assert.equal(chapter.step, 'dodge');
  assert.equal(chapter.windBlade, false);
  saveChapter('guardian', saved);
  assert.equal(loadChapter(saved), 'guardian');
  saveChapter('complete', saved);
  assert.equal(new ChapterProgress(loadChapter(saved)).windBlade, true);
  assert.equal(saved.getItem(legacyKey), 'complete');
});

test('malformed saves and blocked storage recover safely', () => {
  assert.equal(loadChapter(store([[key, '{'], [legacyKey, 'complete']])), 'dodge');
  assert.equal(loadChapter(store([[key, '{"step":"unknown"}']])), 'meet');
  const blocked = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };
  const chapter = new ChapterProgress(loadChapter(blocked));
  assert.equal(chapter.advance('talk'), true);
  assert.doesNotThrow(() => saveChapter(chapter.step, blocked));
  assert.equal(chapter.step, 'slash');
});

test('closing or losing audio leaves practice resumable, and explicit confirmation requires no transcript', () => {
  const saved = store([]);
  saveChapter('speaking', saved);
  const chapter = new ChapterProgress(loadChapter(saved));
  assert.equal(chapter.advance('defeat-guardian'), false);
  assert.equal(loadChapter(saved), 'speaking');
  assert.equal(chapter.advance('confirm-practice'), true);
  saveChapter(chapter.step, saved);
  assert.equal(loadChapter(saved), 'guardian');
});

test('trial defeat/reload keeps the encounter checkpoint within interaction range', () => {
  for (const [step, site] of [...Object.entries(groves), ['guardian', guardianSite]]) {
    const saved = store([]);
    saveChapter(step, saved);
    const restored = loadChapter(saved);
    assert.equal(restored, step);
    const checkpoint = trialCheckpoint(restored);
    assert.ok(Math.hypot(checkpoint.x - site.x, checkpoint.y - site.y) <= 62);
  }
});

test('guardian attacks can be avoided by exiting the indicated area', () => {
  const circle = { kind: 'circle', x: 8, y: 8, radius: 47 };
  assert.equal(inAttackArea(circle, { x: 8, y: 8 }), true);
  assert.equal(inAttackArea(circle, { x: 8, y: 56 }), false);
  const lane = { kind: 'lane', x: 5, y: 5, angle: Math.PI / 2, length: 171, width: 40 };
  assert.equal(inAttackArea(lane, { x: 5, y: 80 }), true);
  assert.equal(inAttackArea(lane, { x: 30, y: 80 }), false);
  assert.equal(inAttackArea(lane, { x: 5, y: 4 }), false);
});
