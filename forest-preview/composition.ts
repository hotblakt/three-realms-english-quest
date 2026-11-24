import type Phaser from 'phaser';
import type { EikuDirection } from '../src/art/eikuAnimationConfig';

const base = import.meta.env.BASE_URL;
const directions = ['south', 'north', 'west', 'east'] as const;
export const standingHeight = 44;

export function compositionPanel() {
  const panel = document.querySelector<HTMLDetailsElement>('#composition')!;
  const value = (key: string) => panel.querySelector<HTMLSelectElement>(`[name="${key}"]`)!.value;
  const checked = (key: string) => panel.querySelector<HTMLInputElement>(`[name="${key}"]`)!.checked;
  return {
    panel,
    read: () => ({
      motion: value('motion'),
      speed: Number(value('speed')),
      paused: checked('paused'),
      frame: Number(value('frame')) - 1,
      candidate: value('character') === 'candidate',
      size: Number(value('size')),
      resolution: Number(value('resolution')),
      zoom: Number(value('zoom')),
      smoothing: checked('smoothing'),
      shadow: checked('shadow'),
      light: checked('light'),
      immersive: value('viewport') === 'immersive',
    }),
  };
}

export type CompositionSettings = ReturnType<ReturnType<typeof compositionPanel>['read']>;

export function preloadComposition(scene: Phaser.Scene): void {
  for (const direction of directions) {
    scene.load.image(textureKey(direction, 384), `${base}eiku-composition/${direction}.webp`);
  }
}

function textureKey(direction: EikuDirection, resolution: number): string {
  return `eiku-concept-${direction}-${resolution}`;
}

export function showCandidate(
  scene: Phaser.Scene, image: Phaser.GameObjects.Image, facing: Phaser.Math.Vector2, settings: CompositionSettings,
): void {
  const direction = facing.x ? (facing.x > 0 ? 'east' : 'west') : (facing.y > 0 ? 'south' : 'north');
  const key = textureKey(direction, settings.resolution);
  if (!scene.textures.exists(key)) {
    const master = scene.textures.get(textureKey(direction, 384)).getSourceImage() as HTMLImageElement;
    const variant = scene.textures.createCanvas(key, settings.resolution, settings.resolution)!;
    variant.context.imageSmoothingQuality = 'high';
    variant.context.drawImage(master, 0, 0, settings.resolution, settings.resolution);
    variant.refresh();
  }
  if (image.texture.key !== key) image.setTexture(key);
  const displaySize = standingHeight * settings.size / 100 * 384 / 316;
  image.setOrigin(.5, 338 / 384).setDisplaySize(displaySize, displaySize);
}

// Change the logical width to match the safe-area parent while keeping height and world units stable.
export function useCompositionViewport(game: Phaser.Game): void {
  const parent = document.querySelector<HTMLElement>('#game')!;
  const body = document.body;
  const form = compositionPanel();
  let frame = 0;
  const schedule = () => {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      const immersive = form.read().immersive;
      body.classList.toggle('immersive-forest', immersive);
      const width = immersive && parent.clientHeight
        ? Math.max(1, Math.round(400 * parent.clientWidth / parent.clientHeight)) : 720;
      if (game.scale.gameSize.width !== width) game.scale.setGameSize(width, 400);
    });
  };
  const observer = new ResizeObserver(schedule);
  observer.observe(parent);
  form.panel.addEventListener('change', schedule);
  game.events.once('destroy', () => {
    observer.disconnect();
    form.panel.removeEventListener('change', schedule);
    cancelAnimationFrame(frame);
  });
  schedule();
}
