import type Phaser from 'phaser';
import assetCatalog from '../../docs/misty-forest-runtime-assets.json';
import { bridge, chest, spirit, width } from '../layout';

export type ForestTexture = keyof typeof assetCatalog.textures;
export type Stratum = 'background' | 'ground' | 'water' | 'deck' | 'mist' | 'foot';

const depth: Record<Exclude<Stratum, 'foot'>, number> = {
  background: -7, ground: -8, water: -4, deck: -3, mist: -.7,
};

export interface Placement {
  key: ForestTexture;
  x: number;
  y: number;
  scale: number;
  layer?: Stratum;
  tint?: number;
  alpha?: number;
  angle?: number;
  flip?: boolean;
}

export function place(scene: Phaser.Scene, p: Placement) {
  const [ox, oy] = assetCatalog.textures[p.key].origin;
  const layer = p.layer ?? 'foot';
  return scene.add.image(p.x, p.y, p.key)
    .setOrigin(ox, oy).setScale(p.scale).setDepth(layer === 'foot' ? p.y : depth[layer])
    .setAngle(p.angle ?? 0).setFlipX(p.flip ?? false).setTint(p.tint ?? 0xffffff).setAlpha(p.alpha ?? 1);
}

export const landmarks = {
  bridge: { key: 'bridge', ...bridge, scale: .84, layer: 'deck', tint: 0xd5dec3 },
  gate: { key: 'torii', x: 900, y: 219, scale: .72, tint: 0xffe6ba },
  shrine: { key: 'spirit-mist', ...spirit, y: spirit.y - 6, scale: .66, alpha: .65 },
  chest: { key: 'chest-closed', ...chest, scale: .62 },
} satisfies Record<string, Placement>;

export const backdrop: readonly Placement[] = [
  { key: 'dense', x: 40, y: 155, scale: 1.32, flip: true },
  { key: 'sparse', x: 138, y: 132, scale: .84 },
  { key: 'dense', x: 384, y: 86, scale: 1.18 },
  { key: 'dense', x: 742, y: 95, scale: 1.1, flip: true },
  { key: 'sparse', x: 1085, y: 95, scale: 1.11 },
  { key: 'dense', x: width - 15, y: 163, scale: 1.3 },
];

export const clearings = [
  { x: 482, y: 713, radius: 170 }, { x: 567, y: 531, radius: 128 },
  { x: bridge.x + 60, y: bridge.y - 18, radius: 116 },
  { x: 905, y: 228, radius: 132 }, { x: 220, y: 450, radius: 100 },
] as const;

export interface Waterfall {
  lip: { x: number; y: number };
  length: number;
  width: number;
  // Future painted face sits in the water layer. The prototype uses the face already in the bridge art.
  face?: Placement;
}

export const falls: readonly Waterfall[] = [
  { lip: { x: bridge.x + 105, y: bridge.y - 67 }, width: 25, length: 17 },
  { lip: { x: bridge.x + 13, y: bridge.y + 44 }, width: 20, length: 13 },
];
