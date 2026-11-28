import type Phaser from 'phaser';
import type { ObserveForest } from '../forest-batch-b-preview/boot';

export const showVisibilityLog: ObserveForest = (scene, avatar) => {
  const panel = document.querySelector('#diagnostics details')!;
  const label = document.createElement('label');
  label.textContent = '角色顯示紀錄（可複製）';
  const log = document.createElement('textarea');
  log.readOnly = true;
  log.rows = 5;
  label.append(log);
  panel.append(label);
  const started = performance.now();
  const lines: string[] = [];
  const short = (value: number) => Math.round(value * 100) / 100;

  function record() {
    const sprite = avatar();
    const camera = scene.cameras.main;
    const bounds = sprite.getBounds();
    const view = camera.worldView;
    const overlap = (a: Phaser.Geom.Rectangle, b: Phaser.Geom.Rectangle) =>
      a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
    const blockers = scene.children.list.flatMap(child => {
      if (child.type !== 'Image') return [];
      const image = child as Phaser.GameObjects.Image;
      if (image === sprite || image.depth <= sprite.depth || !image.visible || image.alpha === 0
        || !overlap(bounds, image.getBounds())) return [];
      return [`${image.texture.key}/${image.frame.name}@${short(image.depth)}:${short(image.alpha)}`];
    });
    const renderer = scene.game.renderer;
    const texture = scene.textures.exists(sprite.texture.key);
    const frame = texture && scene.textures.get(sprite.texture.key).has(sprite.frame.name);
    const lost = 'gl' in renderer && (renderer as Phaser.Renderer.WebGL.WebGLRenderer).gl?.isContextLost();
    lines.push(`${short((performance.now() - started) / 1000)}s｜${sprite.texture.key}/${sprite.frame.name}`
      + `｜足點 ${short(sprite.x)},${short(sprite.y)}・深度 ${short(sprite.depth)}・透明度 ${short(sprite.alpha)}`
      + `｜圖格 ${frame ? '有效' : '缺失'}・顯示 ${sprite.visible ? '是' : '否'}・繪製旗標 ${sprite.willRender(camera) ? '通過' : '阻擋'}`
      + `・鏡頭交集 ${overlap(bounds, view) ? '有' : '無'}・${'gl' in renderer ? 'WebGL' : 'Canvas'}${lost ? '（已遺失）' : ''}`
      + `｜前景候選 ${blockers.slice(0, 6).join('、') || '無'}`);
    if (lines.length > 40) lines.shift();
    log.value = lines.join('\n');
    log.scrollTop = log.scrollHeight;
  }

  record();
  const timer = window.setInterval(record, 1000);
  scene.events.once('shutdown', () => window.clearInterval(timer));
};
