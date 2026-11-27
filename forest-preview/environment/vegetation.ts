import type Phaser from 'phaser';
import { addBreeze, addSoftShadow } from '../../src/art/villageAtmosphere';
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

export function drawAtmosphere(scene: Phaser.Scene): Phaser.GameObjects.Image[] {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const texture = scene.textures.createCanvas('forest-filtered-light', 128, 128)!;
  const ctx = texture.context;
  const light = ctx.createRadialGradient(64,64,6,64,64,63);
  light.addColorStop(0, 'rgba(255,222,145,.33)');
  light.addColorStop(.45, 'rgba(239,218,141,.17)');
  light.addColorStop(1, 'rgba(239,218,141,0)');
  ctx.fillStyle = light;
  ctx.fillRect(0, 0, 128, 128);
  texture.refresh();
  const pools = clearings.slice(0, 4).map(({ x, y, radius }, i) => scene.add.image(x, y-22, texture.key)
    .setDisplaySize(radius * 2.04, radius * .77).setAngle(-24 + i * 4).setDepth(-1.47).setAlpha(.78));
  for (const [index, [x, y, scale, alpha]] of [
    [273, 324, 1.33, .32], [765, 157, 1.4, .27], [681, 615, .98, .22], [1028, 488, 1.25, .19],
  ].entries()) {
    const fog = place(scene, { key:'mist', x, y, scale, alpha, layer:'mist', flip: index % 2 === 0 });
    if (!reduce) scene.tweens.add({
      targets: fog, x: x + 27, alpha: alpha * 1.24, duration: 5100 + index * 470,
      yoyo: true, repeat: -1, ease: 'Sine.inOut',
    });
  }
  addBreeze(scene);
  return pools;
}
