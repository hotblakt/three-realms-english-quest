import Phaser from 'phaser';
import { createEiku } from '../src/art/eikuSprite';
import { preloadEikuAtlas } from '../src/art/eikuAtlas';
import { paintVillage } from '../src/art/villageArtwork';

export const viewport = { width: 304, height: 184 };
export const feet = { x: 152, y: 134 };

export function readGameArt() {
  return new Promise((resolve, reject) => {
    const parent = document.createElement('div');
    parent.hidden = true;
    document.body.append(parent);
    new Phaser.Game({
      type: Phaser.CANVAS,
      parent,
      ...viewport,
      backgroundColor: '#243f31',
      audio: { noAudio: true },
      banner: false,
      scene: {
        preload() {
          preloadEikuAtlas(this);
        },
        create() {
          const game = this.game;
          const cleanup = () => {
            game.destroy(true);
            parent.remove();
          };
          try {
            paintVillage(this);
            const sprite = createEiku(this, 0, 0).setVisible(false);
            const { frame } = sprite;
            const image = document.createElement('canvas');
            image.width = frame.cutWidth;
            image.height = frame.cutHeight;
            image.getContext('2d').drawImage(sprite.texture.getSourceImage(),
              frame.cutX, frame.cutY, image.width, image.height, 0, 0, image.width, image.height);
            const current = {
              image,
              source: [0, 0, image.width, image.height],
              x: sprite.displayOriginX,
              y: sprite.displayOriginY,
              scale: sprite.scaleX,
            };
            this.cameras.main.setScroll(440 - feet.x, 366 - feet.y);
            game.events.once(Phaser.Core.Events.POST_RENDER, () => {
              const village = document.createElement('canvas');
              village.width = viewport.width;
              village.height = viewport.height;
              village.getContext('2d').drawImage(game.canvas, 0, 0);
              resolve({ current, village });
              cleanup();
            });
          } catch (error) {
            cleanup();
            reject(error);
          }
        },
      },
    });
  });
}
