import { launchForest } from '../forest-batch-b-preview/boot';
import { loadLandmarks } from './loadLandmarks';

launchForest(loadLandmarks, (scene, avatar) => {
  const button = document.querySelector<HTMLButtonElement>('#observe-idle')!;
  button.addEventListener('click', async () => {
    button.disabled = true;
    try {
      const { showVisibilityLog } = await import('./visibilityLog');
      showVisibilityLog(scene, avatar);
      button.hidden = true;
    } catch {
      button.textContent = '無法開啟，請再試一次';
      button.disabled = false;
    }
  });
});
