import { repository, shaPattern } from './registry.mjs';

const statuses = ['queued', 'in_progress', 'success', 'failure', 'cancelled', 'skipped',
  'neutral', 'timed_out', 'action_required', 'stale', 'startup_failure', 'waiting', 'pending'];
const status = value => statuses.includes(value) ? value : null;
const id = value => Number.isSafeInteger(value) && value > 0 ? value : null;
const sha = value => typeof value === 'string' && shaPattern.test(value) ? value : null;
const timestamp = value => typeof value === 'string' && Number.isFinite(Date.parse(value))
  ? new Date(value).toISOString() : null;
const run = (raw, expectedSha) => expectedSha && raw?.sha === expectedSha && id(raw.id)
  ? { id: raw.id, status: status(raw.status), sha: expectedSha } : null;

// Allowlist scalars only. GitHub bodies, arbitrary URLs, user data and raw errors never cross this boundary.
export function publicSnapshot(raw, registry) {
  if (raw?.repository !== repository) return null;
  return {
    repository, observedAt: timestamp(raw.observedAt),
    coverage: raw.coverage === 'complete' ? 'complete' : 'partial',
    mainSha: sha(raw.mainSha), stablePages: run(raw.stablePages, registry.stable.commit),
    tasks: Object.fromEntries(registry.tasks.map(task => {
      const remote = Object.hasOwn(raw.tasks ?? {}, task.id) ? raw.tasks[task.id] : null;
      const matching = remote?.pr?.number === task.pr && task.pr !== null;
      const pr = matching ? {
        number: task.pr, state: ['open', 'closed', 'merged'].includes(remote.pr.state) ? remote.pr.state : null,
        headSha: sha(remote.pr.headSha), mergeSha: sha(remote.pr.mergeSha),
      } : null;
      return [task.id, {
        branchSha: sha(remote?.branchSha), pr,
        ci: run(remote?.ci, pr?.headSha), quality: run(remote?.quality, pr?.headSha),
        pages: run(remote?.pages, pr?.mergeSha),
      }];
    })),
  };
}

export function workflowStatus(value) {
  return status(value?.conclusion) ?? status(value?.status);
}
