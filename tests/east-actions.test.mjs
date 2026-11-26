import assert from 'node:assert/strict';
import test from 'node:test';
import { EastActions } from '../forest-preview/eastActions.ts';

test('cast releases exactly once, expires, and can be started again', () => {
  const actions = new EastActions();
  assert.equal(actions.start('cast', 100), true);
  assert.equal(actions.start('cast', 101), false);
  assert.equal(actions.releaseCast(899), false);
  assert.equal(actions.releaseCast(900), true);
  assert.equal(actions.releaseCast(901), false);
  assert.equal(actions.current(1500), undefined);
  assert.equal(actions.start('cast', 1500), true);
});
test('actual sword and dash events interrupt presentation in priority order', () => {
  const actions = new EastActions();
  actions.start('cast', 0);
  assert.equal(actions.start('attack', 90), true);
  assert.equal(actions.start('cast', 91), false);
  assert.equal(actions.start('dash', 92), true);
  assert.equal(actions.start('attack', 93), false);
  assert.equal(actions.current(251).name, 'dash');
  assert.equal(actions.current(252), undefined);
  assert.equal(actions.releaseCast(900), false);
});
