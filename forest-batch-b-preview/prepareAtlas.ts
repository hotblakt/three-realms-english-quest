import provenance from '../docs/forest-batch-b-provenance.json';
import { loadOptionalImage } from '../forest-preview/startup';

export function prepareAtlas(signal: AbortSignal, note: (message: string, phase?: boolean) => void) {
  return prepareVerifiedAtlas('forest-batch-b', provenance.meta, signal, note);
}

type AtlasMetadata = Pick<typeof provenance.meta, 'image' | 'size' | 'sha256' | 'bytes'>;

export async function prepareVerifiedAtlas(directory: string, meta: AtlasMetadata,
  signal: AbortSignal, note: (message: string, phase?: boolean) => void) {
  note(`選用圖集請求｜${meta.image}`, false);
  const response = await fetch(`${import.meta.env.BASE_URL}${directory}/${meta.image}?v=${meta.sha256.slice(0, 16)}`, { signal });
  if (!response.ok) throw new Error(`圖集 HTTP ${response.status}`);
  const blob = await response.blob();
  if (blob.size !== meta.bytes) throw new Error('圖集大小不符');
  const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  const hash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  if (hash !== meta.sha256) throw new Error('圖集 SHA-256 不符');
  if (signal.aborted) throw new Error('圖集請求已取消');

  note(`選用圖集已下載，開始解碼｜${meta.image}`, false);
  const url = URL.createObjectURL(blob);
  const revoke = () => URL.revokeObjectURL(url);
  signal.addEventListener('abort', revoke, { once: true });
  try {
    const decoded = await loadOptionalImage(url, meta.size.w, meta.size.h, 5000);
    if (decoded.status !== 'loaded') throw new Error(`圖集載入失敗｜${decoded.status}`);
    await decoded.image.decode?.();
    if (signal.aborted) throw new Error('圖集解碼已取消');
    note(`選用圖集解碼完成｜${meta.size.w}×${meta.size.h}`, false);
    return decoded.image;
  } finally {
    signal.removeEventListener('abort', revoke);
    revoke();
  }
}
