import Phaser from 'phaser';
import { Sword } from '../combat/Sword';
import { Player } from '../entities/Player';
import { drawActor } from '../entities/VillageActor';
import { Controls } from '../input/Controls';
import { TrainingProgress } from '../progression/TrainingProgress';
import { loadTraining, saveTraining } from '../save/trainingSave';
import { paintVillage, villageHeight, villageWidth } from './villageArt';

export class VillageScene extends Phaser.Scene {
  private controls!: Controls;
  private player!: Player;
  private sword!: Sword;
  private progress!: TrainingProgress;
  private readonly geno = new Phaser.Math.Vector2(440, 224);
  private readonly dummy = new Phaser.Math.Vector2(548, 270);
  private readonly thorns = new Phaser.Geom.Rectangle(313, 350, 62, 37);
  private readonly dialogue = document.querySelector<HTMLElement>('#dialogue')!;
  private readonly close = document.querySelector<HTMLButtonElement>('#close-dialogue')!;
  private readonly health = document.querySelector<HTMLElement>('#health')!;
  private readonly objective = document.querySelector<HTMLElement>('#objective')!;
  private dummyArt!: Phaser.GameObjects.Graphics;

  constructor() {
    super('village');
  }

  create(): void {
    paintVillage(this);
    this.physics.world.setBounds(16, 73, villageWidth - 32, villageHeight - 133);
    this.player = new Player(this, 440, 366);
    this.controls = new Controls(this.input.keyboard!);
    this.sword = new Sword(this);
    this.progress = new TrainingProgress(loadTraining());
    const obstacles = this.physics.add.staticGroup();
    const addObstacle = (x: number, y: number, width: number, height: number) => {
      obstacles.add(this.add.zone(x, y, width, height));
    };
    addObstacle(247, 153, 95, 49);
    addObstacle(628, 156, 95, 49);
    addObstacle(this.geno.x, this.geno.y, 22, 17);
    addObstacle(this.dummy.x, this.dummy.y, 18, 17);
    const pond = this.add.zone(665, 384, 164, 70);
    const pondBody = this.physics.add.existing(pond, true).body as Phaser.Physics.Arcade.StaticBody;
    pondBody.setCircle(36, 46, 0);
    for (const x of [625, 705]) addObstacle(x, 384, 36, 52);
    this.physics.add.collider(this.player.body, pond);
    this.physics.add.collider(this.player.body, obstacles);
    drawActor(this, this.geno.x, this.geno.y, true);
    this.add.text(this.geno.x, this.geno.y - 44, 'Elder Geno', {
      fontFamily: 'system-ui', fontSize: '13px', color: '#fff2c8', stroke: '#20392c', strokeThickness: 4,
    }).setOrigin(.5).setDepth(999);
    this.dummyArt = this.add.graphics({ x: this.dummy.x, y: this.dummy.y }).setDepth(this.dummy.y);
    this.dummyArt.fillStyle(0x364936, .6).fillEllipse(0, 5, 25, 10);
    this.dummyArt.fillStyle(0x70513e).fillRect(-3, -18, 6, 24);
    this.dummyArt.fillStyle(0xe4b66d).fillRoundedRect(-9, -29, 18, 22, 6);
    this.dummyArt.lineStyle(3, 0x98654f).lineBetween(-8, -15, 8, -15);
    const thornArt = this.add.graphics().setDepth(-.5);
    thornArt.fillStyle(0x354d3c).fillRoundedRect(this.thorns.x, this.thorns.y, this.thorns.width, this.thorns.height, 12);
    for (let i = 0; i < 12; i++) {
      const x = this.thorns.x + 6 + i % 6 * 10;
      const y = this.thorns.y + 14 + Math.floor(i / 6) * 15;
      thornArt.fillStyle(0xb96d65).fillTriangle(x - 5, y, x + 5, y, x + 1, y - 10);
    }
    const camera = this.cameras.main;
    camera.setBounds(0, 0, villageWidth, villageHeight).startFollow(this.player.view, true, .16, .16);
    for (const selector of ['#hud', '#controls', '#keyboard']) {
      document.querySelector<HTMLElement>(selector)!.hidden = false;
    }
    this.updateHud();
    const closeDialogue = () => this.dismissDialogue();
    this.close.addEventListener('click', closeDialogue);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.controls.destroy();
      this.close.removeEventListener('click', closeDialogue);
    });
  }

  update(now: number): void {
    this.player.syncView();
    const interact = this.controls.consume('interact');
    const attack = this.controls.consume('attack');
    const dodge = this.controls.consume('dodge');
    const position = this.player.body.center;
    if (!this.dialogue.hidden) {
      this.player.body.setVelocity(0);
      if (interact) this.dismissDialogue();
      return;
    }
    if (interact && position.distance(this.geno) <= 58) {
      this.player.body.setVelocity(0);
      document.querySelector<HTMLElement>('#line')!.textContent =
        'Eiku, breathe with the wind. When you are ready, practice your slash on the straw dummy east of here.';
      this.dialogue.hidden = false;
      this.close.focus({ preventScroll: true });
      return;
    }
    const direction = this.controls.direction();
    this.player.look(direction, now);
    this.player.move(direction, now, dodge);
    if (attack && this.sword.swing(now, position, this.player.facing, this.dummy)) {
      this.tweens.killTweensOf(this.dummyArt);
      this.dummyArt.setAngle(-12);
      this.tweens.add({ targets: this.dummyArt, angle: 0, duration: 180 });
      this.progress.strikeDummy();
      saveTraining(this.progress.step);
      this.updateHud();
    }
    if (this.thorns.contains(position.x, position.y) && this.player.damage(now)) this.updateHud();
  }

  private dismissDialogue(): void {
    this.dialogue.hidden = true;
    this.progress.meetGeno();
    saveTraining(this.progress.step);
    this.updateHud();
  }

  private updateHud(): void {
    const { health, maxHealth } = this.player;
    this.health.textContent = '♥'.repeat(health) + '♡'.repeat(maxHealth - health);
    this.health.setAttribute('aria-label', `Health ${health} of ${maxHealth}`);
    this.objective.textContent = this.progress.objective;
  }
}
