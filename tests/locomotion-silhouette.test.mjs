import assert from 'node:assert/strict';
import test from 'node:test';
import { locomotionSilhouette } from '../forest-preview/locomotionSilhouette.ts';
import { transitionVisualScale } from '../forest-preview/scaleTransition.ts';
import { recommendedScale } from '../forest-preview/directionalScale.ts';
import { runSources } from '../forest-preview/runSources.ts';

const nominal = 44 * 2.07 * 384 / 316;
const visible = state => state.value * state.silhouette.bodyHeight;
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} vs ${b}`);

test('every approved locomotion frame is measured and can enter either pose without a size jump', () => {
  for (const [direction, percent] of Object.entries(recommendedScale)) {
    const run = runSources[direction === 'east' ? 'framesprite' : direction + '-run'];
    const idle = runSources[direction + '-idle'];
    for (let frame = 0; frame < run.frameCount; frame++) {
      const runBody = locomotionSilhouette(run.id, frame);
      const idleBody = locomotionSilhouette(idle.id, 0);
      assert.ok(runBody && idleBody);
      const running = transitionVisualScale(undefined, 'run', nominal * percent / 100, 0, false, runBody);
      const first = transitionVisualScale(running, 'idle', nominal, 16, false, idleBody);
      near(visible(first), visible(running));
      const halfway = transitionVisualScale(first, 'idle', nominal, 76, false, idleBody);
      near(visible(halfway), (visible(running) + nominal * idleBody.bodyHeight) / 2);
      const restart = transitionVisualScale(halfway, 'run', nominal * percent / 100, 84, false, runBody);
      near(visible(restart), visible(halfway));
      near(transitionVisualScale(restart, 'run', nominal * percent / 100, 204, false, runBody).value, nominal * percent / 100);
    }
    assert.ok(Array.from({length:idle.frameCount}, (_, i) => locomotionSilhouette(idle.id, i)).every(Boolean));
  }
});

test('rapid turns rebase on the current silhouette even when two run scales match', () => {
  const east = locomotionSilhouette('eiku-east-run', 2);
  const west = locomotionSilhouette('eiku-west-run', 0);
  const north = locomotionSilhouette('eiku-north-run', 3);
  const a = transitionVisualScale(undefined, 'run', nominal, 0, false, east);
  const b = transitionVisualScale(a, 'run', nominal, 14, false, west);
  near(visible(a), visible(b));
  const c = transitionVisualScale(b, 'run', nominal * 1.14, 32, false, north);
  near(visible(b), visible(c));
  assert.equal(transitionVisualScale(c, 'run', nominal * 1.14, 35, true, north).value, nominal * 1.14);
});
