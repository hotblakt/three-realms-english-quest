import type Phaser from 'phaser';
import { fallbackEikuSheet, makeFallbackEikuTexture } from './actorArtwork';
import {
  eikuDirections, eikuFrameName, eikuMotions, productionAnimations, productionFoot,
  productionFrameCount, productionFrameSize, productionScale, type EikuDirection, type EikuMotion,
} from './eikuAnimationConfig';
import { eikuAtlasKey, hasEikuAtlas } from './eikuAtlas';

const fallbackAnimations = {
  idle: { indices: [0, 1], frameRate: 2 },
  walk: { indices: [2, 3, 4, 5], frameRate: 10 },
  dodge: { indices: [2, 4], frameRate: 18 },
};

function animationKey(sheet: string, direction: EikuDirection, motion: EikuMotion): string {
  const prefix = sheet === eikuAtlasKey ? 'eiku-production' : 'eiku';
  return `${prefix}-${direction}-${motion}`;
}

function registerAnimations(scene: Phaser.Scene, sheet: string): void {
  const production = sheet === eikuAtlasKey;
  for (const direction of eikuDirections) {
    for (const motion of eikuMotions) {
      if (!production && motion === 'attack') continue;
      const key = animationKey(sheet, direction, motion);
      if (scene.anims.exists(key)) continue;
      if (production) {
        const frames = Array.from({ length: productionFrameCount }, (_, index) => ({
          key: sheet, frame: eikuFrameName(direction, motion, index),
        }));
        scene.anims.create({ key, frames, ...productionAnimations[motion] });
      } else if (motion !== 'attack') {
        const { indices, frameRate } = fallbackAnimations[motion];
        const frames = indices.map(index => ({ key: sheet, frame: `${direction}-${index}` }));
        scene.anims.create({ key, frames, frameRate, repeat: -1 });
      }
    }
  }
}

export function createEiku(scene: Phaser.Scene, x: number, y: number): Phaser.GameObjects.Sprite {
  if (hasEikuAtlas(scene)) {
    registerAnimations(scene, eikuAtlasKey);
    return scene.add.sprite(x, y, eikuAtlasKey, eikuFrameName('south', 'idle', 0))
      .setOrigin(productionFoot.x / productionFrameSize, productionFoot.y / productionFrameSize)
      .setScale(productionScale).setDepth(y);
  }

  makeFallbackEikuTexture(scene);
  registerAnimations(scene, fallbackEikuSheet);
  return scene.add.sprite(x, y, fallbackEikuSheet, 'south-0').setOrigin(.5, .84).setDepth(y);
}

export function animateEiku(sprite: Phaser.GameObjects.Sprite, facing: Phaser.Math.Vector2, motion: EikuMotion): void {
  const sheet = sprite.texture.key;
  const current = sprite.anims.currentAnim?.key;
  if (motion === 'attack' && (sheet !== eikuAtlasKey || current?.endsWith('-dodge'))) return;
  const locomotion = motion === 'idle' || motion === 'walk';
  if (locomotion && sprite.anims.isPlaying && current?.endsWith('-attack')) return;
  // A completed dodge relies on the next locomotion state to select the next animation.
  if (motion === 'dodge' && current?.endsWith('-dodge') && !sprite.anims.isPlaying) return;

  const direction = facing.x ? (facing.x > 0 ? 'east' : 'west') : (facing.y > 0 ? 'south' : 'north');
  sprite.play(animationKey(sheet, direction, motion), true);
}
