import type { CheckpointId, LandmarkId, RegionId, SafeAnchorId, forestRegionId } from './world.ts';

type AreaPayload = {
  readonly regionId: typeof forestRegionId | RegionId;
  readonly spawnId: SafeAnchorId;
};

type ArenaPayload = {
  readonly landmarkId: LandmarkId;
  readonly checkpointId: CheckpointId;
};

export interface WorldEventPayloads {
  AreaReady: AreaPayload;
  AreaExit: AreaPayload;
  ArenaEntered: ArenaPayload;
  ArenaExited: ArenaPayload;
}

export type WorldEvent = {
  [Type in keyof WorldEventPayloads]: Readonly<{ type: Type } & WorldEventPayloads[Type]>
}[keyof WorldEventPayloads];
