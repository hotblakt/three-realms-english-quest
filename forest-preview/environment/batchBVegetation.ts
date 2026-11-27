import type Phaser from 'phaser';
import { addSoftShadow } from '../../src/art/villageAtmosphere';
import { props } from '../layout';
import { drawEcologyFloor, drawGrove } from './ecology';
import { backdrop, clearings, place } from './placement';

type Block = (x: number, y: number, width: number, height: number) => void;

// Art variation is independent of the original physical trunk/rock footprints.
const smallerClumps = new Set([2, 8, 13, 19, 25, 31, 35, 47]);
const litClumps = new Set([5, 16, 24, 33, 39]);

export function drawVegetation(scene: Phaser.Scene, block: Block): Phaser.GameObjects.Image[] {
  for (const entry of backdrop) place(scene, { ...entry, layer: 'background', tint: 0x527877, alpha: .48 });
  drawEcologyFloor(scene);
  const canopy: Phaser.GameObjects.Image[] = [];
  for (const [index, [x, y, scale, key]] of props.entries()) {
    const bamboo = key === 'dense' || key === 'sparse';
    const rock = key.startsWith('rock-');
    const small = bamboo && smallerClumps.has(index);
    const grove = bamboo ? drawGrove(scene, index, x, y, scale) : undefined;
    const item = grove?.[0] ?? place(scene, { key: small ? 'sparse' : key, x, y,
      scale: small ? scale * .86 : scale,
      flip: index % 5 === 0 || index % 5 === 3,
      tint: litClumps.has(index) ? 0xcdcd9a : index % 3 ? 0xa4ba9b : 0x86a99c,
    });
    addSoftShadow(scene, x, y, (bamboo ? 103 : 73) * scale, 25 * scale, .57);
    if (bamboo) {
      canopy.push(...(grove ?? [item]));
      block(x, y - 2, 36 * scale, 17 * scale);
    } else if (rock) {
      block(x, y - 8, item.displayWidth * .58, 21 * scale);
    }
  }
  for (const [index, [x, y, scale]] of [
    [318, 663, .48], [317, 703, .58], [463, 658, .34], [487, 574, .44],
    [573, 644, .40], [787, 365, .40], [821, 298, .55], [972, 239, .50],
  ].entries()) {
    place(scene, { key: 'underbrush', x, y, scale, layer: 'ground', tint: 0xa8b888, flip: index % 3 === 0 });
  }
  return canopy;
}
