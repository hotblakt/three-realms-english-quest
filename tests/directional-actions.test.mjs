import assert from 'node:assert/strict';
import test from 'node:test';
import { chooseCastTiming, facingDirection, forwardDistance, selectDirectionalAction } from '../forest-preview/directionalActions.ts';
import { EastActions } from '../forest-preview/eastActions.ts';
import { runSources } from '../forest-preview/runSources.ts';

const base = { casting: false, busy: false, moving: false, hasInput: false };

test('automatic run and idle select the accepted clip for every facing', () => {
  for (const [vector, name] of [[{x:1,y:0},'east'], [{x:0,y:-1},'north'], [{x:-1,y:0},'west'], [{x:0,y:1},'south']]) {
    assert.equal(facingDirection(vector), name);
    assert.equal(selectDirectionalAction(runSources, name, base), runSources[name + '-idle']);
    assert.equal(selectDirectionalAction(runSources, name, {...base, moving:true, hasInput:true}),
      runSources[name === 'east' ? 'framesprite' : name + '-run']);
  }
});

test('missing cast, blocked run and attack/dash fall back to stance', () => {
  assert.equal(selectDirectionalAction(runSources, 'north', {...base, casting:true}), undefined);
  for (const direction of ['east','west','south']) {
    assert.equal(selectDirectionalAction(runSources, direction, {...base, casting:true, busy:true}), runSources[direction + '-cast']);
    assert.equal(selectDirectionalAction(runSources, direction, {...base, busy:true, moving:true}), undefined);
    assert.equal(selectDirectionalAction(runSources, direction, {...base, hasInput:true}), undefined);
  }
  assert.equal(forwardDistance({x:-1,y:0},{x:-1,y:0},{x:-6,y:0}), 6);
  assert.equal(forwardDistance({x:0,y:-1},{x:0,y:-1},{x:0,y:0}), 0);
  assert.equal(forwardDistance({x:0,y:-1},{x:0,y:1},{x:0,y:-5}), 0);
});

test('the west cast releases once and a dash cancels recovery', () => {
  const state = new EastActions();
  const timing = chooseCastTiming('west', 10, 14);
  assert.deepEqual(timing, {duration:1400, releaseAt:500});
  assert.ok(state.start('cast', 0, timing));
  assert.equal(state.releaseCast(499), false);
  assert.equal(state.releaseCast(500), true);
  assert.equal(state.releaseCast(501), false);
  assert.ok(state.start('dash', 600));
  assert.equal(state.releaseCast(700), false);
  assert.equal(state.current(760), undefined);
});
