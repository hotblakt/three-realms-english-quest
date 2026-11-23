import Phaser from 'phaser';
import { preloadEikuAtlas } from '../art/eikuAtlas';
import { paintVillage } from '../art/villageArtwork';

export class TitleScene extends Phaser.Scene {
  constructor() {
    super('title');
  }

  preload(): void {
    preloadEikuAtlas(this);
  }

  create(): void {
    paintVillage(this);
    this.cameras.main.centerOn(440, 230);
    const title = document.querySelector<HTMLElement>('#title')!;
    const begin = document.querySelector<HTMLButtonElement>('#begin')!;
    begin.disabled = false;
    begin.addEventListener('click', () => {
      title.hidden = true;
      this.scene.start('village');
    }, { once: true });
  }
}
