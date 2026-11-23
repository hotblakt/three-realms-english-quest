import Phaser from 'phaser';

export function useLandscapeLayout(game: Phaser.Game): void {
  const stage = document.querySelector<HTMLElement>('#stage')!;
  const rotate = document.querySelector<HTMLElement>('#rotate-device')!;
  const portrait = matchMedia('(orientation: portrait) and (any-pointer: coarse)');
  const viewport = window.visualViewport;
  let previousFocus: HTMLElement | null = null;
  let frame = 0;

  const refresh = () => {
    frame = 0;
    // Keep browser zoom independent of the game's layout.
    if (viewport && viewport.scale === 1) {
      stage.style.setProperty('--visible-height', `${Math.floor(viewport.height)}px`);
    } else {
      stage.style.removeProperty('--visible-height');
    }
    if (portrait.matches && rotate.hidden) {
      previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      stage.inert = true;
      rotate.hidden = false;
      game.pause();
      rotate.querySelector<HTMLElement>('h2')!.focus({ preventScroll: true });
    } else if (!portrait.matches && !rotate.hidden) {
      rotate.hidden = true;
      stage.inert = false;
      game.resume();
      previousFocus?.focus({ preventScroll: true });
      previousFocus = null;
    }
    game.scale.getParentBounds();
    game.scale.refresh();
  };
  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(refresh);
  };

  // Toolbar and safe-area changes may resize the canvas parent without a window resize.
  const observer = new ResizeObserver(schedule);
  observer.observe(document.querySelector('#game')!);
  portrait.addEventListener('change', schedule);
  viewport?.addEventListener('resize', schedule);
  window.addEventListener('resize', schedule);
  game.events.once(Phaser.Core.Events.DESTROY, () => {
    observer.disconnect();
    portrait.removeEventListener('change', schedule);
    viewport?.removeEventListener('resize', schedule);
    window.removeEventListener('resize', schedule);
    cancelAnimationFrame(frame);
  });
  refresh();
}
