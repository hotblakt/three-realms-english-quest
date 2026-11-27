export const locomotionTransitionMs = 120;
type Group = 'run' | 'idle' | 'other';

export interface VisualScaleState {
  group: Group;
  target: number;
  from: number;
  started: number;
  value: number;
}

export function transitionVisualScale(old: VisualScaleState | undefined, group: Group, target: number,
  time: number, reduceMotion: boolean): VisualScaleState {
  if (!old || reduceMotion || group === 'other' || old.group === 'other') {
    return { group, target, from: target, started: time, value: target };
  }
  const changed = group !== old.group || target !== old.target;
  const from = changed ? old.value : old.from;
  const started = changed ? time : old.started;
  const t = Math.max(0, Math.min(1, (time - started) / locomotionTransitionMs));
  const ease = t * t * (3 - 2 * t);
  return { group, target, from, started, value: from + (target - from) * ease };
}
