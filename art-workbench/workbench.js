import './style.css';
import { candidates, defaultCandidate } from './candidates';
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
  const images = new Map();
  function loadCandidate(key) {
    if (!images.has(key)) {
      images.set(key, loadImage(candidates[key].url).catch(error => {
        images.delete(key);
        throw error;
      }));
    }
    return images.get(key);
  }

  const [{ current, village }, initial] = await Promise.all([readGameArt(), loadCandidate(defaultCandidate)]);
  let selected = defaultCandidate;
  let image = initial;
  let requestId = 0;

  function render() {
    byId('scale-value').textContent = `${scaleInput.value}%`;
    byId('offset-x-value').textContent = xInput.value;
    byId('offset-y-value').textContent = yInput.value;
    const asset = candidates[selected];
    byId('candidate-title').textContent = asset.title;
    candidateInfo.textContent = `${image.width} × ${image.height}・${asset.info}`;
    warning.textContent = asset.warning;
    const frame = { ...asset, image, source: asset.crop ?? [0, 0, image.width, image.height] };
    draw(currentCanvas, current, village, 0, 0);
    draw(candidateCanvas, frame, village, xInput.valueAsNumber, yInput.valueAsNumber);
  }

  source.addEventListener('change', async () => {
    const key = source.value;
    const request = ++requestId;
    status.textContent = '正在載入候選圖…';
    try {
      const loaded = await loadCandidate(key);
      if (request !== requestId) return;
      image = loaded;
      selected = key;
      status.textContent = '';
      render();
    } catch {
      if (request !== requestId) return;
      source.value = selected;
      status.textContent = '候選圖無法載入，已保留上一張。';
    }
  });

  for (const control of [scaleInput, xInput, yInput, background, sampling, guides]) {
    control.addEventListener('input', render);
  }
  byId('reset').addEventListener('click', () => {
    scaleInput.value = '100';
    xInput.value = yInput.value = '0';
    background.value = 'village';
    sampling.value = 'smooth';
    requestId++;
    source.value = selected = defaultCandidate;
    image = initial;
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
