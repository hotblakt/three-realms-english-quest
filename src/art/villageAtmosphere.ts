import type Phaser from 'phaser';

const shadow = 'village-contact-shadow';
const gold = 'village-lantern-soft-light';
const leaf = 'village-airborne-leaf';
const wind = 'village-breeze-streak';

function gradient(scene: Phaser.Scene, key: string, color: string, opacity: number): void {
  if (scene.textures.exists(key)) return;
  const texture = scene.textures.createCanvas(key, 64, 64)!;
  const context = texture.context;
  const ramp = context.createRadialGradient(32, 32, 0, 32, 32, 32);
  ramp.addColorStop(0, `rgba(${color},${opacity})`);
  ramp.addColorStop(.43, `rgba(${color},${opacity * .65})`);
  ramp.addColorStop(1, `rgba(${color},0)`);
  context.fillStyle = ramp;
  context.fillRect(0, 0, 64, 64);
  texture.refresh();
}

export function addSoftShadow(scene: Phaser.Scene, x: number, y: number, width: number, height: number, alpha = 1) {
  gradient(scene, shadow, '13, 24, 31', .65);
  return scene.add.image(x, y, shadow).setDisplaySize(width, height).setDepth(-1.8).setAlpha(alpha);
}

export function addLanternLight(scene: Phaser.Scene, x: number, y: number): void {
  gradient(scene, gold, '255, 193, 106', .4);
  const pool = scene.add.image(x, y + 1, gold).setDisplaySize(61, 27).setDepth(-1.6);
  const halo = scene.add.image(x, y - 15, gold).setDisplaySize(51, 51).setDepth(-1.55).setAlpha(.69);
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches && !matchMedia('(any-pointer: coarse)').matches) {
    scene.tweens.add({
      targets: [pool, halo], alpha: .54, duration: 1950 + x % 400, yoyo: true, repeat: -1, ease: 'Sine.inOut',
    });
  }
}

export function addBreeze(scene: Phaser.Scene): void {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!scene.textures.exists(leaf)) {
    const art = scene.add.graphics();
    art.fillStyle(0xbccb92).fillPoints([{ x: 1, y: 5 }, { x: 4, y: 2 }, { x: 10, y: 1 }, { x: 7, y: 4 }], true);
    art.generateTexture(leaf, 12, 7);
    art.clear().lineStyle(1, 0xc8dcba, .48).beginPath().moveTo(1, 5).lineTo(11, 2).lineTo(26, 1).strokePath();
    art.generateTexture(wind, 28, 7);
    art.destroy();
  }
  const touch = matchMedia('(any-pointer: coarse)').matches;
  for (let index = 0; index < (touch ? 5 : 8); index++) {
    const streak = index % 4 === 0;
    const x = 125 + index * 79;
    const y = 191 + index * 39 % 205;
    const drift = streak ? 95 : 61;
    const particle = scene.add.image(x, y, streak ? wind : leaf).setAlpha(0).setDepth(-.9);
    scene.tweens.add({
      targets: particle, x: x + drift, y: y + 12, angle: streak ? 0 : 52,
      duration: 3900 + index * 160, delay: index * 290, repeat: -1, repeatDelay: 850,
      onUpdate: (_tween, _target, key, value) => {
        if (key === 'x') particle.setAlpha(Math.sin(Math.PI * (value - x) / drift) * (streak ? .36 : .52));
      },
    });
  }
}
