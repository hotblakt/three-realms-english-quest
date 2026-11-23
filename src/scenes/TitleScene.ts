import Phaser from 'phaser';
import { paintVillage } from './villageArt';

export class TitleScene extends Phaser.Scene {
  constructor() {
    super('title');
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
