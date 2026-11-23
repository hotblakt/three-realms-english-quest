import { awakeningOfWind } from '../quests/chapters';

export type TrainingStep = 'meet-geno' | 'strike-dummy' | 'complete';

export class TrainingProgress {
  constructor(public step: TrainingStep = 'meet-geno') {}

  get objective(): string {
    if (this.step === 'meet-geno') return awakeningOfWind.intro;
    if (this.step === 'strike-dummy') return awakeningOfWind.nextObjective;
    return awakeningOfWind.complete;
  }

  meetGeno(): void {
    if (this.step === 'meet-geno') this.step = 'strike-dummy';
  }

  strikeDummy(): void {
    if (this.step === 'strike-dummy') this.step = 'complete';
  }
}
