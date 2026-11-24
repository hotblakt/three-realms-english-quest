import { lessons, type Lesson, type LessonId } from './lessons.ts';

export type Completion = 'recognized' | 'assisted';
type Entry = { status: Completion; earned: number };
export type LearningSave = Partial<Record<LessonId, Entry>>;

export class LearningProgress {
  private readonly entries: LearningSave;

  constructor(entries: LearningSave = {}) {
    this.entries = { ...entries };
  }

  status(id: LessonId): Completion | 'new' { return this.entries[id]?.status ?? 'new'; }

  get exp(): number {
    return Object.values(this.entries).reduce((total, entry) => total + entry.earned, 0);
  }

  complete(lesson: Lesson, status: Completion): number {
    const prior = this.entries[lesson.id];
    if (prior) {
      if (prior.status === 'assisted' && status === 'recognized') {
        this.entries[lesson.id] = { ...prior, status };
      }
      return 0;
    }
    this.entries[lesson.id] = { status, earned: lesson.exp };
    return lesson.exp;
  }

  snapshot(): LearningSave { return { ...this.entries }; }
}

export function parseLearning(value: unknown): LearningSave {
  const result: LearningSave = {};
  if (value === null || typeof value !== 'object') return result;
  const entries = value as Record<string, unknown>;
  for (const { id } of lessons) {
    const item = entries[id] as Partial<Entry> | undefined;
    if (item?.status !== 'recognized' && item?.status !== 'assisted') continue;
    const earned = item.earned;
    if (typeof earned !== 'number' || !Number.isSafeInteger(earned) || earned < 0 || earned > 1000) continue;
    result[id] = { status: item.status, earned };
  }
  return result;
}
