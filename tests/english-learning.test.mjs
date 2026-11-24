import assert from 'node:assert/strict';
import test from 'node:test';
import { lessons, recommendLesson } from '../src/learning/lessons.ts';
import { LearningProgress } from '../src/learning/LearningProgress.ts';
import { loadLearning, saveLearning } from '../src/save/learningSave.ts';
import { loadChapter } from '../src/save/chapterSave.ts';
import { matchesSpokenText, selectSpokenMatch } from '../src/speech/matchSpokenText.ts';

const byId = id => lessons.find(lesson => lesson.id === id);
const memory = entries => {
  const data = new Map(entries);
  return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
};

test('six complete lesson definitions are available and recommendations follow the adventure', () => {
  assert.equal(new Set(lessons.map(lesson => lesson.id)).size, 6);
  assert.deepEqual(lessons.map(lesson => lesson.target), [
    'I can run.', 'I can jump.', 'I can fight.', 'This is my sword.', 'I am ready.', 'The wind is strong.',
  ]);
  for (const lesson of lessons) {
    assert.ok(lesson.meaning && lesson.hint && lesson.difficulty > 0 && lesson.exp > 0);
    assert.equal(matchesSpokenText('Um, ' + lesson.target.toUpperCase(), lesson.target), true);
  }
  assert.equal(recommendLesson('elder', () => false), 'my-sword');
  assert.equal(recommendLesson('elder', id => id === 'my-sword'), 'am-ready');
  assert.equal(recommendLesson('stone', id => id === 'can-run'), 'strong-wind');
});

test('essential words and negation cannot be overridden by a competing alternative', () => {
  const target = byId('can-run').target;
  for (const transcript of ['I can jump', 'I can’t run', 'I can not run', 'I run']) {
    assert.equal(selectSpokenMatch({ transcript, alternatives: ['I can run'] }, target), undefined);
  }
  assert.equal(selectSpokenMatch({ transcript: 'Uh...', alternatives: ['I can walk', 'I can run'] }, target), 'I can run');
  assert.equal(selectSpokenMatch({ transcript: 'I CAN RUN!', alternatives: ["I can't run"] }, target), 'I CAN RUN!');
  assert.equal(matchesSpokenText('The wind strong', byId('strong-wind').target), false);
});

test('assisted and recognized completions persist; replay and upgrades cannot award twice', () => {
  const storage = memory([]);
  const first = new LearningProgress(loadLearning(storage));
  const run = byId('can-run'), sword = byId('my-sword');
  assert.equal(first.status(run.id), 'new');
  assert.equal(first.complete(run, 'assisted'), 8);
  assert.equal(first.complete(run, 'assisted'), 0);
  assert.equal(first.complete(sword, 'recognized'), 10);
  saveLearning(first.snapshot(), storage);
  const restored = new LearningProgress(loadLearning(storage));
  assert.equal(restored.exp, 18);
  assert.equal(restored.status(run.id), 'assisted');
  assert.equal(restored.complete(run, 'recognized'), 0);
  assert.equal(restored.status(run.id), 'recognized');
  assert.equal(restored.complete(sword, 'assisted'), 0);
  assert.equal(restored.status(sword.id), 'recognized');
  assert.equal(restored.exp, 18);
});

test('old village and chapter saves are preserved and corrupt learning entries are isolated', () => {
  const saved = memory([
    ['three-realms:awakening-of-wind:v1', 'complete'],
    ['three-realms:awakening-of-wind:v2', '{"step":"complete"}'],
  ]);
  assert.deepEqual(loadLearning(saved), {});
  assert.equal(loadChapter(saved), 'complete');
  const learning = new LearningProgress(loadLearning(saved));
  learning.complete(byId('can-run'), 'assisted');
  saveLearning(learning.snapshot(), saved);
  assert.equal(loadChapter(saved), 'complete');
  assert.equal(saved.getItem('three-realms:awakening-of-wind:v1'), 'complete');
  saved.setItem('three-realms:english-learning:v1', '{"can-run":{"status":"assisted","earned":8},"can-fight":{"status":"recognized","earned":-1},"unknown":{"status":"recognized","earned":42}}');
  assert.equal(new LearningProgress(loadLearning(saved)).exp, 8);
  saved.setItem('three-realms:english-learning:v1', '{');
  assert.deepEqual(loadLearning(saved), {});
});
