import Phaser from 'phaser';

export function showSlash(scene: Phaser.Scene, origin: Phaser.Math.Vector2, angle: number): void {
  const arc = scene.add.graphics({ x: origin.x, y: origin.y - 10 }).setRotation(angle).setDepth(2000);
  const sweep = [
    { x: 9, y: -28 }, { x: 29, y: -25 }, { x: 41, y: -13 }, { x: 46, y: 1 }, { x: 37, y: 18 },
    { x: 21, y: 28 }, { x: 8, y: 31 }, { x: 25, y: 16 }, { x: 33, y: 3 }, { x: 31, y: -9 }, { x: 24, y: -19 },
  ];
  arc.fillStyle(0x3bbca9, .46).fillPoints(sweep, true);
  arc.lineStyle(4, 0xa9eee0, .9).beginPath().arc(0, 0, 41, -.72, .72).strokePath();
  arc.lineStyle(2, 0xffe5a4, .95).beginPath().arc(0, 0, 43, -.49, .29).strokePath();
  arc.fillStyle(0xfff1bb).fillTriangle(44, -8, 48, -4, 42, -2);
  scene.tweens.add({ targets: arc, rotation: angle + .22, scale: 1.2, alpha: 0,
    duration: 200, ease: 'Quad.out', onComplete: () => arc.destroy() });
}

export function showDodge(scene: Phaser.Scene, sprite: Phaser.GameObjects.Sprite, direction: Phaser.Math.Vector2): void {
  const ghosts = [0, 1].map(index => scene.add.image(
    sprite.x - direction.x * (8 + index * 10), sprite.y - direction.y * (8 + index * 10),
    sprite.texture.key, sprite.frame.name,
  ).setDepth(sprite.depth - .1).setOrigin(sprite.originX, sprite.originY).setAlpha(.4 - index * .15).setTint(0x78d8bd));
  const streaks = scene.add.graphics({ x: sprite.x, y: sprite.y }).setRotation(direction.angle()).setDepth(sprite.depth + .1);
  streaks.lineStyle(2, 0xb7ead2, .8).lineBetween(-29, -9, 1, -9).lineBetween(-22, 2, 5, 2);
  streaks.lineStyle(1, 0xe4c483, .7).lineBetween(-34, -3, -10, -3);
  const targets = [...ghosts, streaks];
  scene.tweens.add({ targets, alpha: 0, duration: 190, onComplete: () => targets.forEach(effect => effect.destroy()) });
}

export function makeObjectiveMarker(scene: Phaser.Scene): Phaser.GameObjects.Graphics {
  const marker = scene.add.graphics().setDepth(1000);
  marker.fillStyle(0x17282b, .8).fillCircle(0, 0, 8);
  marker.fillStyle(0xe9bf79).fillPoints([{ x: 0, y: -6 }, { x: 5, y: 0 }, { x: 0, y: 6 }, { x: -5, y: 0 }], true);
  marker.fillStyle(0xfff1b9).fillTriangle(0, -4, 3, 0, -2, 0);
  return marker;
}
