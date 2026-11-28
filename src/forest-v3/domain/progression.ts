export type ClearReward = 'wind-seal' | 'guardian-badge' | 'encounter-clear';
export type RewardId = ClearReward | 'wind-rune' | 'discover' | 'recruit';
export interface Receipt {
  slot: string;
  sourceId: string;
  rewardId: RewardId;
  key: string;
}
export interface Progress {
  /** Owned by Chapter 1. Forest transactions preserve this value. */
  chapterWindBlade: boolean;
  seals: number;
  rune: boolean;
  badge: boolean;
  cleared: readonly string[];
  treasures: readonly string[];
  unlockedShortcuts: readonly string[];
  rewardReceipts: readonly Receipt[];
  companion: {
    companionId: 'hayate';
    discovered: boolean;
    collected: boolean;
    bondStage: 0 | 1 | 2;
    appliedGrowthKeys: readonly string[];
  };
}
export type RewardProposal =
  | { kind: 'clear'; encounterId: string; reward: ClearReward; shortcutId?: 'east-return' }
  | { kind: 'treasure'; landmarkId: 'west-chest' }
  | { kind: 'equip-rune' }
  | { kind: 'discover' }
  | { kind: 'recruit'; mode: 'recognized' | 'assisted' };

export function proposeWindRune(progress: Progress, atSafePoint: boolean): RewardProposal | undefined {
  if (atSafePoint && progress.chapterWindBlade && progress.seals > 0 && !progress.rune) return { kind: 'equip-rune' };
}

export type TransactionResult =
  | { status: 'confirmed'; progress: Progress; receipt: Receipt; firstClear: boolean }
  | { status: 'rejected'; reason: string };
export interface RewardStorage {
  read(slot: string): Promise<Progress>;
  /** Serialize per slot. Persist receipt and all effects atomically before returning confirmed. */
  commit(slot: string, proposal: RewardProposal): Promise<TransactionResult>;
}
export function initialProgress(chapterWindBlade = false): Progress {
  return {
    chapterWindBlade, seals: 0, rune: false, badge: false, cleared: [], treasures: [],
    unlockedShortcuts: [], rewardReceipts: [],
    companion: { companionId: 'hayate', discovered: false, collected: false, bondStage: 0, appliedGrowthKeys: [] },
  };
}
export function receiptFor(slot: string, proposal: RewardProposal): Receipt {
  let sourceId: string;
  let rewardId: RewardId;
  switch (proposal.kind) {
    case 'clear': sourceId = proposal.encounterId; rewardId = proposal.reward; break;
    case 'treasure': sourceId = proposal.landmarkId; rewardId = 'wind-seal'; break;
    case 'equip-rune': sourceId = 'wind-rune'; rewardId = 'wind-rune'; break;
    default: sourceId = 'hayate'; rewardId = proposal.kind;
  }
  return { slot, sourceId, rewardId, key: JSON.stringify([slot, sourceId, rewardId]) };
}
function reconcileBond(progress: Progress): Progress {
  const guardian = progress.rewardReceipts.find(receipt =>
    receipt.sourceId === 'mosswood-guardian' && receipt.rewardId === 'guardian-badge',
  );
  if (!guardian || !progress.companion.collected || progress.companion.appliedGrowthKeys.includes(guardian.key)) {
    return progress;
  }
  return { ...progress, companion: {
    ...progress.companion, bondStage: 2,
    appliedGrowthKeys: [...progress.companion.appliedGrowthKeys, guardian.key],
  } };
}

/** Pure transaction reducer for use inside the integration owner's serialization boundary. */
export function applyReward(slot: string, saved: Progress, proposal: RewardProposal): TransactionResult {
  const receipt = receiptFor(slot, proposal);
  if (saved.rewardReceipts.some(item => item.key === receipt.key)) {
    return { status: 'confirmed', progress: reconcileBond(saved), receipt, firstClear: false };
  }
  if (proposal.kind === 'clear' && saved.cleared.includes(proposal.encounterId)) {
    return { status: 'rejected', reason: 'missing-clear-receipt' };
  }
  if (proposal.kind === 'equip-rune' && (!saved.seals || !saved.chapterWindBlade)) {
    return { status: 'rejected', reason: 'rune-unavailable' };
  }
  if (proposal.kind === 'recruit' && !saved.companion.discovered) {
    return { status: 'rejected', reason: 'habitat-not-discovered' };
  }
  let progress: Progress = { ...saved, rewardReceipts: [...saved.rewardReceipts, receipt] };
  switch (proposal.kind) {
    case 'clear':
      progress = { ...progress, cleared: [...progress.cleared, proposal.encounterId] };
      if (proposal.reward === 'guardian-badge') progress = { ...progress, badge: true };
      else if (proposal.reward === 'wind-seal') progress = { ...progress, seals: progress.seals + 1 };
      if (proposal.shortcutId && !progress.unlockedShortcuts.includes(proposal.shortcutId)) {
        progress = { ...progress, unlockedShortcuts: [...progress.unlockedShortcuts, proposal.shortcutId] };
      }
      break;
    case 'treasure':
      progress = { ...progress, treasures: [...progress.treasures, proposal.landmarkId], seals: progress.seals + 1 };
      break;
    case 'equip-rune': progress = { ...progress, rune: true }; break;
    case 'discover': progress = { ...progress, companion: { ...progress.companion, discovered: true } }; break;
    case 'recruit': progress = { ...progress, companion: { ...progress.companion, collected: true, bondStage: 1 } }; break;
  }
  return { status: 'confirmed', progress: reconcileBond(progress), receipt, firstClear: proposal.kind === 'clear' };
}

/** Deterministic in-memory adapter. Mutation is synchronous before the promise resolves. */
export class MemoryRewardStorage implements RewardStorage {
  private readonly slots = new Map<string, Progress>();
  rejectNext = false;
  private readonly defaults: Progress;

  constructor(defaults = initialProgress()) {
    this.defaults = structuredClone(defaults);
  }
  async read(slot: string): Promise<Progress> {
    return structuredClone(this.slots.get(slot) ?? this.defaults);
  }
  async commit(slot: string, proposal: RewardProposal): Promise<TransactionResult> {
    if (this.rejectNext) {
      this.rejectNext = false;
      return { status: 'rejected', reason: 'write-failed' };
    }
    const result = applyReward(slot, this.slots.get(slot) ?? this.defaults, proposal);
    if (result.status === 'confirmed') this.slots.set(slot, result.progress);
    return structuredClone(result);
  }
}
