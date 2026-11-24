import { recommendLesson } from '../learning/lessons';
import { LearningProgress } from '../learning/LearningProgress';
import { loadLearning } from '../save/learningSave';
import Phaser from 'phaser';
import { createGeno } from '../art/actorArtwork';
import { createTrainingDummy, paintVillage, updateRoofOcclusion, villageHeight, villageWidth, type Roof } from '../art/villageArtwork';
import { drawTrialRelic, paintTrial } from '../art/trialArtwork';
import { makeObjectiveMarker } from '../art/windEffects';
import { Sword } from '../combat/Sword';
import { TrialEncounter } from '../combat/TrialEncounter';
import { Player } from '../entities/Player';
import { chineseFont, messages } from '../i18n';
import { Controls } from '../input/Controls';
import { ChapterProgress, type ChapterAction } from '../progression/ChapterProgress';
import { fragment, gate, groves, guardianSite, isGrove, trialCheckpoint, trialHeight, trialWidth, voiceStone } from '../quests/trialLayout';
import { loadChapter, saveChapter } from '../save/chapterSave';
import { SpeakingPractice } from '../ui/SpeakingPractice';

const geno = { x: 440, y: 224 };
const dummy = { x: 548, y: 270 };
const thorns = new Phaser.Geom.Rectangle(313, 350, 62, 37);

export class VillageScene extends Phaser.Scene {
  private controls!: Controls;
  private player!: Player;
  private sword!: Sword;
  private progress?: ChapterProgress;
  private speaking!: SpeakingPractice;
  private learning?: LearningProgress;
  private fight?: TrialEncounter;
  private relic?: Phaser.GameObjects.Graphics;
  private dummyArt?: Phaser.GameObjects.Graphics;
  private roofs: Roof[] = [];
  private retrying = false;
  private speakingAtStone = false;
  private openingDialogue = false;
  private readonly dialogue = document.querySelector<HTMLElement>('#dialogue')!;
  private readonly line = document.querySelector<HTMLElement>('#line')!;
  private readonly close = document.querySelector<HTMLButtonElement>('#close-dialogue')!;
  private readonly startSpeaking = document.querySelector<HTMLButtonElement>('#open-speaking')!;
  private readonly touch = document.querySelector<HTMLElement>('#controls')!;
  private readonly health = document.querySelector<HTMLElement>('#health')!;
  private readonly objective = document.querySelector<HTMLElement>('#objective')!;
  private objectiveMarker!: Phaser.GameObjects.Graphics;

  constructor() { super('village'); }

  private get chapter(): ChapterProgress { return this.progress!; }

  create(): void {
    this.learning ??= new LearningProgress(loadLearning());
    this.progress ??= new ChapterProgress(loadChapter());
    this.fight = undefined;
    this.relic = undefined;
    this.dummyArt = undefined;
    this.retrying = false;
    this.openingDialogue = false;
    this.speakingAtStone = false;
    this.dialogue.hidden = true;
    this.roofs = [];
    const trial = this.chapter.enteredTrial;
    const width = trial ? trialWidth : villageWidth;
    const height = trial ? trialHeight : villageHeight;
    const checkpoint = trial ? trialCheckpoint(this.chapter.step) : { x: 440, y: 366 };
    this.physics.world.setBounds(16, trial ? 38 : 73, width - 32, height - (trial ? 68 : 133));
    this.player = new Player(this, checkpoint.x, checkpoint.y);
    this.controls = new Controls(this.input.keyboard!);
    this.sword = new Sword(this, () => this.player.animateAttack());
    if (trial) this.buildTrial();
    else this.buildVillage();
    this.objectiveMarker = makeObjectiveMarker(this);
    this.cameras.main.setBounds(0, 0, width, height).startFollow(this.player.view, true, .16, .16, 0, 72);
    this.touch.hidden = false;
    document.querySelector<HTMLElement>('#hud')!.hidden = false;
    document.querySelector<HTMLElement>('#keyboard')!.hidden = false;
    document.querySelector<HTMLElement>('#location')!.textContent = trial ? messages.trialName : messages.hiddenBambooVillage;
    document.querySelector<HTMLButtonElement>('[data-action="interact"]')!.textContent = messages.interact;
    this.mountDialogue();
    this.updateHud();
  }

  private buildVillage(): void {
    this.roofs = paintVillage(this);
    const obstacles = this.physics.add.staticGroup();
    for (const [x, y, width, height] of [
      [247, 153, 95, 49], [628, 156, 95, 49], [geno.x, geno.y, 22, 17],
      [dummy.x, dummy.y, 18, 17], [625, 384, 36, 52], [705, 384, 36, 52],
    ]) obstacles.add(this.add.zone(x, y, width, height));
    const pond = this.add.zone(665, 384, 164, 70);
    const body = this.physics.add.existing(pond, true).body as Phaser.Physics.Arcade.StaticBody;
    body.setCircle(36, 46, 0);
    this.physics.add.collider(this.player.body, pond);
    this.physics.add.collider(this.player.body, obstacles);
    createGeno(this, geno.x, geno.y);
    this.worldLabel(geno.x, geno.y - 44, messages.elderGeno);
    this.dummyArt = createTrainingDummy(this, dummy.x, dummy.y);
    this.worldLabel(gate.x, gate.y - 27, messages.trialName);
    const brambles = this.add.graphics().setDepth(-.5);
    brambles.fillStyle(0x354d3c).fillRoundedRect(thorns.x, thorns.y, thorns.width, thorns.height, 12);
    for (let i = 0; i < 12; i++) {
      const x = thorns.x + 6 + i % 6 * 10;
      const y = thorns.y + 14 + Math.floor(i / 6) * 15;
      brambles.fillStyle(0xb96d65).fillTriangle(x - 5, y, x + 5, y, x + 1, y - 10);
    }
  }

  private buildTrial(): void {
    paintTrial(this);
    drawTrialRelic(this, voiceStone.x, voiceStone.y);
    this.worldLabel(voiceStone.x, voiceStone.y - 39, messages.voiceStone);
    if (this.chapter.step === 'fragment') this.showFragment();
    if (this.chapter.windBlade) this.placePracticeDummy();
  }

  private showFragment(): void {
    this.relic = drawTrialRelic(this, fragment.x, fragment.y);
    this.tweens.add({ targets: this.relic, y: fragment.y - 5, duration: 680, yoyo: true, repeat: -1 });
  }

  private placePracticeDummy(): void {
    this.dummyArt = createTrainingDummy(this, guardianSite.x, guardianSite.y);
  }

  private worldLabel(x: number, y: number, label: string): void {
    this.add.text(x, y, label, {
      fontFamily: chineseFont, fontSize: '16px', fontStyle: 'bold', color: '#fff2c8', stroke: '#20392c', strokeThickness: 4,
    }).setOrigin(.5).setDepth(999);
  }

  private mountDialogue(): void {
    this.speaking = new SpeakingPractice(this.learning!, completed => {
      this.touch.inert = false;
      if (this.speakingAtStone) {
        if (completed) this.advance('confirm-practice');
        return;
      }
      this.dialogue.hidden = false;
      this.startSpeaking.focus({ preventScroll: true });
    });
    const openSpeaking = () => this.openSpeech(false);
    const closeDialogue = () => this.dismissDialogue();
    this.startSpeaking.addEventListener('click', openSpeaking);
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
      this.touch.inert = false;
      this.startSpeaking.removeEventListener('click', openSpeaking);
      this.close.removeEventListener('click', closeDialogue);
    });
  }

  private openSpeech(atStone: boolean): void {
    this.speakingAtStone = atStone;
    this.dialogue.hidden = true;
    this.touch.inert = true;
    this.player.body.setVelocity(0);
    const required = atStone && this.chapter.step === 'speaking' ? 'can-run' : undefined;
    const recommended = required ?? recommendLesson(atStone ? 'stone' : 'elder', id => this.learning!.status(id) !== 'new');
    this.speaking.open(recommended, { required, returnLabel: atStone ? messages.returnToTrial : messages.backToGeno });
  }

  private showDialogue(line: string, advancesTraining = false, allowSpeech = false): void {
    this.openingDialogue = advancesTraining;
    this.startSpeaking.hidden = !allowSpeech;
    this.line.textContent = line;
    document.querySelector<HTMLElement>('#dialogue-speaker')!.textContent = allowSpeech ? messages.elderGeno : messages.windAwakening;
    this.player.body.setVelocity(0);
    this.dialogue.hidden = false;
    this.close.focus({ preventScroll: true });
  }

  private dismissDialogue(): void {
    this.dialogue.hidden = true;
    if (this.openingDialogue) this.advance('talk');
  }

  update(now: number, delta: number): void {
    this.player.syncView();
    const position = this.player.body.center;
    updateRoofOcclusion(this.roofs, position.x, position.y, delta);
    this.updateMarker();
    const interact = this.controls.consume('interact');
    const attack = this.controls.consume('attack');
    const dodge = this.controls.consume('dodge');
    if (this.speaking.visible || !this.dialogue.hidden) {
      this.player.body.setVelocity(0);
      this.player.idle();
      if (interact && !this.dialogue.hidden) this.dismissDialogue();
      return;
    }

    if (interact && this.interact(position)) return;
    const direction = this.controls.direction();
    this.player.look(direction, now);
    if (this.player.move(direction, now, dodge) && this.advance('dodge')) this.player.heal();
    if (attack) this.swing(now, position);

    if (this.fight) {
      let defeated = false;
      const wave = this.fight.waveNumber;
      this.fight.update(delta, position, () => {
        if (!defeated && this.player.damage(now) === 'defeated') defeated = true;
      });
      if (this.fight.waveNumber !== wave) this.player.heal();
      if (defeated) {
        this.fight.destroy();
        this.fight = undefined;
        this.retrying = true;
        const checkpoint = trialCheckpoint(this.chapter.step);
        this.player.body.reset(checkpoint.x, checkpoint.y);
        this.controls.reset();
      }
    } else if (!this.chapter.enteredTrial && thorns.contains(position.x, position.y)) {
      this.player.damage(now);
    }
    if (this.chapter.step === 'fragment' && this.near(position, fragment, 26)) {
      this.relic?.destroy();
      this.advance('collect');
    }
    this.updateHud();
  }

  private near(position: Phaser.Math.Vector2, target: { x: number; y: number }, radius = 62): boolean {
    return Phaser.Math.Distance.Between(position.x, position.y, target.x, target.y) <= radius;
  }

  private interact(position: Phaser.Math.Vector2): boolean {
    const step = this.chapter.step;
    if (!this.chapter.enteredTrial) {
      if (this.near(position, geno, 58)) {
        this.showDialogue(step === 'dodge' ? messages.learnDodge : step === 'enter' ? messages.enterTrial : messages.villageTraining,
          step === 'meet', true);
        return true;
      }
      if (step === 'enter' && this.near(position, gate)) {
        this.advance('enter');
        this.scene.restart();
        return true;
      }
      return false;
    }
    if (!this.fight && (step === 'speaking' || step === 'guardian' || step === 'complete') && this.near(position, voiceStone)) {
      this.openSpeech(true);
      return true;
    }
    if (!this.fight && isGrove(step) && this.near(position, groves[step])) {
      this.retrying = false;
      this.player.heal();
      this.fight = new TrialEncounter(this, groves[step], groves[step].waves);
    } else if (!this.fight && step === 'guardian' && this.near(position, guardianSite)) {
      this.retrying = false;
      this.player.heal();
      this.fight = new TrialEncounter(this, guardianSite, [[16]], true);
    } else if (step === 'complete' && this.near(position, guardianSite)) {
      this.showDialogue(messages.chapterEnding);
      return true;
    }
    return false;
  }

  private swing(now: number, position: Phaser.Math.Vector2): void {
    const target = this.fight?.target(position, this.player.facing);
    const practice = this.chapter.enteredTrial ? guardianSite : dummy;
    const aimed = target?.position ?? new Phaser.Math.Vector2(practice.x, practice.y);
    if (!this.sword.swing(now, position, this.player.facing, aimed, this.chapter.windBlade)) return;
    if (target && this.fight) {
      const fight = this.fight;
      fight.strike(target);
      if (!fight.complete) return;
      this.fight = undefined;
      this.player.heal();
      if (fight.guardian) {
        this.advance('defeat-guardian');
        this.placePracticeDummy();
        this.showDialogue(messages.chapterEnding);
      } else {
        this.advance('clear-grove');
        if (this.chapter.step === 'fragment') this.showFragment();
      }
    } else if (this.dummyArt) {
      this.tweens.killTweensOf(this.dummyArt);
      this.dummyArt.setAngle(-12);
      this.tweens.add({ targets: this.dummyArt, angle: 0, duration: 180 });
      this.advance('strike');
    }
  }

  private advance(action: ChapterAction): boolean {
    if (!this.chapter.advance(action)) return false;
    saveChapter(this.chapter.step);
    this.retrying = false;
    this.updateHud();
    return true;
  }

  private updateMarker(): void {
    const step = this.chapter.step;
    const targets = { meet: geno, slash: dummy, enter: gate, ...groves, fragment, speaking: voiceStone,
      guardian: guardianSite, dodge: undefined, complete: undefined };
    const target = targets[step];
    this.objectiveMarker.setVisible(Boolean(target) && !this.fight);
    if (!target) return;
    const camera = this.cameras.main;
    const markerY = target.y - (step === 'meet' ? 64 : step === 'slash' ? 47 : 30);
    this.objectiveMarker.setPosition(
      Phaser.Math.Clamp(target.x, camera.scrollX + 52, camera.scrollX + camera.width - 52),
      Phaser.Math.Clamp(markerY, camera.scrollY + 81, camera.scrollY + camera.height - 72),
    );
  }

  private updateHud(): void {
    const { health, maxHealth } = this.player;
    const hearts = '♥'.repeat(health) + '♡'.repeat(maxHealth - health);
    if (this.health.textContent !== hearts) {
      this.health.textContent = hearts;
      this.health.setAttribute('aria-label', messages.healthStatus(health, maxHealth));
    }
    const objectives = {
      meet: messages.meetGeno, slash: messages.strikeDummy, dodge: messages.learnDodge,
      enter: messages.enterTrial, 'lower-grove': messages.lowerGrove, 'upper-grove': messages.upperGrove,
      'east-grove': messages.eastGrove, fragment: messages.collectFragment, speaking: messages.useVoiceStone,
      guardian: messages.visitGuardian, complete: messages.chapterClear,
    };
    const fight = this.fight;
    const step = this.chapter.step;
    const base = objectives[step];
    const objective = this.retrying ? `${messages.retryHint} ${base}` : !fight ? base
      : fight.guardian ? (fight.canCounter ? messages.guardianOpen : messages.fightGuardian) : fight.remaining > 0
        ? messages.groveWave(fight.waveNumber, fight.waveCount, fight.remaining) : messages.nextWave;
    if (this.objective.textContent === objective) return;
    this.objective.textContent = objective;
    this.objective.classList.toggle('is-complete', this.chapter.windBlade);
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.objective.animate([{ backgroundColor: '#e6c68655' }, { backgroundColor: 'transparent' }], { duration: 650 });
    }
  }
}
