import { productionFoot, productionScale } from '../src/art/eikuAnimationConfig';
import frontPreviewUrl from '../art/preview/eiku-front-master/eiku-front-idle-preview.png?url';
import frontOriginalUrl from '../art/reference/eiku-front-master-candidate.png?url';
import southPreviewUrl from '../art/preview/eiku-v2-south/eiku-v2-south-idle-preview.png?url';
import southOptimizedUrl from '../art/preview/eiku-v2-south/eiku-v2-south-optimized-preview.png?url';
import southMasterUrl from '../art/reference/eiku-v2-south-master.png?url';

export const defaultCandidate = 'south-v2';

export const candidates = {
  'south-v2': {
    url: southPreviewUrl,
    title: '影空 2.0・南向候選格',
    info: 'RGBA・透明・獨立角色格',
    warning: '已移除地面陰影；目前只有南向單格，尚未通過正式圖集驗收。',
    ...productionFoot,
    scale: productionScale,
  },
  'south-v2-optimized': {
    url: southOptimizedUrl,
    title: '影空 2.0・南向優化',
    info: 'RGBA・透明・可讀性重繪預覽',
    warning: '護額、眼部、圍巾與刀柄做了重繪。此格僅供比較，仍待正式圖集驗收。',
    ...productionFoot,
    scale: productionScale,
  },
  'south-v2-master': {
    url: southMasterUrl,
    title: '影空 2.0・原始主圖',
    info: 'RGBA・含地面陰影',
    warning: '原圖含半透明地面陰影與極低 alpha 殘點。以下方鞋底對齊，保留原始陰影。',
    crop: [300, 28, 665, 1200],
    x: 323,
    y: 1136,
    scale: 64 / 1102 * productionScale,
  },
  preview: {
    url: frontPreviewUrl,
    title: '舊版・正面候選格',
    info: 'RGBA・去背衍生預覽',
    warning: '去背預覽有透明邊，比例、邊緣與小尺寸可讀性仍待修正。',
    ...productionFoot,
    scale: productionScale,
  },
  original: {
    url: frontOriginalUrl,
    title: '舊版・原始主視覺',
    info: 'RGB・無 alpha（取主體區域等比顯示）',
    warning: '原圖沒有 alpha。近白背景是原始像素，畫布保留這些像素。',
    crop: [275, 0, 760, 1312],
    x: 325,
    y: 1258,
    scale: 65 / 1205 * productionScale,
  },
};
