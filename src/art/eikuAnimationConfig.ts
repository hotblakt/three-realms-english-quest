export const eikuDirections = ['south', 'west', 'east', 'north'] as const;
export type EikuDirection = typeof eikuDirections[number];

export const eikuMotions = ['idle', 'walk', 'attack', 'dodge'] as const;
export type EikuMotion = typeof eikuMotions[number];

export const productionFrameSize = 96;
export const productionFoot = { x: 48, y: 72 };
export const productionScale = 2 / 3;
export const productionFrameCount = 8;

export const productionAnimations = {
  idle: { frameRate: 6, repeat: -1 },
  walk: { frameRate: 12, repeat: -1 },
  attack: { frameRate: 32, repeat: 0 },
  dodge: { frameRate: 50, repeat: 0 },
} satisfies Record<EikuMotion, { frameRate: number; repeat: number }>;

export function eikuFrameName(direction: EikuDirection, motion: EikuMotion, index: number): string {
  return `eiku/${direction}/${motion}/${String(index).padStart(2, '0')}`;
}
