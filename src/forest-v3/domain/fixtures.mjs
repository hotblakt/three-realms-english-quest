import { add, distance, scale, sub, zero, Encounter, MemoryRewardStorage, initialProgress } from './index.ts';

const dot = (a, b) => a.x * b.x + a.y * b.y;
const point = (x, y = 0) => ({ x, y });
export { point, zero };
export function mockWorld(points = {}, { wall, camera = () => true } = {}) {
  const anchors = {
    entry: point(0), rest: point(-10), front: point(30), far: point(92),
    guardian: point(37), safe: point(-20, 15), ...points,
  };
  const wallContact = (from, to, radius = 0) => {
    if (wall === undefined) return;
    if (from.x < wall && to.x >= wall - radius && to.x > from.x) {
      return Math.max(0, (wall - radius - from.x) / (to.x - from.x));
    }
    if (from.x > wall && to.x <= wall + radius && to.x < from.x) {
      return Math.max(0, (wall + radius - from.x) / (to.x - from.x));
    }
  };
  return {
    anchor(id) {
      const value = anchors[id];
      return value && ('regionId' in value ? value : { id, regionId: 'forest', point: value });
    },
    walkable(position, actor, region) {
      return region === 'forest' && (wall === undefined || Math.abs(position.x - wall) >= actor.radius);
    },
    move(actor, desired) {
      const contact = wallContact(actor.position, desired, actor.radius);
      return contact === undefined ? desired : add(actor.position, scale(sub(desired, actor.position), contact));
    },
    visible(from, to) { return wallContact(from, to) === undefined; },
    onCamera: camera,
    intersects(shape, origin, facing, actor) {
      const offset = sub(actor.position, origin);
      const forward = dot(offset, facing);
      const lateral = Math.abs(offset.x * facing.y - offset.y * facing.x);
      if (shape.kind === 'strip') {
        return forward >= -actor.radius && forward <= shape.range + actor.radius && lateral <= shape.halfWidth + actor.radius;
      }
      const gap = distance(origin, actor.position);
      if (gap <= actor.radius) return true;
      if (gap > shape.range + actor.radius) return false;
      const turn = Math.atan2(lateral, forward);
      return turn <= shape.degrees * Math.PI / 360 + Math.asin(actor.radius / gap);
    },
    sweep(from, to, halfWidth, targets) {
      const segment = sub(to, from);
      const lengthSquared = dot(segment, segment);
      const terrain = wallContact(from, to, halfWidth);
      let best = terrain === undefined ? undefined : { fraction: terrain };
      for (const actor of targets) {
        const offset = sub(from, actor.position);
        const radius = actor.radius + halfWidth;
        const c = dot(offset, offset) - radius ** 2;
        const b = dot(offset, segment);
        const discriminant = b ** 2 - lengthSquared * c;
        const fraction = c <= 0 ? 0 : discriminant < 0 || lengthSquared === 0 ? Infinity
          : (-b - Math.sqrt(discriminant)) / lengthSquared;
        if (fraction >= 0 && fraction <= 1 && (!best || fraction < best.fraction)) {
          best = { fraction, targetId: actor.id };
        }
      }
      return best;
    },
  };
}
export function fixture({ world = mockWorld(), progress = initialProgress(true), storage = new MemoryRewardStorage(progress), overrides } = {}) {
  let wall = 0;
  let sequence = 0;
  const battle = new Encounter({ clock: () => wall, world, storage, slot: 'demo', attemptId: () => `try-${++sequence}`, ...overrides });
  function step(ms, input = {}) { wall += ms; battle.update({ move: zero, ...input }); }
  function enter(encounterId = 'lantern-sprout', options = {}) {
    const enemySpawnIds = encounterId === 'east-wind-pair' ? ['front', 'far']
      : encounterId === 'mosswood-guardian' ? ['guardian'] : ['front'];
    return battle.enter({ encounterId, enemySpawnIds, regionId: 'forest', landmarkId: 'arena',
      checkpointId: 'rest', spawnId: 'entry', safeAnchorId: 'safe', ...options }, progress);
  }
  return { battle, world, storage, step, enter, clock: () => wall, events: () => battle.drainEvents() };
}
