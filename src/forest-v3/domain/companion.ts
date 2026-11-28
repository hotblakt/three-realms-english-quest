import { distance } from './contracts.ts';
import type { Actor, Clock, CombatEvent, CompanionSnapshot, Point, WorldGeometry } from './contracts.ts';
import type { Progress, RewardProposal } from './progression.ts';

export const recruitmentPhrase = 'Come with me.';
export const companionTuning = { startDistance: 40, stopDistance: 26, recoverDistance: 110, blockedMs: 2000 } as const;
export type EnglishCompletion = 'recognized' | 'assisted';
export type FollowDecision =
  | { kind: 'loading' | 'hidden' | 'wait' }
  | { kind: 'follow'; target: Point; speedRatio: number }
  | { kind: 'recover' | 'safe-side'; target: Point };
export interface FollowInput {
  ready: boolean;
  regionId: string;
  companion: Actor;
  player: Point;
  /** World-selected trail in preference order. On the bridge give single-file anchors. */
  trailAnchorIds: readonly string[];
  recoveryAnchorIds: readonly string[];
  interacting?: boolean;
  combat?: boolean;
  safeAnchorId?: string;
}

export function companionSnapshot(progress: Progress, visualReady: boolean): CompanionSnapshot {
  const { discovered, collected, bondStage } = progress.companion;
  return { companionId: 'hayate', discovered, collected, bondStage, visualReady };
}

/** Creates proposals only after a safe interaction. The host presents the English exercise. */
export class Recruitment {
  private open = false;
  discover(insideHabitat: boolean, safe: boolean): RewardProposal | undefined {
    return insideHabitat && safe ? { kind: 'discover' } : undefined;
  }
  begin(snapshot: CompanionSnapshot, insideHabitat: boolean, safe: boolean): boolean {
    this.open = insideHabitat && safe && snapshot.discovered && !snapshot.collected;
    return this.open;
  }
  complete(mode: EnglishCompletion): RewardProposal | undefined {
    if (!this.open || (mode !== 'recognized' && mode !== 'assisted')) return;
    this.open = false;
    return { kind: 'recruit', mode };
  }
  cancel(): void { this.open = false; }
}

export interface CounterHint {
  windowId: string;
  deadline: number;
  text: string;
  audio: 'hayate-bell';
  safeAnchorId?: string;
}

/** Uses the encounter's effective clock so follow timers and hints can freeze on pause. */
export class Hayate {
  private region?: string;
  private following = false;
  private blockedSince?: number;
  private attempt?: string;
  private seq = 0;
  private hinted = false;
  private activeHint?: CounterHint;

  private readonly world: WorldGeometry;
  private readonly clock: Clock;

  constructor(world: WorldGeometry, clock: Clock) {
    this.world = world;
    this.clock = clock;
  }

  follow(snapshot: CompanionSnapshot, input: FollowInput): FollowDecision {
    if (input.regionId !== this.region || !input.ready) {
      this.region = input.regionId;
      this.following = false;
      this.blockedSince = undefined;
    }
    if (!snapshot.collected) return { kind: 'hidden' };
    if (!input.ready) return { kind: 'loading' };
    if (input.combat) {
      const target = input.safeAnchorId && this.anchor(input.safeAnchorId, input);
      if (!target) return { kind: 'hidden' };
      const reachable = this.reachable(input, target);
      return reachable ? { kind: 'safe-side', target } : { kind: 'hidden' };
    }
    if (input.interacting) return { kind: 'wait' };
    const gap = distance(input.companion.position, input.player);
    this.following = gap >= (this.following ? companionTuning.stopDistance : companionTuning.startDistance);
    if (!this.following) {
      this.blockedSince = undefined;
      return { kind: 'wait' };
    }
    const trail = input.trailAnchorIds.map(id => this.anchor(id, input)).find(point =>
      point && distance(point, input.companion.position) > 1 && this.reachable(input, point));
    if (trail) this.blockedSince = undefined;
    else this.blockedSince ??= this.clock();
    const blocked = this.blockedSince !== undefined && this.clock() - this.blockedSince >= companionTuning.blockedMs;
    if ((gap > companionTuning.recoverDistance || blocked) && !this.world.onCamera(input.companion.position)) {
      const target = input.recoveryAnchorIds.map(id => this.anchor(id, input)).find(point => point && !this.world.onCamera(point));
      if (target) {
        this.blockedSince = undefined;
        return { kind: 'recover', target };
      }
    }
    return trail ? { kind: 'follow', target: trail, speedRatio: gap > companionTuning.recoverDistance ? 1.25 : 0.95 }
      : { kind: 'wait' };
  }

  private anchor(id: string, input: FollowInput): Point | undefined {
    const anchor = this.world.anchor(id);
    return anchor?.regionId === input.regionId && this.world.walkable(anchor.point, input.companion, input.regionId)
      ? anchor.point : undefined;
  }

  private reachable(input: FollowInput, point: Point): boolean {
    const { companion, regionId } = input;
    const reached = this.world.move(companion, point, regionId);
    return this.world.visible(companion.position, point, regionId) && distance(reached, point) < 0.001;
  }

  explorationHint(snapshot: CompanionSnapshot, input: FollowInput, landmarkId: string, completed: boolean): Point | undefined {
    if (!snapshot.collected || !input.ready || input.combat || input.interacting || completed || landmarkId !== 'falls-lookout') return;
    const point = this.anchor(landmarkId, input);
    return point && this.reachable(input, point) ? point : undefined;
  }

  /** Caller supplies the current attempt, never the attempt named by a delayed event. */
  beginAttempt(currentAttempt?: string): void {
    if (currentAttempt === this.attempt) return;
    this.attempt = currentAttempt;
    this.seq = 0;
    this.hinted = false;
    this.activeHint = undefined;
  }

  consume(snapshot: CompanionSnapshot, event: CombatEvent): CounterHint | undefined {
    if (event.attemptId !== this.attempt || event.seq <= this.seq || event.atMs > this.clock()) return;
    this.seq = event.seq;
    if (event.type === 'ArenaExited' || event.type === 'EncounterFailed' || event.type === 'EncounterCleared') {
      this.beginAttempt();
    } else if (event.type === 'CounterEnded' && event.windowId === this.activeHint?.windowId) {
      this.activeHint = undefined;
    } else if (event.type === 'CounterOffered' && snapshot.collected && !this.hinted && event.deadline > this.clock()) {
      this.hinted = true;
      this.activeHint = {
        windowId: event.windowId, deadline: event.deadline, safeAnchorId: event.safeAnchorId,
        text: event.windBladeReady ? '現在，試試風刃！' : '現在可以反擊！', audio: 'hayate-bell',
      };
      return this.activeHint;
    }
  }

  get hint(): CounterHint | undefined {
    return this.activeHint && this.activeHint.deadline > this.clock() ? this.activeHint : undefined;
  }
}
