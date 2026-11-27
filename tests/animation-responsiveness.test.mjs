import assert from 'node:assert/strict';
import test from 'node:test';
import { canStartRun, castAtlasKeys, movementAtlasKeys, movementAtlasesReady } from '../forest-preview/movementReadiness.ts';
import { runSources } from '../forest-preview/runSources.ts';
import { transitionVisualScale } from '../forest-preview/scaleTransition.ts';

test('all four runs and idles are required at the chosen resolution before movement', () => {
  for (const resolution of [256, 384]) {
    const loaded = new Set(movementAtlasKeys.map(key => runSources[key].textures[resolution].url));
    const ready = () => movementAtlasesReady(key => loaded.has(runSources[key].textures[resolution].url));
    for (const key of movementAtlasKeys) {
      const url = runSources[key].textures[resolution].url;
      loaded.delete(url);
      assert.equal(ready(), false, key);
      loaded.add(url);
    }
    assert.equal(ready(), true);
    for (const key of castAtlasKeys) assert.equal(loaded.has(runSources[key].textures[resolution].url), false);
  }
});

test('run and idle switch poses immediately while size eases over 120 ms', () => {
  for (const run of [95, 114]) {
    const idle = transitionVisualScale(undefined, 'idle', 100, 0, false);
    const firstRun = transitionVisualScale(idle, 'run', run, 16, false);
    assert.equal(firstRun.group, 'run');
    assert.equal(firstRun.value, 100);
    const settled = transitionVisualScale(firstRun, 'run', run, 136, false);
    assert.equal(settled.value, run);
    const firstIdle = transitionVisualScale(settled, 'idle', 100, 152, false);
    assert.equal(firstIdle.value, run);
    const halfIdle = transitionVisualScale(firstIdle, 'idle', 100, 212, false);
    assert.equal(halfIdle.value, (run + 100) / 2);
    assert.equal(transitionVisualScale(halfIdle, 'idle', 100, 272, false).value, 100);
    assert.equal(transitionVisualScale(firstRun, 'idle', 100, 17, true).value, 100);
    assert.equal(transitionVisualScale(firstIdle, 'other', 100, 17, false).value, 100);
  }
});

test('run pose can start before the first physics step and respects blocked sides', () => {
  const wall = { up: false, down: false, left: true, right: false };
  assert.equal(canStartRun({ x: -1, y: 0 }, wall), false);
  assert.equal(canStartRun({ x: 0, y: 0 }, wall), false);
  assert.equal(canStartRun({ x: 1, y: 0 }, wall), true);
  assert.equal(canStartRun({ x: 0, y: -1 }, wall), true);
});
