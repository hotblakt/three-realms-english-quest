export const movementAtlasKeys = [
  'framesprite', 'north-run', 'west-run', 'south-run',
  'east-idle', 'north-idle', 'west-idle', 'south-idle',
] as const;

export const castAtlasKeys = ['east-cast', 'west-cast', 'south-cast'] as const;

export function movementAtlasesReady(isReady: (key: typeof movementAtlasKeys[number]) => boolean): boolean {
  return movementAtlasKeys.every(isReady);
}

export function canStartRun(input: { x: number; y: number },
  blocked: { up: boolean; down: boolean; left: boolean; right: boolean }): boolean {
  return (input.x > 0 && !blocked.right) || (input.x < 0 && !blocked.left)
    || (input.y < 0 && !blocked.up) || (input.y > 0 && !blocked.down);
}
