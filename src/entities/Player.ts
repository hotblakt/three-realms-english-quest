import Phaser from 'phaser';
import { animateEiku, createEiku } from '../art/actorArtwork';
import { showDodge } from '../art/windEffects';

export class Player {
  readonly maxHealth = 5;
  health = this.maxHealth;
  readonly facing = new Phaser.Math.Vector2(0, 1);
  private dodgeUntil = 0;
  private dodgeReady = 0;
  private damageReady = 0;
  private readonly dodgeDirection = new Phaser.Math.Vector2();
  readonly view;
  readonly body;

  constructor(private readonly scene: Phaser.Scene, readonly spawnX: number, readonly spawnY: number) {
    this.view = createEiku(scene, spawnX, spawnY);
    this.body = scene.physics.add.existing(scene.add.zone(spawnX, spawnY, 18, 16)).body as Phaser.Physics.Arcade.Body;
    this.body.setCollideWorldBounds(true);
  }

  look(direction: Phaser.Math.Vector2, now: number): void {
    if (direction.lengthSq() && now >= this.dodgeUntil) this.facing.copy(direction);
  }

  move(direction: Phaser.Math.Vector2, now: number, dodge: boolean): void {
    if (dodge && now >= this.dodgeReady) {
      this.dodgeDirection.copy(this.facing);
      this.dodgeUntil = now + 160;
      this.dodgeReady = now + 550;
      showDodge(this.scene, this.view, this.dodgeDirection);
    }
    const dodging = now < this.dodgeUntil;
    const velocity = dodging ? this.dodgeDirection : direction;
    const speed = dodging ? 310 : 123;
    this.body.setVelocity(velocity.x * speed, velocity.y * speed);
    animateEiku(this.view, this.facing, dodging ? 'dodge' : velocity.lengthSq() ? 'walk' : 'idle');
    this.view.alpha = dodging ? .75 : now < this.damageReady && Math.floor(now / 90) % 2 ? .45 : 1;
  }

  idle(): void {
    animateEiku(this.view, this.facing, 'idle');
  }

  damage(now: number): boolean {
    if (now < this.damageReady || now < this.dodgeUntil) return false;
    this.health--;
    this.damageReady = now + 950;
    if (this.health === 0) {
      this.body.reset(this.spawnX, this.spawnY);
      this.health = this.maxHealth;
    }
    return true;
  }

  syncView(): void {
    const { x, y } = this.body.center;
    this.view.setPosition(x, y).setDepth(y);
  }
}
