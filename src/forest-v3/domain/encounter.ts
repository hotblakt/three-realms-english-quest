import { add, distance, scale, south, sub, unit, zero } from './contracts.ts';
import type {
  Actor, ArenaEntry, AttackWindow, Clock, CombatEvent, CombatPayload, EventPayloads, HudState, Phase,
  PlayerInput, Point, WorldGeometry,
} from './contracts.ts';
import { AttackBudget, enemyAttack, enemyVulnerable, settleEnemyAttack, steerEnemy } from './enemy.ts';
import type { Enemy } from './enemy.ts';
import { receiptFor } from './progression.ts';
import type { Progress, RewardProposal, RewardStorage, TransactionResult } from './progression.ts';
import { encounters, enemies, tuning } from './tuning.ts';
import type { EncounterDefinition, EnemyDefinition } from './tuning.ts';

export interface EncounterOptions {
  clock: Clock;
  world: WorldGeometry;
  storage: RewardStorage;
  slot: string;
  /** Unique across scene instances in this session. */
  attemptId: () => string;
  encounters?: Readonly<Record<string, EncounterDefinition>>;
  enemies?: Readonly<Record<string, EnemyDefinition>>;
}
export interface EntryRequest extends ArenaEntry {
  encounterId: string;
  enemySpawnIds: readonly string[];
  practice?: boolean;
  assisted?: boolean;
}
type Action = { kind: 'sword' | 'windBlade'; window: AttackWindow; recoveryUntil: number; released: boolean; spiritAwarded: boolean };
type Projectile = { window: AttackWindow; position: Point; travelled: number; owner?: Enemy };
type Contact = { window: AttackWindow; target: Actor; damage: number; sword?: Action };

export class Encounter {
  private phase: Phase = 'explore';
  private entry?: EntryRequest;
  private definition?: EncounterDefinition;
  private progress?: Progress;
  private attemptId = '';
  private readonly usedAttempts = new Set<string>();
  private seq = 0;
  private nextAttack = 0;
  private firstEnemy = 0;
  private time = 0;
  private wall: number;
  private resumeUntil = 0;
  private output: CombatEvent[] = [];
  private budget = new AttackBudget();
  private foes: Enemy[] = [];
  private player: Actor = { id: 'player', radius: 9, halfHeight: 8, position: zero };
  private facing = south;
  private dodgeFacing = south;
  private health: number = tuning.health;
  private spirit: number = tuning.startingSpirit;
  private evadeUntil = 0;
  private dodgeReady = 0;
  private windReady = 0;
  private damageReady = 0;
  private hurtUntil = 0;
  private action?: Action;
  private counter?: { windowId: string; sourceId: string; deadline: number };
  private buffer?: { kind: 'sword' | 'windBlade' | 'dodge'; until: number };
  private projectiles: Projectile[] = [];
  private hits = new Map<string, Set<string>>();
  private pending?: Promise<TransactionResult>;

  private readonly options: EncounterOptions;

  constructor(options: EncounterOptions) {
    this.options = options;
    this.wall = options.clock();
  }

  get now() { return this.time; }
  get currentAttempt() { return this.entry ? this.attemptId : undefined; }
  get playerPosition(): Point { return { ...this.player.position }; }
  get enemyState() {
    return this.foes.map(({ id, position, health, phase, stage }) => ({ id, position: { ...position }, health, phase, stage }));
  }
  get projectileState() {
    return this.projectiles.map(({ window, position }) => ({ attackId: window.attackId, position: { ...position } }));
  }
  get hud(): HudState {
    const unlocked = Boolean(this.progress?.chapterWindBlade);
    return {
      phase: this.phase, health: this.health, spirit: this.spirit, windBladeUnlocked: unlocked,
      windBladeReady: unlocked && this.spirit >= tuning.windCost && this.time >= this.windReady,
      dodgeReady: this.time >= this.dodgeReady, dodgeReadyAt: this.dodgeReady, windBladeReadyAt: this.windReady,
      counterDeadline: this.counter?.deadline,
      practice: Boolean(this.entry?.practice),
    };
  }
  drainEvents(): CombatEvent[] {
    const events = this.output;
    this.output = [];
    return events;
  }

  enter(request: EntryRequest, progress: Progress): boolean {
    if (this.pending || (this.phase !== 'explore' && this.phase !== 'cleared')) return false;
    return this.start(request, progress);
  }

  private start(request: EntryRequest, progress: Progress): boolean {
    const catalog: Readonly<Record<string, EncounterDefinition>> = this.options.encounters ?? encounters;
    const definition = Object.hasOwn(catalog, request.encounterId) ? catalog[request.encounterId] : undefined;
    if (!definition || (definition.prerequisite && !progress.cleared.includes(definition.prerequisite))) return false;
    if (request.practice && !progress.cleared.includes(request.encounterId)) return false;
    if (definition.enemies.length !== request.enemySpawnIds.length) return false;
    const spawn = this.safeAnchor(request.spawnId, request.regionId, this.player);
    if (!spawn || !this.safeAnchor(request.checkpointId, request.regionId, this.player)) return false;
    const foes: Enemy[] = [];
    const enemyCatalog: Readonly<Record<string, EnemyDefinition>> = this.options.enemies ?? enemies;
    for (const [index, kind] of definition.enemies.entries()) {
      const enemy = Object.hasOwn(enemyCatalog, kind) ? enemyCatalog[kind] : undefined;
      if (!enemy?.attacks.length) return false;
      const id = `${kind}:${index}`;
      const point = this.safeAnchor(request.enemySpawnIds[index], request.regionId, { id, position: spawn, radius: enemy.radius });
      if (!point || distance(spawn, point) < this.player.radius + enemy.radius ||
        foes.some(foe => distance(foe.position, point) < foe.radius + enemy.radius)) return false;
      foes.push({ id, position: point, spawn: point, radius: enemy.radius, definition: enemy,
        health: enemy.health, phase: 'idle', stage: 1, attackCount: 0, until: 0 });
    }
    const id = this.options.attemptId();
    if (!id || this.usedAttempts.has(id)) return false;
    this.usedAttempts.add(id);
    this.entry = { ...request, enemySpawnIds: [...request.enemySpawnIds] };
    this.definition = definition;
    this.progress = structuredClone(progress);
    this.attemptId = id;
    this.phase = 'active';
    this.player.position = spawn;
    this.foes = foes;
    this.output = [];
    this.projectiles = [];
    this.hits.clear();
    this.budget = new AttackBudget();
    this.time = this.seq = this.nextAttack = this.firstEnemy = this.resumeUntil = 0;
    this.wall = this.options.clock();
    this.evadeUntil = this.dodgeReady = this.windReady = this.damageReady = this.hurtUntil = 0;
    this.health = tuning.health;
    this.spirit = tuning.startingSpirit;
    this.facing = south;
    this.action = this.counter = this.buffer = undefined;
    return true;
  }

  private safeAnchor(id: string, regionId: string, actor: Actor): Point | undefined {
    const anchor = this.options.world.anchor(id);
    return anchor?.regionId === regionId && this.options.world.walkable(anchor.point, actor, regionId) ? anchor.point : undefined;
  }

  pause(): void {
    if (this.phase !== 'active') return;
    this.phase = 'paused';
    this.buffer = undefined;
  }

  resume(): void {
    if (this.phase !== 'paused') return;
    this.phase = 'active';
    this.wall = this.options.clock();
    this.resumeUntil = this.wall + tuning.resumeGrace;
  }

  retry(assisted = this.entry?.assisted): boolean {
    if (this.phase !== 'failed' || !this.entry || !this.progress) return false;
    return this.start({ ...this.entry, assisted, spawnId: this.entry.checkpointId }, this.progress);
  }

  retreat(): Point | undefined {
    if (!this.entry || this.pending) return;
    const point = this.safeAnchor(this.entry.checkpointId, this.entry.regionId, this.player);
    if (!point) return;
    this.cancelActive();
    this.emit({ type: 'ArenaExited', landmarkId: this.entry.landmarkId, checkpointId: this.entry.checkpointId });
    this.phase = 'explore';
    this.entry = undefined;
    this.foes = [];
    this.player.position = point;
    this.health = tuning.health;
    this.spirit = Math.max(this.spirit, tuning.startingSpirit);
    return { ...point };
  }

  private emit(payload: CombatPayload): void {
    this.output.push({
      encounterId: this.entry!.encounterId, attemptId: this.attemptId, seq: ++this.seq, atMs: this.time, ...payload,
    });
  }

  /** Advance on an integral millisecond grid, including every crossed activity boundary. */
  update(input: PlayerInput = { move: zero }): void {
    if (this.phase !== 'active') return;
    const now = this.options.clock();
    if (now < this.resumeUntil) return;
    const elapsed = Math.max(0, Math.floor(now - Math.max(this.wall, this.resumeUntil)));
    this.wall = Math.max(this.wall, this.resumeUntil) + elapsed;
    for (let step = 0; step < elapsed && this.phase === 'active'; step++) {
      this.time++;
      this.step(input.move);
    }
    if (this.phase !== 'active') return;
    const kind = input.dodge ? 'dodge' : input.sword ? 'sword' : input.windBlade ? 'windBlade' : undefined;
    if (!kind) return;
    const direction = unit(input.move);
    if (distance(direction, zero) > 0 && this.time >= this.evadeUntil) this.facing = direction;
    if (this.tryAction(kind, distance(direction, zero) > 0)) this.buffer = undefined;
    else if ((kind !== 'windBlade' || this.progress?.chapterWindBlade) &&
      (kind === 'dodge' || this.buffer?.kind !== 'dodge')) this.buffer = { kind, until: this.time + tuning.buffer };
  }

  private tryAction(kind: Action['kind'] | 'dodge', directed: boolean): boolean {
    const now = this.time;
    if (now < this.evadeUntil) return false;
    if (kind === 'dodge') {
      if (now < this.dodgeReady || (this.action?.kind === 'sword' && this.action.released && now < this.action.window.closesAt)) return false;
      this.cancelAction();
      this.dodgeReady = now + tuning.dodgeCooldown;
      this.evadeUntil = now + tuning.dodgeDuration;
      this.dodgeFacing = this.facing;
    } else {
      if (this.action || now < this.hurtUntil || (kind === 'windBlade' && !this.hud.windBladeReady)) return false;
      const wind = kind === 'windBlade';
      const facing = !wind && !directed ? this.aimSword() : this.facing;
      const opensAt = now + (wind ? tuning.windWindup : tuning.swordWindup);
      const range = this.progress?.rune ? tuning.runeRange : tuning.windRange;
      const closesAt = opensAt + (wind ? Math.ceil(range * 1000 / tuning.windSpeed) : tuning.swordActive);
      const window: AttackWindow = {
        attackId: `attack-${++this.nextAttack}`, sourceId: this.player.id,
        origin: this.player.position, facing, opensAt, closesAt,
        shape: wind ? { kind: 'projectile', range, halfWidth: tuning.windHalfWidth, speed: tuning.windSpeed }
          : { kind: 'sector', range: tuning.swordRange, degrees: tuning.swordDegrees },
      };
      this.action = { kind, window, released: false, spiritAwarded: false,
        recoveryUntil: wind ? opensAt + tuning.windRecovery : closesAt + tuning.swordRecovery };
    }
    this.emit({ type: 'ActionStarted', action: kind, origin: this.player.position, facing: this.action?.window.facing ?? this.facing });
    return true;
  }

  private aimSword(): Point {
    const origin = this.player.position;
    const target = this.foes.filter(foe => foe.health > 0 && distance(origin, foe.position) <= tuning.swordRange &&
      this.options.world.visible(origin, foe.position, this.entry!.regionId))
      .sort((a, b) => distance(origin, a.position) - distance(origin, b.position))
      .find(foe => {
        const direction = unit(sub(foe.position, origin));
        return direction.x * this.facing.x + direction.y * this.facing.y >= Math.cos(35 * Math.PI / 180);
      });
    return target ? unit(sub(target.position, origin)) : this.facing;
  }

  private step(move: Point): void {
    const now = this.time;
    const direction = unit(move);
    const directed = distance(direction, zero) > 0;
    const dodging = now - 1 < this.evadeUntil;
    if (now >= this.evadeUntil && directed) this.facing = direction;
    if (this.counter && now >= this.counter.deadline) this.endCounter();
    if (this.action?.kind === 'sword' && now === this.action.window.closesAt) this.close(this.action.window, 'complete');
    if (this.action && now >= this.action.recoveryUntil) this.action = undefined;
    if (this.buffer) {
      if (now > this.buffer.until || this.tryAction(this.buffer.kind, directed)) this.buffer = undefined;
    }
    // Integrate the elapsed interval before applying actions that start at its end.
    const velocity = scale(dodging ? this.dodgeFacing : direction, (dodging ? tuning.dodgeSpeed : tuning.runSpeed) / 1000);
    const region = this.entry!.regionId;
    this.player.position = this.options.world.move(this.player, add(this.player.position, velocity), region);
    const contacts: Contact[] = [];
    const first = this.firstEnemy;
    for (let count = 0; count < this.foes.length; count++) {
      const index = (first + count) % this.foes.length;
      if (this.stepEnemy(this.foes[index], contacts)) this.firstEnemy = (index + 1) % this.foes.length;
    }
    this.stepPlayerAttack(contacts);
    const finished = this.stepProjectiles(contacts);
    for (const hit of contacts) this.resolve(hit);
    for (const { window, owner } of finished) {
      if (owner) this.endEnemy(owner, 'complete');
      else this.close(window, 'complete');
    }
    for (const foe of this.foes) {
      if (foe.health > 0 || foe.phase === 'defeated') continue;
      if (foe.action && !this.projectiles.some(projectile => projectile.owner === foe)) this.endEnemy(foe, 'cancelled');
      foe.phase = 'defeated';
    }
    if (!this.health) {
      this.cancelActive();
      this.foes = [];
      this.phase = 'failed';
      this.emit({ type: 'EncounterFailed', checkpointId: this.entry!.checkpointId });
    } else if (this.foes.every(foe => foe.phase === 'defeated')) {
      this.cancelActive();
      this.health = tuning.health;
      this.spirit = Math.max(this.spirit, tuning.startingSpirit);
      if (this.entry!.practice || this.progress!.cleared.includes(this.entry!.encounterId)) {
        this.phase = 'cleared';
        this.emit({ type: 'EncounterCleared', firstClear: false });
      } else this.phase = 'settlement';
    }
  }

  private stepPlayerAttack(contacts: Contact[]): void {
    const action = this.action;
    if (!action) return;
    const window = action.window;
    if (!action.released && this.time >= window.opensAt) {
      action.released = true;
      window.origin = this.player.position;
      this.emit({ type: 'HitWindowOpened', ...window });
      if (action.kind === 'windBlade') {
        this.spirit -= tuning.windCost;
        this.windReady = this.time + tuning.windCooldown;
        this.projectiles.push({ window, position: window.origin, travelled: 0 });
      }
    }
    if (action.kind !== 'sword' || !action.released) return;
    if (this.time >= window.closesAt || window.shape.kind === 'projectile') return;
    for (const target of this.foes) {
      if (target.health > 0 && this.overlaps(window, this.player.position, target)) contacts.push({ window, target, damage: 1, sword: action });
    }
  }

  private stepEnemy(foe: Enemy, contacts: Contact[]): true | undefined {
    if (foe.health <= 0) return;
    const now = this.time;
    const window = foe.action;
    if (foe.phase === 'telegraph' && window && now >= window.opensAt) {
      foe.phase = 'active';
      this.emit({ type: 'HitWindowOpened', ...window });
      if (window.shape.kind === 'projectile') this.projectiles.push({ window, position: window.origin, travelled: 0, owner: foe });
    }
    if (foe.phase === 'active' && window) {
      if (window.shape.kind === 'projectile') return;
      if (now >= window.closesAt) this.endEnemy(foe, 'complete');
      else if (this.overlaps(window, window.origin, this.player)) contacts.push({ window, target: this.player, damage: 1 });
      return;
    }
    const cooling = foe.phase === 'recovery' || foe.phase === 'transition' || foe.phase === 'retreat';
    if (foe.phase === 'telegraph' || (cooling && now < foe.until)) return;
    const core = foe.definition.core;
    if (core && foe.stage === 1 && foe.health <= core.phaseAt) {
      foe.stage = 2;
      foe.phase = 'transition';
      foe.until = now + core.transition;
      return;
    }
    const regionId = this.entry!.regionId;
    if (!steerEnemy(foe, this.player, this.options.world, regionId, now) || !this.budget.acquire(foe.id, now)) return;
    foe.attackCount++;
    const next = enemyAttack(foe);
    const warning = foe.attackCount === 1 ? this.definition!.firstWarning ?? next.warning : next.warning;
    const opensAt = now + warning + (this.entry!.assisted ? tuning.assistWarning : 0);
    const facing = unit(sub(this.player.position, foe.position));
    foe.action = {
      attackId: `attack-${++this.nextAttack}`, sourceId: foe.id, shape: next.shape, origin: foe.position,
      facing: distance(facing, zero) ? facing : south, opensAt, closesAt: opensAt + next.active,
    };
    foe.phase = 'telegraph';
    this.emit({ type: 'AttackTelegraphed', ...foe.action });
    return true;
  }

  private overlaps(window: AttackWindow, origin: Point, target: Actor): boolean {
    const world = this.options.world;
    return window.shape.kind !== 'projectile' && world.visible(origin, target.position, this.entry!.regionId) &&
      world.intersects(window.shape, origin, window.facing, target);
  }

  private stepProjectiles(contacts: Contact[]): Projectile[] {
    const finished: Projectile[] = [];
    this.projectiles = this.projectiles.filter(projectile => {
      const { window, owner } = projectile;
      const shape = window.shape;
      if (shape.kind !== 'projectile' || window.opensAt === this.time) return true;
      const movement = Math.min(shape.speed / 1000, shape.range - projectile.travelled);
      const to = add(projectile.position, scale(window.facing, movement));
      const targets = owner ? [this.player] : this.foes.filter(foe => foe.health > 0);
      const hit = this.options.world.sweep(projectile.position, to, shape.halfWidth, targets, this.entry!.regionId);
      const target = hit && targets.find(candidate => candidate.id === hit.targetId);
      if (target) contacts.push({ window, target, damage: owner ? 1 : tuning.windDamage });
      if (hit || projectile.travelled + movement >= shape.range - 1e-9 || this.time >= window.closesAt) {
        finished.push(projectile);
        return false;
      }
      projectile.travelled += movement;
      projectile.position = to;
      return true;
    });
    return finished;
  }

  private resolve({ window, target, damage, sword }: Contact): void {
    const hitTargets = this.hits.get(window.attackId) ?? new Set<string>();
    if (hitTargets.has(target.id)) return;
    hitTargets.add(target.id);
    this.hits.set(window.attackId, hitTargets);
    const spiritBefore = this.spirit;
    let hpDelta = 0;
    let result: EventPayloads['HitResolved']['result'] = 'hit';
    if (target.id === this.player.id) {
      if (this.time < this.evadeUntil) {
        result = 'dodge';
        if (!this.counter && this.foes.some(foe => foe.id === window.sourceId && foe.health > 0)) {
          const deadline = this.time + tuning.counterDuration + (this.entry!.assisted ? tuning.assistCounter : 0);
          this.counter = { windowId: window.attackId, sourceId: window.sourceId, deadline };
          this.emit({ type: 'CounterOffered', windowId: window.attackId, deadline, windBladeReady: this.hud.windBladeReady, safeAnchorId: this.entry!.safeAnchorId });
        }
      } else if (this.time < this.damageReady) result = 'protected';
      else {
        hpDelta = -Math.min(this.health, damage);
        this.health += hpDelta;
        this.damageReady = this.time + tuning.damageProtection;
        this.hurtUntil = this.time + tuning.hitRecovery;
        if (!this.action?.released) this.cancelAction();
      }
    } else {
      const foe = this.foes.find(enemy => enemy.id === target.id)!;
      if (!enemyVulnerable(foe)) result = 'shell';
      const counter = Boolean(sword && result === 'hit' && this.counter?.sourceId === target.id);
      if (result === 'hit') {
        hpDelta = -Math.min(foe.health, damage + Number(counter));
        foe.health += hpDelta;
        if (foe.health > 0 && (foe.phase === 'engage' || foe.phase === 'queued')) {
          foe.phase = 'retreat';
          foe.until = this.time + 120;
        }
      }
      if (sword && !sword.spiritAwarded) {
        sword.spiritAwarded = true;
        this.spirit = Math.min(tuning.spiritMax, this.spirit + 1);
      }
      if (counter) {
        this.spirit = Math.min(tuning.spiritMax, this.spirit + 1);
        this.endCounter();
      }
    }
    this.emit({ type: 'HitResolved', attackId: window.attackId, sourceId: window.sourceId, targetId: target.id,
      result, hpDelta, spiritDelta: this.spirit - spiritBefore });
  }

  private close(window: AttackWindow, reason: 'complete' | 'cancelled'): void {
    this.emit({ type: 'AttackEnded', ...window, reason });
    this.hits.delete(window.attackId);
  }

  private endCounter(): void {
    if (this.counter) this.emit({ type: 'CounterEnded', windowId: this.counter.windowId });
    this.counter = undefined;
  }

  private endEnemy(foe: Enemy, reason: 'complete' | 'cancelled'): void {
    if (foe.action) this.close(foe.action, reason);
    this.budget.release(foe.id, this.time);
    if (foe.health > 0) settleEnemyAttack(foe, this.time);
    else foe.action = undefined;
  }

  private cancelAction(): void {
    if (this.action) {
      const { window, released, kind } = this.action;
      if (!released || (kind === 'sword' && this.time < window.closesAt)) this.close(window, 'cancelled');
    }
    this.action = undefined;
  }

  private cancelActive(): void {
    this.cancelAction();
    for (const projectile of this.projectiles) {
      if (!projectile.owner) this.close(projectile.window, 'cancelled');
    }
    for (const foe of this.foes) if (foe.action) this.endEnemy(foe, 'cancelled');
    this.projectiles = [];
    this.buffer = undefined;
    this.endCounter();
    this.hits.clear();
  }

  get rewardProposal(): RewardProposal | undefined {
    if (this.phase !== 'settlement' || !this.entry || !this.definition) return;
    return { kind: 'clear', encounterId: this.entry.encounterId, reward: this.definition.reward,
      ...(this.definition.reward === 'guardian-badge' ? { shortcutId: 'east-return' as const } : {}) };
  }

  async settle(): Promise<TransactionResult> {
    if (this.pending) return this.pending;
    const proposal = this.rewardProposal;
    if (!proposal) return { status: 'rejected', reason: 'nothing-to-settle' };
    this.pending = this.confirm(proposal);
    try { return await this.pending; }
    finally { this.pending = undefined; }
  }

  private async confirm(proposal: RewardProposal): Promise<TransactionResult> {
    try {
      const result = await this.options.storage.commit(this.options.slot, proposal);
      if (result.status === 'confirmed') {
        const expected = receiptFor(this.options.slot, proposal);
        if (expected.key !== result.receipt.key || !result.progress.rewardReceipts.some(receipt => receipt.key === expected.key)) {
          return { status: 'rejected', reason: 'invalid-confirmation' };
        }
        this.progress = structuredClone(result.progress);
        this.phase = 'cleared';
        const event = { rewardId: result.receipt.rewardId, firstClear: result.firstClear };
        this.emit({ type: 'RewardCommitted', ...event });
        this.emit({ type: 'EncounterCleared', ...event });
      }
      return result;
    } catch {
      return { status: 'rejected', reason: 'write-failed' };
    }
  }
}
