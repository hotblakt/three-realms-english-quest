import { launchForest } from '../forest-batch-b-preview/boot';

launchForest(async (signal, note) => {
  const { prepareLandmarks } = await import('./landmarks');
  if (signal.aborted) throw new Error('地標圖集請求已取消');
  return prepareLandmarks(signal, note);
});
