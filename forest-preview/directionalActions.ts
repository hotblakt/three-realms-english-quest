import type { EikuDirection } from '../src/art/eikuAnimationConfig';

type Vector = { x: number; y: number };

export function facingDirection(facing: Vector): EikuDirection {
  if (facing.x) return facing.x > 0 ? 'east' : 'west';
  return facing.y < 0 ? 'north' : 'south';
}

export function forwardDistance(facing: Vector, input: Vector, displacement: Vector): number {
  if (facing.x * input.x + facing.y * input.y <= 0) return 0;
  return Math.max(0, facing.x * displacement.x + facing.y * displacement.y);
}

export function selectDirectionalAction<T>(
  clips: Partial<Record<string, T>>,
  direction: EikuDirection,
  state: { casting: boolean; busy: boolean; moving: boolean; hasInput: boolean },
): T | undefined {
  if (state.casting) return clips[`${direction}-cast`];
  if (state.busy) return undefined;
  if (state.moving) return clips[direction === 'east' ? 'framesprite' : `${direction}-run`];
  if (!state.hasInput) return clips[`${direction}-idle`];
}

export function chooseCastTiming(direction: EikuDirection, fps: number, frames: number) {
  const releaseFrame = { north: 0, east: 8, south: 6, west: 5 }[direction];
  return { duration: frames * 1000 / fps, releaseAt: releaseFrame * 1000 / fps };
}
