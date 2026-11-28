export type Point = Readonly<{ x: number; y: number }>;
export type Clock = () => number;
export type Actor = { id: string; position: Point; radius: number; halfHeight?: number };
export type Shape =
  | { kind: 'sector'; range: number; degrees: number }
  | { kind: 'strip'; range: number; halfWidth: number }
  | { kind: 'projectile'; range: number; halfWidth: number; speed: number };

export interface Anchor {
  id: string;
  regionId: string;
  point: Point;
}
export interface AreaReady {
  regionId: string;
  spawnId: string;
}
export type AreaExit = AreaReady;
export interface ArenaExit {
  landmarkId: string;
  checkpointId: string;
}
export interface ArenaEntry extends ArenaExit {
  regionId: string;
  spawnId: string;
  safeAnchorId?: string;
}
export interface WorldGeometry {
  anchor(id: string): Anchor | undefined;
  walkable(point: Point, actor: Actor, regionId: string): boolean;
  move(actor: Actor, desired: Point, regionId: string): Point;
  visible(from: Point, to: Point, regionId: string): boolean;
  onCamera(point: Point): boolean;
  intersects(shape: Exclude<Shape, { kind: 'projectile' }>, origin: Point, facing: Point, target: Actor): boolean;
  /** Normalized first contact along the segment. Hard terrain wins equal-time contacts. */
  sweep(from: Point, to: Point, halfWidth: number, targets: readonly Actor[], regionId: string):
    { fraction: number; targetId?: string } | undefined;
}
export interface PlayerInput {
  move: Point;
  /** One-shot edges. The caller clears held input on focus loss. */
  sword?: boolean;
  dodge?: boolean;
  windBlade?: boolean;
}
export type Phase = 'explore' | 'active' | 'paused' | 'settlement' | 'failed' | 'cleared';
export type HitResult = 'hit' | 'shell' | 'protected' | 'dodge';
export interface AttackWindow {
  attackId: string;
  sourceId: string;
  shape: Shape;
  origin: Point;
  facing: Point;
  opensAt: number;
  closesAt: number;
}
export interface EventPayloads {
  AttackTelegraphed: AttackWindow;
  HitWindowOpened: AttackWindow;
  AttackEnded: AttackWindow & { reason: 'complete' | 'cancelled' };
  HitResolved: { attackId: string; sourceId: string; targetId: string; result: HitResult; hpDelta: number; spiritDelta: number };
  CounterOffered: { windowId: string; deadline: number; windBladeReady: boolean; safeAnchorId?: string };
  CounterEnded: { windowId: string };
  EncounterFailed: { checkpointId: string };
  EncounterCleared: { rewardId?: string; firstClear: boolean };
  RewardCommitted: { rewardId: string; firstClear: boolean };
  ActionStarted: { action: 'sword' | 'windBlade' | 'dodge'; origin: Point; facing: Point };
  ArenaExited: { landmarkId: string; checkpointId: string };
}
export type CombatEventOf<K extends keyof EventPayloads> = Readonly<{
  type: K; encounterId: string; attemptId: string; seq: number; atMs: number;
} & EventPayloads[K]>;
export type CombatPayload = { [K in keyof EventPayloads]: { type: K } & EventPayloads[K] }[keyof EventPayloads];
export type CombatEvent = { [K in keyof EventPayloads]: CombatEventOf<K> }[keyof EventPayloads];
export interface HudState {
  phase: Phase;
  health: number;
  spirit: number;
  windBladeUnlocked: boolean;
  windBladeReady: boolean;
  dodgeReady: boolean;
  dodgeReadyAt: number;
  windBladeReadyAt: number;
  counterDeadline?: number;
  practice: boolean;
}
export type AnimationCue = {
  kind: 'ground-mark' | 'sword-arc' | 'dodge-outline' | 'wind-charge' | 'wind-projectile' | 'impact' | 'clear-mark';
  event: CombatEvent;
};
export type AudioCue = { kind: 'warning' | 'swing' | 'dodge' | 'wind' | 'impact' | 'block' | 'counter' | 'reward'; event: CombatEvent };
export interface CompanionSnapshot {
  companionId: 'hayate';
  discovered: boolean;
  collected: boolean;
  bondStage: 0 | 1 | 2;
  visualReady: boolean;
}
export const zero: Point = { x: 0, y: 0 };
export const south: Point = { x: 0, y: 1 };
export const add = (a: Point, b: Point): Point => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a: Point, b: Point): Point => ({ x: a.x - b.x, y: a.y - b.y });
export const scale = (a: Point, amount: number): Point => ({ x: a.x * amount, y: a.y * amount });
export const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
export function unit(point: Point): Point {
  const length = distance(point, zero);
  return length ? scale(point, 1 / length) : zero;
}
