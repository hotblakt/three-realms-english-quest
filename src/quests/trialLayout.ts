export const trialWidth = 1050;
export const trialHeight = 660;
export const gate = { x: 109, y: 269 };
export const fragment = { x: 810, y: 434 };
export const voiceStone = { x: 524, y: 524 };
export const guardianSite = { x: 523, y: 205 };

export const groves = {
  'lower-grove': { x: 217, y: 470, waves: [[3, 3, 3], [3, 3, 4]] },
  'upper-grove': { x: 239, y: 192, waves: [[3, 4, 3], [4, 4, 4]] },
  'east-grove': { x: 799, y: 194, waves: [[4, 4, 4], [4, 5, 4]] },
} as const;

export type Grove = keyof typeof groves;

export function isGrove(step: string): step is Grove { return Object.hasOwn(groves, step); }

export function trialCheckpoint(step: string): { x: number; y: number } {
  if (isGrove(step)) {
    const spot = groves[step];
    return { x: spot.x, y: spot.y + 58 };
  }
  if (step === 'fragment') return { x: fragment.x, y: fragment.y + 58 };
  if (step === 'speaking') return { x: voiceStone.x, y: voiceStone.y + 53 };
  return { x: guardianSite.x, y: guardianSite.y + 58 };
}
