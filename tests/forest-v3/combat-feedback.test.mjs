import test from 'node:test';
import assert from 'node:assert/strict';
import { CombatFeedback, explorationSwordInterval } from '../../forest-v3-preview/combatFeedback.ts';
import { tuning } from '../../src/forest-v3/domain/tuning.ts';

function stubView() {
  const points = [];
  const view = {
    visible: false,
    points,
    arc(x, y, radius, start, end) { points.push({ x, y, radius, start, end }); return this; },
    setPosition(x, y) { this.x = x; this.y = y; return this; },
    setVisible(value) { this.visible = value; return this; },
  };
  for (const method of ['setDepth','setAlpha','clear','lineStyle','beginPath','strokePath','strokeEllipse',
    'lineBetween','setTexture','setOrigin','setScale','setFlip','setTint']) {
    view[method] = () => view;
  }
  return view;
}

globalThis.matchMedia = () => ({ matches: false });
const scene = { add: { graphics: stubView, image: stubView } };
const at = {x:20,y:30};
const avatar = { ...at, texture: { key:'eiku' }, frame: { name:'0' } };

test('sword paints a directional arc on the acceptance frame and expires independently of movement', t => {
  t.mock.method(globalThis, 'matchMedia', () => ({matches:false}));
  const feedback = new CombatFeedback(scene);
  feedback.slash(at, {x:-1,y:0}, 100);
  assert.equal(feedback.sword.visible,true);
  const first = feedback.sword.points[0];
  assert.equal(first.x,20);
  assert.ok(first.start > Math.PI / 2 && first.end > Math.PI);
  feedback.update(avatar, 101 + tuning.swordWindup + tuning.swordActive);
  assert.equal(feedback.sword.visible,false);
  assert.equal(explorationSwordInterval,300);
});

test('dodge afterimages use actual avatar coordinates and reduced motion keeps only the ground cue', t => {
  const preference = {matches:false};
  t.mock.method(globalThis, 'matchMedia', () => preference);
  const feedback = new CombatFeedback(scene);
  feedback.startDodge(at,{x:1,y:0},100);
  feedback.update({...avatar,x:24},105);
  assert.ok(feedback.ghosts[0].visible);
  assert.equal(feedback.ghosts[0].x,24);
  preference.matches = true;
  feedback.update(avatar,154);
  assert.equal(feedback.ghosts.some(v=>v.visible),false);
  feedback.clear();
  assert.equal(feedback.sword.visible,false);
});
