import raw from './tasks.json';
import { freshness, nextProducerAction, parallelReady, repository, uniqueReports, validateRegistry } from './registry.mjs';
import { publicSnapshot } from './snapshot.mjs';
import './style.css';

const registry = validateRegistry(raw);
const root = `https://github.com/${repository}`;
const byId = new Map(registry.tasks.map(task => [task.id, task]));
const labels = {
  pending: '待辦', ready: '可排程', dispatched: '已交接', running: '執行中', awaiting_review: '待審閱',
  awaiting_producer_acceptance: '待製作人驗收', completed: '完成', blocked: '有阻礙', cancelled: '取消',
};
const runStatus = {
  success: '通過', failure: '失敗', queued: '排隊中', in_progress: '進行中', pending: '等待中',
  cancelled: '取消', skipped: '跳過', timed_out: '逾時', waiting: '等待中', action_required: '待處理',
};
const metricLabels = {
  totalSeconds: '經過秒數', engineeringSeconds: '工程秒數', testingSeconds: '測試秒數', waitingSeconds: '等待秒數',
  retrySeconds: '重試秒數', humanSeconds: '人工秒數', paidCredits: '付費點數', costUsd: '美元費用',
  verificationSeconds: '發布驗證秒數', deploymentSeconds: '部署秒數', reworked: '重工件數',
};
const when = date => date ? new Date(date).toLocaleString('zh-TW', { hour12: false, timeZoneName: 'short' }) : '未知';
const el = (tag, text, parent) => {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  parent?.append(node);
  return node;
};
const paragraph = (parent, content, muted = false) => {
  const node = el('p', content, parent);
  if (muted) node.className = 'muted';
  return node;
};
function link(parent, label, path) {
  el('a', label, parent).href = root + path;
}
function showEvidence(parent, entries) {
  for (const entry of entries) {
    const line = el('p', undefined, parent);
    const [kind, id] = entry.ref.split(':');
    const path = kind === 'pr' ? `/pull/${id}` : kind === 'commit' ? `/commit/${id}` : `/blob/main/${entry.ref}`;
    link(line, `${entry.kind === 'repository' ? 'Git 核對' : '已提報'}｜${entry.label}`, path);
  }
}
function prompt(parent, action) {
  const details = el('details', undefined, parent);
  el('summary', '手動交接提示', details);
  const field = el('textarea', undefined, details);
  field.value = action.prompt;
  field.readOnly = true;
  field.setAttribute('aria-label', '手動交接提示');
  const button = el('button', '複製提示', details);
  const status = paragraph(details, '', true);
  status.setAttribute('role', 'status');
  button.onclick = async () => {
    try {
      await navigator.clipboard.writeText(field.value);
      status.textContent = '已複製';
    } catch {
      field.focus();
      field.select();
      status.textContent = '已選取，請使用裝置的複製功能。';
    }
  };
}

const next = nextProducerAction(registry.tasks);
const nextPanel = document.querySelector('#next');
if (next) {
  el('h3', next.nextAction.label, nextPanel);
  paragraph(nextPanel, `${next.milestone}・${next.title}・${labels[next.status]}`);
  if (next.sourceBranch) link(el('p', undefined, nextPanel), '查看交付分支', `/tree/${next.sourceBranch}`);
  prompt(nextPanel, next.nextAction);
} else paragraph(nextPanel, '目前沒有需要製作人處理的事項。');

const stable = document.querySelector('#stable');
el('h3', registry.stable.label, stable);
link(el('p', undefined, stable), `PR #${registry.stable.pr}・${registry.stable.commit.slice(0, 12)}`, `/pull/${registry.stable.pr}`);
paragraph(stable, `展示日期 ${registry.stable.demoDate}`);
paragraph(stable, registry.stable.systems.join('・'));
showEvidence(stable, registry.stable.evidence);

function renderSnapshot(snapshot) {
  const status = document.querySelector('#status');
  status.replaceChildren();
  const state = freshness(snapshot?.observedAt);
  paragraph(status, state === 'fresh' ? '24 小時內的唯讀快照'
    : state === 'stale' ? '快照已超過 24 小時' : 'GitHub 狀態未核對');
  if (snapshot?.coverage === 'partial' && snapshot.observedAt) paragraph(status, '部分欄位無法讀取。', true);
  paragraph(status, `快照時間 ${when(snapshot?.observedAt)}`, true);
  paragraph(status, `登錄更新 ${when(registry.updatedAt)}`, true);
  if (snapshot?.mainSha) link(el('p', undefined, status), `main ${snapshot.mainSha.slice(0, 12)}`, `/commit/${snapshot.mainSha}`);
  showRun(status, '穩定版 Pages', snapshot?.stablePages);
  renderTasks(snapshot?.tasks ?? {});
}
function showRun(parent, label, run) {
  const line = el('p', undefined, parent);
  const value = `${label} ${run?.status ? runStatus[run.status] ?? run.status : '未核對'}`;
  if (run?.id) link(line, value, `/actions/runs/${run.id}`);
  else line.textContent = value;
}
function renderTasks(observations) {
  const panel = document.querySelector('#tasks');
  panel.replaceChildren();
  const eligible = parallelReady(registry.tasks);
  paragraph(panel, eligible.length ? `可並行候選 ${eligible.map(task => task.title).join('、')}`
    : '目前沒有可並行派工的任務。', true);
  const tasks = [...registry.tasks].sort((a, b) => (a.status === 'completed') - (b.status === 'completed')
    || a.priority - b.priority);
  for (const task of tasks) {
    const detail = el('details', undefined, panel);
    detail.open = task.status !== 'completed';
    el('summary', `${labels[task.status]}・${task.milestone}・${task.title}`, detail);
    paragraph(detail, `${task.id}・${task.role}`, true);
    if (task.dependencies.length) paragraph(detail, `依賴 ${task.dependencies.map(id => byId.get(id).title).join('、')}`);
    const tracking = observations[task.id];
    if (task.sourceBranch) link(el('p', undefined, detail), task.sourceBranch, `/tree/${task.sourceBranch}`);
    if (task.sourceCommit) link(el('p', undefined, detail), `登錄提交 ${task.sourceCommit.slice(0, 12)}`, `/commit/${task.sourceCommit}`);
    if (tracking?.branchSha) link(el('p', undefined, detail), `遠端分支 ${tracking.branchSha.slice(0, 12)}`, `/commit/${tracking.branchSha}`);
    if (task.sourceCommit && tracking?.branchSha && task.sourceCommit !== tracking.branchSha) paragraph(detail, '登錄提交與遠端分支已不同。');
    if (task.pr) link(el('p', undefined, detail), `PR #${task.pr}${tracking?.pr?.state ? `・${{ open: '開啟', closed: '已關閉', merged: '已合併' }[tracking.pr.state]}` : ''}`, `/pull/${task.pr}`);
    if (tracking?.pr?.headSha) link(el('p', undefined, detail), `PR head ${tracking.pr.headSha.slice(0, 12)}`, `/commit/${tracking.pr.headSha}`);
    showRun(detail, 'CI', tracking?.ci);
    showRun(detail, '品質門檻', tracking?.quality);
    showRun(detail, 'Pages', tracking?.pages);
    if (task.deployment) paragraph(detail, `登錄部署 ${{ deployed: '已部署', pending: '等待中', failed: '失敗' }[task.deployment]}`, true);
    const checks = el('ul', undefined, detail);
    task.acceptance.forEach(check => el('li', check, checks));
    task.blockers.forEach(blocker => paragraph(detail, `阻礙｜${blocker}`));
    task.limitations.forEach(limit => paragraph(detail, limit, true));
    showEvidence(detail, task.evidence);
    if (task.nextAction && task !== next) prompt(detail, task.nextAction);
  }
}

const metricsPanel = document.querySelector('#metrics');
for (const report of uniqueReports(registry.reports)) {
  const detail = el('details', undefined, metricsPanel);
  el('summary', report.scope, detail);
  showEvidence(detail, [report.evidence]);
  const metric = (label, value) => paragraph(detail, `${label} ${value ?? '未量測'}`);
  for (const [key, label] of Object.entries(metricLabels)) metric(label, report.metrics[key]);
  for (const [label, accepted, reviewed] of [['素材驗收', 'assetAccepted', 'assetReviewed'],
    ['首次通過', 'firstPassAccepted', 'firstPassReviewed']]) {
    const total = report.metrics[reviewed], pass = report.metrics[accepted];
    metric(label, total > 0 && pass !== null ? `${pass}/${total}` : null);
  }
  metric('提報品質', report.quality ? ({ pass: '通過', fail: '未通過', pending: '等待中' })[report.quality] : null);
}

renderSnapshot(null);
try {
  const response = await fetch(`${import.meta.env.BASE_URL}mission-control/github-status.json`, {
    cache: 'no-store', signal: AbortSignal.timeout(5000),
  });
  if (response.ok) renderSnapshot(publicSnapshot(await response.json(), registry));
} catch {
  // The source registry remains usable when the optional snapshot is unavailable.
}
