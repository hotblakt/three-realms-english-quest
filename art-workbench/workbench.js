import './style.css';
import { productionFoot, productionScale } from '../src/art/eikuAnimationConfig';
import previewUrl from '../art/preview/eiku-front-master/eiku-front-idle-preview.png?url';
import originalUrl from '../art/reference/eiku-front-master-candidate.png?url';
import { feet, readGameArt, viewport } from './game-art';
import { loadImage, mountIdlePreview } from './idle';

const byId = id => document.getElementById(id);
const currentCanvas = byId('current');
const candidateCanvas = byId('candidate');
const scaleInput = byId('scale');
const xInput = byId('offset-x');
const yInput = byId('offset-y');
const background = byId('background');
const sampling = byId('sampling');
const source = byId('source');
const guides = byId('guides');
const status = byId('comparison-status');
const candidateInfo = byId('candidate-info');
const warning = byId('asset-warning');

const colors = { bamboo: '#385648', dark: '#142728', light: '#e6decd' };

function draw(canvas, frame, village, offsetX, offsetY) {
  const context = canvas.getContext('2d');
  const smooth = sampling.value === 'smooth';
  canvas.classList.toggle('pixelated', !smooth);
  context.imageSmoothingEnabled = smooth;
  context.imageSmoothingQuality = 'high';
  if (background.value === 'village') {
    context.drawImage(village, 0, 0);
  } else {
    context.fillStyle = colors[background.value];
    context.fillRect(0, 0, viewport.width, viewport.height);
  }

  const x = feet.x + offsetX;
  const y = feet.y + offsetY;
  const scale = scaleInput.valueAsNumber / 100 * frame.scale;
  const [sx, sy, width, height] = frame.source;
  context.drawImage(frame.image, sx, sy, width, height,
    x - frame.x * scale, y - frame.y * scale, width * scale, height * scale);

  if (!guides.checked) return;
  context.strokeStyle = '#ffe093';
  context.setLineDash([4, 3]);
  context.beginPath();
  context.moveTo(0, feet.y + .5);
  context.lineTo(viewport.width, feet.y + .5);
  context.moveTo(feet.x + .5, 0);
  context.lineTo(feet.x + .5, viewport.height);
  context.stroke();
  context.fillStyle = '#fae7b9';
  context.fillRect(x - 2, y - 2, 5, 5);
}

async function start() {
  const [{ current, village }, image] = await Promise.all([readGameArt(), loadImage(previewUrl)]);
  const preview = { image, source: [0, 0, image.width, image.height], ...productionFoot, scale: productionScale };
  let original;
  let request;

  function render() {
    byId('scale-value').textContent = `${scaleInput.value}%`;
    byId('offset-x-value').textContent = xInput.value;
    byId('offset-y-value').textContent = yInput.value;
    const raw = source.value === 'original' && original;
    const frame = raw ? original : preview;
    candidateInfo.textContent = raw
      ? `${frame.image.width} × ${frame.image.height}・RGB・無 alpha（取主體區域等比顯示）`
      : `${image.width} × ${image.height}・RGBA・去背衍生預覽`;
    warning.textContent = raw
      ? '原圖沒有 alpha。近白背景是原始像素，畫布保留這些像素。'
      : '去背預覽有透明邊，比例、邊緣與小尺寸可讀性仍待修正。';
    draw(currentCanvas, current, village, 0, 0);
    draw(candidateCanvas, frame, village, xInput.valueAsNumber, yInput.valueAsNumber);
  }

  source.addEventListener('change', async () => {
    if (source.value === 'original' && !original) {
      status.textContent = '正在載入原始主視覺…';
      try {
        request ??= loadImage(originalUrl);
        const image = await request;
        // Same 65 px target silhouette height as the packed candidate, before applying 2/3.
        original = { image, source: [275, 0, 760, 1312], x: 325, y: 1258, scale: 65 / 1205 * productionScale };
      } catch {
        request = undefined;
        source.value = 'preview';
        status.textContent = '原始主視覺無法載入，已返回去背預覽。';
        render();
        return;
      }
    }
    status.textContent = '';
    render();
  });

  for (const control of [scaleInput, xInput, yInput, background, sampling, guides]) {
    control.addEventListener('input', render);
  }
  byId('reset').addEventListener('click', () => {
    scaleInput.value = '100';
    xInput.value = yInput.value = '0';
    background.value = 'village';
    sampling.value = 'smooth';
    source.value = 'preview';
    guides.checked = true;
    status.textContent = '';
    render();
  });

  byId('current-info').textContent = `${current.source[2]} × ${current.source[3]}・取自 Phaser 角色影格`;
  status.textContent = '';
  render();
}

mountIdlePreview();
start().catch(() => {
  status.textContent = '比較圖載入失敗。請重新整理後再試。';
});
