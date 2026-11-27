import type { EikuDirection } from '../src/art/eikuAnimationConfig';
import measured from '../docs/eiku-directional-scale-measurements.json' with { type: 'json' };

const clipHeights: Readonly<Partial<Record<string, readonly number[]>>> = {
  'eiku-east-run': measured.run,
  'eiku-west-run': measured['west-run'],
  'eiku-north-run': measured['north-run'],
  'eiku-south-run': measured['south-run'],
  'eiku-east-idle': measured['east-idle'],
  'eiku-west-idle': measured['west-idle'],
  'eiku-north-idle': measured['north-idle'],
  'eiku-south-idle': measured['south-idle'],
};

export function locomotionSilhouette(clip: string, frame: number) {
  const height = clipHeights[clip]?.[frame];
  return height === undefined ? undefined : { clip, bodyHeight: height / 256 };
}

export function stanceSilhouette(direction: EikuDirection) {
  const height = { east: 209, north: 210, west: 210, south: 211 }[direction];
  return { clip: `stance-${direction}`, bodyHeight: height / 256 };
}
