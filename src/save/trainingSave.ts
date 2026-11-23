import type { TrainingStep } from '../progression/TrainingProgress';
import { awakeningOfWind } from '../quests/chapters';

const key = `three-realms:${awakeningOfWind.id}:v1`;

export function loadTraining(): TrainingStep {
  try {
    const value = localStorage.getItem(key);
    if (value === 'strike-dummy' || value === 'complete') return value;
  } catch {
    return 'meet-geno';
  }
  return 'meet-geno';
}

export function saveTraining(step: TrainingStep): void {
  try {
    localStorage.setItem(key, step);
  } catch {
    // Keep in-memory progress when storage is unavailable.
  }
}
