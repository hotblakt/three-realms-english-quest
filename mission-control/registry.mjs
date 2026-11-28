export const repository = 'hotblakt/three-realms-english-quest';
export const roles = ['Producer', 'ChatGPT', 'Codex', 'Work', 'ChatGPT Images', 'FrameSprite'];
export const states = ['pending', 'ready', 'dispatched', 'running', 'awaiting_review',
  'awaiting_producer_acceptance', 'completed', 'blocked', 'cancelled'];
const transitions = {
  pending: ['ready', 'awaiting_producer_acceptance', 'blocked', 'cancelled'],
  ready: ['pending', 'dispatched', 'awaiting_review', 'blocked', 'cancelled'],
  dispatched: ['ready', 'running', 'blocked', 'cancelled'],
  running: ['awaiting_review', 'awaiting_producer_acceptance', 'blocked', 'cancelled'],
  awaiting_review: ['ready', 'awaiting_producer_acceptance', 'completed', 'blocked', 'cancelled'],
  awaiting_producer_acceptance: ['ready', 'completed', 'blocked', 'cancelled'],
  blocked: ['pending', 'ready', 'cancelled'],
  completed: [],
  cancelled: [],
};
export const metrics = ['totalSeconds', 'engineeringSeconds', 'testingSeconds', 'waitingSeconds', 'retrySeconds',
  'humanSeconds', 'paidCredits', 'costUsd', 'assetAccepted', 'assetReviewed', 'firstPassAccepted',
  'firstPassReviewed', 'reworked', 'verificationSeconds', 'deploymentSeconds'];
const idPattern = /^[a-z0-9][a-z0-9-]{0,79}$/;
export const shaPattern = /^[a-f0-9]{40}$/;
export const branchPattern = /^(?:main|[a-z0-9-]+\/[a-z0-9][a-z0-9._/-]{0,100})$/;
const privateText = /(?:https?:\/\/|three-realms-art-assets|raw-archives|incoming\/|github_pat_|gh[pousr]_|bearer\s+|api[_ -]?key\s*[:=]|-----BEGIN|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,})/i;
const validId = value => typeof value === 'string' && idPattern.test(value);
const date = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value) && Number.isFinite(Date.parse(value));
const integer = value => Number.isSafeInteger(value) && value > 0;
const nullable = (value, check) => value === null || check(value);
const oneOf = (value, options) => options.includes(value);
const text = value => typeof value === 'string' && value.length > 0 && value.length <= 1200 && !privateText.test(value);
const list = (value, check) => Array.isArray(value) && value.every(check);
const record = (value, keys) => value && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const must = (condition, message) => { if (!condition) throw new Error(message); };
const evidence = value => record(value, ['kind', 'ref', 'label'])
  && oneOf(value.kind, ['reported', 'repository'])
  && /^(?:docs\/[a-z0-9-]+\.md|pr:\d+|commit:[a-f0-9]{40})$/.test(value.ref) && text(value.label);

// This key is for comparing write scopes, never for opening or modifying files.
export function canonicalWriteScope(scope) {
  must(typeof scope === 'string' && scope.length <= 1024 && /^[A-Za-z0-9._/-]+$/.test(scope)
    && !scope.startsWith('/'), 'Invalid write scope');
  const parts = scope.split('/').filter(segment => segment && segment !== '.');
  must(parts.length > 0 && parts.every(segment => segment !== '..' && !segment.endsWith('.')),
    'Invalid write scope segment');
  const canonical = parts.join('/').toLowerCase();
  must(!privateText.test(canonical), 'Invalid private write scope');
  return canonical;
}

export function assertTransition(from, to) {
  must(transitions[from]?.includes(to), `Invalid status transition: ${from} → ${to}`);
}

function validateReport(r, taskIds) {
  must(record(r, ['id', 'task', 'attempt', 'revision', 'commit', 'pr', 'scope', 'evidence', 'metrics', 'quality']),
    'Invalid report shape');
  must(validId(r.id) && taskIds.has(r.task) && integer(r.attempt) && integer(r.revision)
    && nullable(r.commit, x => shaPattern.test(x)) && nullable(r.pr, integer) && text(r.scope)
    && evidence(r.evidence) && record(r.metrics, metrics) && nullable(r.quality, x => oneOf(x, ['pass', 'fail', 'pending'])),
  `Invalid report: ${r.id}`);
  for (const field of metrics) {
    must(nullable(r.metrics[field], x => typeof x === 'number' && Number.isFinite(x) && x >= 0),
      `Invalid metric: ${r.id}/${field}`);
  }
  for (const [pass, total] of [['assetAccepted', 'assetReviewed'], ['firstPassAccepted', 'firstPassReviewed']]) {
    must(r.metrics[pass] === null || (r.metrics[total] !== null && r.metrics[pass] <= r.metrics[total]),
      `Invalid acceptance counts: ${r.id}`);
  }
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  }
  return value;
}

export function uniqueReports(reports) {
  const ids = new Map();
  const slots = new Map();
  const revisions = new Map();
  for (const report of reports) {
    const payload = JSON.stringify(canonical(report));
    if (ids.has(report.id)) {
      must(ids.get(report.id) === payload, `Conflicting report identity: ${report.id}`);
      continue;
    }
    ids.set(report.id, payload);
    // A distinct attempt can record another real run of the same commit and PR.
    const key = JSON.stringify([report.task, report.commit, report.pr, report.attempt]);
    const revisionKey = JSON.stringify([key, report.revision]);
    const { id: _id, ...fields } = report;
    const revision = JSON.stringify(canonical(fields));
    must(!revisions.has(revisionKey) || revisions.get(revisionKey) === revision,
      `Conflicting report revision: ${report.id}`);
    revisions.set(revisionKey, revision);
    if (!slots.has(key) || report.revision > slots.get(key).revision) slots.set(key, report);
  }
  return [...slots.values()];
}

export function validateRegistry(data) {
  must(record(data, ['version', 'repository', 'updatedAt', 'stable', 'tasks', 'reports'])
    && data.version === 1 && data.repository === repository && date(data.updatedAt), 'Invalid registry header');
  const stable = data.stable;
  must(record(stable, ['label', 'commit', 'pr', 'demoDate', 'systems', 'evidence'])
    && text(stable.label) && shaPattern.test(stable.commit) && integer(stable.pr)
    && /^\d{4}-\d{2}-\d{2}$/.test(stable.demoDate) && list(stable.systems, text) && list(stable.evidence, evidence),
  'Invalid stable baseline');
  must(Array.isArray(data.tasks) && Array.isArray(data.reports), 'Invalid registry collections');
  const byId = new Map();
  for (const t of data.tasks) {
    must(record(t, ['id', 'milestone', 'title', 'role', 'stream', 'priority', 'dependencies', 'status',
      'sourceBranch', 'sourceCommit', 'pr', 'deployment', 'acceptance', 'evidence', 'limitations', 'blockers',
      'nextAction', 'writeScopes', 'history']), 'Invalid task shape');
    must(validId(t.id) && !byId.has(t.id) && text(t.milestone) && text(t.title) && roles.includes(t.role)
      && oneOf(t.stream, ['production', 'release_qa']) && integer(t.priority) && states.includes(t.status)
      && list(t.dependencies, validId) && new Set(t.dependencies).size === t.dependencies.length
      && nullable(t.sourceBranch, x => branchPattern.test(x) && !privateText.test(x) && !x.includes('..'))
      && nullable(t.sourceCommit, x => shaPattern.test(x)) && nullable(t.pr, integer)
      && nullable(t.deployment, x => oneOf(x, ['pending', 'deployed', 'failed']))
      && list(t.acceptance, text) && t.acceptance.length > 0 && list(t.evidence, evidence)
      && list(t.limitations, text) && list(t.blockers, text)
      && Array.isArray(t.writeScopes)
      && nullable(t.nextAction, a => record(a, ['role', 'label', 'prompt']) && roles.includes(a.role) && text(a.label) && text(a.prompt)),
    `Invalid task: ${t.id}`);
    t.writeScopes.forEach(canonicalWriteScope);
    if (t.status === 'blocked') must(t.blockers.length > 0, `Missing blocker: ${t.id}`);
    if (t.status === 'completed') must(t.evidence.length > 0, `Missing completion evidence: ${t.id}`);
    if (['completed', 'cancelled'].includes(t.status)) must(t.nextAction === null, `Obsolete action: ${t.id}`);
    if ((t.role === 'Codex' || t.writeScopes.length > 0) && ['dispatched', 'running'].includes(t.status)) {
      must(t.sourceBranch && t.sourceBranch !== 'main' && t.writeScopes.length, `Missing isolated work scope: ${t.id}`);
    }
    must(Array.isArray(t.history) && t.history.length > 0, `Missing task history: ${t.id}`);
    let prior;
    for (const entry of t.history) {
      must(record(entry, ['status', 'at', 'evidence']) && states.includes(entry.status) && date(entry.at)
        && nullable(entry.evidence, evidence) && (entry.status !== 'running' || entry.evidence !== null)
        && (prior?.status !== 'pending' || entry.status !== 'awaiting_producer_acceptance' || entry.evidence !== null)
        && (prior?.status !== 'ready' || entry.status !== 'awaiting_review' || entry.evidence !== null),
      `Invalid lifecycle evidence: ${t.id}`);
      if (prior) {
        must(Date.parse(entry.at) >= Date.parse(prior.at), `History order: ${t.id}`);
        assertTransition(prior.status, entry.status);
      }
      prior = entry;
    }
    must(prior.status === t.status, `Task status differs from history: ${t.id}`);
    byId.set(t.id, t);
  }

  const done = new Set();
  const visiting = new Set();
  function visit(id) {
    must(byId.has(id), `Unknown task dependency: ${id}`);
    must(!visiting.has(id), `Dependency cycle: ${id}`);
    if (done.has(id)) return;
    visiting.add(id);
    byId.get(id).dependencies.forEach(visit);
    visiting.delete(id);
    done.add(id);
  }
  byId.forEach((_, id) => visit(id));
  const occupied = data.tasks.filter(active);
  const scopes = new Map(occupied.map(task => [task, canonicalScopes(task)]));
  must(occupied.filter(task => task.stream === 'production').length <= 3
    && occupied.filter(task => task.stream === 'release_qa').length <= 1, 'Workstream capacity exceeded');
  for (const [index, task] of occupied.entries()) {
    must(task.dependencies.every(id => byId.get(id).status === 'completed'), `Unmet active dependency: ${task.id}`);
    must(!occupied.slice(index + 1).some(other => tasksConflict(task, other, scopes)), `Active write conflict: ${task.id}`);
  }
  data.reports.forEach(r => validateReport(r, byId));
  uniqueReports(data.reports);
  return data;
}

const order = (a, b) => a.priority - b.priority || a.id.localeCompare(b.id);
const active = task => ['dispatched', 'running'].includes(task.status);
const scopesOverlap = (left, right) => left === right || left.startsWith(right + '/') || right.startsWith(left + '/');
const canonicalScopes = task => task.writeScopes.map(canonicalWriteScope);
const tasksConflict = (a, b, scopes) => (a.sourceBranch && a.sourceBranch.toLowerCase() === b.sourceBranch?.toLowerCase())
  || scopes.get(a).some(x => scopes.get(b).some(y => scopesOverlap(x, y)));

export function parallelReady(tasks) {
  const scopes = new Map(tasks.map(task => [task, canonicalScopes(task)]));
  const occupied = tasks.filter(active);
  const finished = new Set(tasks.filter(t => t.status === 'completed').map(t => t.id));
  const selected = [];
  for (const task of tasks.filter(t => t.status === 'ready').sort(order)) {
    if (!task.dependencies.every(id => finished.has(id))) continue;
    const reserved = [...occupied, ...selected];
    if (reserved.filter(t => t.stream === task.stream).length >= (task.stream === 'production' ? 3 : 1)) continue;
    if ((task.role === 'Codex' || task.writeScopes.length > 0) && (!task.sourceBranch || task.sourceBranch === 'main' || !task.writeScopes.length)) continue;
    if (!reserved.some(t => tasksConflict(task, t, scopes))) selected.push(task);
  }
  return selected;
}

export function nextProducerAction(tasks) {
  const finished = new Set(tasks.filter(t => t.status === 'completed').map(t => t.id));
  const parallel = new Set(parallelReady(tasks).map(t => t.id));
  return tasks.filter(t => t.nextAction?.role === 'Producer' && (
    t.status === 'blocked' || (['awaiting_review', 'awaiting_producer_acceptance'].includes(t.status)
      && t.dependencies.every(id => finished.has(id))) || (t.status === 'ready' && parallel.has(t.id))
  )).sort(order)[0] ?? null;
}

export function freshness(observedAt, now = Date.now()) {
  if (!date(observedAt) || Date.parse(observedAt) > now) return 'unknown';
  return now - Date.parse(observedAt) > 24 * 60 * 60 * 1000 ? 'stale' : 'fresh';
}
