export const ecologyDeadlineMs = 3000;

export type OptionalImage =
  | { status: 'loaded'; image: HTMLImageElement }
  | { status: 'missing' | 'invalid-size' | 'timeout' };

export function loadOptionalImage(url: string, width: number, height: number,
  deadline = ecologyDeadlineMs, image = new Image()): Promise<OptionalImage> {
  return new Promise(resolve => {
    const finish = (result: OptionalImage) => {
      clearTimeout(timer);
      image.onload = null;
      image.onerror = null;
      if (result.status === 'timeout') image.removeAttribute('src');
      resolve(result);
    };
    const timer = setTimeout(() => finish({ status: 'timeout' }), deadline);
    image.onload = () => finish(image.naturalWidth === width && image.naturalHeight === height
      ? { status: 'loaded', image } : { status: 'invalid-size' });
    image.onerror = () => finish({ status: 'missing' });
    image.src = url;
  });
}

export function failForestStartup(loading: HTMLElement, message: string, details: unknown): void {
  loading.dataset.failed = 'true';
  loading.querySelector('p')!.textContent = message;
  loading.querySelector('button')!.hidden = false;
  console.error('[forest-startup]', details);
}
