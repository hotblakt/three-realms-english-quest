import { bridge, chest, entrance, shortcut, spirit } from '../../../forest-preview/layout.ts';
import { contains, footprint, isWalkable, playerBody, type Bounds, type Point, type Size } from './collision.ts';

export const forestRegionId = 'misty-bamboo-forest';
export const hayateId = 'hayate';
export const forestSceneKey = 'misty-forest';

const point = (x: number, y: number): Point => ({ x, y });
const bounds = (left: number, top: number, right: number, bottom: number): Bounds =>
  ({ left, top, right, bottom });

export const regions = {
  'misty-south': bounds(285, 575, 586, 864),
  'misty-lantern-trail': bounds(454, 430, 633, 618),
  'misty-west-falls': bounds(128, 360, 529, 622),
  'misty-bridge': bounds(606, 429.5, 744, 473.5),
  'misty-east-junction': bounds(710, 249, 1111, 580),
  'misty-hayate-habitat': bounds(850, 95, 1040, 249),
  'misty-guardian-clearing': bounds(993, 300, 1196, 469),
} as const;
export type RegionId = keyof typeof regions;

interface Landmark {
  readonly regionId: RegionId;
  readonly point: Point;
}

export const landmarks = {
  'south-entry': { regionId: 'misty-south', point: entrance },
  'village-return': { regionId: 'misty-south', point: point(465, 823) },
  fork: { regionId: 'misty-south', point: point(515, 599) },
  'lantern-practice': { regionId: 'misty-lantern-trail', point: point(550, 550) },
  'west-chest': { regionId: 'misty-west-falls', point: chest },
  'falls-lookout': { regionId: 'misty-west-falls', point: point(175, 385) },
  'bridge-west': { regionId: 'misty-bridge', point: point(622, 451) },
  'bridge-center': { regionId: 'misty-bridge', point: bridge },
  'bridge-east': { regionId: 'misty-bridge', point: point(728, 451) },
  'east-junction': { regionId: 'misty-east-junction', point: point(850, 285) },
  'east-skirmish': { regionId: 'misty-east-junction', point: point(812, 470) },
  'shrine-approach': { regionId: 'misty-hayate-habitat', point: point(920, 145) },
  shrine: { regionId: 'misty-hayate-habitat', point: spirit },
  'guardian-entry': { regionId: 'misty-guardian-clearing', point: point(1050, 317) },
  'guardian-retreat': { regionId: 'misty-guardian-clearing', point: point(1016, 315) },
  'east-return': { regionId: 'misty-east-junction', point: shortcut },
} as const satisfies Record<string, Landmark>;
export type LandmarkId = keyof typeof landmarks;

interface SafeAnchor extends Landmark {
  readonly use: 'arrival' | 'checkpoint' | 'retreat' | 'interaction' | 'companion';
}

export const safeAnchors = {
  'south-entry': { ...landmarks['south-entry'], use: 'arrival' },
  'village-return': { ...landmarks['village-return'], use: 'retreat' },
  fork: { ...landmarks.fork, use: 'retreat' },
  'west-chest-interact': { ...landmarks['west-chest'], point: point(197, 440), use: 'interaction' },
  'falls-lookout': { ...landmarks['falls-lookout'], use: 'retreat' },
  'bridge-west': { ...landmarks['bridge-west'], use: 'retreat' },
  'bridge-east': { ...landmarks['bridge-east'], use: 'retreat' },
  'east-junction': { ...landmarks['east-junction'], use: 'checkpoint' },
  'east-skirmish-retreat': { ...landmarks['east-skirmish'], point: point(798, 441), use: 'retreat' },
  'shrine-approach': { ...landmarks['shrine-approach'], use: 'interaction' },
  'hayate-side': { ...landmarks['shrine-approach'], point: point(944, 155), use: 'companion' },
  'guardian-retreat': { ...landmarks['guardian-retreat'], use: 'checkpoint' },
  'guardian-companion-side': { ...landmarks['guardian-entry'], point: point(1085, 330), use: 'companion' },
  'east-return': { ...landmarks['east-return'], use: 'interaction' },
} as const satisfies Record<string, SafeAnchor>;
export type SafeAnchorId = keyof typeof safeAnchors;

export const checkpoints = {
  'south-entry': 'south-entry',
  'east-junction': 'east-junction',
  'guardian-retreat': 'guardian-retreat',
} as const satisfies Record<string, SafeAnchorId>;
export type CheckpointId = keyof typeof checkpoints;

export const interactions = {
  'west-chest': { safeSpawnId: 'west-chest-interact', radius: 53 },
  shrine: { safeSpawnId: 'shrine-approach', radius: 53, companionId: hayateId },
  'east-return': { safeSpawnId: 'east-return', radius: 53 },
} as const satisfies Partial<Record<LandmarkId, { safeSpawnId: SafeAnchorId; radius: number; companionId?: 'hayate' }>>;

export const returnShortcut = { exitId: 'east-return', from: 'east-return', to: 'south-entry', activation: 'interact' } as const;

export function regionsAt(center: Point, body: Size = playerBody): RegionId[] {
  return (Object.keys(regions) as RegionId[]).filter(id => contains(regions[id], footprint(center, body)));
}

export function isRegionWalkable(regionId: RegionId, center: Point, body: Size = playerBody): boolean {
  return isWalkable(center, body, regions[regionId]);
}

export function getSafeAnchors(regionId: RegionId, use?: SafeAnchor['use'], body: Size = playerBody): SafeAnchorId[] {
  return (Object.keys(safeAnchors) as SafeAnchorId[]).filter(id => {
    const anchor = safeAnchors[id];
    return anchor.regionId === regionId && (use === undefined || anchor.use === use) &&
      isRegionWalkable(regionId, anchor.point, body);
  });
}
