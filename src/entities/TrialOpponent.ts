import Phaser from 'phaser';
import { addSoftShadow } from '../art/villageAtmosphere';
import { inAttackArea, type AttackArea } from '../combat/trialRules';

type Phase = 'approach' | 'windup' | 'recover';

export class TrialOpponent {
  readonly position: Phaser.Math.Vector2;
  private readonly art;
  private readonly shadow;
  private readonly telegraph;
  private readonly bar;
  private phase: Phase = 'approach';
  private deadline = 0;
  private nextAttack: number;
  private area?: AttackArea;
  private attackCount = 0;
  private flashUntil = 0;
  private health: number;

  constructor(
    scene: Phaser.Scene, x: number, y: number, private readonly maxHealth: number,
    private readonly guardian: boolean, start: number, stagger: number,
  ) {
    this.position = new Phaser.Math.Vector2(x, y);
    this.health = maxHealth;
    this.nextAttack = start + stagger;
    this.shadow = addSoftShadow(scene, x, y + 3, guardian ? 60 : 28, guardian ? 23 : 12);
    this.telegraph = scene.add.graphics().setDepth(-.25);
    this.art = scene.add.graphics({ x, y });
    this.bar = scene.add.graphics({ x, y }).setDepth(850);
    this.draw(start);
  }

  get vulnerable(): boolean { return this.phase === 'recover'; }

  update(now: number, delta: number, player: Phaser.Math.Vector2, others: TrialOpponent[]): boolean {
    let struck = false;
    if (this.phase === 'windup' && now >= this.deadline) {
      struck = Boolean(this.area && inAttackArea(this.area, player));
      this.telegraph.clear();
      this.phase = 'recover';
      this.deadline = now + (this.guardian ? 2150 : 1020);
    } else if (this.phase === 'recover' && now >= this.deadline) {
      this.phase = 'approach';
      this.nextAttack = now + (this.guardian ? 420 : 650);
    }

    if (this.phase === 'approach') {
      const offset = player.clone().subtract(this.position);
      const reach = this.guardian ? 79 : 47;
      const anotherWarning = others.some(other => other !== this && other.phase === 'windup');
      if (offset.length() <= reach && now >= this.nextAttack && !anotherWarning) {
        this.startAttack(now, player, offset.angle());
      } else if (offset.length() > reach - 9) {
        offset.normalize();
        for (const other of others) {
          if (other === this) continue;
          const away = this.position.clone().subtract(other.position);
          if (away.lengthSq() > 0 && away.lengthSq() < 31 ** 2) offset.add(away.normalize().scale(.68));
        }
        const speed = this.guardian ? 63 : 46;
        this.position.add(offset.limit(1).scale(speed * delta / 1000));
      }
    }
    this.draw(now);
    return struck;
  }

  hit(now: number): boolean {
    if (this.guardian && this.phase !== 'recover') return false;
    this.health -= this.guardian ? 2 : 1;
    this.flashUntil = now + 115;
    if (this.health > 0) return false;
    this.destroy();
    return true;
  }

  private startAttack(now: number, player: Phaser.Math.Vector2, angle: number): void {
    this.phase = 'windup';
    this.deadline = now + (this.guardian ? 1550 : 1100);
    const lane = this.guardian && this.attackCount++ % 2 === 1;
    this.telegraph.clear().setPosition(0, 0).setRotation(0);
    this.telegraph.fillStyle(0xefab62, .28).lineStyle(2, 0xffd39a, .95);
    if (lane) {
      const { x, y } = this.position;
      this.area = { kind: 'lane', x, y, angle, width: 34, length: 171 };
      this.telegraph.setPosition(x, y).setRotation(angle).fillRect(0, -17, 171, 34).strokeRect(0, -17, 171, 34);
    } else {
      const { x, y } = player;
      const radius = this.guardian ? 37 : 29;
      this.area = { kind: 'circle', x, y, radius };
      this.telegraph.fillCircle(x, y, radius).strokeCircle(x, y, radius);
    }
  }

  private draw(now: number): void {
    const { x, y } = this.position;
    const scale = this.guardian ? 1.85 : 1;
    const lift = Math.sin(now / 190 + x / 40) * 1.6;
    const glow = now < this.flashUntil ? 0xfff2d1 : this.phase === 'windup' ? 0xfac582 : 0xa9dfbe;
    this.shadow.setPosition(x, y + 3);
    this.art.setPosition(x, y + lift).setDepth(y).setScale(scale).clear();
    this.art.fillStyle(0x253b43).fillEllipse(0, -11, 37, 27);
    this.art.fillStyle(this.guardian ? 0x487c89 : 0x549875).fillPoints([
      { x: -18, y: -11 }, { x: -14, y: -27 }, { x: 0, y: -32 },
      { x: 14, y: -26 }, { x: 18, y: -11 }, { x: 0, y: 1 },
    ], true);
    this.art.fillStyle(glow).fillCircle(-5, -17, 2.5).fillCircle(5, -17, 2.5);
    this.art.lineStyle(2, glow, .86).lineBetween(-15, -12, 0, -4).lineBetween(0, -4, 14, -12);
    if (now < this.flashUntil) this.art.lineStyle(3, 0xffedbe, .9).strokeEllipse(0, -15, 39, 33);
    const width = this.guardian ? 73 : 32;
    this.bar.setPosition(x, y - (this.guardian ? 69 : 41)).clear();
    this.bar.fillStyle(0x182c27, .95).fillRoundedRect(-width / 2, -2, width, 6, 2);
    this.bar.fillStyle(this.phase === 'recover' ? 0x9ee6c2 : 0xedb989).fillRect(-width / 2 + 1, -1, (width - 2) * this.health / this.maxHealth, 4);
  }

  destroy(): void {
    this.art.destroy();
    this.bar.destroy();
    this.shadow.destroy();
    this.telegraph.destroy();
  }
}
