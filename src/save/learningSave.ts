import { parseLearning, type LearningSave } from '../learning/LearningProgress.ts';

type LearningStorage = Pick<Storage, 'getItem' | 'setItem'>;
const key = 'three-realms:english-learning:v1';

function browserStorage(): LearningStorage | undefined {
  try { return globalThis.localStorage; } catch { return undefined; }
}

export function loadLearning(storage = browserStorage()): LearningSave {
  try {
    const raw = storage?.getItem(key);
    return raw ? parseLearning(JSON.parse(raw)) : {};
  } catch {
    return {};
  }
}

export function saveLearning(entries: LearningSave, storage = browserStorage()): void {
  try { storage?.setItem(key, JSON.stringify(entries)); } catch { /* Retain the session's progress. */ }
}
