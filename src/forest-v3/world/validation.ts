import { canTraversePath, contains, footprint, hardColliders, isClearArea, isWalkable, playerBody } from './collision.ts';
import { encounterAreas, encounterRetreatPath, guardianClearance, isEncounterWalkable, type EncounterId } from './encounters.ts';
import { findRoute, isRouteWalkable, routeClearance, routes, type RouteId } from './routes.ts';
import { checkpoints, getSafeAnchors, interactions, landmarks, regions, safeAnchors, type SafeAnchorId } from './world.ts';

const legacyClearance: Partial<Record<RouteId, number>> = {
  'lantern-to-bridge': 14,
  'west-treasure': 12,
  'west-lookout': 3,
  'bridge-crossing': 13.5,
  'east-approach': 10,
  'skirmish-approach': 10,
};
const targetBody = { width: 54, height: 48 };

export function validateWorldGeometry() {
  const issues: string[] = [];
  const clearanceByRoute = (Object.keys(routes) as RouteId[]).map(id => {
    const padding = routeClearance(id);
    const legacyMinimum = legacyClearance[id];
    const meetsTarget = isRouteWalkable(id, targetBody);
    if (!isRouteWalkable(id) || (legacyMinimum === undefined ? !meetsTarget : !isRouteWalkable(id, { width: playerBody.width + 2 * legacyMinimum,
          height: playerBody.height + 2 * legacyMinimum }))) {
      issues.push(`Route clearance: ${id}`);
    }
    return { id, padding, meetsTarget };
  });

  for (const [id, anchor] of Object.entries(safeAnchors)) {
    const anchorId = id as SafeAnchorId;
    if (!getSafeAnchors(anchor.regionId).includes(anchorId) ||
        !findRoute('south-entry', anchorId) || !findRoute(anchorId, 'south-entry')) {
      issues.push(`Unsafe or disconnected anchor: ${id}`);
    }
  }

  for (const id of Object.keys(interactions) as (keyof typeof interactions)[]) {
    const { safeSpawnId, radius } = interactions[id];
    const from = safeAnchors[safeSpawnId].point;
    const to = landmarks[id].point;
    if (Math.hypot(from.x - to.x, from.y - to.y) >= radius ||
        !isWalkable(from) || !findRoute('south-entry', safeSpawnId)) {
      issues.push(`Interaction unreachable: ${id}`);
    }
  }

  const bridgeOpening = { top: 429.5, bottom: 474 };
  for (const y of [bridgeOpening.top + playerBody.height / 2, bridgeOpening.bottom - playerBody.height / 2]) {
    if (!canTraversePath([{ x: 622, y }, { x: 728, y }])) issues.push(`Bridge opening: ${y}`);
  }
  for (const y of [400, 425, 478, 500]) {
    if (canTraversePath([{ x: 585, y }, { x: 765, y }])) issues.push(`Creek barrier: ${y}`);
  }

  for (const id of Object.keys(encounterAreas) as EncounterId[]) {
    const area = encounterAreas[id];
    const retreat = safeAnchors[area.retreatId];
    const checkpoint = safeAnchors[checkpoints[area.checkpointId]];
    if (!contains(regions[landmarks[area.landmarkId].regionId], area.bounds) || !isClearArea(area.bounds) ||
        !isEncounterWalkable(id, area.entry)) {
      issues.push(`Encounter bounds: ${id}`);
    }
    if (isEncounterWalkable(id, retreat.point) || isEncounterWalkable(id, checkpoint.point) ||
        !canTraversePath([retreat.point, ...area.approach, area.entry], targetBody) ||
        !canTraversePath(encounterRetreatPath(id), targetBody) ||
        !findRoute(area.retreatId, checkpoints[area.checkpointId])) {
      issues.push(`Encounter retreat: ${id}`);
    }
    const intake = footprint(area.entry, playerBody);
    for (const [index, spawn] of area.spawns.entries()) {
      const diameter = spawn.radius * 2;
      const body = footprint(spawn.point, { width: diameter, height: diameter });
      const touchesEntry = intake.left < body.right && intake.right > body.left &&
        intake.top < body.bottom && intake.bottom > body.top;
      const touchesPeer = area.spawns.slice(0, index).some(peer =>
        Math.hypot(peer.point.x - spawn.point.x, peer.point.y - spawn.point.y) <= spawn.radius + peer.radius);
      if (!isClearArea(body, area.bounds) || touchesEntry || touchesPeer) issues.push(`Enemy spawn: ${id}/${index}`);
    }
  }

  const guardian = guardianClearance();
  if (!guardian.shockwaveClear || !guardian.fanClear || !guardian.companionClear ||
      guardian.dodgeLanes.some(lane => !lane.clear || !lane.retreatClear)) {
    issues.push('Guardian telegraphs, dodge or retreat');
  }
  return { issues, clearanceByRoute, bridgeOpening, guardian, colliderCount: hardColliders.length };
}
