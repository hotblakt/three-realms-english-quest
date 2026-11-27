export const locomotionTransitionMs = 120;
export interface Silhouette { clip: string; bodyHeight: number }

type Group = 'run' | 'idle' | 'other';

export interface VisualScaleState {
  group: Group;
  silhouette: Silhouette;
  target: number;
  from: number;
  started: number;
  value: number;
}

export function transitionVisualScale(old: VisualScaleState | undefined, group: Group, target: number,
  time: number, reduceMotion: boolean,
  silhouette: Silhouette = { clip: group, bodyHeight: 1 }): VisualScaleState {
  if (!old || reduceMotion || group === 'other' || old.group === 'other') {
    return { group, silhouette, target, from: target * silhouette.bodyHeight, started: time, value: target };
  }
  const changed = group !== old.group || silhouette.clip !== old.silhouette.clip || target !== old.target;
  const from = changed ? old.value * old.silhouette.bodyHeight : old.from;
  const started = changed ? time : old.started;
  const t = Math.max(0, Math.min(1, (time - started) / locomotionTransitionMs));
  const ease = t * t * (3 - 2 * t);
  const visible = from + (target * silhouette.bodyHeight - from) * ease;
  return { group, silhouette, target, from, started, value: visible / silhouette.bodyHeight };
}
