import type Phaser from 'phaser';
import provenance from '../../docs/forest-batch-a-provenance.json';
import { addSoftShadow } from '../../src/art/villageAtmosphere';

const runtime = provenance.runtime;
type CreekPiece = Exclude<keyof typeof runtime, 'batch-water'>;

interface CreekPlacement {
  key: CreekPiece;
  x: number;
  y: number;
  width: number;
  origin: readonly [number, number];
  flip?: boolean;
}

const shoreOrigin = [.69, .72] as const;
export const shoreline: readonly CreekPlacement[] = [
  { key: 'batch-shoal', x: 521, y: 815, width: 108, origin: shoreOrigin },
  { key: 'batch-bank', x: 573, y: 616, width: 126, origin: shoreOrigin },
  { key: 'batch-shoal', x: 648, y: 568, width: 100, origin: [.36, .75], flip: true },
  { key: 'batch-bank', x: 765, y: 232, width: 116, origin: shoreOrigin },
  { key: 'batch-shoal', x: 862, y: 130, width: 95, origin: [.35, .75], flip: true },
];

export const upstreamFall = {
  face: { key: 'batch-falls', x: 751, y: 304, width: 131, origin: [.58, .29] },
  pool: { x: 729, y: 365 },
  spray: { x: 743, y: 336, width: 21, length: 18 },
} satisfies { face: CreekPlacement; pool: { x: number; y: number }; spray: { x: number; y: number; width: number; length: number } };

export function preloadCreekArt(scene: Phaser.Scene): void {
  for (const [key, entry] of Object.entries(runtime)) {
    scene.load.image(key, `${import.meta.env.BASE_URL}forest-batch-a/${entry.url}`);
  }
}

export function placeCreekArt(scene: Phaser.Scene, item: CreekPlacement, depth: number): void {
  if (!scene.textures.exists(item.key)) return;
  const image = scene.add.image(item.x, item.y, item.key);
  image.setOrigin(...item.origin).setScale(item.width / image.width)
    .setDepth(depth).setFlipX(item.flip ?? false).setTint(0xd2d6be);
  addSoftShadow(scene, item.x, item.y + 9, item.width * .73, item.width * .22, .68).setDepth(depth - .03);
}
