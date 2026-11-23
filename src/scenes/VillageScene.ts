import Phaser from 'phaser';
import { createGeno } from '../art/actorArtwork';
import { createTrainingDummy, paintVillage, villageHeight, villageWidth } from '../art/villageArtwork';
import { makeObjectiveMarker } from '../art/windEffects';
import { Sword } from '../combat/Sword';
import { Player } from '../entities/Player';
import { chineseFont, messages } from '../i18n';
import { Controls } from '../input/Controls';
import { TrainingProgress } from '../progression/TrainingProgress';
import { loadTraining, saveTraining } from '../save/trainingSave';
import { SpeakingPractice } from '../ui/SpeakingPractice';

export class VillageScene extends Phaser.Scene {
  private controls!: Controls;
  private player!: Player;
  private sword!: Sword;
  private progress!: TrainingProgress;
  private speaking!: SpeakingPractice;
  private readonly geno = new Phaser.Math.Vector2(440, 224);
  private readonly dummy = new Phaser.Math.Vector2(548, 270);
  private readonly thorns = new Phaser.Geom.Rectangle(313, 350, 62, 37);
  private readonly dialogue = document.querySelector<HTMLElement>('#dialogue')!;
  private readonly close = document.querySelector<HTMLButtonElement>('#close-dialogue')!;
  private readonly health = document.querySelector<HTMLElement>('#health')!;
  private readonly objective = document.querySelector<HTMLElement>('#objective')!;
  private dummyArt!: Phaser.GameObjects.Graphics;
  private objectiveMarker!: Phaser.GameObjects.Graphics;

  constructor() {
    super('village');
  }

  create(): void {
    paintVillage(this);
    this.physics.world.setBounds(16, 73, villageWidth - 32, villageHeight - 133);
    this.player = new Player(this, 440, 366);
    this.controls = new Controls(this.input.keyboard!);
    this.sword = new Sword(this, () => this.player.animateAttack());
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
    createGeno(this, this.geno.x, this.geno.y);
    this.add.text(this.geno.x, this.geno.y - 44, messages.elderGeno, {
      fontFamily: chineseFont, fontSize: '17px', fontStyle: 'bold', color: '#fff2c8', stroke: '#20392c', strokeThickness: 4,
    }).setOrigin(.5).setDepth(999);
    this.dummyArt = createTrainingDummy(this, this.dummy.x, this.dummy.y);
    this.objectiveMarker = makeObjectiveMarker(this);
    const thornArt = this.add.graphics().setDepth(-.5);
    thornArt.fillStyle(0x354d3c).fillRoundedRect(this.thorns.x, this.thorns.y, this.thorns.width, this.thorns.height, 12);
    for (let i = 0; i < 12; i++) {
      const x = this.thorns.x + 6 + i % 6 * 10;
      const y = this.thorns.y + 14 + Math.floor(i / 6) * 15;
      thornArt.fillStyle(0xb96d65).fillTriangle(x - 5, y, x + 5, y, x + 1, y - 10);
    }
    const camera = this.cameras.main;
    camera.setBounds(0, 0, villageWidth, villageHeight).startFollow(this.player.view, true, .16, .16, 0, 72);
    for (const selector of ['#hud', '#controls', '#keyboard']) {
      document.querySelector<HTMLElement>(selector)!.hidden = false;
    }
    this.updateHud();
    const startSpeaking = document.querySelector<HTMLButtonElement>('#open-speaking')!;
    const touchControls = document.querySelector<HTMLElement>('#controls')!;
    this.speaking = new SpeakingPractice(() => {
      touchControls.inert = false;
      this.dialogue.hidden = false;
      startSpeaking.focus({ preventScroll: true });
    });
    const openSpeaking = () => {
      this.dialogue.hidden = true;
      touchControls.inert = true;
      this.speaking.open();
    };
    startSpeaking.addEventListener('click', openSpeaking);
    const closeDialogue = () => this.dismissDialogue();
    this.close.addEventListener('click', closeDialogue);
    const pauseForRotation = () => {
      this.controls.reset();
      this.player.body.setVelocity(0);
      this.speaking.suspend();
    };
    this.game.events.on(Phaser.Core.Events.PAUSE, pauseForRotation);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off(Phaser.Core.Events.PAUSE, pauseForRotation);
      this.controls.destroy();
      this.speaking.destroy();
      touchControls.inert = false;
      startSpeaking.removeEventListener('click', openSpeaking);
      this.close.removeEventListener('click', closeDialogue);
    });
  }

  update(now: number): void {
    this.player.syncView();
    const interact = this.controls.consume('interact');
    const attack = this.controls.consume('attack');
    const dodge = this.controls.consume('dodge');
    const position = this.player.body.center;
    if (this.speaking.visible) {
      this.player.body.setVelocity(0);
      this.player.idle();
      return;
    }
    if (!this.dialogue.hidden) {
      this.player.body.setVelocity(0);
      this.player.idle();
      if (interact) this.dismissDialogue();
      return;
    }
    if (interact && position.distance(this.geno) <= 58) {
      this.player.body.setVelocity(0);
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
    this.health.setAttribute('aria-label', messages.healthStatus(health, maxHealth));
    const findingGeno = this.progress.step === 'meet-geno';
    const target = findingGeno ? this.geno : this.dummy;
    const complete = this.progress.step === 'complete';
    this.objectiveMarker.setPosition(target.x, target.y - (findingGeno ? 64 : 47)).setVisible(!complete);
    const objective = this.progress.objective;
    if (this.objective.textContent === objective) return;
    this.objective.textContent = objective;
    this.objective.classList.toggle('is-complete', complete);
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.objective.animate([{ backgroundColor: '#e6c68655' }, { backgroundColor: 'transparent' }], { duration: 900 });
    }
  }
}
