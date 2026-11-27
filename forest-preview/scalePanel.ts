import type Phaser from 'phaser';
import type { EikuDirection } from '../src/art/eikuAnimationConfig';
import { recommendedScale, sanitizeScales } from './directionalScale';
import { transitionVisualScale, type Silhouette, type VisualScaleState } from './scaleTransition';

const key = 'three-realms:forest-directional-calibration:v1';
let scales = sanitizeScales();

export function setupScalePanel(): void {
  const panel = document.querySelector('#directional-scale')!;
  const persist = panel.querySelector<HTMLInputElement>('#remember-directional-scale')!;
  const inputs = [...panel.querySelectorAll<HTMLInputElement>('input[type=range]')];
  try {
    const saved = localStorage.getItem(key);
    if (saved) {
      scales = sanitizeScales(JSON.parse(saved) ?? {});
      persist.checked = true;
    }
  } catch {
    // A private or blocked storage session can still use live calibration.
  }
  const render = () => {
    for (const input of inputs) {
      input.value = String(scales[input.name as EikuDirection]);
      panel.querySelector<HTMLOutputElement>(`output[for="${input.id}"]`)!.value = `${input.value}%`;
    }
  };
  const save = () => {
    try {
      if (persist.checked) localStorage.setItem(key, JSON.stringify(scales));
      else localStorage.removeItem(key);
    } catch {
      persist.checked = false;
    }
  };
  for (const input of inputs) {
    input.addEventListener('input', () => {
      scales = sanitizeScales({ ...scales, [input.name]: Number(input.value) });
      render();
    });
    input.addEventListener('change', save);
  }
  persist.addEventListener('change', save);
  panel.querySelector('button')!.addEventListener('click', () => {
    scales = { ...recommendedScale };
    render();
    save();
  });
  render();
}

const previous = new WeakMap<Phaser.GameObjects.Image, VisualScaleState>();
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

export function renderVisualSize(image: Phaser.GameObjects.Image, nominal: number,
  group: VisualScaleState['group'], direction?: EikuDirection, silhouette?: Silhouette): number {
  const target = direction ? nominal * scales[direction] / 100 : nominal;
  const state = transitionVisualScale(previous.get(image), group, target, image.scene.time.now, reducedMotion.matches, silhouette);
  previous.set(image, state);
  return state.value;
}
