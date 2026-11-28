export function shrineOpacity(bounds: { left: number; right: number; top: number }, depth: number,
  x: number, feetY: number): number {
  if (feetY >= depth || feetY <= bounds.top) return 1;
  const inset = Math.min(x - bounds.left, bounds.right - x);
  const overlap = Math.max(0, Math.min(1, inset / 18));
  return 1 - .72 * overlap;
}
