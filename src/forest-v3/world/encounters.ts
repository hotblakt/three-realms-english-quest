import { canTraversePath, footprint, isClearArea, isWalkable, playerBody, type Bounds, type Point } from './collision.ts';
import { landmarks, safeAnchors, type CheckpointId, type LandmarkId, type SafeAnchorId } from './world.ts';

interface EnemySpawn {
  readonly enemy: 'bamboo-sprout' | 'wind-seed' | 'mosswood-guardian';
  readonly point: Point;
  readonly radius: number;
}

interface EncounterArea {
  readonly landmarkId: LandmarkId;
  readonly bounds: Bounds;
  readonly entry: Point;
  readonly approach: readonly Point[];
  readonly retreat: readonly Point[];
  readonly retreatId: SafeAnchorId;
  readonly checkpointId: CheckpointId;
  readonly spawns: readonly EnemySpawn[];
}

export function encounterCameraBounds(id: EncounterId): Bounds {
  const area = encounterAreas[id];
  const points = [...area.approach, safeAnchors[area.retreatId].point];
  return {
    left: Math.min(area.bounds.left, ...points.map(p => p.x - playerBody.width / 2)),
    top: Math.min(area.bounds.top, ...points.map(p => p.y - playerBody.height / 2)),
    right: Math.max(area.bounds.right, ...points.map(p => p.x + playerBody.width / 2)),
    bottom: Math.max(area.bounds.bottom, ...points.map(p => p.y + playerBody.height / 2)),
  };
}

const guardianSpawn = { enemy: 'mosswood-guardian', point: { x: 1069, y: 413 }, radius: 22 } as const;

export const encounterAreas = {
  'lantern-sprout': {
    landmarkId: 'lantern-practice',
    bounds: { left: 475, top: 485, right: 548, bottom: 539 },
    entry: { x: 537, y: 525 },
    approach: [landmarks['lantern-practice'].point],
    retreat: [landmarks['lantern-practice'].point],
    retreatId: 'fork',
    checkpointId: 'south-entry',
    spawns: [{ enemy: 'bamboo-sprout', point: { x: 501, y: 511 }, radius: 11 }],
  },
  'east-wind-pair': {
    landmarkId: 'east-skirmish',
    bounds: { left: 770, top: 462, right: 923, bottom: 578 },
    entry: landmarks['east-skirmish'].point,
    approach: [],
    retreat: [],
    retreatId: 'east-skirmish-retreat',
    checkpointId: 'east-junction',
    spawns: [
      { enemy: 'bamboo-sprout', point: { x: 800, y: 515 }, radius: 11 },
      { enemy: 'wind-seed', point: { x: 899, y: 550 }, radius: 10 },
    ],
  },
  'mosswood-guardian': {
    landmarkId: 'guardian-entry',
    bounds: { left: 1042, top: 357, right: 1196, bottom: 469 },
    entry: { x: 1065, y: 367 },
    approach: [landmarks['guardian-entry'].point, { x: 1061, y: 327 }],
    retreat: [{ x: 1061, y: 327 }, landmarks['guardian-entry'].point],
    retreatId: 'guardian-retreat',
    checkpointId: 'guardian-retreat',
    spawns: [guardianSpawn],
  },
} as const satisfies Record<string, EncounterArea>;
export type EncounterId = keyof typeof encounterAreas;

export function isEncounterWalkable(id: EncounterId, center: Point): boolean {
  return isWalkable(center, undefined, encounterAreas[id].bounds);
}

export function encounterRetreatPath(id: EncounterId): readonly Point[] {
  const area = encounterAreas[id];
  return [area.entry, ...area.retreat, safeAnchors[area.retreatId].point];
}

export const guardianGeometry = {
  origin: guardianSpawn.point,
  facing: { x: 1, y: 0 },
  shockwave: { length: 120, width: 34 },
  fan: { radius: 72, halfAngleDegrees: 50 },
  dodgeDistance: 310 * .160,
  dodgeStarts: [{ x: 1140, y: 410 }, { x: 1140, y: 416 }],
  companionSafeAnchorId: 'guardian-companion-side',
} as const;

// Conservative clearance envelopes used only for the fixed east-facing geometry.
export function guardianClearance() {
  const area = encounterAreas['mosswood-guardian'];
  const { origin, shockwave, fan, dodgeDistance, dodgeStarts, companionSafeAnchorId } = guardianGeometry;
  const shockwaveBounds = {
    left: origin.x, right: origin.x + shockwave.length,
    top: origin.y - shockwave.width / 2, bottom: origin.y + shockwave.width / 2,
  };
  const fanHalfWidth = fan.radius * Math.sin(fan.halfAngleDegrees * Math.PI / 180);
  const fanBounds = {
    left: origin.x, right: origin.x + fan.radius,
    top: origin.y - fanHalfWidth, bottom: origin.y + fanHalfWidth,
  };
  const dodgeLanes = dodgeStarts.map((from, index) => {
    const to = { x: from.x, y: from.y + (index === 0 ? dodgeDistance : -dodgeDistance) };
    const end = footprint(to, playerBody);
    const exitsTelegraph = end.top >= shockwaveBounds.bottom || end.bottom <= shockwaveBounds.top;
    // Minimum distance from the origin to the end footprint, outside even the full fan circle.
    const fanDistance = Math.hypot(end.left - origin.x,
      Math.max(end.top - origin.y, origin.y - end.bottom, 0));
    const retreat = [to, { x: to.x, y: area.entry.y }, ...encounterRetreatPath('mosswood-guardian')];
    return {
      from, to,
      clear: exitsTelegraph && fanDistance > fan.radius && canTraversePath([from, to], undefined, area.bounds),
      retreatClear: canTraversePath(retreat),
    };
  });
  const companion = safeAnchors[companionSafeAnchorId].point;
  const companionFootprint = footprint(companion, playerBody);
  return {
    shockwaveBounds,
    shockwaveClear: isClearArea(shockwaveBounds, area.bounds),
    fanBounds,
    fanClear: isClearArea(fanBounds, area.bounds),
    dodgeLanes,
    companionClear: companionFootprint.bottom < area.bounds.top &&
      canTraversePath([safeAnchors[area.retreatId].point, ...area.approach, companion]),
  };
}
