import type { PrepareForestDecoration } from '../forest-batch-b-preview/boot';

export const loadLandmarks: PrepareForestDecoration = async (signal, note) => {
  const { prepareLandmarks } = await import('./landmarks');
  if (signal.aborted) throw new Error('地標圖集請求已取消');
  return prepareLandmarks(signal, note);
};
