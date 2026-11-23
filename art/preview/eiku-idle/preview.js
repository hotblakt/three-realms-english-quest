const play = document.querySelector('#play');
const step = document.querySelector('#step');
const guides = document.querySelector('#guides');
const frameLabel = document.querySelector('#frame');
const canvases = [...document.querySelectorAll('canvas[data-direction]')];

async function start() {
  const atlasUrl = new URL('./eiku-idle-preview.json', import.meta.url);
  const response = await fetch(atlasUrl);
  if (!response.ok) throw new Error('Atlas unavailable');
  const atlas = await response.json();
  const image = new Image();
  image.src = new URL(atlas.image, atlasUrl);
  await image.decode();

  const directions = canvases.map(canvas => ({
    canvas,
    ctx: canvas.getContext('2d'),
    frames: atlas.frames[canvas.dataset.direction],
  }));
  const frameCount = directions[0].frames.length;
  let index = 0;
  let timer;

  function render() {
    for (const { canvas, ctx, frames } of directions) {
      const [x, y, width, height] = frames[index];
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, x, y, width, height, 0, 0, width, height);
      if (guides.checked) {
        ctx.strokeStyle = '#00a3a5';
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.moveTo(111.5, 0);
        ctx.lineTo(111.5, height);
        ctx.moveTo(0, 208.5);
        ctx.lineTo(width, 208.5);
        ctx.stroke();
      }
    }
    frameLabel.textContent = `第 ${index + 1}／${frameCount} 格`;
  }

  function advance() {
    index = (index + 1) % frameCount;
    render();
  }

  function setPlaying(playing) {
    clearInterval(timer);
    timer = playing ? setInterval(advance, 1000 / atlas.fps) : undefined;
    play.textContent = playing ? '暫停' : '播放';
  }

  play.addEventListener('click', () => setPlaying(timer === undefined));
  step.addEventListener('click', () => {
    setPlaying(false);
    advance();
  });
  guides.addEventListener('change', render);
  play.disabled = false;
  step.disabled = false;
  render();
  setPlaying(!matchMedia('(prefers-reduced-motion: reduce)').matches);
}

start().catch(() => {
  document.querySelector('#error').hidden = false;
});
