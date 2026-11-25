import frameSprite from './run-manifest.json' with { type: 'json' };
import chatgpt from './chatgpt-run-manifest.json' with { type: 'json' };

export const runSources = { framesprite: frameSprite, chatgpt };

export function parseRunSource(value: string): keyof typeof runSources | 'static' {
  if (value === 'static' || value === 'chatgpt') return value;
  return 'framesprite';
}
