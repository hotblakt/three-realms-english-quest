import { chapterSteps, type ChapterStep } from '../progression/ChapterProgress.ts';

const legacyKey = 'three-realms:awakening-of-wind:v1';
const key = 'three-realms:awakening-of-wind:v2';
type ChapterStorage = Pick<Storage, 'getItem' | 'setItem'>;

function browserStorage(): ChapterStorage | undefined {
  try { return globalThis.localStorage; } catch { return undefined; }
}

export function loadChapter(storage = browserStorage()): ChapterStep {
  try {
    const value = storage?.getItem(key);
    if (value) {
      try {
        const state = JSON.parse(value);
        if (chapterSteps.includes(state?.step)) return state.step;
      } catch {
        // Try the old training checkpoint if the chapter record is unreadable.
      }
    }
    const legacy = storage?.getItem(legacyKey);
    if (legacy === 'complete') return 'dodge';
    if (legacy === 'strike-dummy') return 'slash';
  } catch {
    // Storage may be unavailable in a restricted browser context.
  }
  return 'meet';
}

export function saveChapter(step: ChapterStep, storage = browserStorage()): void {
  try {
    storage?.setItem(key, JSON.stringify({ step }));
  } catch {
    // The running session retains its checkpoint in memory.
  }
}
