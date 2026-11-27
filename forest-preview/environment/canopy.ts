interface Occluder {
  x: number;
  y: number;
  displayWidth: number;
  displayHeight: number;
  originY: number;
}

/** Use a taller overlap window for crowns lifted off the associated tree's sorting foot. */
export function canopyOpacity(sprite: Occluder, x: number, feetY: number, bodyHeight: number): number {
  const top = sprite.y - sprite.displayHeight * sprite.originY;
  if (feetY >= sprite.y || feetY <= top) return 1;
  const clamp = (ratio: number) => Math.max(0, Math.min(1, ratio));
  const horizontal = clamp((sprite.displayWidth * .42 - Math.abs(x - sprite.x)) / 31);
  if (sprite.originY <= 1) return 1 - horizontal * .75;
  const bottom = top + sprite.displayHeight;
  const vertical = clamp((bottom - (feetY - bodyHeight)) / 16);
  return 1 - horizontal * vertical * .75;
}
