import type { Shape } from './contracts.ts';

export const tuning = {
  health: 5, spiritMax: 4, startingSpirit: 2, runSpeed: 123,
  swordWindup: 60, swordActive: 90, swordRecovery: 150, swordRange: 55, swordDegrees: 106,
  dodgeSpeed: 310, dodgeDuration: 160, dodgeCooldown: 550,
  counterDuration: 900, damageProtection: 950, hitRecovery: 100,
  windCost: 2, windDamage: 2, windWindup: 120, windRecovery: 180, windCooldown: 650,
  windSpeed: 360, windHalfWidth: 12, windRange: 144, runeRange: 168,
  buffer: 120, resumeGrace: 300, attackGap: 250, enemyReset: 2000,
  assistWarning: 250, assistCounter: 300,
} as const;

export interface AttackDefinition {
  shape: Shape;
  warning: number;
  active: number;
  recovery: number;
}
export interface EnemyDefinition {
  health: number;
  radius: number;
  speed: number;
  minDistance: number;
  maxDistance: number;
  attacks: readonly AttackDefinition[];
  /** A core enemy only takes damage in recovery. */
  core?: { phaseAt: number; transition: number; laterRecovery: number };
}
export const enemies = {
  'bamboo-sprout': {
    health: 3, radius: 11, speed: 75, minDistance: 0, maxDistance: 32,
    attacks: [{ shape: { kind: 'sector', range: 43, degrees: 100 }, warning: 500, active: 100, recovery: 750 }],
  },
  'wind-seed': {
    health: 3, radius: 10, speed: 55, minDistance: 80, maxDistance: 105,
    attacks: [{ shape: { kind: 'projectile', range: 136, halfWidth: 9, speed: 170 }, warning: 600, active: 800, recovery: 850 }],
  },
  'mosswood-guardian': {
    health: 12, radius: 22, speed: 45, minDistance: 0, maxDistance: 65,
    core: { phaseAt: 6, transition: 600, laterRecovery: 1000 },
    attacks: [
      { shape: { kind: 'sector', range: 72, degrees: 100 }, warning: 800, active: 140, recovery: 1300 },
      { shape: { kind: 'strip', range: 120, halfWidth: 17 }, warning: 900, active: 120, recovery: 1300 },
    ],
  },
} as const satisfies Record<string, EnemyDefinition>;

export interface EncounterDefinition {
  enemies: readonly string[];
  reward: 'wind-seal' | 'guardian-badge' | 'encounter-clear';
  firstWarning?: number;
  prerequisite?: string;
}
export const encounters = {
  'lantern-sprout': { enemies: ['bamboo-sprout'], reward: 'wind-seal', firstWarning: 700 },
  'east-wind-pair': { enemies: ['bamboo-sprout', 'wind-seed'], reward: 'encounter-clear' },
  'mosswood-guardian': { enemies: ['mosswood-guardian'], reward: 'guardian-badge', prerequisite: 'east-wind-pair' },
} as const satisfies Record<string, EncounterDefinition>;
