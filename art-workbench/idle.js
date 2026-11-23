import idleUrl from '../art/reference/eiku-idle-candidate.png?url';
import atlas from '../art/preview/eiku-idle/eiku-idle-preview.json';

export function loadImage(url) {
  const image = new Image();
  image.src = url;
  return image.decode().then(() => image);
}

export function mountIdlePreview() {
  const section = document.querySelector('#idle');
  const play = document.querySelector('#idle-play');
  const step = document.querySelector('#idle-step');
  const label = document.querySelector('#idle-frame');
  const status = document.querySelector('#idle-status');
  const views = [...section.querySelectorAll('canvas')].map(canvas => ({
    context: canvas.getContext('2d'),
    frames: atlas.frames[canvas.dataset.direction],
  }));
  const count = views[0].frames.length;
  let image;
  let loading = false;
  let frame = 0;
  let timer;

  function render() {
    for (const { context, frames } of views) {
      const [x, y, width, height] = frames[frame];
      context.clearRect(0, 0, 222, 222);
      context.drawImage(image, x, y, width, height, 0, 0, width, height);
    }
    label.textContent = `第 ${frame + 1}／${count} 格・${atlas.fps} 格／秒`;
  }

  function advance() {
    frame = (frame + 1) % count;
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
  section.addEventListener('toggle', async () => {
    if (!section.open) {
      setPlaying(false);
      return;
    }
    if (image || loading) return;
    loading = true;
    status.textContent = '正在載入四向參考圖…';
    try {
      image = await loadImage(idleUrl);
      render();
      play.disabled = false;
      step.disabled = false;
      status.textContent = '';
      setPlaying(section.open && !matchMedia('(prefers-reduced-motion: reduce)').matches);
    } catch {
      status.textContent = '四向參考圖載入失敗。請關閉後再開啟重試。';
    } finally {
      loading = false;
    }
  });
}
