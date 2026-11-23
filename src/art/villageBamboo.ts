import type Phaser from 'phaser';

type Graphics = Phaser.GameObjects.Graphics;
type Seed = Phaser.Math.RandomDataGenerator;
type Stem = { x: number; y: number; frame: string };

const atlas = 'village-bamboo-depth';
const north = 'village-bamboo-north';
const south = 'village-bamboo-south';
const southTop = 360;
const cellWidth = 80;
const cellHeight = 122;
const columns = 12;
const rootY = 116;
const stems = new WeakMap<Phaser.Textures.TextureManager, Stem[]>();

export function bakeBamboo(scene: Phaser.Scene, ground: Graphics, random: Seed, width: number): void {
  const back = scene.add.graphics();
  const front = scene.add.graphics();
  const packed = scene.add.graphics();
  const placements: Stem[] = [];
  for (let i = 0; i < 125; i++) {
    const x = random.between(8, 873);
    const y = i % 2 ? random.between(474, 554) : random.between(37, 119);
    ground.fillStyle(0x1b352f, .56).fillEllipse(x, y + 2, 32, 7);

    // Combine plants outside the walkable bounds; pack the rest by their actual roots.
    if (y <= 73 || y >= 490) {
      const near = y >= 490;
      drawBamboo(near ? front : back, x, near ? y - southTop : y, random);
    } else {
      const index = placements.length;
      drawBamboo(packed, (index % columns + .5) * cellWidth, Math.floor(index / columns) * cellHeight + rootY, random);
      placements.push({ x, y, frame: String(index) });
    }
  }

  back.generateTexture(north, width, 80);
  front.generateTexture(south, width, 200);
  packed.generateTexture(atlas, columns * cellWidth, Math.ceil(placements.length / columns) * cellHeight);
  const texture = scene.textures.get(atlas);
  placements.forEach(({ frame }, i) => {
    texture.add(frame, 0, i % columns * cellWidth, Math.floor(i / columns) * cellHeight, cellWidth, cellHeight);
  });
  stems.set(scene.textures, placements);
  back.destroy();
  front.destroy();
  packed.destroy();
}

export function placeBamboo(scene: Phaser.Scene): void {
  scene.add.image(0, 0, north).setOrigin(0).setDepth(73);
  scene.add.image(0, southTop, south).setOrigin(0).setDepth(490);
  for (const { x, y, frame } of stems.get(scene.textures) ?? []) {
    scene.add.image(x, y, atlas, frame).setOrigin(.5, rootY / cellHeight).setDepth(y);
  }
}

function drawBamboo(ground: Graphics, x: number, y: number, random: Seed): void {
  const height = random.between(49, 112);
  const bend = random.between(-12, 14);
  ground.lineStyle(7, 0x1b3931).lineBetween(x, y, x + bend, y - height);
  ground.lineStyle(4, random.pick([0x527550, 0x688553, 0x7f945d, 0x42694f])).lineBetween(x - 1, y, x + bend - 1, y - height);
  for (let i = 11; i < height; i += 11) {
    const joint = x + bend * i / height;
    ground.lineStyle(1, 0xb0ad74, .65).lineBetween(joint - 3, y - i, joint + 3, y - i);
    if (i < 20) continue;
    const side = i % 22 ? 1 : -1;
    ground.lineStyle(1, 0x648359).lineBetween(joint, y - i, joint + side * 16, y - i - 8);
    ground.fillStyle(random.pick([0x345d47, 0x466f4e, 0x5d8457, 0x779759]));
    ground.fillPoints([
      { x: joint + side * 3, y: y - i - 3 }, { x: joint + side * 13, y: y - i - 9 },
      { x: joint + side * 25, y: y - i - 9 }, { x: joint + side * 17, y: y - i - 4 },
    ], true);
  }
}
