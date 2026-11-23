import Phaser from 'phaser';
import { showSlash } from '../art/windEffects';

export class Sword {
  private readyAt = 0;

  constructor(private readonly scene: Phaser.Scene, private readonly onSwing: () => void) {}

  swing(now: number, origin: Phaser.Math.Vector2, facing: Phaser.Math.Vector2, target: Phaser.Math.Vector2, windBlade = false): boolean {
    if (now < this.readyAt) return false;
    this.readyAt = now + 300;
    this.onSwing();
    showSlash(this.scene, origin, facing.angle(), windBlade);
    const offset = target.clone().subtract(origin);
    if (offset.lengthSq() === 0) return true;
    return offset.lengthSq() <= (windBlade ? 89 : 55) ** 2 && offset.normalize().dot(facing) >= .6;
  }
}
