import assets from '../../../docs/misty-forest-runtime-assets.json' with { type: 'json' };
import { chest, creekColliders, height, props, width } from '../../../forest-preview/layout.ts';

export interface Point { readonly x: number; readonly y: number }
export interface Size { readonly width: number; readonly height: number }
export interface Bounds {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}
export interface Collider extends Bounds {
  readonly id: string;
  readonly kind: 'creek' | 'bamboo' | 'rock' | 'chest' | 'gate';
}

export const worldSize: Size = { width, height };
export const worldBounds: Bounds = { left: 24, top: 30, right: width - 24, bottom: height - 26 };
export const playerBody: Size = { width: 18, height: 16 };

export function footprint(center: Point, size: Size): Bounds {
  return {
    left: center.x - size.width / 2, top: center.y - size.height / 2,
    right: center.x + size.width / 2, bottom: center.y + size.height / 2,
  };
}

export function contains(outer: Bounds, inner: Bounds): boolean {
  return inner.left >= outer.left && inner.right <= outer.right &&
    inner.top >= outer.top && inner.bottom <= outer.bottom;
}

function overlaps(a: Bounds, b: Bounds): boolean {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

function block(id: string, kind: Collider['kind'], x: number, y: number, width: number, height: number): Collider {
  // Arcade StaticBody.setSize(width, height, true) floors its half extents
  // when placing the rectangle, but keeps the unrounded full dimensions.
  const left = x - Math.floor(width / 2);
  const top = y - Math.floor(height / 2);
  return { id, kind, left, top, right: left + width, bottom: top + height };
}

// ForestScene.addLandmarks uses the shared torii art anchor (900, 219).
const gateX = 900;
const gateY = 219;

export const hardColliders: readonly Collider[] = [
  ...creekColliders().map(({ x, y, width, height }, i) => block(`creek-${i}`, 'creek', x, y, width, height)),
  ...props.flatMap(([x, y, scale, kind], i) => {
    if (kind === 'underbrush') return [];
    if (kind === 'dense' || kind === 'sparse') {
      return [block(`prop-${i}`, 'bamboo', x, y - 2, 36 * scale, 17 * scale)];
    }
    return [block(`prop-${i}`, 'rock', x, y - 8, assets.textures[kind].runtimeDimensions[0] * scale * .58, 21 * scale)];
  }),
  block('west-chest', 'chest', chest.x, chest.y - 6, 36, 16),
  ...[-1, 1].flatMap(side => [
    block(`gate-post-${side}`, 'gate', gateX + side * 40, gateY - 1, 17, 19),
    block(`gate-lantern-${side}`, 'gate', gateX + side * 78, gateY + 3, 22, 20),
  ]),
];

export function collidersIn(area: Bounds): readonly Collider[] {
  return hardColliders.filter(collider => overlaps(area, collider));
}

export function isClearArea(area: Bounds, within = worldBounds): boolean {
  return area.left < area.right && area.top < area.bottom && contains(worldBounds, area) && contains(within, area) && collidersIn(area).length === 0;
}

export function isWalkable(center: Point, body = playerBody, within = worldBounds): boolean {
  return body.width > 0 && body.height > 0 && isClearArea(footprint(center, body), within);
}

// Open slabs match strict rectangle overlap: edge contact alone is allowed.
function slab(start: number, delta: number, min: number, max: number): readonly [number, number] {
  if (delta === 0) return start > min && start < max ? [-Infinity, Infinity] : [Infinity, -Infinity];
  const a = (min - start) / delta;
  const b = (max - start) / delta;
  return [Math.min(a, b), Math.max(a, b)];
}

export function canTraverse(from: Point, to: Point, body = playerBody, within = worldBounds): boolean {
  if (!isWalkable(from, body, within) || !isWalkable(to, body, within)) return false;
  return !hardColliders.some(({ left, right, top, bottom }) => {
    const [entryX, exitX] = slab(from.x, to.x - from.x, left - body.width / 2, right + body.width / 2);
    const [entryY, exitY] = slab(from.y, to.y - from.y, top - body.height / 2, bottom + body.height / 2);
    return Math.max(0, entryX, entryY) < Math.min(1, exitX, exitY);
  });
}

export function canTraversePath(points: readonly Point[], body = playerBody, within = worldBounds): boolean {
  return points.length > 0 && isWalkable(points[0], body, within) &&
    points.slice(1).every((point, index) => canTraverse(points[index], point, body, within));
}
