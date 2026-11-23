import Phaser from 'phaser';
import { createEiku } from '../../../src/art/eikuSprite';
import { productionFoot, productionScale } from '../../../src/art/eikuAnimationConfig';

const background = document.querySelector('#background');
const anchor = document.querySelector('#anchor');
const zoom = document.querySelector('#zoom');
const status = document.querySelector('#status');
const canvases = [document.querySelector('#current'), document.querySelector('#candidate')];
const foot = { x: 72, y: 78 };

function readCurrentFrame() {
  return new Promise(resolve => {
    new Phaser.Game({
      type: Phaser.CANVAS,
      parent: 'phaser-source',
      width: 56,
      height: 56,
      audio: { noAudio: true },
      banner: false,
      scene: {
        create() {
          const sprite = createEiku(this, 0, 0);
          const { frame } = sprite;
          const copy = document.createElement('canvas');
          copy.width = frame.cutWidth;
          copy.height = frame.cutHeight;
          copy.getContext('2d').drawImage(sprite.texture.getSourceImage(),
            frame.cutX, frame.cutY, copy.width, copy.height, 0, 0, copy.width, copy.height);
          resolve({ image: copy, x: sprite.displayOriginX, y: sprite.displayOriginY, scale: sprite.scaleX });
          this.game.destroy(true);
        },
      },
    });
  });
}

async function start() {
  const candidate = new Image();
  candidate.src = new URL('./eiku-front-idle-preview.png', import.meta.url);
  await candidate.decode();
  const frames = [
    await readCurrentFrame(),
    { image: candidate, x: productionFoot.x, y: productionFoot.y, scale: productionScale },
  ];

  function render() {
    canvases.forEach((canvas, index) => {
      const context = canvas.getContext('2d');
      const { image, x, y, scale } = frames[index];
      context.fillStyle = background.value;
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.imageSmoothingQuality = 'high';
      context.drawImage(image, foot.x - x * scale, foot.y - y * scale, image.width * scale, image.height * scale);
      if (anchor.checked) {
        context.strokeStyle = '#f9be5e';
        context.setLineDash([4, 3]);
        context.beginPath();
        context.moveTo(.5, foot.y + .5);
        context.lineTo(canvas.width, foot.y + .5);
        context.moveTo(foot.x + .5, 0);
        context.lineTo(foot.x + .5, canvas.height);
        context.stroke();
      }
    });
  }

  background.addEventListener('change', render);
  anchor.addEventListener('change', render);
  zoom.addEventListener('change', () => document.querySelector('.comparison').classList.toggle('zoom', zoom.checked));
  render();
  status.textContent = '同場比較已載入。可切換背景檢查輪廓及去背邊緣。';
}

start().catch(() => {
  status.textContent = '無法讀取比較圖。請透過 Vite 本機伺服器開啟。';
});
