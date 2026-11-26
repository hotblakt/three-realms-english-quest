import Phaser from 'phaser';
import { preloadEikuAtlas } from '../src/art/eikuAtlas';
import { addBreeze, addLanternLight, addSoftShadow } from '../src/art/villageAtmosphere';
import { makeObjectiveMarker } from '../src/art/windEffects';
import { Sword } from '../src/combat/Sword';
import { Player } from '../src/entities/Player';
import { Controls } from '../src/input/Controls';
import assetCatalog from '../docs/misty-forest-runtime-assets.json';
import { EastActions } from './eastActions';
import { AnimationClip } from './animationClip';
import { runSources } from './runSources';
import { compositionPanel, preloadComposition, showCandidate, standingHeight } from './composition';
import { bridge, chest, entrance, height, props, routes, shortcut, spirit, streamCenter, waterWalls, width } from './layout';

type ForestTexture = keyof typeof assetCatalog.textures;
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
    this.drawGround();
    this.drawStream();
    this.drawProps();
    this.addLandmarks();
    this.addAtmosphere();
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

  private image(key: ForestTexture, x: number, y: number, scale = 1, depth = y) {
    const [originX, originY] = assetCatalog.textures[key].origin;
    return this.add.image(x, y, key).setOrigin(originX, originY).setScale(scale).setDepth(depth);
  }

  private block(x: number, y: number, w: number, h: number): void {
    const obstacle = this.obstacles.create(x, y, 'ground') as Phaser.Types.Physics.Arcade.ImageWithStaticBody;
    obstacle.setVisible(false);
    obstacle.body.setSize(w, h, true);
  }

  private drawGround(): void {
    this.add.tileSprite(0, 0, width, height, 'ground').setOrigin(0).setDepth(-10).setTint(0x9aaa92);
    const paths = this.add.graphics().setDepth(-9);
    for (const [index, route] of routes.entries()) {
      const points = route.map(([x, y]) => ({ x, y }));
      const wide = index === 0 ? 83 : 57;
      paths.lineStyle(wide, 0x314733, .45).strokePoints(points);
      paths.lineStyle(wide - 17, 0x807953, .43).strokePoints(points);
      paths.lineStyle(wide - 34, 0xa1946c, .19).strokePoints(points);
    }
    const stonePatches = [
      [477, 759, .55, -24], [502, 653, .57, -16], [546, 552, .61, 1],
      [593, 488, .53, 5], [606, 464, .39, -22], [748, 444, .42, -24], [789, 406, .52, -7], [839, 321, .55, -4],
      [878, 226, .61, -9], [914, 155, .45, 0], [405, 556, .44, 46],
      [286, 500, .46, 45], [222, 439, .42, 48], [1008, 287, .48, 10],
    ];
    for (const [x, y, scale, angle] of stonePatches) {
      this.image('stone', x, y, scale, -8).setAngle(angle).setAlpha(.94).setTint(0xc8c5ab);
    }
  }

  private drawStream(): void {
    const creek = this.add.graphics().setDepth(-5);
    const edges = Array.from({ length: 47 }, (_, index) => {
      const y = index * 20;
      return { y, x: streamCenter(y) + Math.sin(y * .028) * 6 };
    });
    for (const [radius, color, alpha] of [[63, 0x2c4537, .7], [51, 0x4b5d46, 1], [40, 0x355f58, 1], [28, 0x285951, .8]]) {
      creek.fillStyle(color, alpha).fillPoints([
        ...edges.map(({ x, y }) => ({ x: x - radius, y })),
        ...edges.slice().reverse().map(({ x, y }) => ({ x: x + radius, y })),
      ], true);
    }
    this.textureStream(edges);
    for (const { from, to } of waterWalls) {
      for (let y = from; y < to; y += 22) {
        const h = Math.min(22, to - y);
        this.block(streamCenter(y + h / 2), y + h / 2, 75, h + 1);
      }
    }
    this.image('bridge', bridge.x, bridge.y, .84, -3).setTint(0xcbd5b9);
    this.addRipples();
  }

  private textureStream(edges: { x: number; y: number }[]): void {
    const left = Math.floor(Math.min(...edges.map(({ x }) => x))) - 45;
    const right = Math.ceil(Math.max(...edges.map(({ x }) => x))) + 45;
    const bed = this.textures.createCanvas('forest-stream-bed', right - left, height)!;
    const ctx = bed.context;
    const tile = this.textures.get('water').getSourceImage() as HTMLImageElement;
    const pattern = ctx.createPattern(tile, 'repeat');
    if (!pattern) return;
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, right - left, height);
    ctx.globalCompositeOperation = 'destination-in';
    // Accumulate opacity toward the center, keeping the banks dark and soft.
    const centerline = new Path2D();
    edges.forEach(({ x, y }, index) => {
      if (index === 0) centerline.moveTo(x - left, y);
      else centerline.lineTo(x - left, y);
    });
    const mask = document.createElement('canvas');
    mask.width = right - left;
    mask.height = height;
    const maskCtx = mask.getContext('2d')!;
    maskCtx.lineJoin = 'round';
    for (const [lineWidth, alpha] of [[79, .24], [69, .35], [58, .63]]) {
      maskCtx.lineWidth = lineWidth;
      maskCtx.globalAlpha = alpha;
      maskCtx.stroke(centerline);
    }
    ctx.drawImage(mask, 0, 0);
    bed.refresh();
    this.add.image(left, 0, 'forest-stream-bed').setOrigin(0).setDepth(-4.8).setTint(0x90b4aa);
  }

  private addRipples(): void {
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const streak = this.make.graphics({ x: 0, y: 0 }, false);
    streak.lineStyle(1, 0xafdec3, .65).lineBetween(5, 1, 1, 17);
    streak.lineStyle(1, 0xd0ead0, .3).lineBetween(9, 5, 7, 12);
    streak.generateTexture('forest-ripple', 11, 19);
    streak.destroy();
    for (let index = 0; index < 24; index++) {
      const y = 16 + index * 37;
      if (Math.abs(y - bridge.y) < 105) continue;
      const x = streamCenter(y) + (index * 13 % 35) - 17;
      const ripple = this.add.image(x, y, 'forest-ripple').setDepth(-4)
        .setAlpha(.28 + index % 3 * .09).setScale(.7 + index % 4 * .13);
      if (!reduce) {
        this.tweens.add({
          targets: ripple, x: x + streamCenter(y + 15) - streamCenter(y),
          y: y + 15, alpha: .1, duration: 1900 + index % 5 * 280,
          yoyo: true, repeat: -1, ease: 'Sine.inOut',
        });
      }
    }
  }

  private drawProps(): void {
    for (const [index, [x, y, scale, key]] of props.entries()) {
      const object = this.image(key, x, y, scale);
      object.setFlipX(index % 3 === 0).setTint(index % 4 ? 0xb9c8a0 : 0x9eb69f);
      const bamboo = key === 'dense' || key === 'sparse';
      const rock = key.startsWith('rock-');
      addSoftShadow(this, x, y, (bamboo ? 103 : 73) * scale, 25 * scale, .57);
      if (bamboo) {
        this.canopy.push(object);
        this.block(x, y - 2, 36 * scale, 17 * scale);
      } else if (rock) {
        this.block(x, y - 8, object.displayWidth * .58, 21 * scale);
      }
    }
  }

  private addLandmarks(): void {
    this.chestArt = this.image('chest-closed', chest.x, chest.y, .62);
    addSoftShadow(this, chest.x, chest.y, 63, 23);
    this.block(chest.x, chest.y - 6, 36, 16);
    const gateX = 900;
    const gateY = 219;
    const gate = this.image('torii', gateX, gateY, .72).setTint(0xffe6ba);
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
    this.image('spirit-mist', spirit.x, spirit.y - 6, .66, -2).setAlpha(.65);
    makeObjectiveMarker(this).setPosition(spirit.x, spirit.y - 13).setDepth(spirit.y);
  }

  private addAtmosphere(): void {
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    for (const [index, [x, y, scale]] of [[293, 350, 1.1], [766, 166, 1.34], [663, 628, 1], [1047, 510, 1.2]].entries()) {
      const fog = this.image('mist', x, y, scale, -.7).setAlpha(.19);
      if (!reduce) this.tweens.add({
        targets: fog, x: x + 33, alpha: .29, duration: 4500 + index * 600, yoyo: true, repeat: -1, ease: 'Sine.inOut',
      });
    }
    addBreeze(this);
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
