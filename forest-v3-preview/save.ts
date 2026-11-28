import { loadChapter } from '../src/save/chapterSave';
import { applyReward, initialProgress, type Progress, type RewardProposal, type RewardStorage, type TransactionResult } from '../src/forest-v3/domain/progression';
import { checkpoints, type CheckpointId } from '../src/forest-v3/world/world';

export const alphaDatabase = 'three-realms-forest-v3-alpha';
const storeName = 'slots';
export const alphaSlot = 'alpha-v1';
export type AlphaRecord = { version: 1; progress: Progress; checkpoint: CheckpointId; english?: 'recognized' | 'assisted' };

function record(value: unknown, unlocked: boolean): AlphaRecord {
  if (value === undefined) return { version: 1, checkpoint: 'south-entry', progress: initialProgress(unlocked) };
  const entry = value as AlphaRecord | null;
  const p = entry?.progress;
  const strings = (list: unknown): list is string[] => Array.isArray(list) && list.every(x => typeof x === 'string');
  if (!entry || entry.version !== 1 || !Object.hasOwn(checkpoints, entry.checkpoint) ||
      (entry.english !== undefined && entry.english !== 'recognized' && entry.english !== 'assisted') ||
      !p || ![p.chapterWindBlade, p.rune, p.badge].every(x => typeof x === 'boolean') ||
      !Number.isSafeInteger(p.seals) || p.seals < 0 ||
      !strings(p.cleared) || !strings(p.treasures) || !strings(p.unlockedShortcuts) ||
      !Array.isArray(p.rewardReceipts) || !p.rewardReceipts.every(r => r && r.slot === alphaSlot &&
        typeof r.sourceId === 'string' && typeof r.rewardId === 'string' &&
        r.key === JSON.stringify([r.slot, r.sourceId, r.rewardId])) ||
      p.companion?.companionId !== 'hayate' || typeof p.companion.discovered !== 'boolean' ||
      typeof p.companion.collected !== 'boolean' || ![0, 1, 2].includes(p.companion.bondStage) ||
      !strings(p.companion.appliedGrowthKeys)) throw new Error('試玩存檔格式無法讀取');
  return { ...entry, progress: { ...p, chapterWindBlade: unlocked } };
}

export class AlphaSave implements RewardStorage {
  private database?: Promise<IDBDatabase>;

  constructor(private readonly windBlade = () => loadChapter() === 'complete') {}

  private connect(): Promise<IDBDatabase> {
    this.database ??= new Promise((resolve, reject) => {
      const request = indexedDB.open(alphaDatabase, 1);
      let disconnected = false;
      const stop = (error: unknown) => {
        disconnected = true;
        clearTimeout(timeout);
        reject(error);
      };
      const timeout = setTimeout(() => stop(new Error('試玩存檔開啟逾時')), 5000);
      request.onupgradeneeded = () => {
        if (disconnected) request.transaction?.abort();
        else request.result.createObjectStore(storeName);
      };
      request.onerror = () => stop(request.error);
      request.onblocked = () => stop(new Error('試玩存檔由其他頁面使用中'));
      request.onsuccess = () => {
        clearTimeout(timeout);
        if (disconnected) {
          request.result.close();
          return;
        }
        request.result.onversionchange = () => { request.result.close(); this.database = undefined; };
        resolve(request.result);
      };
    }).catch(error => { this.database = undefined; throw error; }) as Promise<IDBDatabase>;
    return this.database;
  }

  private async transact<T>(slot: string, mode: IDBTransactionMode,
    apply: (current: AlphaRecord) => { value: T; next?: AlphaRecord }): Promise<T> {
    if (slot !== alphaSlot) throw new Error('未知試玩存檔');
    const db = await this.connect();
    return new Promise((resolve, reject) => {
      let result: T;
      let failure: unknown;
      const transaction = db.transaction(storeName, mode);
      transaction.oncomplete = () => resolve(result);
      transaction.onabort = () => reject(failure ?? transaction.error ?? new Error('試玩儲存已中斷'));
      const store = transaction.objectStore(storeName);
      const read = store.get(slot);
      read.onsuccess = () => {
        try {
          const { value, next } = apply(record(read.result, this.windBlade()));
          result = value;
          if (next) store.put(next, slot);
        } catch (error) {
          failure = error;
          transaction.abort();
        }
      };
    });
  }

  load() { return this.transact(alphaSlot, 'readonly', current => ({ value: current })); }
  async read(slot: string) {
    return this.transact(slot, 'readonly', current => ({ value: current.progress }));
  }
  checkpoint(checkpoint: CheckpointId) {
    return this.transact(alphaSlot, 'readwrite', current => ({ value: undefined, next: { ...current, checkpoint } }));
  }
  async commit(slot: string, proposal: RewardProposal) {
    try {
      return await this.transact<TransactionResult>(slot, 'readwrite', current => {
        const value = applyReward(slot, current.progress, proposal);
        if (value.status === 'rejected') return { value };
        const english = proposal.kind === 'recruit' ? current.english ?? proposal.mode : current.english;
        return { value, next: { ...current, progress: value.progress, english } };
      });
    } catch {
      return { status: 'rejected', reason: 'save-unavailable' } as const;
    }
  }
}
