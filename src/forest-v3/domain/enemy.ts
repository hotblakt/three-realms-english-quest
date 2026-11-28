import { add, distance, scale, sub, unit } from './contracts.ts';
import type { Actor, AttackWindow, Point, WorldGeometry } from './contracts.ts';
import { tuning } from './tuning.ts';
import type { AttackDefinition, EnemyDefinition } from './tuning.ts';

export type EnemyPhase = 'idle' | 'engage' | 'queued' | 'telegraph' | 'active' | 'recovery' | 'retreat' | 'transition' | 'defeated';
export interface Enemy extends Actor {
  definition: EnemyDefinition;
  spawn: Point;
  health: number;
  phase: EnemyPhase;
  stage: 1 | 2;
  attackCount: number;
  until: number;
  blockedSince?: number;
  action?: AttackWindow;
}
export class AttackBudget {
  private owner?: string;
  private readyAt = 0;
  acquire(owner: string, now: number): boolean {
    if (this.owner || now < this.readyAt) return false;
    this.owner = owner;
    return true;
  }
  release(owner: string, now: number): void {
    if (this.owner !== owner) return;
    this.owner = undefined;
    this.readyAt = now + tuning.attackGap;
  }
}
export function enemyAttack(enemy: Enemy): AttackDefinition {
  return enemy.definition.attacks[(Math.max(1, enemy.attackCount) - 1) % enemy.definition.attacks.length];
}
export function enemyVulnerable(enemy: Enemy): boolean {
  return !enemy.definition.core || enemy.phase === 'recovery';
}
export function settleEnemyAttack(enemy: Enemy, now: number): void {
  enemy.action = undefined;
  const core = enemy.definition.core;
  if (core && enemy.stage === 1 && enemy.health <= core.phaseAt) {
    enemy.stage = 2;
    enemy.phase = 'transition';
    enemy.until = now + core.transition;
    return;
  }
  enemy.phase = 'recovery';
  enemy.until = now + (core && enemy.stage === 2 ? core.laterRecovery : enemyAttack(enemy).recovery);
}
export function steerEnemy(enemy: Enemy, player: Actor, world: WorldGeometry, regionId: string, now: number): boolean {
  const definition = enemy.definition;
  const gap = distance(enemy.position, player.position);
  const direction = unit(sub(player.position, enemy.position));
  const toward = gap > definition.maxDistance;
  const away = gap < definition.minDistance;
  const visible = world.visible(enemy.position, player.position, regionId);
  enemy.phase = 'engage';
  if (toward || away || !visible) {
    const desired = add(enemy.position, scale(direction, (away ? -1 : 1) * definition.speed / 1000));
    const next = world.move(enemy, desired, regionId);
    if (distance(next, enemy.position) > 0) enemy.blockedSince = undefined;
    else enemy.blockedSince ??= now;
    enemy.position = next;
  }
  if (enemy.blockedSince !== undefined && now >= enemy.blockedSince + tuning.enemyReset && (toward || !visible)) {
    enemy.phase = 'retreat';
    if (world.walkable(enemy.spawn, enemy, regionId)) enemy.position = enemy.spawn;
    enemy.blockedSince = undefined;
    enemy.until = now + tuning.attackGap;
    return false;
  }
  if (toward || !visible) return false;
  enemy.phase = 'queued';
  return true;
}
