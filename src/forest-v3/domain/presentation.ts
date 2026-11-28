import type { AnimationCue, AudioCue, CombatEvent } from './contracts.ts';

/** Consumers may run one gate per attempt. Gaps are allowed, replays and out-of-order events are ignored. */
export class EventGate {
  private sequence = 0;
  private readonly encounterId: string;
  private readonly attemptId: string;

  constructor(encounterId: string, attemptId: string) {
    this.encounterId = encounterId;
    this.attemptId = attemptId;
  }
  accept(event: CombatEvent): boolean {
    if (event.attemptId !== this.attemptId || event.encounterId !== this.encounterId || event.seq <= this.sequence) return false;
    this.sequence = event.seq;
    return true;
  }
}

export function animationCue(event: CombatEvent): AnimationCue | undefined {
  switch (event.type) {
    case 'AttackTelegraphed': return { kind: 'ground-mark', event };
    case 'AttackEnded': return { kind: 'clear-mark', event };
    case 'HitResolved': return { kind: 'impact', event };
    case 'HitWindowOpened':
      if (event.shape.kind === 'projectile') return { kind: 'wind-projectile', event };
      break;
    case 'ActionStarted':
      if (event.action === 'sword') return { kind: 'sword-arc', event };
      if (event.action === 'dodge') return { kind: 'dodge-outline', event };
      return { kind: 'wind-charge', event };
  }
}
export function audioCue(event: CombatEvent): AudioCue | undefined {
  switch (event.type) {
    case 'AttackTelegraphed': return { kind: 'warning', event };
    case 'ActionStarted':
      if (event.action === 'sword') return { kind: 'swing', event };
      if (event.action === 'dodge') return { kind: 'dodge', event };
      break;
    case 'HitWindowOpened':
      if (event.sourceId === 'player' && event.shape.kind === 'projectile') return { kind: 'wind', event };
      break;
    case 'HitResolved': return { kind: event.result === 'hit' ? 'impact' : 'block', event };
    case 'CounterOffered': return { kind: 'counter', event };
    case 'RewardCommitted':
      if (event.firstClear) return { kind: 'reward', event };
      break;
  }
}
