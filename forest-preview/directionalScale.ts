import type { EikuDirection } from '../src/art/eikuAnimationConfig';

export const recommendedScale = { east: 100, west: 100, north: 114, south: 95 } as const;
export type DirectionScales = Record<EikuDirection, number>;
export type ArtAction = 'run' | 'idle' | 'cast' | 'stance';

// Median crown-to-boot height measured at the 256 px reference resolution.
const body: Record<EikuDirection, Partial<Record<ArtAction, number>> & { run: number }> = {
  east: { run: 189, idle: 210, cast: 209, stance: 209 },
  west: { run: 202, idle: 210, cast: 209, stance: 210 },
  north: { run: 172, idle: 209.5, stance: 210 },
  south: { run: 202, idle: 210, cast: 210, stance: 211 },
};

export function sanitizeScales(input: Partial<DirectionScales> = {}): DirectionScales {
  const result: DirectionScales = { ...recommendedScale };
  for (const direction of Object.keys(result) as EikuDirection[]) {
    const value = input[direction];
    if (typeof value === 'number' && Number.isFinite(value)) {
      result[direction] = Math.max(80, Math.min(120, Math.round(value)));
    }
  }
  return result;
}

export function calibrationFor(direction: EikuDirection, action: ArtAction, scales: DirectionScales) {
  const heights = body[direction];
  return { target: heights.run * scales[direction] / 100, artwork: heights[action] ?? heights.run };
}

export function clipCalibration(id: string): { direction: EikuDirection; action: ArtAction } | undefined {
  const match = /^eiku-(east|west|north|south)-(run|idle|cast)$/.exec(id);
  if (match) return { direction: match[1] as EikuDirection, action: match[2] as ArtAction };
}

export function smoothBodyHeight(previous: number, target: number, elapsed: number): number {
  if (Math.abs(previous - target) < .02 || elapsed >= 200) return target;
  return target + (previous - target) * Math.exp(-Math.max(0, elapsed) / 45);
}
