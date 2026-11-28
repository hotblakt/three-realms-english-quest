import test from 'node:test';
import assert from 'node:assert/strict';
import { forestGeometry } from '../../forest-v3-preview/geometry.ts';
import { guardianGeometry, guardianClearance, encounterAreas } from '../../src/forest-v3/world/encounters.ts';
import { forestRegionId } from '../../src/forest-v3/world/world.ts';
import { Encounter } from '../../src/forest-v3/domain/encounter.ts';
import { MemoryRewardStorage, initialProgress } from '../../src/forest-v3/domain/progression.ts';
import { enemies } from '../../src/forest-v3/domain/tuning.ts';
import { readFileSync } from 'node:fs';

const at = (x, y) => ({x,y});
const player = (x,y) => ({ id:'player', radius:9, halfHeight:8, position:at(x,y) });

test('signed-off bridge is traversable and creek blocks movement and projectiles', () => {
  const world = forestGeometry(() => undefined, () => true);
  assert.deepEqual(world.move(player(622,451),at(728,451),forestRegionId),at(728,451));
  assert.deepEqual(world.move(player(622,481),at(744,481),forestRegionId),at(622,481));
  const terrain = world.sweep(at(622,481),at(744,481),4,[player(742,481)],forestRegionId);
  assert.ok(terrain?.fraction > 0);
  assert.equal(terrain.targetId,undefined);
  const target = world.sweep(at(622,451),at(744,451),4,[player(728,451)],forestRegionId);
  assert.equal(target?.targetId,'player');
});

test('all arena adapters accept the verified start locations and safe checkpoints', () => {
  const world = forestGeometry(() => undefined, () => true);
  for (const [id, area] of Object.entries(encounterAreas)) {
    const encounter = new Encounter({ world, slot:'test', storage:new MemoryRewardStorage(), clock:()=>0, attemptId:()=>id });
    const valid = encounter.enter({
      encounterId:id, regionId:forestRegionId, spawnId:id+'-entry', landmarkId:area.landmarkId,
      checkpointId:area.checkpointId, enemySpawnIds:area.spawns.map((_,i)=>id+'-enemy-'+i),
    }, {...initialProgress(),cleared:['east-wind-pair']});
    assert.equal(valid,true,id);
    assert.deepEqual(encounter.playerPosition,area.entry);
    assert.deepEqual(encounter.retreat(),world.anchor(area.checkpointId).point);
  }
});

test('guardian emits only verified easterly telegraphs at the fixed arena origin', () => {
  const arena = encounterAreas['mosswood-guardian'];
  const geometry = guardianClearance();
  assert.equal(geometry.shockwaveClear && geometry.fanClear && geometry.dodgeLanes.every(d => d.clear),true);
  let now = 0;
  const world = forestGeometry(() => arena.bounds, () => true);
  const encounter = new Encounter({ world, slot:'test', storage:new MemoryRewardStorage(), clock:()=>now,
    attemptId:()=> 'guardian', fixedAttackFacings:{'mosswood-guardian:0':guardianGeometry.facing},
    enemies:{ ...enemies, 'mosswood-guardian':{...enemies['mosswood-guardian'],speed:0} },
  });
  assert.ok(encounter.enter({ encounterId:'mosswood-guardian',regionId:forestRegionId,spawnId:'mosswood-guardian-entry',
    enemySpawnIds:['mosswood-guardian-enemy-0'],checkpointId:'guardian-retreat',landmarkId:'guardian-entry' },
  {...initialProgress(),cleared:['east-wind-pair']}));
  for (let tick=0;tick<160;tick++) { now+=16; encounter.update(); }
  const warnings=encounter.drainEvents().filter(event=>event.type==='AttackTelegraphed');
  assert.deepEqual(warnings.slice(0,2).map(e=>e.shape.kind),['sector','strip']);
  for(const warning of warnings) {
    assert.deepEqual(warning.origin,guardianGeometry.origin);
    assert.deepEqual(warning.facing,guardianGeometry.facing);
  }
});

test('isolated candidate entry and save store never register an alpha production save writer', () => {
  const config = readFileSync(new URL('../../vite.config.ts', import.meta.url),'utf8');
  const stable = readFileSync(new URL('../../forest-preview/main.ts', import.meta.url),'utf8');
  const save = readFileSync(new URL('../../forest-v3-preview/save.ts', import.meta.url),'utf8');
  assert.match(config,/forest-v3-preview\/index\.html/);
  assert.doesNotMatch(stable,/forest-v3|Alpha/);
  assert.match(save,/loadChapter\(\)/);
  assert.match(save,/three-realms-forest-v3-alpha/);
  assert.doesNotMatch(save,/saveChapter|localStorage\.setItem/);
});
