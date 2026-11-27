import Phaser from 'phaser';
import '../src/style.css';
import './preview.css';
import { useLandscapeLayout } from '../src/ui/landscapeLayout';
import { useCompositionViewport } from './composition';
import { setupScalePanel } from './scalePanel';
import { setupEastReview } from './eastReview';
import { ForestScene } from './ForestScene';

document.querySelector<HTMLElement>('#forest-loading')!.dataset.phase = 'phaser/preload';
setupEastReview();
setupScalePanel();

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: 720,
  height: 400,
  backgroundColor: '#182d24',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  physics: { default: 'arcade', arcade: { gravity: { x: 0, y: 0 } } },
  scene: [ForestScene],
  callbacks: { postBoot: game => {
    useLandscapeLayout(game);
    useCompositionViewport(game);
  } },
});
