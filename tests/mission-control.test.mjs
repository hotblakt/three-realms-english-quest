import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { assertTransition, canonicalWriteScope, freshness, nextProducerAction, parallelReady, repository, uniqueReports, validateRegistry }
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

test('closeout removes obsolete prompts and exposes the next eligible producer handoff', () => {
  const data = validateRegistry(registry());
  const closed = data.tasks.filter(task => task.id.startsWith('mission-control-'));
  assert.ok(closed.every(task => task.status === 'completed' && task.nextAction === null));
  assert.equal(nextProducerAction(data.tasks).id, 'forest-v3-world-design');
  const invalid = { ...data.tasks.find(t => t.id === 'mission-control-foundation'),
    nextAction: { role: 'Producer', label: 'Obsolete review', prompt: 'Old review' } };
  assert.equal(nextProducerAction([invalid]), null);
  data.tasks.splice(data.tasks.findIndex(t => t.id === invalid.id), 1, invalid);
  assert.throws(() => validateRegistry(data), /Obsolete action/);
});

test('actual launch tasks fit three independent design scopes and one QA slot', () => {
  const data = registry();
  const expected = ['forest-v3-world-design', 'hayate-companion-design', 'combat-v1-design', 'demo-qa-plan'];
  assert.deepEqual(parallelReady(data.tasks).map(t => t.id), expected);
  assert.deepEqual(data.tasks.find(t => t.id === 'production-integration-gate').dependencies, expected);
  assert.equal(data.tasks.find(t => t.id === 'demo-implementation-authorization').status, 'pending');
  const first = data.tasks.find(t => t.id === expected[0]);
  const second = data.tasks.find(t => t.id === expected[1]);
  second.writeScopes = [first.writeScopes[0].replace('production/', 'production//./')];
  assert.deepEqual(parallelReady(data.tasks).map(t => t.id), [expected[0],expected[2],expected[3]]);
  first.status = 'dispatched';
  assert.notEqual(nextProducerAction(data.tasks)?.id, first.id);
  first.status = 'ready';
  data.tasks.find(t => t.id === 'mission-control-foundation').status = 'awaiting_review';
  assert.deepEqual(parallelReady(data.tasks), []);
});

test('PR 40 closeout preserves four disjoint reported scopes and unknown manual time', () => {
  const data = registry();
  const reports = data.reports.filter(r => r.task === 'mission-control-foundation');
  const rows = uniqueReports([...reports, ...reports]);
  assert.deepEqual(rows.map(r => r.metrics.totalSeconds), [593, 292, 141, 286]);
  assert.equal(rows.reduce((sum, r) => sum + r.metrics.totalSeconds, 0), 1312);
  assert.ok(rows.every(r => r.metrics.humanSeconds === 0 && r.evidence.kind === 'reported'));
  assert.ok(!data.reports.some(r => r.task === 'mission-control-mobile-acceptance'));
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


test('Release Manager reproduction reserves equivalent file paths across branches', () => {
  const base = { ...fix(), status: 'ready', dependencies: [] };
  const a = { ...base, id: 'a', sourceBranch: 'feat/a', writeScopes: ['mission-control/main.mjs'] };
  const b = { ...base, id: 'b', sourceBranch: 'feat/b', writeScopes: ['mission-control//main.mjs'] };
  assert.deepEqual(parallelReady([a, b]).map(t => t.id), ['a']);
  for (const alias of ['././mission-control/main.mjs/', 'Mission-Control/MAIN.MJS', 'mission-control/./main.mjs',
    'mission-control///']) {
    assert.deepEqual(parallelReady([a, { ...b, writeScopes: [alias] }]).map(t => t.id), ['a'], alias);
  }
  assert.deepEqual(parallelReady([a, { ...b, writeScopes: ['mission-control/main2.mjs'] }]).map(t => t.id), ['a', 'b']);
  assert.deepEqual(parallelReady([a, { ...b, sourceBranch: 'feat/a', writeScopes: ['docs/update.md'] }]).map(t => t.id), ['a']);
});

test('write scopes canonicalize only unambiguous dot and slash segments and reject other syntax', () => {
  assert.equal(canonicalWriteScope('./.github//workflows/./deploy.yml/'), '.github/workflows/deploy.yml');
  for (const scope of ['', '.', '././', '../a', 'docs/../src', 'a/..', 'a///../b',
    '/repo/file', '//server/share', 'C:/repo/file', String.raw`docs\file`, '*', 'docs/**', 'doc?.md',
    'docs/a[1]', 'docs/a.', 'docs/a ', 'docs/檔案', 'docs/%2e%2e', 'incoming//master.png', null]) {
    assert.throws(() => canonicalWriteScope(scope), /write scope/, String(scope));
  }
  const data = registry();
  data.tasks.find(t => t.id === fix().id).writeScopes = ['a/../b'];
  assert.throws(() => validateRegistry(data), /write scope segment/);
  assert.throws(() => parallelReady([{ ...fix(), writeScopes: ['docs/*.md'], status: 'ready' }]), /write scope/);
});

test('active scope conflicts use the same key as ready scheduling', () => {
  const data = registry();
  for (const [i, scope] of ['mission-control/main.mjs', 'Mission-Control//./main.mjs/'].entries()) {
    data.tasks.push({ ...fix(), id: 'active-' + i, sourceBranch: 'feat/active-' + i, pr: null,
      status: 'running', writeScopes: [scope],
      history: [{ status: 'running', at: data.updatedAt, evidence: data.stable.evidence[0] }],
    });
  }
  assert.throws(() => validateRegistry(data), /Active write conflict/);
});

test('PR 40 tracking requires matching the existing source branch and keeps merge and deployment unknown', async () => {
  const data = registry();
  const task = data.tasks.find(t => t.id === 'mission-control-foundation');
  const head = 'db0c7c9136f24af6418b42916e622c9e42e22d37';
  assert.equal(task.pr, 40);
  assert.equal(task.status, 'completed');
  assert.equal(task.deployment, null);
  const mock = branch => async url => {
    if (url.endsWith('/pulls/40')) return {ok: true, json: async () => ({
      number: 40, state: 'open', head: { ref: branch, sha: head, repo: { full_name: repository } },
      base: { ref: 'main' }, merge_commit_sha: 'c'.repeat(40),
    })};
    if (url.endsWith('/heads/' + task.sourceBranch)) return {ok: true, json: async () => ({ object: { sha: head } })};
    return {ok: false};
  };
  const matching = (await collectGitHubStatus(data, mock(task.sourceBranch))).tasks[task.id];
  assert.equal(matching.branchSha, head);
  assert.deepEqual(matching.pr, {number: 40, state: 'open', headSha: head, mergeSha: null});
  assert.equal(matching.pages, null);
  assert.equal((await collectGitHubStatus(data, mock('feat/unrelated'))).tasks[task.id].pr, null);
});

test('merged PR CI recovery needs independently matching head, workflow and repository evidence', async () => {
  const data = registry();
  const task = data.tasks.find(t => t.pr === 40);
  const mergeSha = '1463e675ed1dba4b822b91216984d4c79b38317a';
  const candidate = { id: 41, head_sha: task.sourceCommit, head_branch: task.sourceBranch,
    repository: { full_name: repository }, head_repository: { full_name: repository },
    workflow_id: 91, event: 'pull_request', pull_requests: [], conclusion: 'failure' };
  const inspect = async (runChanges = {}, options = {}) => {
    const fetcher = async url => {
      let payload;
      if (url.endsWith('/pulls/40')) payload = {
        number: 40, merged: true, merge_commit_sha: mergeSha,
        head: { ref: task.sourceBranch, sha: task.sourceCommit, repo: { full_name: repository } },
        base: { ref: 'main' },
      };
      if (url.includes('quality.yml/runs') && !options.noRuns) payload = { workflow_runs: [{ ...candidate, ...runChanges }] };
      if (url.endsWith('/actions/workflows/quality.yml') && !options.noWorkflow) payload = { id: 91, path: '.github/workflows/quality.yml' };
      if (url.includes('/runs/41/jobs')) payload = options.noGate ? { jobs: [] }
        : { jobs: [{ name: 'PR quality gate', conclusion: 'failure' }] };
      return payload ? { ok: true, json: async () => payload } : { ok: false };
    };
    return (await collectGitHubStatus(data, fetcher)).tasks[task.id];
  };
  const confirmed = await inspect();
  assert.equal(confirmed.pr.state, 'merged');
  assert.equal(confirmed.ci.status, 'failure');
  assert.equal(confirmed.quality.status, 'failure');
  assert.equal((await inspect({}, { noGate: true })).quality.status, null);
  assert.equal((await inspect({}, { noRuns: true })).quality, null);
  assert.equal((await inspect({}, { noWorkflow: true })).quality, null);
  for (const mismatch of [{ head_sha: mergeSha }, { workflow_id: 90 }, { head_branch: 'feat/other' },
    { head_repository: { full_name: 'other/repo' } }, { event: 'push' }, { pull_requests: [{ number: 41 }] }]) {
    assert.equal((await inspect(mismatch)).quality, null);
  }
});
