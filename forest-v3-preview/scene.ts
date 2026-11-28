import type Phaser from 'phaser';
import { Encounter, type EntryRequest } from '../src/forest-v3/domain/encounter';
import { Hayate, Recruitment, companionSnapshot, recruitmentPhrase, type EnglishCompletion } from '../src/forest-v3/domain/companion';
import { distance, scale, unit, sub, type Point, type AttackWindow, type CombatEvent } from '../src/forest-v3/domain/contracts';
import { initialProgress, proposeWindRune, type RewardProposal } from '../src/forest-v3/domain/progression';
import { enemies } from '../src/forest-v3/domain/tuning';
import { encounterAreas, guardianGeometry, type EncounterId } from '../src/forest-v3/world/encounters';
import { checkpoints, forestRegionId, landmarks, safeAnchors } from '../src/forest-v3/world/world';
import { getRoutePoints } from '../src/forest-v3/world/routes';
import { addSoftShadow } from '../src/art/villageAtmosphere';
import { SpeechRecognitionService } from '../src/speech/SpeechRecognitionService';
import { selectSpokenMatch } from '../src/speech/matchSpokenText';
import { AlphaSave, alphaSlot } from './save';
import { forestGeometry } from './geometry';
import eastFox from './assets/hayate-east.webp?url';
import westFox from './assets/hayate-west.webp?url';
import northFox from './assets/hayate-north.webp?url';
import southFox from './assets/hayate-south.webp?url';

type ForestClass = typeof import('../forest-preview/ForestScene').ForestScene;
const fox = { east: eastFox, west: westFox, north: northFox, south: southFox };
type Direction = keyof typeof fox;
const bodyHeight: Record<Direction, number> = { east: 113, west: 112, north: 132, south: 115 };
const labels: Record<EncounterId, string> = {
  'lantern-sprout': '石燈小徑・竹芽',
  'east-wind-pair': '橋東試煉・竹芽與風籽',
  'mosswood-guardian': '苔木守衛',
};
const near = (a: Point, b: Point, radius = 42) => distance(a, b) < radius;
function element<T extends HTMLElement>(tag: string, parent: Element, text?: string): T {
  const result = document.createElement(tag) as T;
  if (text) result.textContent = text;
  parent.append(result);
  return result;
}
function button(parent: Element, text: string, click: () => void) {
  const result = element<HTMLButtonElement>('button', parent, text);
  result.type = 'button';
  result.addEventListener('click', click);
  return result;
}

export function alphaScene(Base: ForestClass): ForestClass {
  return class ForestAlpha extends Base {
    private readonly save = new AlphaSave();
    private progress = initialProgress();
    private active?: EncounterId;
    private enemyPoints: readonly Point[] = [];
    private readonly geometry = forestGeometry(() => this.active ? encounterAreas[this.active].bounds : undefined,
      p => this.cameras.main.worldView.contains(p.x, p.y));
    private readonly encounter = new Encounter({
      world: this.geometry, clock: () => performance.now(), attemptId: () => crypto.randomUUID(),
      storage: this.save, slot: alphaSlot,
      fixedAttackFacings: { 'mosswood-guardian:0': guardianGeometry.facing },
      enemies: { ...enemies, 'mosswood-guardian': { ...enemies['mosswood-guardian'], speed: 0 } },
    });
    private readonly hayate = new Hayate(this.geometry, () => performance.now());
    private readonly recruitment = new Recruitment();
    private readonly speech = new SpeechRecognitionService();
    private speechSession?: AbortController;
    private dialogue?: HTMLDialogElement;
    private foxShadow?: Phaser.GameObjects.Image;
    private companion?: Phaser.GameObjects.Image;
    private paws: Point = safeAnchors['hayate-side'].point;
    private trail: Point[] = [];
    private direction: Direction = 'south';
    private readonly effects = new Map<string, Phaser.GameObjects.Graphics>();
    private readonly bolts = new Map<string, Phaser.GameObjects.Arc>();
    private readonly enemyViews = new Map<string, Phaser.GameObjects.Container>();
    private cast = false;
    private loaded = false;
    private working = false;
    private result = '';
    private health!: HTMLOutputElement;
    private saveStatus!: HTMLOutputElement;
    private retreat!: HTMLButtonElement;
    private retry!: HTMLButtonElement;
    private readonly lifecycle = new AbortController();

    override async create() {
      await super.create();
      if (!this.controlsReady) return;
      document.body.classList.add('forest-alpha');
      const panel = element<HTMLElement>('aside', document.body);
      panel.id = 'alpha-hud';
      panel.setAttribute('aria-label', '試玩冒險狀態');
      this.health = element<HTMLOutputElement>('output', panel, '霧竹林 3.0 試玩版');
      this.health.setAttribute('aria-live', 'off');
      this.saveStatus = element<HTMLOutputElement>('output', panel);
      this.saveStatus.hidden = true;
      this.retreat = button(panel, '安全撤退', () => this.exitCombat());
      this.retry = button(panel, '重試', () => {
        if (this.encounter.hud.phase === 'settlement') void this.settle();
        else if (this.active) {
          const id = this.active;
          this.exitCombat();
          if (!this.active) void this.enter(id, true);
        }
      });
      this.retreat.hidden = this.retry.hidden = true;
      const cast = document.querySelector<HTMLButtonElement>('#east-cast-button')!;
      cast.textContent = '風之刃';
      cast.addEventListener('click', () => { this.cast = true; }, { signal: this.lifecycle.signal });
      const pause = () => {
        this.speechSession?.abort();
        window.speechSynthesis?.cancel();
        this.cast = false;
        this.controls.reset();
        this.encounter.pause();
      };
      const resume = () => this.encounter.resume();
      document.addEventListener('visibilitychange', () => document.hidden ? pause() : resume(), { signal: this.lifecycle.signal });
      window.addEventListener('blur', pause, { signal: this.lifecycle.signal });
      window.addEventListener('focus', resume, { signal: this.lifecycle.signal });
      this.game.events.on('pause', pause);
      this.game.events.on('resume', resume);
      this.events.once('shutdown', () => {
        this.game.events.off('pause', pause);
        this.game.events.off('resume', resume);
        pause();
        this.lifecycle.abort();
        panel.remove();
        this.dialogue?.remove();
      });
      this.markRoutes();
      try {
        const saved = await this.save.load();
        this.progress = saved.progress;
        this.placePlayer(safeAnchors[checkpoints[saved.checkpoint]].point);
        this.updateHud();
        if (this.progress.companion.collected) this.paws = this.player.body.center.clone();
        if (this.progress.treasures.includes('west-chest')) this.chestArt.setTexture('chest-open');
      } catch {
        this.storageWarning('暫時無法讀取試玩存檔。原存檔已保留。');
      }
      this.loaded = true;
      void this.loadCompanion();
    }

    private async loadCompanion() {
      try {
        const signal = this.lifecycle.signal;
        const files = await Promise.all(Object.entries(fox).map(async ([direction, url]) => {
          const image = new Image();
          image.src = url;
          let timer: number | undefined;
          try {
            await Promise.race([image.decode(), new Promise<never>((_, reject) => {
              timer = window.setTimeout(() => reject(new Error('image timeout')), 5000);
            })]);
          } finally {
            window.clearTimeout(timer);
          }
          return { direction, image };
        }));
        if (signal.aborted) return;
        for (const { direction, image } of files) {
          if (!this.textures.addImage('hayate-' + direction, image)) throw new Error(direction);
        }
        this.foxShadow = addSoftShadow(this, this.paws.x, this.paws.y + 1, 22, 8).setVisible(false);
        this.companion = this.add.image(this.paws.x, this.paws.y, 'hayate-south').setVisible(false);
      } catch {
        this.storageWarning('疾風圖像暫時無法顯示，仍可探索與完成試玩。');
      }
    }

    protected override get usesForestDemoActions(): boolean { return false; }

    protected override moveForestPlayer(direction: Phaser.Math.Vector2, now: number): boolean {
      const sword = this.controls.consume('attack');
      const k = this.castKey.isDown && !this.castHeld;
      this.castHeld = this.castKey.isDown;
      const blade = this.cast || k;
      this.cast = false;
      if (!this.loaded || this.dialogue?.open) {
        this.player.body.setVelocity(0, 0);
        return false;
      }
      if (!this.active) {
        if (blade && !this.progress.chapterWindBlade) {
          this.result = '先在第一章取得風之刃。';
          this.time.delayedCall(2700, () => { this.result = ''; });
        }
        return super.moveForestPlayer(direction, now);
      }
      const dodge = this.controls.consume('dodge');
      this.encounter.update({ move: direction, sword, dodge, windBlade: blade });
      this.placePlayer(this.encounter.playerPosition);
      let dodgeStarted = false;
      for (const event of this.encounter.drainEvents()) {
        this.renderEvent(event);
        if (event.type === 'ActionStarted' && event.action === 'dodge') dodgeStarted = true;
      }
      this.renderEnemies();
      this.renderProjectiles();
      if (this.encounter.hud.phase === 'settlement' && !this.working && !this.settlementAttempted) {
        this.settlementAttempted = true;
        void this.settle();
      }
      this.updateHud();
      return dodgeStarted;
    }
    private castHeld = false;
    private settlementAttempted = false;

    override update(now: number, delta: number) {
      const before = this.loaded ? this.player.body.center.clone() : undefined;
      super.update(now, delta);
      if (before && !this.dialogue?.open) this.followCompanion(delta, before);
    }

    private placePlayer(p: Point) {
      if (this.player.body.center.x !== p.x || this.player.body.center.y !== p.y) this.player.body.reset(p.x, p.y);
      this.player.body.setVelocity(0, 0);
      this.player.syncView();
    }

    private storageWarning(message: string) {
      this.saveStatus.hidden = false;
      this.saveStatus.textContent = message;
      this.saveStatus.setAttribute('role', 'status');
    }

    private markRoutes() {
      for (const id of ['west-lookout', 'guardian-entrance', 'skirmish-entry'] as const) {
        const points = getRoutePoints(id);
        const path = this.add.graphics().setDepth(-.1);
        path.lineStyle(4, 0xa48d63, .24);
        path.strokePoints([...points]);
      }
      // Reuse the existing upstream cascade painting at the dry-land lookout.
      if (this.textures.exists('batch-falls')) {
        const face = this.add.image(148, 361, 'batch-falls').setOrigin(.58, .29).setDepth(-.15);
        const ratio = 70 / face.width;
        face.setScale(ratio);
      }
      const signs = [
        [515, 584, '瀑布 ←　　木橋 ↗'],
        [175, 372, '聽見瀑布了・沿原路返回'],
        [798, 437, '橋東試煉 ↓'],
        [1016, 295, '守衛清地 →'],
      ] as const;
      for (const [x, y, label] of signs) {
        this.add.text(x, y, label, { fontSize: '14px', color: '#fff0c4', backgroundColor: '#1c3429',
          padding: { x: 5, y: 3 } }).setOrigin(.5, 1).setDepth(y - 1);
      }
    }

    private async enter(id: EncounterId, assisted = false) {
      if (this.working || this.active) return;
      this.working = true;
      try { this.progress = await this.save.read(alphaSlot); }
      catch { this.storageWarning('無法讀取試玩存檔。此回合可練習，獎勵可能無法保存。'); }
      this.working = false;
      const area = encounterAreas[id];
      if (this.lifecycle.signal.aborted) return;
      const request: EntryRequest = {
        encounterId: id, regionId: forestRegionId, spawnId: id + '-entry',
        enemySpawnIds: area.spawns.map((_, i) => id + '-enemy-' + i),
        landmarkId: area.landmarkId, checkpointId: area.checkpointId, assisted,
        practice: this.progress.cleared.includes(id),
      };
      if (!this.encounter.enter(request, this.progress)) {
        this.result = '還不能挑戰。先完成橋東試煉。';
        return;
      }
      this.active = id;
      this.settlementAttempted = false;
      this.result = '';
      this.hayate.beginAttempt(this.encounter.currentAttempt);
      this.placePlayer(this.encounter.playerPosition);
      void this.save.checkpoint(area.checkpointId).catch(() => this.storageWarning('安全據點未能儲存。'));
      this.updateHud();
    }

    private exitCombat() {
      if (this.working) return;
      const point = this.encounter.retreat();
      if (!point) return;
      for (const view of this.enemyViews.values()) view.destroy();
      this.enemyViews.clear();
      for (const mark of this.effects.values()) mark.destroy();
      this.effects.clear();
      for (const bolt of this.bolts.values()) bolt.destroy();
      this.bolts.clear();
      this.active = undefined;
      this.result = '';
      this.enemyPoints = [];
      this.hayate.beginAttempt();
      this.placePlayer(point);
      this.updateHud();
    }

    private updateHud() {
      const hud = this.encounter.hud;
      const info = this.active
        ? `體力 ${hud.health}／5　風力 ${hud.spirit}／4${hud.practice ? '　練習' : ''}`
        : `風印 ${this.progress.seals}　${this.progress.companion.collected ? '疾風・羈絆 ' + this.progress.companion.bondStage : '探索霧竹林'}`;
      if (this.health.textContent !== info) this.health.textContent = info;
      this.retreat.hidden = !this.active;
      this.retry.hidden = !this.active || !['failed', 'settlement'].includes(hud.phase);
      this.retry.textContent = hud.phase === 'settlement' ? '重試儲存' : '再挑戰';
      this.retreat.textContent = hud.phase === 'cleared' ? '離開試煉' : '安全撤退';
    }

    private async commit(proposal?: RewardProposal): Promise<boolean> {
      if (!proposal || this.working) return false;
      this.working = true;
      const result = await this.save.commit(alphaSlot, proposal);
      this.working = false;
      if (result.status === 'confirmed') {
        this.progress = result.progress;
        this.updateHud();
        return true;
      }
      this.storageWarning('這次進度沒有存下來，可以再試一次。');
      return false;
    }

    private async settle() {
      if (this.working) return;
      this.working = true;
      const result = await this.encounter.settle();
      this.working = false;
      if (result.status !== 'confirmed') {
        this.storageWarning('獎勵尚未存下來。可重試儲存，或安全撤退。');
        return;
      }
      this.progress = result.progress;
      this.result = this.active === 'mosswood-guardian'
        ? '取得守衛徽章！可循捷徑回入口，或留下來練習。'
        : '試煉完成！可離開，也能再來練習。';
      this.updateHud();
    }

    protected override forestInteraction(pressed: boolean): string {
      if (!this.loaded) return '讀取試玩進度…';
      if (this.active) {
        const phase = this.encounter.hud.phase;
        if (phase === 'failed') return '先休息一下。可用「再挑戰」或安全撤退。';
        if (phase === 'settlement') return '保存試煉獎勵…';
        if (phase === 'cleared') return this.result;
        const hint = this.hayate.hint?.text;
        if (hint) return hint;
        return this.active === 'mosswood-guardian'
          ? '留意橙色範圍，向旁閃避。守衛露出核心時再揮劍。'
          : '避開橙色範圍。靠近敵人後揮劍。';
      }
      const p = this.player.body.center;
      if (near(p, safeAnchors['west-chest-interact'].point, 33)) {
        if (this.progress.treasures.includes('west-chest')) return '已取得瀑布寶藏。走原路回岔路。';
        if (pressed) void this.commit({ kind: 'treasure', landmarkId: 'west-chest' }).then(ok => {
          if (ok) this.chestArt.setTexture('chest-open');
        });
        return '發現藏在瀑布小徑的寶箱！按「互動」。';
      }
      if (near(p, landmarks['shrine-approach'].point)) {
        if (this.progress.companion.collected) return '疾風已加入。靈狐會跟在你身後。';
        if (pressed && !this.working && !this.dialogue?.open) void this.discoverCompanion();
        return '神社旁有腳步聲。按「互動」打招呼。';
      }
      if (near(p, landmarks['east-return'].point)) {
        if (pressed) {
          this.placePlayer(safeAnchors['south-entry'].point);
          this.trail = [];
          if (this.progress.companion.collected) this.paws = this.player.body.center.clone();
          void this.save.checkpoint('south-entry').catch(() => this.storageWarning('入口據點未能儲存。'));
        }
        return '按「互動」，由原有捷徑回入口。';
      }
      if (near(p, landmarks['village-return'].point, 27)) {
        if (pressed) window.location.href = `${import.meta.env.BASE_URL}forest-preview/`;
        return this.progress.badge ? '冒險完成！按「互動」回穩定版森林。' : '按「互動」離開試玩。';
      }
      for (const id of Object.keys(encounterAreas) as EncounterId[]) {
        const area = encounterAreas[id];
        if (!near(p, landmarks[area.landmarkId].point, id === 'lantern-sprout' ? 25 : 30)) continue;
        if (id === 'mosswood-guardian' && !this.progress.cleared.includes('east-wind-pair')) return '先到橋東完成竹芽與風籽的試煉。';
        if (pressed) void this.enter(id);
        return labels[id] + (this.progress.cleared.includes(id) ? '・按「互動」再練習。' : '・按「互動」挑戰。');
      }
      const rune = proposeWindRune(this.progress, near(p, landmarks['east-junction'].point, 28));
      if (rune) {
        if (pressed) void this.commit(rune);
        return '把風印化為風符，延長風之刃。按「互動」。';
      }
      if (this.result) return this.result;
      if (this.progress.companion.collected && !this.progress.treasures.includes('west-chest') &&
        near(p, safeAnchors['falls-lookout'].point, 125)) return '疾風望向瀑布旁：沿著石頭找找寶箱。';
      if (this.progress.badge) return '已取得守衛徽章。可尋寶、再練習，或從東側捷徑返回。';
      if (p.x > 740) return this.progress.cleared.includes('east-wind-pair')
        ? '往北找疾風，或循東側小徑挑戰苔木守衛。' : '沿橋東小徑往南，挑戰竹芽與風籽。';
      return '岔路向西尋找瀑布寶藏，向北循石燈找木橋。';
    }

    private async discoverCompanion() {
      if (!this.progress.companion.discovered && !await this.commit(this.recruitment.discover(true, true))) return;
      if (!this.recruitment.begin(companionSnapshot(this.progress, Boolean(this.companion)), true, true)) return;
      const dialogue = element<HTMLDialogElement>('dialog', document.body);
      this.dialogue = dialogue;
      dialogue.id = 'alpha-practice';
      const title = element('h2', dialogue, '邀請疾風同行');
      title.id = 'alpha-phrase-title';
      dialogue.setAttribute('aria-labelledby', title.id);
      element('p', dialogue, '跟我來。');
      const phrase = element('p', dialogue, recruitmentPhrase);
      phrase.lang = 'en';
      const feedback = element<HTMLOutputElement>('output', dialogue, '可以跟讀，或使用輔助練習。');
      feedback.setAttribute('role', 'status');
      element('p', dialogue, '語音只比對聽到的文字。瀏覽器可能透過網路處理語音。');
      const say = button(dialogue, '聽英文', () => {
        if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) {
          feedback.textContent = '目前無法播放，可以看著句子練習。';
          return;
        }
        window.speechSynthesis.cancel();
        const line = new SpeechSynthesisUtterance(recruitmentPhrase);
        line.lang = 'en-US';
        line.onerror = () => { feedback.textContent = '目前無法播放，可以看著句子練習。'; };
        window.speechSynthesis.speak(line);
      });
      const finish = async (mode: EnglishCompletion) => {
        this.speechSession?.abort();
        if (await this.commit(this.recruitment.complete(mode))) {
          this.paws = safeAnchors['hayate-side'].point;
          dialogue.close();
        } else {
          this.recruitment.begin(companionSnapshot(this.progress, Boolean(this.companion)), true, true);
          feedback.textContent = '還沒能儲存，請再試一次。';
        }
      };
      const listen = button(dialogue, '開啟麥克風', () => {
        if (this.speechSession) return;
        window.speechSynthesis?.cancel();
        const session = new AbortController();
        this.speechSession = session;
        listen.disabled = say.disabled = true;
        feedback.textContent = '正在準備麥克風…';
        void this.speech.recognize('en-US', session.signal, phase => {
          feedback.textContent = phase === 'listening' ? '請念出英文句子。' : '正在聽…';
        }).then(result => {
          if (session.signal.aborted) return;
          if (selectSpokenMatch(result, recruitmentPhrase)) {
            feedback.textContent = '聽到了！疾風準備好了。';
            void finish('recognized');
          } else {
            feedback.textContent = result.transcript
              ? `聽到：${result.transcript}。試著再念一次。` : '這次沒聽清楚，可以再試一次。';
          }
        }).catch(() => {
          if (!session.signal.aborted) feedback.textContent = '這次無法使用麥克風。可以重試或用輔助練習。';
        }).finally(() => {
          if (this.speechSession === session) this.speechSession = undefined;
          listen.disabled = say.disabled = false;
        });
      });
      button(dialogue, '完成輔助練習', () => { if (!this.working) void finish('assisted'); });
      button(dialogue, '稍後再來', () => dialogue.close());
      this.controls.reset();
      if (this.input.keyboard) this.input.keyboard.enabled = false;
      dialogue.addEventListener('close', () => {
        if (this.input.keyboard) this.input.keyboard.enabled = true;
        this.speechSession?.abort();
        window.speechSynthesis?.cancel();
        this.recruitment.cancel();
        this.dialogue = undefined;
        dialogue.remove();
      }, { once: true });
      dialogue.showModal();
    }

    private followCompanion(delta: number, previous: Point) {
      const p = this.player.body.center;
      const visual = this.companion;
      if (!visual) return;
      if (distance(previous, p) < 55 && (!this.trail.length || distance(this.trail[0], previous) > 9)) {
        this.trail.unshift(previous);
        this.trail.length = Math.min(this.trail.length, 24);
      }
      const snapshot = companionSnapshot(this.progress, true);
      const walk = this.following.follow(snapshot, {
        ready: true, regionId: forestRegionId, companion: { id: 'hayate', position: this.paws, radius: 6 }, player: p,
        trailAnchorIds: this.trail.map((_, index) => 'trail-' + index),
        recoveryAnchorIds: this.trail.map((_, index) => 'trail-' + index),
        combat: Boolean(this.active), safeAnchorId: this.active === 'mosswood-guardian'
          ? 'guardian-companion-side' : this.active && encounterAreas[this.active].retreatId,
      });
      if (!snapshot.collected) {
        visual.setVisible(near(p, safeAnchors['hayate-side'].point, 130));
      } else if (walk.kind === 'hidden' || walk.kind === 'loading') visual.setVisible(false);
      else {
        visual.setVisible(true);
        if (walk.kind === 'recover') this.paws = walk.target;
        if (walk.kind === 'follow' || walk.kind === 'safe-side') {
          const offset = sub(walk.target, this.paws);
          const stride = Math.min(distance(this.paws, walk.target), Math.min(50, delta) * .123 *
            (walk.kind === 'follow' ? walk.speedRatio : .95));
          const desired = scale(unit(offset), stride);
          const next = this.geometry.move({ id: 'hayate', radius: 6, position: this.paws },
            { x: this.paws.x + desired.x, y: this.paws.y + desired.y }, forestRegionId);
          if (distance(this.paws, next) > .05) {
            this.direction = Math.abs(offset.x) > Math.abs(offset.y)
              ? offset.x > 0 ? 'east' : 'west' : offset.y > 0 ? 'south' : 'north';
          }
          this.paws = next;
        }
      }
      this.foxShadow?.setPosition(this.paws.x, this.paws.y + 1).setVisible(visual.visible);
      visual.setTexture('hayate-' + this.direction).setOrigin(.5, 213 / 256)
        .setScale(45.5 / bodyHeight[this.direction]).setPosition(this.paws.x, this.paws.y).setDepth(this.paws.y);
    }

    private readonly following = new Hayate({ ...this.geometry, anchor: id => {
      const match = /^trail-(\d+)$/.exec(id);
      const point = match && this.trail[Number(match[1])];
      return point ? { id, regionId: forestRegionId, point } : this.geometry.anchor(id);
    } }, () => performance.now());

    private renderProjectiles() {
      const shots = this.encounter.projectileState;
      for (const [id, view] of this.bolts) {
        if (!shots.some(shot => shot.attackId === id)) {
          view.destroy();
          this.bolts.delete(id);
        }
      }
      for (const { attackId, position: p } of shots) {
        const view = this.bolts.get(attackId) ?? this.add.circle(p.x, p.y, 7, 0xb2f6cc, .9).setStrokeStyle(2, 0xf6ffde);
        view.setPosition(p.x, p.y).setDepth(p.y + 1);
        this.bolts.set(attackId, view);
      }
    }

    private drawShape(graphics: Phaser.GameObjects.Graphics, event: AttackWindow, color: number, opacity: number) {
      const { origin: p, facing, shape } = event;
      const angle = Math.atan2(facing.y, facing.x);
      graphics.clear().fillStyle(color, opacity).lineStyle(2, color, Math.min(1, opacity + .35));
      if (shape.kind === 'sector') {
        const half = shape.degrees * Math.PI / 360;
        graphics.beginPath().moveTo(p.x, p.y).arc(p.x, p.y, shape.range, angle - half, angle + half, false)
          .closePath().fillPath().strokePath();
      } else {
        const corner = (u: number, v: number) => ({ x: p.x + facing.x * u - facing.y * v, y: p.y + facing.y * u + facing.x * v });
        const w = shape.halfWidth;
        graphics.fillPoints([corner(0, w), corner(shape.range, w), corner(shape.range, -w), corner(0, -w)], true);
      }
    }

    private renderEvent(event: CombatEvent) {
      this.hayate.consume(companionSnapshot(this.progress, Boolean(this.companion)), event);
      if (event.type === 'AttackTelegraphed' || event.type === 'HitWindowOpened') {
        const warning = event.type === 'AttackTelegraphed';
        if (event.sourceId === 'player' && warning) return;
        const mark = this.effects.get(event.attackId) ?? this.add.graphics().setDepth(1300);
        this.effects.set(event.attackId, mark);
        this.drawShape(mark, event, event.sourceId === 'player' ? 0xbef9e4 : 0xffa751, warning ? .34 : .65);
      } else if (event.type === 'AttackEnded') {
        this.effects.get(event.attackId)?.destroy();
        this.effects.delete(event.attackId);
      } else if (event.type === 'HitResolved' && event.result === 'hit') {
        const target = event.targetId === 'player' ? this.player.body.center
          : this.encounter.enemyState.find(enemy => enemy.id === event.targetId)?.position;
        if (target) {
          const flash = this.add.circle(target.x, target.y - 14, 11, 0xffeead, .85).setDepth(target.y + 2);
          this.time.delayedCall(95, () => flash.destroy());
        }
      } else if (event.type === 'ActionStarted' && event.action === 'dodge') {
        const ring = this.add.ellipse(event.origin.x, event.origin.y - 4, 28, 11, 0xadf0cb, .6).setDepth(event.origin.y);
        this.time.delayedCall(130, () => ring.destroy());
      } else if (event.type === 'EncounterCleared' && !event.firstClear) {
        this.result = '練習完成！初次獎勵已領取。';
      }

    }

    protected override vegetationOpacity(image: Phaser.GameObjects.Image, x: number, y: number, size: number) {
      let opacity = super.vegetationOpacity(image, x, y, size);
      for (const foe of this.enemyPoints) opacity = Math.min(opacity, super.vegetationOpacity(image, foe.x, foe.y, 100));
      return opacity;
    }

    private renderEnemies() {
      const enemies = this.encounter.enemyState;
      this.enemyPoints = enemies.filter(foe => foe.health > 0).map(foe => foe.position);
      for (const foe of enemies) {
        let view = this.enemyViews.get(foe.id);
        if (!view) {
          const guardian = foe.id.startsWith('mosswood');
          const wind = foe.id.startsWith('wind-seed');
          view = this.add.container();
          view.add([
            this.add.ellipse(0, 0, guardian ? 50 : 24, 11, 0x102120, .55),
            this.add.circle(0, guardian ? -29 : -15, guardian ? 23 : 12, guardian ? 0x887652 : wind ? 0x74b9be : 0x8fa46e),
            this.add.text(0, guardian ? -61 : -34, '', { fontSize: '12px', color: '#fff4d2', backgroundColor: '#182f29' }).setOrigin(.5),
          ]);
          view.setData('name', guardian ? '苔木守衛' : wind ? '風籽' : '竹芽');
          this.enemyViews.set(foe.id, view);
        }
        const label = view.getAt(2) as Phaser.GameObjects.Text;
        const name = `${view.getData('name')}・${foe.health}${foe.phase === 'recovery' ? '　空隙' : ''}`;
        if (label.text !== name) label.setText(name);
        view.setPosition(foe.position.x, foe.position.y).setDepth(foe.position.y).setVisible(foe.health > 0);
      }
    }
  };
}
