import type PhaserType from 'phaser';
import template from '../forest-preview/game-shell.html?raw';
import '../src/style.css';
import '../forest-preview/preview.css';
import { errorDescription, optionalAtlas, registerOptionalAtlas } from './atlas';

declare global {
  interface Window {
    forestCandidate: {
      note(message: string, phase?: boolean): void;
      fail(message: string): void;
      failed(): boolean;
      complete(message: string): void;
    };
  }
}

const { note, fail, failed, complete } = window.forestCandidate;

type ForestAvatar = () => PhaserType.GameObjects.Image;
export type ForestDecoration = (scene: PhaserType.Scene, avatar: ForestAvatar) => PhaserType.GameObjects.Image[];
export type ObserveForest = (scene: PhaserType.Scene, avatar: ForestAvatar) => void;
export type PrepareForestDecoration = (signal: AbortSignal, log: typeof note) =>
  Promise<(scene: PhaserType.Scene) => ForestDecoration | undefined>;

async function start(prepareDecoration?: PrepareForestDecoration, observe?: ObserveForest): Promise<void> {
  note('載入 Phaser 與霧竹林模組');
  const parsed = new DOMParser().parseFromString(template, 'text/html');
  parsed.body.querySelectorAll('script').forEach(script => script.remove());
  document.body.append(...parsed.body.children);
  document.querySelector<HTMLAnchorElement>('.forest-back')!.href = `${import.meta.env.BASE_URL}art-workbench/`;

  const [
    { default: Phaser }, { ForestScene }, { useLandscapeLayout }, composition, scale, review,
    { movementAtlasKeys }, { runSources },
  ] = await Promise.all([
    import('phaser'), import('../forest-preview/ForestScene'), import('../src/ui/landscapeLayout'),
    import('../forest-preview/composition'), import('../forest-preview/scalePanel'), import('../forest-preview/eastReview'),
    import('../forest-preview/movementReadiness'), import('../forest-preview/runSources'),
  ]);
  if (failed()) return;
  review.setupEastReview();
  scale.setupScalePanel();
  const renderer = new URLSearchParams(location.search).get('renderer');
  const atlasKey = 'forest-batch-b';

  async function prepareEcology(signal: AbortSignal) {
    const [vegetation, canopy, ecology, { prepareAtlas }] = await Promise.all([
      import('../forest-preview/environment/batchBVegetation'), import('../forest-preview/environment/canopy'),
      import('../forest-preview/environment/ecology'), import('./prepareAtlas'),
    ]);
    if (signal.aborted) throw new Error('圖集請求已取消');
    const image = await prepareAtlas(signal, note);
    return { image, vegetation, canopy, ecology };
  }
  type Ecology = Awaited<ReturnType<typeof prepareEcology>>;

  class CandidateScene extends ForestScene {
    private atlas!: ReturnType<typeof optionalAtlas<Ecology>>;
    private ecology?: Ecology;
    private landmarkAtlas?: ReturnType<typeof optionalAtlas<Awaited<ReturnType<PrepareForestDecoration>>>>;
    private decorate?: ForestDecoration;

    preload(): void {
      note('載入必要資產｜四向 Run／Idle');
      const pending = new Map<string, string>();
      const events = Phaser.Loader.Events;
      const add = (key: string) => { pending.set(key, '等待回應'); };
      const received = (file: PhaserType.Loader.File) => { pending.set(file.key, '等待解碼／註冊'); };
      const done = (key: string) => { pending.delete(key); };
      const requestFailed = (file: PhaserType.Loader.File) => {
        pending.delete(file.key);
        note(`資產請求失敗｜${file.key}・HTTP ${file.xhrLoader?.status || '未知'}`, false);
      };
      this.load.on(events.ADD, add);
      this.load.on(events.FILE_LOAD, received);
      this.load.on(events.FILE_COMPLETE, done);
      this.load.on(events.FILE_LOAD_ERROR, requestFailed);
      this.load.once(events.POST_PROCESS, () => {
        for (const [key, state] of pending) note(`${state}｜${key}`, false);
        pending.clear();
        this.load.off(events.ADD, add);
        this.load.off(events.FILE_LOAD, received);
        this.load.off(events.FILE_COMPLETE, done);
        this.load.off(events.FILE_LOAD_ERROR, requestFailed);
      });
      window.addEventListener('forest-candidate-failed', () => {
        for (const [key, state] of pending) note(`${state}｜${key}`, false);
        if (this.sys.isActive()) this.scene.pause();
      }, { once: true });
      this.atlas = optionalAtlas(prepareEcology, 5000);
      if (prepareDecoration) this.landmarkAtlas = optionalAtlas(signal => prepareDecoration(signal, note), 5000, '地標圖集逾時');
      super.preload();
    }

    async create(): Promise<void> {
      if (failed()) return;
      try {
        const resolution = Number(document.querySelector<HTMLSelectElement>('[name="resolution"]')!.value);
        const missing = movementAtlasKeys.flatMap(key => {
          const manifest = runSources[key];
          const texture = `${manifest.id}-${resolution}`;
          return this.textures.exists(texture) && this.textures.get(texture).has(String(manifest.frameCount - 1))
            ? [] : [texture];
        });
        if (missing.length) {
          fail(`必要動畫未就緒｜${missing.join('、')}`);
          return;
        }
        note('四向動作就緒｜確認選用竹林圖集');
        const atlas = await this.atlas;
        if (failed()) return;
        if (atlas.ok) {
          note('註冊選用竹林圖集');
          const batch = atlas.value;
          const registration = registerOptionalAtlas(
            () => batch.ecology.registerEcology(this, batch.image),
            () => this.textures.exists(atlasKey) && this.textures.get(atlasKey).has('canopy-01'),
            () => { if (this.textures.exists(atlasKey)) this.textures.remove(atlasKey); },
          );
          if (registration.ok) this.ecology = batch;
          else note(`使用原竹林｜紋理註冊失敗：${registration.reason}`, false);
        } else {
          note(`使用原竹林｜${atlas.reason}`, false);
        }

        if (this.landmarkAtlas) {
          note('確認選用地標圖集');
          const landmarks = await this.landmarkAtlas;
          if (failed()) return;
          if (landmarks.ok) this.decorate = landmarks.value(this);
          else note(`沿用原地標｜${landmarks.reason}`, false);
        }
        note('建立霧竹林場景');
        super.create();
        if (!document.querySelector<HTMLElement>('#forest-loading')!.hidden) {
          fail('霧竹林場景未通過就緒檢查');
          return;
        }
        observe?.(this, () => this.forestAvatar);
        note('場景已建立｜等待首次繪製');
        this.game.events.once(Phaser.Core.Events.POST_RENDER, () => {
          const ecology = this.ecology ? '竹林生態已啟用' : '使用原竹林';
          const landmarks = prepareDecoration ? (this.decorate ? '｜風靈地標已啟用' : '｜使用原地標') : '';
          complete(`已繪製｜${ecology}${landmarks}`);
        });
      } catch (error) {
        fail(`霧竹林啟動失敗｜${errorDescription(error)}`);
      }
    }

    protected override drawForestDecoration() {
      return this.decorate?.(this, () => this.forestAvatar) ?? super.drawForestDecoration();
    }

    protected override drawForestVegetation(block: (x: number, y: number, w: number, h: number) => void) {
      return this.ecology ? this.ecology.vegetation.drawVegetation(this, block) : super.drawForestVegetation(block);
    }

    protected override vegetationOpacity(image: PhaserType.GameObjects.Image, x: number, y: number, size: number) {
      return this.ecology ? this.ecology.canopy.canopyOpacity(image, x, y, composition.standingHeight * size / 100)
        : super.vegetationOpacity(image, x, y, size);
    }
  }

  note('初始化 Phaser 渲染器');
  new Phaser.Game({
    type: renderer === 'canvas' ? Phaser.CANVAS : renderer === 'webgl' ? Phaser.WEBGL : Phaser.AUTO,
    parent: 'game',
    width: 720, height: 400,
    backgroundColor: '#182d24',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    physics: { default: 'arcade', arcade: { gravity: { x: 0, y: 0 } } },
    scene: [CandidateScene],
    callbacks: { postBoot: game => {
      note(`Phaser 已初始化｜${game.renderer.type === Phaser.WEBGL ? 'WebGL' : 'Canvas'}`, false);
      game.events.on(Phaser.Core.Events.CONTEXT_LOST, () => fail('WebGL context 遺失'));
      useLandscapeLayout(game);
      composition.useCompositionViewport(game);
    } },
  });
}
export function launchForest(prepareDecoration?: PrepareForestDecoration, observe?: ObserveForest): void {
  start(prepareDecoration, observe).catch(error => fail(`模組或渲染器初始化失敗｜${errorDescription(error)}`));
}
