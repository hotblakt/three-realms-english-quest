import Phaser from 'phaser';
import { showSlash } from '../art/windEffects';

export class Sword {
  private readyAt = 0;

  constructor(private readonly scene: Phaser.Scene, private readonly onSwing: () => void) {}

  swing(now: number, origin: Phaser.Math.Vector2, facing: Phaser.Math.Vector2, target: Phaser.Math.Vector2): boolean {
    if (now < this.readyAt) return false;
    this.readyAt = now + 300;
    this.onSwing();
    showSlash(this.scene, origin, facing.angle());
    const offset = target.clone().subtract(origin);
    return offset.lengthSq() <= 55 ** 2 && offset.normalize().dot(facing) >= .6;
  }
}
