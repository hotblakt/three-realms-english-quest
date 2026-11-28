import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { assertTransition, freshness, nextProducerAction, parallelReady, repository, uniqueReports, validateRegistry }
  from '../mission-control/registry.mjs';
import { publicSnapshot } from '../mission-control/snapshot.mjs';
import { collectGitHubStatus } from '../scripts/sync-mission-control.mjs';

const registry = () => JSON.parse(readFileSync(new URL('../mission-control/tasks.json', import.meta.url), 'utf8'));
const fix = () => registry().tasks.find(t => t.id === 'mission-control-foundation');

test('registry validates and missing metrics are recorded explicitly', () => {
  const data = validateRegistry(registry());
  assert.equal(data.reports[0].metrics.costUsd, null);
  assert.equal(data.reports[0].metrics.humanSeconds, 0);
  delete data.reports[0].metrics.costUsd;
  assert.throws(() => validateRegistry(data), /Invalid report/);
  const malformed = registry();
  malformed.tasks[0].id = null;
  assert.throws(() => validateRegistry(malformed), /Invalid task/);
});

test('unknown dependencies and cycles fail validation', () => {
  const data = registry();
  data.tasks[0].dependencies = [data.tasks[1].id];
  data.tasks[1].dependencies = [data.tasks[0].id];
  assert.throws(() => validateRegistry(data), /Dependency cycle/);
  data.tasks[1].dependencies = ['missing'];
  assert.throws(() => validateRegistry(data), /Unknown task dependency/);
});

test('status transitions need valid history and running evidence', () => {
  assert.doesNotThrow(() => assertTransition('dispatched', 'running'));
  assert.throws(() => assertTransition('completed', 'running'), /Invalid status transition/);
  const data = registry();
  const task = data.tasks.find(t => t.id === fix().id);
  task.status = 'running';
  task.history.push({ status: 'running', at: data.updatedAt, evidence: null });
  assert.throws(() => validateRegistry(data), /lifecycle evidence/);
});

test('duplicate reports do not double count, revisions replace and attempts remain distinct', () => {
  const initial = registry().reports[0];
  const mirror = { ...initial, id: 'mirrored-report' };
  const corrected = { ...initial, id: 'revised-report', revision: 2, metrics: { ...initial.metrics, humanSeconds: 4 } };
  const retry = { ...initial, id: 'separate-retry', attempt: 2 };
  assert.deepEqual(uniqueReports([initial, initial, mirror, corrected, retry]), [corrected, retry]);
  assert.throws(() => uniqueReports([initial, { ...initial, scope: 'changed identity' }]), /Conflicting report identity/);
  assert.throws(() => uniqueReports([initial, { ...mirror, scope: 'changed revision' }]), /Conflicting report revision/);
});

test('planner reserves distinct branches and overlapping write scopes under 3+1 capacity', () => {
  const task = (id, scope, priority, overrides = {}) => ({ ...fix(), id, dependencies: [], status: 'ready',
    writeScopes: [scope], sourceBranch: `feat/${id}`, priority, ...overrides });
  const tasks = [
    task('running', 'src/forest', 1, { status: 'running' }),
    task('overlap', 'src/forest/scene.ts', 1), task('a', 'docs', 1), task('b', 'tests', 2),
    task('c', 'art', 3), task('qa', 'qa', 1, {stream: 'release_qa'}),
    task('second-qa', 'qa2', 2, {stream: 'release_qa'}),
    task('waiting', 'misc', 1, { dependencies: ['a'] }),
  ];
  assert.deepEqual(parallelReady(tasks).map(t => t.id), ['a', 'qa', 'b']);
  const data = registry();
  const template = data.tasks.find(t => t.id === 'mission-control-foundation');
  data.tasks.push(...['active-a','active-b'].map(id => ({
    ...template, id, sourceBranch: `feat/${id}`, status: 'running', writeScopes: ['docs'],
    history: [{ status: 'running', at: data.updatedAt, evidence: data.stable.evidence[0] }],
  })));
  assert.throws(() => validateRegistry(data), /Active write conflict/);
});

test('next action is a single explicit producer handoff, with dependencies and priorities respected', () => {
  const tasks = registry().tasks;
  assert.equal(nextProducerAction(tasks).id, 'mission-control-foundation');
  const waiting = tasks.find(t => t.id === 'mission-control-mobile-acceptance');
  waiting.status = 'awaiting_producer_acceptance';
  waiting.priority = 1;
  assert.equal(nextProducerAction(tasks).id, 'mission-control-foundation');
  const earlier = tasks.find(t => t.id === 'mission-control-foundation');
  earlier.status = 'completed';
  assert.equal(nextProducerAction(tasks).id, waiting.id);
});

test('freshness rejects missing and future timestamps and marks old snapshots stale', () => {
  const now = Date.parse('2026-11-29T00:00:01Z');
  assert.equal(freshness('2026-11-28T00:00:00Z', now), 'stale');
  assert.equal(freshness('2026-11-28T22:00:00Z', now), 'fresh');
  assert.equal(freshness('2026-11-30T00:00:00Z', now), 'unknown');
  assert.equal(freshness(null, now), 'unknown');
});

test('public projection rejects private registry content and omits untrusted remote fields', () => {
  const data = registry();
  data.tasks[0].privateNote = 'personal note';
  assert.throws(() => validateRegistry(data), /Invalid task shape/);
  delete data.tasks[0].privateNote;
  data.tasks[0].limitations.push('Read incoming/master.png');
  assert.throws(() => validateRegistry(data), /Invalid task/);
  const raw = { repository, observedAt: '2026-11-28T00:00:00Z', secret: 'TOKEN', stablePages: {
    id: 88, status: 'success', sha: data.stable.commit, url: 'https://private.example/path',
  } };
  const safe = publicSnapshot(raw, registry());
  assert.equal(safe.stablePages.id, 88);
  assert.doesNotMatch(JSON.stringify(safe), /TOKEN|private.example/);
  assert.equal(publicSnapshot({ ...raw, repository: 'other/repo' }, registry()), null);
  raw.stablePages.sha = 'b'.repeat(40);
  assert.equal(publicSnapshot(raw, registry()).stablePages, null);
});

test('read-only synchronization binds job evidence to workflow, PR and SHA and degrades on denied reads', async () => {
  const data = registry();
  const prHead = 'a'.repeat(40);
  const requests = [];
  const mockedFetch = async (url, options) => {
    requests.push(url);
    assert.ok(url.startsWith(`https://api.github.com/repos/${repository}/`));
    assert.equal(options.method, undefined);
    let response;
    if (url.endsWith('/pulls/39')) response = { number: 39, merged: true, merge_commit_sha: data.stable.commit,
      head: { sha: prHead, repo: { full_name: repository } }, base: { ref: 'main' }, body: 'never publish' };
    if (url.includes('quality.yml/runs')) response = { workflow_runs: [
      { id: 6, head_sha: prHead, pull_requests: [{ number: 38 }] },
      { id: 7, head_sha: prHead, pull_requests: [{ number: 39 }] },
    ] };
    if (url.includes('deploy.yml/runs')) response = { workflow_runs: [{ id: 8, head_sha: data.stable.commit, head_branch: 'main' }] };
    if (url.includes('/runs/7/jobs')) response = { jobs: [{ name: 'PR quality gate', conclusion: 'success' }] };
    if (url.includes('/runs/8/jobs')) response = { jobs: [{ name: 'deploy', conclusion: 'success' }] };
    if (url.endsWith('/git/ref/heads/main')) response = { object: { sha: data.stable.commit } };
    return response ? { ok: true, json: async () => response } : { ok: false, status: 403 };
  };
  const snap = await collectGitHubStatus(data, mockedFetch);
  assert.equal(snap.coverage, 'partial');
  assert.equal(snap.tasks['forest-2-stable'].quality.status, 'success');
  assert.equal(snap.stablePages.status, 'success');
  assert.ok(!requests.some(url => url.includes('/runs/6/')));
  assert.doesNotMatch(JSON.stringify(snap), /never publish/);
  const denied = await collectGitHubStatus(data, async () => ({ ok: false, status: 403 }));
  assert.equal(denied.observedAt, null);
  assert.equal(denied.stablePages, null);
});
