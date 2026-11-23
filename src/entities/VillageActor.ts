import Phaser from 'phaser';

export function drawActor(scene: Phaser.Scene, x: number, y: number, elder = false): Phaser.GameObjects.Container {
  const art = scene.add.graphics();
  art.fillStyle(0x19392e, .55).fillEllipse(0, 8, 25, 12);
  art.fillStyle(elder ? 0xd6a156 : 0x234963).fillRoundedRect(-9, -12, 18, 20, 5);
  art.fillStyle(elder ? 0xf4dfae : 0xef6c5b).fillRect(-9, -5, 18, 4);
  art.fillStyle(0xf4c5a1).fillCircle(0, -17, 8);
  art.fillStyle(elder ? 0xe9e4d7 : 0x172534).fillEllipse(0, -22, 18, 10);
  if (elder) art.fillTriangle(-6, -16, 6, -16, 0, -5);
  art.fillStyle(0x182824).fillCircle(-3, -17, 1).fillCircle(3, -17, 1);
  return scene.add.container(x, y, [art]).setDepth(y);
}
