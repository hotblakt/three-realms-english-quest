import frameSprite from './run-manifest.json' with { type: 'json' };
import chatgpt from './chatgpt-run-manifest.json' with { type: 'json' };

import falFirst from './fal-first-manifest.json' with { type: 'json' };
import falSecond from './fal-second-manifest.json' with { type: 'json' };

export const runSources = { framesprite: frameSprite, chatgpt, 'fal-first': falFirst, 'fal-second': falSecond };

export function parseRunSource(value: string): keyof typeof runSources | 'static' {
  if (value === 'static') return value;
  if (Object.hasOwn(runSources, value)) return value as keyof typeof runSources;
  return 'framesprite';
}
