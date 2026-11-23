import { zhTW } from './zh-TW';

export const messages = zhTW;
export const chineseFont = '"PingFang TC", "Heiti TC", "Noto Sans CJK TC", "Microsoft JhengHei", sans-serif';

type TextKey = {
  [Key in keyof typeof messages]: (typeof messages)[Key] extends string ? Key : never;
}[keyof typeof messages];

export function localizeDocument(): void {
  for (const element of document.querySelectorAll<HTMLElement>('[data-text], [data-label]')) {
    const { text, label } = element.dataset;
    if (text) element.textContent = messages[text as TextKey];
    if (label) element.setAttribute('aria-label', messages[label as TextKey]);
  }
}
