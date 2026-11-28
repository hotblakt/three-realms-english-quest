import { add, scale, distance, sub, unit, type Actor, type Point, type WorldGeometry } from '../src/forest-v3/domain/contracts.ts';
import { canTraverse, isWalkable, worldBounds, type Bounds } from '../src/forest-v3/world/collision.ts';
import { encounterAreas } from '../src/forest-v3/world/encounters.ts';
import { forestRegionId, safeAnchors } from '../src/forest-v3/world/world.ts';

const anchors = new Map<string, Point>(Object.entries(safeAnchors).map(([id, anchor]) => [id, anchor.point]));
for (const [id, area] of Object.entries(encounterAreas)) {
  anchors.set(id + '-entry', area.entry);
  area.spawns.forEach(({ point }, index) => anchors.set(id + '-enemy-' + index, point));
}
const size = (a: Actor) => ({ width: a.radius * 2, height: (a.halfHeight ?? a.radius) * 2 });

export function forestGeometry(bounds: () => Bounds | undefined, onCamera: (point: Point) => boolean): WorldGeometry {
  return {
    anchor(id) {
      const point = anchors.get(id);
      return point && { id, point, regionId: forestRegionId };
    },
    onCamera,
    walkable: (p, a) => isWalkable(p, size(a)),
    move(a, desired) {
      const within = a.id === 'hayate' ? worldBounds : bounds() ?? worldBounds;
      const dimensions = size(a);
      const from = a.position;
      if (canTraverse(from, desired, dimensions, within)) return desired;
      const x = { x: desired.x, y: from.y };
      const y = { x: from.x, y: desired.y };
      if (canTraverse(from, x, dimensions, within)) return x;
      return canTraverse(from, y, dimensions, within) ? y : from;
    },
    visible: (from, to) => canTraverse(from, to, { width: 1, height: 1 }),
    intersects(shape, origin, facing, target) {
      const p = sub(target.position, origin);
      const forward = p.x * facing.x + p.y * facing.y;
      const lateral = Math.abs(p.x * facing.y - p.y * facing.x);
      if (shape.kind === 'strip') return forward >= -target.radius && forward <= shape.range + target.radius &&
        lateral <= shape.halfWidth + target.radius;
      const length = distance(origin, target.position);
      if (length <= target.radius) return true;
      return length <= shape.range + target.radius &&
        Math.atan2(lateral, forward) <= shape.degrees * Math.PI / 360 + Math.asin(target.radius / length);
    },
    sweep(from, to, radius, targets) {
      const body = { width: radius * 2, height: radius * 2 };
      const delta = sub(to, from);
      const at = (fraction: number) => add(from, scale(delta, fraction));
      let terrain: number | undefined;
      if (!canTraverse(from, to, body)) {
        let low = 0, high = 1;
        for (let i = 0; i < 16; i++) {
          const middle = (low + high) / 2;
          if (canTraverse(from, at(middle), body)) low = middle;
          else high = middle;
        }
        terrain = high;
      }
      let result = terrain === undefined ? undefined : { fraction: terrain, targetId: undefined as string | undefined };
      const length = distance(from, to);
      const direction = unit(delta);
      for (const target of targets) {
        const offset = sub(target.position, from);
        const along = offset.x * direction.x + offset.y * direction.y;
        const combined = target.radius + radius;
        const cross = offset.x * direction.y - offset.y * direction.x;
        const square = combined ** 2 - cross ** 2;
        if (square < 0) continue;
        const hit = Math.max(0, along - Math.sqrt(square));
        const fraction = length ? hit / length : 0;
        if (along + Math.sqrt(square) < 0 || hit > length || (!length && distance(from, target.position) > combined)) continue;
        if (!result || fraction < result.fraction - 1e-5) result = { fraction, targetId: target.id };
      }
      return result;
    },
  };
}
