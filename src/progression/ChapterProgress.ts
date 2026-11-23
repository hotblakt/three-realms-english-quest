export const chapterSteps = [
  'meet', 'slash', 'dodge', 'enter', 'lower-grove', 'upper-grove', 'east-grove',
  'fragment', 'speaking', 'guardian', 'complete',
] as const;
export type ChapterStep = typeof chapterSteps[number];

const transitions = {
  meet: ['talk', 'slash'],
  slash: ['strike', 'dodge'],
  dodge: ['dodge', 'enter'],
  enter: ['enter', 'lower-grove'],
  'lower-grove': ['clear-grove', 'upper-grove'],
  'upper-grove': ['clear-grove', 'east-grove'],
  'east-grove': ['clear-grove', 'fragment'],
  fragment: ['collect', 'speaking'],
  speaking: ['confirm-practice', 'guardian'],
  guardian: ['defeat-guardian', 'complete'],
} as const;
export type ChapterAction = typeof transitions[keyof typeof transitions][0];

export class ChapterProgress {
  private current: ChapterStep;

  constructor(current: ChapterStep = 'meet') { this.current = current; }

  get step(): ChapterStep { return this.current; }
  get enteredTrial(): boolean { return chapterSteps.indexOf(this.current) >= chapterSteps.indexOf('lower-grove'); }
  get windBlade(): boolean { return this.current === 'complete'; }

  advance(action: ChapterAction): boolean {
    if (this.current === 'complete') return false;
    const [expected, next] = transitions[this.current];
    if (action !== expected) return false;
    this.current = next;
    return true;
  }
}
