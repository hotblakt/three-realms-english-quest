import Phaser from 'phaser';
import { TrialOpponent } from '../entities/TrialOpponent';

export class TrialEncounter {
  private readonly opponents: TrialOpponent[] = [];
  private wave = 0;
  private clock = 0;
  private nextWaveAt = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly anchor: { x: number; y: number },
    private readonly waves: readonly (readonly number[])[],
    readonly guardian = false,
  ) {
    this.spawnWave();
  }

  get remaining(): number { return this.opponents.length; }
  get waveNumber(): number { return this.wave; }
  get waveCount(): number { return this.waves.length; }
  get canCounter(): boolean { return this.guardian && this.opponents.some(opponent => opponent.vulnerable); }
  get complete(): boolean { return this.wave === this.waves.length && this.remaining === 0; }

  update(delta: number, position: Phaser.Math.Vector2, onHit: () => void): void {
    const elapsed = Math.min(delta, 50);
    this.clock += elapsed;
    if (!this.remaining && !this.complete && this.clock >= this.nextWaveAt) this.spawnWave();
    for (const opponent of this.opponents) {
      if (opponent.update(this.clock, elapsed, position, this.opponents)) onHit();
    }
  }

  target(origin: Phaser.Math.Vector2, facing: Phaser.Math.Vector2): TrialOpponent | undefined {
    const ahead = this.opponents.filter(opponent => {
      const offset = opponent.position.clone().subtract(origin);
      return offset.lengthSq() === 0 || offset.normalize().dot(facing) >= .6;
    });
    return ahead.reduce<TrialOpponent | undefined>((closest, opponent) =>
      !closest || origin.distanceSq(opponent.position) < origin.distanceSq(closest.position) ? opponent : closest, undefined);
  }

  strike(opponent: TrialOpponent): void {
    if (opponent.hit(this.clock)) {
      this.opponents.splice(this.opponents.indexOf(opponent), 1);
      if (!this.remaining) this.nextWaveAt = this.clock + 1100;
    }
  }

  destroy(): void {
    for (const opponent of this.opponents) opponent.destroy();
    this.opponents.length = 0;
  }

  private spawnWave(): void {
    const health = this.waves[this.wave++];
    health.forEach((hp, index) => {
      const x = this.anchor.x + (index - (health.length - 1) / 2) * 43;
      const y = this.anchor.y + (index % 2 ? 23 : -12);
      this.opponents.push(new TrialOpponent(this.scene, x, y, hp, this.guardian, this.clock, 800 + index * 570));
    });
  }
}
