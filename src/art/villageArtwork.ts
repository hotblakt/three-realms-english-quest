import Phaser from 'phaser';
import { bakeBamboo, placeBamboo } from './villageBamboo';
import { addBreeze, addLanternLight, addSoftShadow } from './villageAtmosphere';

export const villageWidth = 880;
export const villageHeight = 550;
type Graphics = Phaser.GameObjects.Graphics;
type Seed = Phaser.Math.RandomDataGenerator;
const shrine = { x: 458, y: 117 };

export type Roof = { image: Graphics; x: number; y: number };

export function paintVillage(scene: Phaser.Scene): Roof[] {
  if (!scene.textures.exists('village-ground')) bakeLandscape(scene);
  scene.add.image(0, 0, 'village-ground').setOrigin(0).setDepth(-2);
  placeBamboo(scene);
  drawShrineGate(scene);
  const roofs = [
    drawHut(scene, 247, 177, 0x32414f),
    drawHut(scene, 628, 180, 0x4e4247),
  ];
  drawLantern(scene, 382, 222);
  drawLantern(scene, 498, 222);
  drawLantern(scene, 405, 410);
  drawLantern(scene, 476, 410);
  addBreeze(scene);
  return roofs;
}

export function updateRoofOcclusion(roofs: Roof[], x: number, y: number, delta: number): void {
  for (const roof of roofs) {
    // Fade only the tiles, leaving the wall and collision footprint distinct.
    const behindTiles = Math.abs(roof.x - x) < 68 && y > roof.y - 83 && y < roof.y - 4;
    const target = behindTiles ? .68 : 1;
    if (roof.image.alpha === target) continue;
    const alpha = Phaser.Math.Linear(roof.image.alpha, target, 1 - Math.exp(-delta / 85));
    roof.image.setAlpha(Math.abs(alpha - target) < .01 ? target : alpha);
  }
}

function bakeLandscape(scene: Phaser.Scene): void {
  const ground = scene.add.graphics();
  const random = new Phaser.Math.RandomDataGenerator(['hidden-bamboo-wind']);
  ground.fillStyle(0x243e37).fillRect(0, 0, villageWidth, villageHeight);
  for (const [color, width, height] of [
    [0x2e4c40, 854, 484], [0x365744, 786, 425], [0x3e5e48, 645, 386], [0x45644d, 524, 319],
  ]) {
    ground.fillStyle(color, .72).fillEllipse(440, 262, width, height);
  }
  for (let i = 0; i < 1150; i++) {
    const x = random.between(8, 872);
    const y = random.between(10, 545);
    ground.fillStyle(random.pick([0x263c36, 0x90a970, 0x576d53, 0x182e30]), random.realInRange(.1, .32));
    ground.fillEllipse(x, y, random.between(2, 10), random.between(1, 4));
  }
  ground.fillStyle(0x2c423b).fillRoundedRect(72, 212, 736, 117, 55);
  ground.fillStyle(0x6d715b).fillRoundedRect(80, 220, 720, 100, 49);
  ground.fillStyle(0x263f38).fillRoundedRect(381, 95, 120, 369, 50);
  ground.fillStyle(0x6d715b).fillRoundedRect(390, 101, 102, 353, 43);
  drawPaving(ground, random);
  drawPond(ground);
  drawShrineFoundation(ground);
  for (let index = 0; index < 170; index++) {
    const x = random.between(10, 870);
    const y = random.between(48, 518);
    if ((x > 371 && x < 509) || (y > 198 && y < 336) || (x > 545 && y > 326 && y < 449)) continue;
    drawGrass(ground, x, y, random);
  }
  bakeBamboo(scene, ground, random, villageWidth);
  ground.generateTexture('village-ground', villageWidth, villageHeight);
  ground.destroy();
}

function drawPaving(ground: Graphics, random: Seed): void {
  for (let y = 114; y < 448; y += 16) {
    for (let x = 94 + (y % 3) * 7; x < 793; x += 30) {
      const onCrossing = y >= 225 && y <= 311 && (x > 110 && x < 765 || y > 239 && y < 300);
      if (!onCrossing && (x < 399 || x > 468)) continue;
      const left = x + random.between(-3, 1);
      const width = random.between(23, 29);
      const height = random.between(11, 15);
      const slab = [
        { x: left, y: y + 4 }, { x: left + 5, y }, { x: left + width - 6, y: y + 1 },
        { x: left + width, y: y + 4 }, { x: left + width - 3, y: y + height },
        { x: left + 4, y: y + height },
      ];
      ground.fillStyle(0x47544c).fillPoints(slab, true);
      ground.fillStyle(random.pick([0x8e8c75, 0x9a9479, 0x8b8976, 0x948e77, 0x817f6f]));
      ground.fillPoints(slab.map(point => ({ x: point.x, y: point.y - 2 })), true);
      ground.lineStyle(1, 0xc7b795, .43).lineBetween(left + 6, y - 1, left + width - 7, y - 1);
    }
  }
}

function drawPond(ground: Graphics): void {
  ground.fillStyle(0x243f37, .8).fillEllipse(665, 389, 199, 101);
  ground.fillStyle(0x55735b).fillEllipse(665, 384, 188, 92);
  ground.fillStyle(0x2a5554).fillEllipse(665, 382, 177, 82);
  ground.fillStyle(0x397774).fillEllipse(654, 377, 148, 62);
  ground.fillStyle(0x529081, .28).fillEllipse(635, 366, 92, 31);
  for (let i = 0; i < 12; i++) {
    const x = 597 + (i * 47) % 117;
    const y = 358 + i * 4;
    ground.lineStyle(1, 0xa1c9a2, .56).lineBetween(x, y, x + 8 + i % 4 * 4, y);
  }
  for (const [x, y] of [[613, 392], [704, 368], [727, 391], [716, 403]]) {
    ground.fillStyle(0x214c43).fillEllipse(x, y + 2, 21, 9);
    ground.fillStyle(0x6f9060).fillEllipse(x, y, 18, 7);
    ground.fillStyle(0xc7b487).fillTriangle(x - 2, y, x, y - 5, x + 4, y - 1);
  }
}

function drawShrineFoundation(ground: Graphics): void {
  const { x, y } = shrine;
  ground.fillStyle(0x233c36, .8).fillEllipse(x, y + 4, 110, 38);
  ground.fillStyle(0x606d61).fillRoundedRect(x - 40, y - 8, 80, 18, 5);
  ground.fillStyle(0x938d75).fillRoundedRect(x - 35, y - 9, 70, 12, 3);
}

function drawShrineGate(scene: Phaser.Scene): void {
  const { x, y } = shrine;
  const gate = scene.add.graphics().setDepth(y + 4);
  for (const sign of [-1, 1]) {
    gate.fillStyle(0x402e31).fillRect(x + sign * 30 - 4, y - 42, 8, 45);
    gate.fillStyle(0x9b553f).fillRect(x + sign * 30 - 4, y - 43, 5, 42);
    gate.fillStyle(0x282c35).fillRect(x + sign * 30 - 5, y - 2, 10, 6);
  }
  gate.fillStyle(0x9e573f).fillRect(x - 39, y - 35, 78, 5);
  gate.fillStyle(0x352d38).fillPoints([
    { x: x - 48, y: y - 49 }, { x: x - 35, y: y - 45 }, { x: x + 35, y: y - 45 },
    { x: x + 48, y: y - 49 }, { x: x + 46, y: y - 42 }, { x: x - 46, y: y - 42 },
  ], true);
  gate.fillStyle(0xb48d5b).fillRoundedRect(x - 7, y - 43, 14, 15, 2);
  gate.lineStyle(2, 0xd7c790).beginPath().arc(x, y - 38, 4, .4, 5.6).strokePath();
}

function drawGrass(ground: Graphics, x: number, y: number, random: Seed): void {
  ground.fillStyle(0x263f39, .65).fillEllipse(x, y, 21, 8);
  for (let i = -1; i <= 1; i++) {
    ground.fillStyle(random.pick([0x567956, 0x69905e, 0x779767])).fillTriangle(x + i * 3 - 3, y, x + i * 7, y - random.between(5, 11), x + i * 3 + 3, y + 1);
  }
  if (random.frac() < .27) ground.fillStyle(0xd1ba74).fillCircle(x + 2, y - 5, 1.7);
}

function drawHut(scene: Phaser.Scene, x: number, y: number, roof: number): Roof {
  addSoftShadow(scene, x + 9, y - 6, 158, 48, .8);
  const art = scene.add.graphics({ x, y }).setDepth(y);
  art.fillStyle(0x323a36).fillRoundedRect(-54, -11, 108, 13, 3);
  art.fillStyle(0x725743).fillRect(-49, -48, 98, 42);
  art.fillStyle(0x957052).fillRect(-46, -45, 90, 31);
  for (let i = -43; i < 45; i += 7) art.lineStyle(1, 0x604a40, .7).lineBetween(i, -47, i, -7);
  for (const column of [-46, -14, 14, 44]) {
    art.fillStyle(0x493b39).fillRect(column - 2, -48, 4, 41);
    art.fillStyle(0xa7815b, .55).fillRect(column - 2, -47, 1, 39);
  }
  art.fillStyle(0x323139).fillRect(-12, -38, 24, 36);
  art.fillStyle(0x655144).fillRect(-9, -35, 18, 30);
  art.fillStyle(0xa17547).fillCircle(5, -18, 1.5);
  for (const windowX of [-38, 22]) {
    art.fillStyle(0x453937).fillRect(windowX - 2, -34, 20, 18);
    art.fillStyle(0xe6b575).fillRect(windowX, -32, 16, 14);
    art.lineStyle(1, 0x875d46).lineBetween(windowX + 8, -32, windowX + 8, -18).lineBetween(windowX, -25, windowX + 16, -25);
  }
  const tiles = scene.add.graphics({ x, y }).setDepth(y);
  tiles.fillStyle(0x232d35).fillPoints([
    { x: -70, y: -44 }, { x: -47, y: -72 }, { x: -30, y: -83 }, { x: 33, y: -83 },
    { x: 51, y: -71 }, { x: 70, y: -44 }, { x: 65, y: -39 }, { x: -65, y: -39 },
  ], true);
  tiles.fillStyle(roof).fillPoints([
    { x: -65, y: -46 }, { x: -45, y: -72 }, { x: -29, y: -80 }, { x: 31, y: -80 },
    { x: 48, y: -71 }, { x: 65, y: -46 },
  ], true);
  for (let i = 0; i < 5; i++) {
    const half = 63 - i * 7;
    const height = -47 - i * 7;
    tiles.lineStyle(2, 0x27323b, .75).lineBetween(-half, height, half, height);
    tiles.lineStyle(1, 0xb5a087, .38).lineBetween(-half + 2, height - 2, half - 2, height - 2);
    for (let tile = -half + 8 + i % 2 * 5; tile < half - 3; tile += 9) {
      tiles.lineStyle(1, 0x222c36, .45).lineBetween(tile, height - 4, tile + 1, height);
    }
  }
  tiles.fillStyle(0xa4815a).fillRoundedRect(-35, -83, 70, 3, 2);
  tiles.fillStyle(0xc3a26c).fillRect(-62, -44, 124, 2);
  return { image: tiles, x, y };
}

function drawLantern(scene: Phaser.Scene, x: number, y: number): void {
  addLanternLight(scene, x, y);
  const lamp = scene.add.graphics({ x, y }).setDepth(y);
  lamp.fillStyle(0x433531).fillRect(-2, -19, 4, 21);
  lamp.fillStyle(0x463439).fillRoundedRect(-8, -23, 16, 15, 3);
  lamp.fillStyle(0xffcd82).fillRoundedRect(-6, -22, 12, 12, 3);
  lamp.fillStyle(0xffedab).fillRoundedRect(-3, -21, 6, 9, 2);
  lamp.lineStyle(1, 0xb0784c, .8).lineBetween(-5, -17, 5, -17);
}

export function createTrainingDummy(scene: Phaser.Scene, x: number, y: number): Graphics {
  const art = scene.add.graphics({ x, y }).setDepth(y);
  art.fillStyle(0x243d36, .65).fillEllipse(0, 5, 32, 12);
  art.fillStyle(0x523c39).fillRect(-4, -25, 8, 31);
  art.fillStyle(0xa27b59).fillRect(-2, -24, 2, 28);
  art.fillStyle(0x9a7650).fillRoundedRect(-16, -24, 32, 7, 3);
  art.fillStyle(0x544239).fillRoundedRect(-12, -36, 24, 27, 10);
  art.fillStyle(0xc7a169).fillRoundedRect(-10, -35, 20, 23, 8);
  art.fillStyle(0xe3be7d).fillEllipse(-2, -29, 14, 8);
  for (let line = -6; line <= 6; line += 3) art.lineStyle(1, 0x8b6846, .65).lineBetween(line, -29, line - 1, -15);
  art.lineStyle(3, 0x71554a).lineBetween(-10, -20, 10, -21);
  art.lineStyle(1, 0xf2d6a0).lineBetween(-9, -20, 9, -21);
  return art;
}
