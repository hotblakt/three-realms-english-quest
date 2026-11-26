import type { EikuDirection } from '../src/art/eikuAnimationConfig';

export const recommendedScale = { east: 100, west: 100, north: 114, south: 95 } as const;
export type DirectionScales = Record<EikuDirection, number>;
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

export function runDirection(id: string): EikuDirection | undefined {
  const match = /^eiku-(east|west|north|south)-run$/.exec(id);
  return match?.[1] as EikuDirection | undefined;
}

export function smoothVisualSize(previous: number, target: number, elapsed: number): number {
  if (Math.abs(previous - target) < .02 || elapsed >= 200) return target;
  return target + (previous - target) * Math.exp(-Math.max(0, elapsed) / 45);
}
