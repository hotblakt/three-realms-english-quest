import { canTraversePath, playerBody, worldBounds, type Point, type Size } from './collision.ts';
import { landmarks, returnShortcut, safeAnchors } from './world.ts';

export const routeNodes = {
  'south-entry': landmarks['south-entry'].point,
  'village-return': landmarks['village-return'].point,
  fork: landmarks.fork.point,
  'lantern-practice': landmarks['lantern-practice'].point,
  'west-chest-interact': safeAnchors['west-chest-interact'].point,
  'falls-lookout': landmarks['falls-lookout'].point,
  'bridge-west': landmarks['bridge-west'].point,
  'bridge-east': landmarks['bridge-east'].point,
  'east-junction': landmarks['east-junction'].point,
  'east-skirmish-retreat': safeAnchors['east-skirmish-retreat'].point,
  'east-skirmish': landmarks['east-skirmish'].point,
  'shrine-approach': landmarks['shrine-approach'].point,
  'hayate-side': safeAnchors['hayate-side'].point,
  'guardian-entry': landmarks['guardian-entry'].point,
  'guardian-retreat': landmarks['guardian-retreat'].point,
  'guardian-companion-side': safeAnchors['guardian-companion-side'].point,
  'east-return': landmarks['east-return'].point,
} as const;
export type RouteNodeId = keyof typeof routeNodes;

interface Route {
  readonly from: RouteNodeId;
  readonly to: RouteNodeId;
  readonly via: readonly Point[];
}

function link(from: RouteNodeId, to: RouteNodeId, ...via: (readonly [number, number])[]): Route {
  return { from, to, via: via.map(([x, y]) => ({ x, y })) };
}

export const routes = {
  'south-village': link('south-entry', 'village-return'),
  'south-fork': link('south-entry', 'fork', [496, 686]),
  'lantern-approach': link('fork', 'lantern-practice'),
  'lantern-to-bridge': link('lantern-practice', 'bridge-west', [550, 522], [572, 464], [593, 451]),
  'west-treasure': link('fork', 'west-chest-interact', [439, 564], [368, 565], [329, 565], [307, 542], [310, 518], [258, 492], [223, 451]),
  'west-lookout': link('west-chest-interact', 'falls-lookout', [164, 440], [163, 426], [164, 393]),
  'bridge-crossing': link('bridge-west', 'bridge-east', [675, 451]),
  'east-approach': link('bridge-east', 'east-junction', [761, 451], [820, 420], [816, 349]),
  'skirmish-approach': link('east-junction', 'east-skirmish-retreat', [816, 349], [820, 420]),
  'skirmish-entry': link('east-skirmish-retreat', 'east-skirmish'),
  'shrine-trail': link('east-junction', 'shrine-approach', [900, 253], [900, 190]),
  'hayate-interaction': link('shrine-approach', 'hayate-side'),
  'guardian-approach': link('east-junction', 'guardian-retreat', [931, 288], [1001, 304]),
  'guardian-entrance': link('guardian-retreat', 'guardian-entry'),
  'guardian-side-trail': link('guardian-entry', 'guardian-companion-side'),
  'east-shortcut-trail': link('east-junction', 'east-return', [931, 288], [1001, 304]),
} as const;
export type RouteId = keyof typeof routes;

export function getRoutePoints(id: RouteId): readonly Point[] {
  const { from, to, via } = routes[id];
  return [routeNodes[from], ...via, routeNodes[to]];
}

export function isRouteWalkable(id: RouteId, body = playerBody): boolean {
  return canTraversePath(getRoutePoints(id), body);
}

// Extra clearance on each side of the 18 × 16 body, in world units.
export function routeClearance(id: RouteId): number {
  if (!isRouteWalkable(id)) return 0;
  let low = 0;
  let high = Math.min(
    worldBounds.right - worldBounds.left - playerBody.width,
    worldBounds.bottom - worldBounds.top - playerBody.height,
  ) / 2;
  while (high - low > 0.01) {
    const padding = (low + high) / 2;
    if (isRouteWalkable(id, { width: playerBody.width + 2 * padding, height: playerBody.height + 2 * padding })) {
      low = padding;
    } else {
      high = padding;
    }
  }
  return low;
}

export function findRoute(from: RouteNodeId, to: RouteNodeId,
  { body = playerBody, allowShortcut = false }: { body?: Size; allowShortcut?: boolean } = {},
): RouteNodeId[] | undefined {
  if (!canTraversePath([routeNodes[from]], body) || !canTraversePath([routeNodes[to]], body)) return;
  const walkable = (Object.keys(routes) as RouteId[]).filter(id => isRouteWalkable(id, body)).map(id => routes[id]);
  const queue: RouteNodeId[][] = [[from]];
  const visited = new Set<RouteNodeId>([from]);
  for (const path of queue) {
    const current = path[path.length - 1];
    if (current === to) return path;
    const neighbors: RouteNodeId[] = walkable.flatMap(edge =>
      edge.from === current ? [edge.to] : edge.to === current ? [edge.from] : []);
    if (allowShortcut && current === returnShortcut.from) neighbors.push(returnShortcut.to);
    for (const neighbor of neighbors) {
      if (visited.has(neighbor)) continue;
      visited.add(neighbor);
      queue.push([...path, neighbor]);
    }
  }
}
