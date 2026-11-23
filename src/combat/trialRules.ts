export type Point = { x: number; y: number };
export type AttackArea =
  | { kind: 'circle'; x: number; y: number; radius: number }
  | { kind: 'lane'; x: number; y: number; angle: number; length: number; width: number };

export function inAttackArea(area: AttackArea, point: Point): boolean {
  const dx = point.x - area.x;
  const dy = point.y - area.y;
  if (area.kind === 'circle') return dx * dx + dy * dy <= area.radius ** 2;
  const cosine = Math.cos(area.angle);
  const sine = Math.sin(area.angle);
  const forward = dx * cosine + dy * sine;
  const sideways = -dx * sine + dy * cosine;
  return forward >= 0 && forward <= area.length && Math.abs(sideways) <= area.width / 2;
}
