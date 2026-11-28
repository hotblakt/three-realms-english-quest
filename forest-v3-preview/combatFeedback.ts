import type Phaser from 'phaser';
import type { Point } from '../src/forest-v3/domain/contracts';
import { tuning } from '../src/forest-v3/domain/tuning.ts';

export const explorationSwordInterval = tuning.swordWindup + tuning.swordActive + tuning.swordRecovery;

export class CombatFeedback {
  readonly sword: Phaser.GameObjects.Graphics;
  readonly ghosts: Phaser.GameObjects.Image[];
  private readonly wake: Phaser.GameObjects.Graphics;
  private readonly reduced = matchMedia('(prefers-reduced-motion: reduce)');
  private dodge?: { origin: Point; facing: Point; started: number; nextGhost: number };
  private swordUntil = 0;

  constructor(scene: Phaser.Scene) {
    this.sword = scene.add.graphics().setDepth(1301).setVisible(false);
    this.wake = scene.add.graphics().setDepth(1301).setVisible(false);
    this.ghosts = Array.from({ length: 3 }, () => scene.add.image(0, 0, '__DEFAULT').setVisible(false));
  }

  slash(origin: Point, facing: Point, now: number) {
    const angle = Math.atan2(facing.y, facing.x);
    const x = origin.x;
    const y = origin.y - 30;
    const arc = this.sword.clear().setVisible(true).setAlpha(1);
    arc.lineStyle(8, 0x8ae9ca, .75).beginPath().arc(x, y, 40, angle - .96, angle + .89).strokePath();
    arc.lineStyle(3, 0xfff2be, 1).beginPath().arc(x, y, 43, angle - .87, angle + .83).strokePath();
    arc.lineStyle(2, 0xb8fce4, .85).beginPath().arc(x, y, 31, angle - .9, angle + .42).strokePath();
    this.swordUntil = now + tuning.swordWindup + tuning.swordActive;
  }

  startDodge(origin: Point, facing: Point, now: number) {
    this.dodge = { origin: { x: origin.x, y: origin.y }, facing: { ...facing }, started: now, nextGhost: 0 };
  }

  clear() {
    this.swordUntil = 0;
    this.sword.setVisible(false);
    this.wake.setVisible(false);
    this.ghosts.forEach(ghost => ghost.setVisible(false));
    this.dodge = undefined;
  }

  update(avatar: Phaser.GameObjects.Image, now: number) {
    if (now >= this.swordUntil) this.sword.setVisible(false);
    else if (!this.reduced.matches) this.sword.setAlpha(Math.min(1, (this.swordUntil - now) / 65));
    const dodge = this.dodge;
    if (!dodge) return;
    const elapsed = now - dodge.started;
    if (elapsed >= 220) {
      this.wake.setVisible(false);
      for (const ghost of this.ghosts) ghost.setVisible(false);
      this.dodge = undefined;
      return;
    }
    const { x, y } = dodge.origin;
    const drift = Math.max(0, (220 - elapsed) / 220);
    const wake = this.wake.clear().setVisible(true).setAlpha(drift);
    wake.lineStyle(2, 0x9fffe2, .9).strokeEllipse(avatar.x, avatar.y - 3, 34, 12);
    if (!this.reduced.matches) {
      const normal = { x: -dodge.facing.y, y: dodge.facing.x };
      for (const offset of [-8, 8]) {
        wake.lineBetween(x + normal.x * offset, y - 7 + normal.y * offset,
          avatar.x + normal.x * offset, avatar.y - 7 + normal.y * offset);
      }
      if (dodge.nextGhost < this.ghosts.length && elapsed >= dodge.nextGhost * 48 && elapsed < tuning.dodgeDuration) {
        const ghost = this.ghosts[dodge.nextGhost++];
        ghost.setTexture(avatar.texture.key, avatar.frame.name).setOrigin(avatar.originX, avatar.originY)
          .setScale(avatar.scaleX, avatar.scaleY).setFlip(avatar.flipX, avatar.flipY)
          .setPosition(avatar.x, avatar.y).setDepth(avatar.depth - .1).setTint(0x8be9cc).setVisible(true);
      }
    }
    this.ghosts.forEach((ghost, index) => ghost.setAlpha(.28 * Math.max(0, 1 - (elapsed - index * 48) / 155))
      .setVisible(!this.reduced.matches && index < dodge.nextGhost));
  }
}
