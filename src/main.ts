import Phaser from 'phaser';
import { TitleScene } from './scenes/TitleScene';
import { VillageScene } from './scenes/VillageScene';
import './style.css';

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#243f31',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 720,
    height: 400,
  },
  physics: { default: 'arcade' },
  scene: [TitleScene, VillageScene],
});
