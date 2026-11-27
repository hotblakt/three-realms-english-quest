import type PhaserType from 'phaser';
import forestTemplate from '../forest-preview/index.html?raw';
import '../src/style.css';
import '../forest-preview/preview.css';

declare global {
  interface Window {
    forestDiagnostic: { write(message: string, stage?: boolean): void; finish(): void };
  }
}

type Mode = 'A' | 'B' | 'C' | 'D' | 'E';
const { write, finish } = window.forestDiagnostic;
const query = new URLSearchParams(location.search);
const requested = query.get('mode') ?? 'A';
const mode = (/^[A-E]$/.test(requested) ? requested : 'A') as Mode;
const rendererQuery = query.get('renderer');
const renderer = rendererQuery === 'webgl' || rendererQuery === 'canvas' ? rendererQuery : 'auto';
document.querySelector<HTMLSelectElement>('[name="mode"]')!.value = mode;
document.querySelector<HTMLSelectElement>('[name="renderer"]')!.value = renderer;
write(`入口模組已執行｜${mode} 組・${renderer}`);

async function run(): Promise<void> {
  const parsed = new DOMParser().parseFromString(forestTemplate, 'text/html');
  parsed.body.querySelectorAll('script').forEach(script => script.remove());
  document.body.append(...parsed.body.children);
  const back = document.querySelector<HTMLAnchorElement>('.forest-back');
  if (back) back.href = `${import.meta.env.BASE_URL}art-workbench/`;
  write('載入 Phaser 與場景模組');
  const [{ default: Phaser }, { ForestScene }, { useLandscapeLayout }, composition, scale, review] = await Promise.all([
    import('phaser'), import('../forest-preview/ForestScene'), import('../src/ui/landscapeLayout'),
    import('../forest-preview/composition'), import('../forest-preview/scalePanel'), import('../forest-preview/eastReview'),
  ]);
  write('模組已就緒，初始化介面與 Phaser');
  review.setupEastReview();
  scale.setupScalePanel();

  const useBatchB = mode === 'E';
  const batchB = useBatchB ? await Promise.all([
    import('../forest-preview/environment/batchBVegetation'), import('../forest-preview/environment/canopy'),
  ]) : undefined;
  const signal = new AbortController();
  window.addEventListener('forest-diagnostic-timeout', () => signal.abort(), { once: true });

  async function probeAtlas(): Promise<{ retained: Blob | HTMLImageElement; image?: HTMLImageElement } | undefined> {
    if (mode === 'A') return;
    const { meta } = (await import('../docs/forest-batch-b-provenance.json')).default;
    write(`Batch B 請求｜${meta.image}`);
    const response = await fetch(`${import.meta.env.BASE_URL}forest-batch-b/${meta.image}?v=${meta.sha256.slice(0, 16)}`, {
      signal: signal.signal,
    });
    if (!response.ok) throw new Error(`Batch B 圖集 HTTP ${response.status}`);
    const blob = await response.blob();
    write(`Batch B 下載完成｜${blob.size} bytes・${blob.type}`);
    if (blob.size !== meta.bytes) throw new Error('Batch B 圖集大小不符，可能混入其他版本');
    const hash = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
    if (Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('') !== meta.sha256) {
      throw new Error('Batch B 圖集 SHA-256 不符');
    }
    if (mode === 'B') return { retained: blob };
    write(`Batch B 開始解碼｜${meta.image}`);
    const { loadOptionalImage } = await import('../forest-preview/startup');
    const url = URL.createObjectURL(blob);
    try {
      const decoded = await loadOptionalImage(url, meta.size.w, meta.size.h, 18000);
      if (decoded.status !== 'loaded') throw new Error(`Batch B 解碼失敗｜${decoded.status}`);
      if (typeof decoded.image.decode === 'function') {
        await Promise.race([
          decoded.image.decode(),
          new Promise<never>((_, reject) => {
            if (signal.signal.aborted) reject(new Error('Batch B decode() 逾時'));
            else signal.signal.addEventListener('abort', () => reject(new Error('Batch B decode() 逾時')), { once: true });
          }),
        ]);
      } else {
        write('瀏覽器缺少 Image.decode()，採用 Image load 事件', false);
      }
      write(`Batch B 解碼完成｜${decoded.image.naturalWidth}×${decoded.image.naturalHeight}・預估 RGBA ${meta.rgbaBytes} bytes`);
      return { retained: decoded.image, image: decoded.image };
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  class DiagnosticScene extends ForestScene {
    private probe?: Promise<{ result: Awaited<ReturnType<typeof probeAtlas>>; error?: never } | { error: string }>;
    private retained?: Blob | HTMLImageElement;

    preload(): void {
      write('場景 preload｜排入必要資產');
      const queued = new Set<string>();
      const processing = new Set<string>();
      const events = Phaser.Loader.Events;
      const onAdd = (key: string) => { queued.add(key); };
      const onLoad = (file: PhaserType.Loader.File) => {
        queued.delete(file.key);
        processing.add(file.key);
        write(`收到資產｜${file.key}`, false);
      };
      const onError = (file: PhaserType.Loader.File) => {
        queued.delete(file.key);
        write(`資產請求失敗｜${file.key}・HTTP ${file.xhrLoader?.status || '未知'}`, false);
      };
      const onComplete = (key: string) => {
        processing.delete(key);
        write(`資產處理完成｜${key}`, false);
      };
      const onTexture = (key: string) => write(`紋理已註冊｜${key}`, false);
      this.load.on(events.ADD, onAdd);
      this.load.on(events.FILE_LOAD, onLoad);
      this.load.on(events.FILE_LOAD_ERROR, onError);
      this.load.on(events.FILE_COMPLETE, onComplete);
      this.textures.on(Phaser.Textures.Events.ADD, onTexture);
      this.load.once(events.POST_PROCESS, () => {
        write('Phaser 完成預載，等待場景建立');
        if (processing.size) write(`未回報處理完成｜${[...processing].join('、')}`, false);
        this.load.off(events.ADD, onAdd);
        this.load.off(events.FILE_LOAD, onLoad);
        this.load.off(events.FILE_LOAD_ERROR, onError);
        this.load.off(events.FILE_COMPLETE, onComplete);
        this.textures.off(Phaser.Textures.Events.ADD, onTexture);
      });
      window.addEventListener('forest-diagnostic-timeout', () => {
        write(`尚未收到｜${[...queued].join('、') || '無'}`, false);
        write(`收到但尚未註冊／處理｜${[...processing].join('、') || '無'}`, false);
      }, { once: true });
      this.probe = probeAtlas().then(result => ({ result }), (error: unknown) => {
        const detail = error instanceof Error ? error.message : '未知錯誤';
        write(detail);
        return { error: detail };
      });
      super.preload();
    }

    async create(): Promise<void> {
      try {
        if (mode !== 'A') {
          const probe = await this.probe!;
          if ('error' in probe) throw new Error(probe.error);
          this.retained = probe.result?.retained;
          if ((mode === 'D' || useBatchB) && probe.result?.image) {
            write('Batch B 開始註冊 Phaser 紋理');
            const { registerEcology } = await import('../forest-preview/environment/ecology');
            registerEcology(this, probe.result.image);
            if (!this.textures.get('forest-batch-b').has('canopy-01')) throw new Error('Batch B 紋理未註冊預期幀');
            write('Batch B 紋理已註冊，找到 canopy-01');
          }
        }
        if (signal.signal.aborted) return;
        const atlases = (await import('../forest-preview/movementReadiness')).movementAtlasKeys;
        const sources = (await import('../forest-preview/runSources')).runSources;
        const resolution = Number(document.querySelector<HTMLSelectElement>('[name="resolution"]')?.value ?? '256');
        const remaining = atlases.filter(key => {
          const manifest = sources[key];
          const texture = `${manifest.id}-${resolution}`;
          return !this.textures.exists(texture) || !this.textures.get(texture).has(String(manifest.frameCount - 1));
        });
        write(remaining.length ? `四向動作未就緒｜${remaining.join('、')}` : '四向 Run／Idle 紋理與幀已確認');
        write(useBatchB ? '建立場景｜套用 Batch B 生態' : '建立場景｜PR #31 地景');
        super.create();
        if (!document.querySelector<HTMLElement>('#forest-loading')!.hidden) throw new Error('四向動作就緒檢查未通過');
        write('場景建立完成，等待第一個已繪製畫面');
        this.game.events.once(Phaser.Core.Events.POST_RENDER, () => {
          write('場景已繪製，控制已啟用');
          finish();
        });
      } catch (error) {
        write(`場景未啟動｜${error instanceof Error ? error.message : '未知錯誤'}`);
        finish();
      }
    }

    protected override drawForestVegetation(block: (x: number, y: number, w: number, h: number) => void) {
      return batchB ? batchB[0].drawVegetation(this, block) : super.drawForestVegetation(block);
    }

    protected override vegetationOpacity(canopy: PhaserType.GameObjects.Image, x: number, y: number, size: number): number {
      return batchB ? batchB[1].canopyOpacity(canopy, x, y, composition.standingHeight * size / 100)
        : super.vegetationOpacity(canopy, x, y, size);
    }
  }

  new Phaser.Game({
    type: renderer === 'canvas' ? Phaser.CANVAS : renderer === 'webgl' ? Phaser.WEBGL : Phaser.AUTO,
    parent: 'game',
    width: 720,
    height: 400,
    backgroundColor: '#182d24',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    physics: { default: 'arcade', arcade: { gravity: { x: 0, y: 0 } } },
    scene: [DiagnosticScene],
    callbacks: {
      preBoot: () => write('Phaser 開始建立渲染器'),
      postBoot: game => {
        write(`Phaser 已初始化｜${game.renderer.type === Phaser.WEBGL ? 'WebGL' : 'Canvas'}`);
        game.events.on(Phaser.Core.Events.CONTEXT_LOST, () => write('WebGL context 遺失'));
        useLandscapeLayout(game);
        composition.useCompositionViewport(game);
      },
    },
  });
}

run().catch((error: unknown) => {
  write(`初始化失敗｜${error instanceof Error ? error.message : '未知錯誤'}`);
  finish();
});
