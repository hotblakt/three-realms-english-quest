import Phaser from 'phaser';

export const villageWidth = 880;
export const villageHeight = 550;

export function paintVillage(scene: Phaser.Scene): void {
  if (!scene.textures.exists('village-ground')) bakeLandscape(scene);
  scene.add.image(0, 0, 'village-ground').setOrigin(0).setDepth(-1);
  scene.add.image(0, 0, 'village-canopy').setOrigin(0).setDepth(490);
  hut(scene, 247, 177);
  hut(scene, 628, 180);
  for (const x of [382, 498]) {
    const lamp = scene.add.graphics({ x, y: 222 }).setDepth(222);
    lamp.fillStyle(0xf1c975, .24).fillCircle(0, -13, 21);
    lamp.fillStyle(0x442f2a).fillRect(-2, -17, 4, 21);
    lamp.fillStyle(0xffd987).fillRoundedRect(-6, -20, 12, 13, 3);
  }
}

function bakeLandscape(scene: Phaser.Scene): void {
  const ground = scene.add.graphics();
  const canopy = scene.add.graphics();
  const random = new Phaser.Math.RandomDataGenerator(['hidden-bamboo']);
  ground.fillStyle(0x42664b).fillRect(0, 0, villageWidth, villageHeight);
  ground.fillStyle(0x587c58).fillEllipse(440, 260, 710, 415);
  ground.fillStyle(0xa39165).fillRoundedRect(75, 220, 720, 102, 45);
  ground.fillStyle(0xb4a375).fillRoundedRect(81, 227, 708, 87, 39);
  ground.fillStyle(0xa39165).fillRoundedRect(392, 108, 97, 345, 32);
  ground.fillStyle(0xb4a375).fillRoundedRect(399, 113, 83, 334, 26);
  for (let i = 0; i < 950; i++) {
    ground.fillStyle(random.pick([0xf8e2a2, 0x233b2c]), random.realInRange(.06, .21));
    ground.fillEllipse(random.between(0, villageWidth), random.between(0, villageHeight), random.between(2, 7), 2);
  }
  ground.fillStyle(0x254c49).fillEllipse(665, 385, 183, 95);
  ground.fillStyle(0x43766d).fillEllipse(665, 382, 158, 70);
  ground.lineStyle(2, 0x80ab8a, .72);
  for (let i = 0; i < 8; i++) ground.lineBetween(607 + i * 12, 366 + i * 5, 626 + i * 12, 366 + i * 5);

  for (let i = 0; i < 112; i++) {
    const x = random.between(15, 865);
    const y = random.pick([random.between(22, 82), random.between(490, 545)]);
    const bamboo = y < 100 ? ground : canopy;
    const height = random.between(30, 81);
    bamboo.fillStyle(0x234a36).fillEllipse(x, y, 26, 8);
    bamboo.lineStyle(4, random.pick([0x688452, 0x8d9c5b, 0x3c674b])).lineBetween(x, y, x + 5, y - height);
    for (let j = 12; j < height; j += 12) {
      bamboo.lineStyle(1, 0xe5d199, .9).lineBetween(x + 1, y - j, x + 7, y - j);
      bamboo.fillStyle(random.pick([0x294d39, 0x426d46, 0x63894a])).fillEllipse(x + (j % 24 ? 10 : -6), y - j, 23, 5);
    }
  }

  ground.generateTexture('village-ground', villageWidth, villageHeight);
  canopy.generateTexture('village-canopy', villageWidth, villageHeight);
  ground.destroy();
  canopy.destroy();
}

function hut(scene: Phaser.Scene, x: number, y: number): void {
  const art = scene.add.graphics({ x, y }).setDepth(y);
  art.fillStyle(0x2a4535, .5).fillEllipse(0, 3, 137, 32);
  art.fillStyle(0x78533f).fillRect(-48, -49, 96, 51);
  art.fillStyle(0xb28355).fillRect(-44, -45, 88, 42);
  art.fillStyle(0x3b3230).fillRect(-10, -35, 20, 38);
  art.fillStyle(0xffd28d).fillRect(-34, -32, 15, 13).fillRect(19, -32, 15, 13);
  art.fillStyle(0x523437).fillPoints([
    { x: -65, y: -44 }, { x: -42, y: -76 }, { x: 42, y: -76 }, { x: 65, y: -44 },
  ], true);
  art.lineStyle(3, 0xa96254).lineBetween(-56, -48, 56, -48).lineBetween(-48, -59, 48, -59).lineBetween(-41, -70, 41, -70);
}
