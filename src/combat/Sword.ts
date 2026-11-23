import Phaser from 'phaser';

export class Sword {
  private readyAt = 0;

  constructor(private readonly scene: Phaser.Scene) {}

  swing(now: number, origin: Phaser.Math.Vector2, facing: Phaser.Math.Vector2, target: Phaser.Math.Vector2): boolean {
    if (now < this.readyAt) return false;
    this.readyAt = now + 300;
    const angle = facing.angle();
    const arc = this.scene.add.graphics({ x: origin.x, y: origin.y - 6 }).setDepth(2000);
    arc.lineStyle(6, 0xffe7a7, .95).beginPath().arc(0, 0, 33, angle - .85, angle + .85).strokePath();
    arc.lineStyle(2, 0xfcfff1).beginPath().arc(0, 0, 39, angle - .7, angle + .7).strokePath();
    this.scene.tweens.add({ targets: arc, alpha: 0, duration: 165, onComplete: () => arc.destroy() });
    const offset = target.clone().subtract(origin);
    return offset.lengthSq() <= 55 ** 2 && offset.normalize().dot(facing) >= .6;
  }
}
