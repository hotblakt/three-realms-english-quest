import type Phaser from 'phaser';
import {
  eikuDirections, eikuFrameName, eikuMotions, productionFrameCount, productionFrameSize,
} from './eikuAnimationConfig';

export const eikuAtlasKey = 'eiku-production';
const imagePath = '../../art/production/eiku/eiku.png';
const jsonPath = '../../art/production/eiku/eiku.json';

const images = import.meta.glob<string>('../../art/production/eiku/eiku.png', {
  eager: true, import: 'default', query: '?url&no-inline',
});
const definitions = import.meta.glob<string>('../../art/production/eiku/eiku.json', {
  eager: true, import: 'default', query: '?raw',
});

type Frame = { frame: { x: number; y: number; w: number; h: number } };
type Atlas = {
  frames: Record<string, Frame>;
  meta: { size: { w: number; h: number } };
};

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : undefined;
}

function dimension(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function readAtlas(source: string): Atlas | undefined {
  let data: unknown;
  try {
    data = JSON.parse(source);
  } catch {
    return;
  }

  const root = record(data);
  const frames = record(root?.frames);
  const size = record(record(root?.meta)?.size);
  const width = size?.w;
  const height = size?.h;
  if (!frames || !dimension(width) || !dimension(height) || width > 2048 || height > 2048) return;

  const validated: Atlas['frames'] = {};
  for (const direction of eikuDirections) {
    for (const motion of eikuMotions) {
      for (let index = 0; index < productionFrameCount; index++) {
        const name = eikuFrameName(direction, motion, index);
        const entry = record(frames[name]);
        const bounds = record(entry?.frame);
        if (!entry || entry.trimmed || entry.rotated || entry.anchor || entry.pivot || !bounds) return;
        const { x, y, w, h } = bounds;
        if (!dimension(x) || !dimension(y) || w !== productionFrameSize || h !== productionFrameSize
          || x + w > width || y + h > height) return;
        validated[name] = { frame: { x, y, w, h } };
      }
    }
  }
  return { frames: validated, meta: { size: { w: width, h: height } } };
}

const atlas = definitions[jsonPath] ? readAtlas(definitions[jsonPath]) : undefined;

export function preloadEikuAtlas(scene: Phaser.Scene): void {
  const url = images[imagePath];
  if (url && atlas && !scene.textures.exists(eikuAtlasKey)) {
    scene.load.atlas(eikuAtlasKey, url, atlas);
  }
}

export function hasEikuAtlas(scene: Phaser.Scene): boolean {
  if (!atlas || !scene.textures.exists(eikuAtlasKey)) return false;
  const [{ width, height }] = scene.textures.get(eikuAtlasKey).source;
  return width === atlas.meta.size.w && height === atlas.meta.size.h;
}
