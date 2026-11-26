const images = import.meta.glob<string>(['../art/preview/east-actions/*.webp', '../art/preview/multidirection-actions/*.webp'], {
  eager: true, import: 'default', query: '?url',
});
const statuses = {
  idle: '通過預覽驗收。雙腳穩定，圍巾略有接縫。',
  run: '沿用已核准的六格跑步。',
  attack: '不採用。原稿為空手出拳，遊玩時保留原揮劍。',
  dash: '不採用。原稿為連跑數步，遊玩時保留原閃避。',
  cast: '通過姿態驗收。僅演示施法及風光，沒有傷害或技能解鎖。',
} as const;

export function setupEastReview(): void {
  const panel = document.querySelector<HTMLDetailsElement>('#east-review')!;
  const selector = document.querySelector<HTMLSelectElement>('#east-review-action')!;
  const directionSelector = document.querySelector<HTMLSelectElement>('#review-direction')!;
  const slots = document.querySelector('#east-review-images')!;
  const render = () => {
    if (!panel.open) return;
    const action = selector.value as keyof typeof statuses;
    const direction = directionSelector.value;
    const east = direction === 'east';
    const rejected = direction === 'north' && action === 'cast';
    const fallback = action === 'attack' || action === 'dash';
    document.querySelector('#east-quality')!.textContent = east ? statuses[action]
      : rejected ? '未採用。抬手後轉向西側，無法辨認為北向施法。'
        : fallback ? '使用原有動作與碰撞。'
          : '已通過霧竹林預覽驗收。可從動作來源選取並逐格檢閱。';
    const names = east ? [[action, '來源逐格'], [`${action}-processed`, '處理後圖集']]
      : [[`${direction}-${action}`, '來源逐格']];
    slots.replaceChildren(...names.flatMap(([name, label]) => {
      const url = images[`../art/preview/${east ? 'east-actions' : 'multidirection-actions'}/${name}.webp`];
      if (!url) return [];
      const figure = document.createElement('figure');
      const caption = document.createElement('figcaption');
      const image = new Image();
      caption.textContent = label;
      image.alt = label;
      image.src = url;
      figure.append(caption, image);
      return [figure];
    }));
  };
  directionSelector.addEventListener('change', render);
  selector.addEventListener('change', render);
  panel.addEventListener('toggle', render);
}
