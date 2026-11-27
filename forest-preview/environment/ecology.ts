import type Phaser from 'phaser';
import provenance from '../../docs/forest-batch-b-provenance.json';
import { loadOptionalImage } from '../startup';

const atlas = 'forest-batch-b';
type Frame = keyof typeof provenance.frames;
type Crown = Extract<Frame, `canopy-${string}`>;

interface Grove {
  trunk: 'bamboo-01' | 'bamboo-02';
  crown: Crown;
  crownOffset: number;
  root?: true;
}

// Index into the existing prop footprints. Terrain and collider coordinates stay in layout.ts.
const groves: Readonly<Partial<Record<number, Grove>>> = {
  6: { trunk: 'bamboo-01', crown: 'canopy-02', crownOffset: -15 },
  8: { trunk: 'bamboo-02', crown: 'canopy-03', crownOffset: 16, root: true },
  13: { trunk: 'bamboo-02', crown: 'canopy-02', crownOffset: 15 },
  20: { trunk: 'bamboo-02', crown: 'canopy-03', crownOffset: 18 },
  22: { trunk: 'bamboo-01', crown: 'canopy-01', crownOffset: -18, root: true },
  24: { trunk: 'bamboo-02', crown: 'canopy-03', crownOffset: -14 },
  30: { trunk: 'bamboo-01', crown: 'canopy-01', crownOffset: 18 },
  34: { trunk: 'bamboo-01', crown: 'canopy-02', crownOffset: -17 },
  38: { trunk: 'bamboo-02', crown: 'canopy-03', crownOffset: 14 },
  44: { trunk: 'bamboo-02', crown: 'canopy-02', crownOffset: 16 },
  46: { trunk: 'bamboo-01', crown: 'canopy-01', crownOffset: -19, root: true },
};

const floor: readonly (readonly [Frame, number, number, number, number])[] = [
  ['moss-01', 437, 757, .72, -11], ['leaf-litter-01', 517, 731, .65, 14],
  ['leaf-litter-01', 225, 440, .63, -13], ['moss-01', 159, 433, .72, 8],
  ['wet-ground-02', 598, 482, .73, 14], ['wet-ground-02', 758, 412, .61, -24],
  ['moss-01', 803, 380, .60, 17], ['leaf-litter-01', 875, 256, .70, -19],
  ['moss-01', 960, 169, .65, 14],
];

export function requestEcology() {
  const { image, size, sha256 } = provenance.meta;
  return loadOptionalImage(`${import.meta.env.BASE_URL}forest-batch-b/${image}?v=${sha256.slice(0, 16)}`,
    size.w, size.h);
}

export function registerEcology(scene: Phaser.Scene, image: HTMLImageElement): void {
  if (!scene.textures.exists(atlas)) scene.textures.addAtlas(atlas, image, { frames: provenance.frames });
}

export function drawEcologyFloor(scene: Phaser.Scene): void {
  if (!scene.textures.exists(atlas)) return;
  for (const [frame, x, y, scale, angle] of floor) {
    scene.add.image(x, y, atlas, frame).setDepth(-6).setScale(scale)
      .setAngle(angle).setTint(0xb9c69b).setAlpha(.83);
  }
}

export function drawGrove(scene: Phaser.Scene, index: number, x: number, y: number, scale: number):
  Phaser.GameObjects.Image[] | undefined {
  const grove = groves[index];
  if (!grove || !scene.textures.exists(atlas)) return;
  // The trunk is drawn over the root's flat top within the same foot-sorted group.
  const root = grove.root ?
    scene.add.image(x + scale, y, atlas, 'root-04').setOrigin(.49, .97)
      .setScale(.37 * scale).setDepth(y - .025).setTint(0xa6b884) : undefined;
  const trunk = scene.add.image(x, y, atlas, grove.trunk).setOrigin(.51, .97)
    .setScale(1.13 * scale).setDepth(y).setTint(0xb3c8a4);
  const crown = scene.add.image(x + grove.crownOffset * scale, y, atlas, grove.crown)
    .setScale(.88 * scale).setDepth(y + .025).setTint(0xa9c297);
  // A displaced image origin keeps the canopy at the trunk's sorting foot.
  crown.setOrigin(.5, 1 + 89 * scale / crown.displayHeight);
  return root ? [root, trunk, crown] : [trunk, crown];
}
