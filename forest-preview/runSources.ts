import frameSprite from './run-manifest.json' with { type: 'json' };
import chatgpt from './chatgpt-run-manifest.json' with { type: 'json' };

import falFirst from './fal-first-manifest.json' with { type: 'json' };
import falSecond from './fal-second-manifest.json' with { type: 'json' };

import south from './south-run-manifest.json' with { type: 'json' };

import eastIdle from './east-idle-manifest.json' with { type: 'json' };
import eastCast from './east-cast-manifest.json' with { type: 'json' };

import north_run from './north-run-manifest.json' with { type: 'json' };
import west_run from './west-run-manifest.json' with { type: 'json' };
import north_idle from './north-idle-manifest.json' with { type: 'json' };
import west_idle from './west-idle-manifest.json' with { type: 'json' };
import south_idle from './south-idle-manifest.json' with { type: 'json' };
import west_cast from './west-cast-manifest.json' with { type: 'json' };
import south_cast from './south-cast-manifest.json' with { type: 'json' };

export const runSources = { framesprite: frameSprite, chatgpt, 'fal-first': falFirst, 'fal-second': falSecond, 'south-run': south, 'east-idle': eastIdle, 'east-cast': eastCast,
  'north-run': north_run,
  'west-run': west_run,
  'north-idle': north_idle,
  'west-idle': west_idle,
  'south-idle': south_idle,
  'west-cast': west_cast,
  'south-cast': south_cast,
};

export function parseRunSource(value: string): keyof typeof runSources | 'static' {
  if (value === 'static') return value;
  if (Object.hasOwn(runSources, value)) return value as keyof typeof runSources;
  return 'framesprite';
}
