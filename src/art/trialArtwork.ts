import Phaser from 'phaser';
import { addBreeze } from './villageAtmosphere';
import { fragment, groves, guardianSite, trialHeight, trialWidth, voiceStone } from '../quests/trialLayout';

const terrain = 'bamboo-trial-ground';

export function paintTrial(scene: Phaser.Scene): void {
  if (!scene.textures.exists(terrain)) {
    const art = scene.add.graphics();
    const seed = new Phaser.Math.RandomDataGenerator(['trial-paths']);
    art.fillStyle(0x243f37).fillRect(0, 0, trialWidth, trialHeight);
    art.fillStyle(0x355949).fillRoundedRect(46, 42, 958, 575, 76);
    art.fillStyle(0x728069).fillRoundedRect(168, 150, 123, 387, 54)
      .fillRoundedRect(172, 152, 670, 93, 45)
      .fillRoundedRect(747, 151, 103, 330, 48)
      .fillRoundedRect(208, 446, 627, 72, 35)
      .fillRoundedRect(476, 184, 97, 352, 45);
    for (let i = 0; i < 920; i++) {
      art.fillStyle(seed.pick([0xe8c489, 0x213a30, 0x86a173]), .18);
      art.fillEllipse(seed.between(35, 1015), seed.between(40, 624), seed.between(2, 9), seed.between(2, 4));
    }
    for (const spot of [...Object.values(groves), guardianSite, fragment, voiceStone]) {
      art.fillStyle(0x344a40).fillCircle(spot.x, spot.y, 64);
      art.fillStyle(0x717a61).fillCircle(spot.x, spot.y, 58);
      art.lineStyle(2, 0xe5c783, .68).strokeCircle(spot.x, spot.y, 49);
      art.lineStyle(1, 0xe5c783, .38).strokeCircle(spot.x, spot.y, 42);
      for (const offset of [-52, 52]) {
        art.fillStyle(0x3e3e3e).fillRoundedRect(spot.x + offset - 5, spot.y + 9, 10, 12, 3);
        art.fillStyle(0xf0c27c).fillRoundedRect(spot.x + offset - 4, spot.y + 6, 8, 7, 2);
      }
    }
    for (let i = 0; i < 92; i++) {
      const x = seed.between(15, 1035);
      const y = i % 2 ? seed.between(45, 108) : seed.between(605, 657);
      const height = seed.between(24, 62);
      art.lineStyle(5, seed.pick([0x3a634e, 0x54704c, 0x65805c])).lineBetween(x, y, x + 7, y - height);
      for (let branch = 11; branch < height; branch += 11) {
        art.fillStyle(seed.pick([0x527b56, 0x75915d])).fillTriangle(x + 2, y - branch, x + 19, y - branch - 7, x + 8, y - branch - 1);
      }
    }
    art.generateTexture(terrain, trialWidth, trialHeight);
    art.destroy();
  }
  scene.add.image(0, 0, terrain).setOrigin(0).setDepth(-2);
  addBreeze(scene);
}

export function drawTrialRelic(scene: Phaser.Scene, x: number, y: number): Phaser.GameObjects.Graphics {
  const art = scene.add.graphics({ x, y }).setDepth(y);
  art.fillStyle(0x37565a).fillEllipse(0, 3, 26, 10);
  art.fillStyle(0x74cbb7).fillPoints([{ x: 0, y: -25 }, { x: 11, y: -13 }, { x: 1, y: 0 }, { x: -10, y: -12 }], true);
  art.fillStyle(0xd9fff1).fillTriangle(0, -23, 7, -13, -3, -10);
  return art;
}
