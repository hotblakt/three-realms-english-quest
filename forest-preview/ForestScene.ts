import Phaser from 'phaser';
import { preloadEikuAtlas } from '../src/art/eikuAtlas';
import { addLanternLight, addSoftShadow } from '../src/art/villageAtmosphere';
import { makeObjectiveMarker } from '../src/art/windEffects';
import { Sword } from '../src/combat/Sword';
import { Player } from '../src/entities/Player';
import { Controls } from '../src/input/Controls';
import assetCatalog from '../docs/misty-forest-runtime-assets.json';
import { EastActions } from './eastActions';
import { AnimationClip } from './animationClip';
import { runSources } from './runSources';
import { compositionPanel, preloadComposition, showCandidate, standingHeight } from './composition';
import { chest, entrance, height, shortcut, spirit, width } from './layout';
import { drawTerrain } from './environment/terrain';
import { drawCreek } from './environment/creek';
import { drawAtmosphere, drawVegetation } from './environment/vegetation';
import { landmarks, place } from './environment/placement';

const base = import.meta.env.BASE_URL;
const font = '"PingFang TC", "Noto Sans CJK TC", "Microsoft JhengHei", sans-serif';
const intro = '沿石路走到溪邊，找木橋過溪。';

export class ForestScene extends Phaser.Scene {
  private player!: Player;
  private readonly composition = compositionPanel();
  private settings = this.composition.read();
  private readonly eastActions = new EastActions();
  private castRequested = false;
  private castKey!: Phaser.Input.Keyboard.Key;
  private footMarker!: Phaser.GameObjects.Graphics;
  private readonly anchorSetting = document.querySelector<HTMLInputElement>('#ground-anchor')!;
  private readonly runs = {
    'east-idle': new AnimationClip(runSources['east-idle'], 'eiku-run'),
    'east-cast': new AnimationClip(runSources['east-cast'], 'eiku-run'),
    framesprite: new AnimationClip(runSources.framesprite, 'eiku-run'),
    'south-run': new AnimationClip(runSources['south-run'], 'eiku-run'),
    chatgpt: new AnimationClip(runSources.chatgpt, 'eiku-run'),
    'fal-first': new AnimationClip(runSources['fal-first'], 'eiku-run'),
    'fal-second': new AnimationClip(runSources['fal-second'], 'eiku-run'),
  };
  private previousX = entrance.x;
  private previousY = entrance.y;
  private dodgeEnd = 0;
  private activeRun?: AnimationClip;
  private displayedRunFrame = 0;
  private candidate!: Phaser.GameObjects.Image;
  private originalScale = 1;
  private environmentLights: Phaser.GameObjects.Image[] = [];
  private controls!: Controls;
  private sword!: Sword;
  private obstacles!: Phaser.Physics.Arcade.StaticGroup;
  private chestArt!: Phaser.GameObjects.Image;
  private canopy: Phaser.GameObjects.Image[] = [];
  private opened = false;
  private visitedSpirit = false;
  private notice = intro;
  private readonly message = document.querySelector<HTMLElement>('#forest-message')!;

  constructor() { super('misty-forest'); }

  preload(): void {
    preloadEikuAtlas(this);
    preloadComposition(this);
    for (const key of Object.keys(assetCatalog.textures)) {
      this.load.image(key, `${base}forest-preview-textures/${key}.webp`);
    }
  }

  create(): void {
    this.physics.world.setBounds(24, 30, width - 48, height - 56);
    this.player = new Player(this, entrance.x, entrance.y);
    this.originalScale = this.player.view.scaleX;
    this.candidate = this.add.image(entrance.x, entrance.y, 'eiku-concept-south-384').setOrigin(.5, 338 / 384);
    this.obstacles = this.physics.add.staticGroup();
    this.physics.add.collider(this.player.body, this.obstacles);
    this.controls = new Controls(this.input.keyboard!);
    this.castKey = this.input.keyboard!.addKey('K');
    const castButton = document.querySelector<HTMLButtonElement>('#east-cast-button')!;
    const requestCast = () => { this.castRequested = true; };
    castButton.addEventListener('click', requestCast);
    this.footMarker = this.add.graphics().setDepth(2050).lineStyle(2, 0xffdf7f)
      .strokeCircle(0, 0, 5).lineBetween(-9, 0, 9, 0).lineBetween(0, -9, 0, 9);
    this.sword = new Sword(this, () => this.player.animateAttack());
    this.cameras.main.setBounds(0, 0, width, height);
    this.cameras.main.startFollow(this.player.view, false, .13, .13, 0, -18);
    const block = (x: number, y: number, w: number, h: number) => this.block(x, y, w, h);
    drawTerrain(this);
    drawCreek(this, block);
    this.canopy = drawVegetation(this, block);
    this.addLandmarks();
    this.environmentLights.push(...drawAtmosphere(this));
    this.environmentLights.push(...addLanternLight(this, 617, 471), ...addLanternLight(this, 737, 452));
    const reviewFrame = this.composition.panel.querySelector<HTMLSelectElement>('[name="frame"]')!;
    const replay = document.querySelector<HTMLButtonElement>('#replay-diagnostic')!;
    const replayDiagnostic = () => {
      const mode = this.composition.panel.querySelector<HTMLSelectElement>('[name="motion"]')!;
      const paused = this.composition.panel.querySelector<HTMLInputElement>('[name="paused"]')!;
      paused.checked = false;
      mode.value = 'review';
      this.activeRun = undefined;
      mode.dispatchEvent(new Event('change', { bubbles: true }));
    };
    replay.addEventListener('click', replayDiagnostic);
    const applyComposition = (event?: Event) => {
      const next = this.composition.read();
      const { resolution, speed, paused, source, candidate } = next;
      const clip = candidate && source !== 'static' ? this.runs[source] : undefined;
      const sourceChanged = source !== this.settings.source || candidate !== this.settings.candidate;
      if (sourceChanged || next.motion !== this.settings.motion) this.activeRun = undefined;
      const count = clip?.manifest.frameCount ?? 0;
      if (reviewFrame.length !== count) {
        reviewFrame.replaceChildren(...Array.from({ length: count }, (_, i) => new Option(String(i + 1))));
      }
      if (sourceChanged) reviewFrame.selectedIndex = 0;
      else if ((event?.target as HTMLInputElement | undefined)?.name === 'paused' && paused) {
        reviewFrame.selectedIndex = Math.min(count - 1, this.displayedRunFrame);
      }
      this.settings = this.composition.read();
      reviewFrame.disabled = !paused || !clip;
      replay.hidden = !(clip?.manifest.diagnostic || clip?.manifest.oneShot);
      const info = document.querySelector('#run-info')!;
      if (clip) {
        clip.ensure(this, resolution);
        const asset = clip.manifest.textures[String(resolution)];
        const warning = clip.manifest.diagnostic ? '・僅診斷，單次播放'
          : source === 'chatgpt' ? '・候選循環未通過步態驗收' : '';
        info.textContent = `${clip.manifest.frameCount} 格・${paused ? 0 : clip.manifest.fps * speed} 格／秒（設定）・${asset.width}×${asset.height}・${asset.bytes.toLocaleString('zh-TW')} bytes${warning}`;
      } else {
        info.textContent = '站姿模式・無跑步圖集';
      }
      const smooth = this.settings.smoothing && !matchMedia('(prefers-reduced-motion: reduce)').matches;
      this.cameras.main.setZoom(this.settings.zoom).setLerp(smooth ? .13 : 1);
      this.player.view.setVisible(!this.settings.candidate).setScale(this.originalScale * this.settings.size / 100);
      this.candidate.setVisible(this.settings.candidate);
      this.player.setContactShadowVisible(this.settings.shadow);
      this.environmentLights.forEach(light => light.setVisible(this.settings.light));
    };
    this.composition.panel.addEventListener('change', applyComposition);
    applyComposition();
    const onPause = () => {
      this.controls.reset();
      this.eastActions.clear();
      this.castRequested = false;
      this.player.body.stop();
    };
    this.game.events.on(Phaser.Core.Events.PAUSE, onPause);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off(Phaser.Core.Events.PAUSE, onPause);
      this.controls.destroy();
      castButton.removeEventListener('click', requestCast);
      replay.removeEventListener('click', replayDiagnostic);
      this.composition.panel.removeEventListener('change', applyComposition);
    });
  }

  private block(x: number, y: number, w: number, h: number): void {
    const obstacle = this.obstacles.create(x, y, 'ground') as Phaser.Types.Physics.Arcade.ImageWithStaticBody;
    obstacle.setVisible(false);
    obstacle.body.setSize(w, h, true);
  }

  private addLandmarks(): void {
    this.chestArt = place(this, landmarks.chest);
    addSoftShadow(this, chest.x, chest.y, 63, 23);
    this.block(chest.x, chest.y - 6, 36, 16);
    const { x: gateX, y: gateY } = landmarks.gate;
    const gate = place(this, landmarks.gate);
    this.canopy.push(gate);
    for (const side of [-1, 1]) {
      const postX = gateX + side * 40;
      this.block(postX, gateY - 1, 17, 19);
      this.block(gateX + side * 78, gateY + 3, 22, 20);
      this.environmentLights.push(...addLanternLight(this, gateX + side * 78, gateY - 23));
    }
    const sign = this.add.text(shortcut.x, shortcut.y - 17, '回入口', {
      fontFamily: font, fontSize: '14px', color: '#ffe9b4', backgroundColor: '#1b362d',
      padding: { x: 7, y: 4 },
    }).setOrigin(.5, 1).setDepth(shortcut.y + 1);
    addSoftShadow(this, sign.x, shortcut.y, 60, 18);
    const marker = makeObjectiveMarker(this);
    marker.setPosition(shortcut.x, shortcut.y - 11).setDepth(shortcut.y + 1);
    place(this, landmarks.shrine).setDepth(-2);
    makeObjectiveMarker(this).setPosition(spirit.x, spirit.y - 13).setDepth(spirit.y);
  }

  update(now: number, delta: number): void {
    const direction = this.controls.direction();
    this.player.look(direction, now);
    if (this.player.move(direction, now, this.controls.consume('dodge'))) {
      this.dodgeEnd = now + 160;
      this.eastActions.start('dash', now);
    }
    this.player.syncView();
    const { x, y } = this.player.body.center;
    if (this.controls.consume('attack')
      && this.sword.swing(now, this.player.body.center, this.player.facing, this.player.body.center)) {
      this.eastActions.start('attack', now);
    }
    const autoEast = this.settings.candidate && this.settings.source === 'framesprite'
      && this.settings.motion !== 'review' && !this.settings.paused && this.player.facing.x > 0;
    const castKeyPressed = Phaser.Input.Keyboard.JustDown(this.castKey);
    this.castRequested ||= castKeyPressed;
    if (!autoEast || direction.lengthSq()) {
      this.castRequested = false;
      if (this.eastActions.current(now)?.name === 'cast') this.eastActions.clear();
    }
    if (this.castRequested && this.runs['east-cast'].ensure(this, this.settings.resolution)) {
      this.eastActions.start('cast', now);
      this.castRequested = false;
    }
    if (autoEast && this.eastActions.releaseCast(now)) {
      const spark = this.add.circle(x + 31, y - 43, 6, 0x9cebd6, .7).setDepth(y + 1);
      this.tweens.add({ targets: spark, x: x + 63, scale: 2, alpha: 0, duration: 240,
        onComplete: () => spark.destroy() });
    }
    if (this.settings.candidate) {
      const eastDistance = x - this.previousX;
      const southDistance = y - this.previousY;
      const movingEast = this.player.facing.x > 0 && direction.x > 0 && eastDistance > 0 && now >= this.dodgeEnd;
      const { motion, paused, speed, frame, resolution, size, source } = this.settings;
      const movingSouth = this.player.facing.y > 0 && direction.y > 0 && southDistance > 0 && now >= this.dodgeEnd;
      const automaticSouth = source === 'framesprite' && motion !== 'review' && !paused && movingSouth;
      const action = this.eastActions.current(now);
      const eastCast = autoEast && action?.name === 'cast' ? action : undefined;
      const eastIdle = autoEast && !action && !movingEast && !direction.lengthSq();
      const active = eastCast ? 'east-cast' : eastIdle ? 'east-idle' : automaticSouth ? 'south-run' : source;
      const moving = active === 'south-run' ? movingSouth : movingEast;
      const requestedClip = active !== 'static' && (paused || motion === 'review' || moving || eastIdle || eastCast)
        ? this.runs[active] : undefined;
      const clip = requestedClip?.ensure(this, resolution) ? requestedClip : undefined;
      if (clip) {
        if (clip !== this.activeRun) clip.reset(motion === 'review' || active !== 'framesprite' ? 0 : 1);
        // Use distance travelled so contact with a wall naturally stops the run loop.
        const distance = active === 'south-run' ? southDistance : eastDistance;
        const seconds = motion === 'review' || eastIdle ? delta / 1000 : distance / clip.manifest.referenceSpeed;
        const index = eastCast ? Math.min(clip.manifest.frameCount - 1, Math.floor((now - eastCast.start) * .01))
          : paused ? frame : clip.advance(Math.max(0, Math.min(seconds, .05)), speed);
        this.displayedRunFrame = index;
        if (clip.finished && !paused && motion !== 'review') {
          showCandidate(this, this.candidate, this.player.facing, this.settings);
        } else {
          clip.draw(this.candidate, resolution, index, standingHeight * size / 100);
        }
      } else {
        showCandidate(this, this.candidate, this.player.facing, this.settings);
      }
      this.activeRun = clip;
    } else {
      this.activeRun = undefined;
    }
    this.previousX = x;
    this.previousY = y;
    this.candidate.setPosition(x, y).setDepth(y).setAlpha(this.player.view.alpha);
    this.footMarker.setPosition(x, y).setVisible(this.anchorSetting.checked);
    for (const canopy of this.canopy) {
      const visibilityRadius = canopy.displayWidth * .42;
      const overlap = Math.abs(x - canopy.x);
      const behind = y < canopy.y && y > canopy.y - canopy.displayHeight * canopy.originY;
      const fade = behind ? Math.max(0, Math.min(1, (visibilityRadius - overlap) / 31)) : 0;
      canopy.setAlpha(1 - fade * .75);
    }
    const interact = this.controls.consume('interact');
    const near = (point: { x: number; y: number }) => Phaser.Math.Distance.Between(x, y, point.x, point.y) < 53;
    let hint = this.notice;
    if (near(chest) && !this.opened) {
      hint = '發現寶箱！按「互動」打開。';
      if (interact) {
        this.opened = true;
        this.chestArt.setTexture('chest-open');
        this.notice = hint = '找到林間寶藏了！';
      }
    } else if (near(spirit)) {
      hint = this.visitedSpirit ? '微風帶來一陣小小的腳步聲。' : '霧裡有動靜，按「互動」查看。';
      if (interact) {
        this.visitedSpirit = true;
        this.notice = hint = '微風帶來一陣小小的腳步聲。';
      }
    } else if (near(shortcut)) {
      hint = '按「互動」，沿林間捷徑回到入口。';
      if (interact) {
        this.player.body.reset(entrance.x, entrance.y);
        this.player.syncView();
        this.notice = hint = '已回到南邊入口。';
      }
    } else if (this.notice === intro && x > 741 && y < 510) {
      this.notice = hint = '循著燈火往北，看看鳥居後方。';
    }
    if (this.message.textContent !== hint) this.message.textContent = hint;
  }
}
