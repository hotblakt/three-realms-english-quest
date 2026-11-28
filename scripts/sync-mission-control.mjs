import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { repository, shaPattern, validateRegistry } from '../mission-control/registry.mjs';
import { publicSnapshot, workflowStatus } from '../mission-control/snapshot.mjs';

const validSha = value => typeof value === 'string' && shaPattern.test(value);

export async function collectGitHubStatus(registry, fetcher = fetch, token = '', now = () => new Date()) {
  validateRegistry(registry);
  let reads = 0;
  let failures = 0;
  const headers = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
  if (token) headers.Authorization = `Bearer ${token}`;
  async function read(path) {
    try {
      const response = await fetcher(`https://api.github.com/repos/${repository}/${path}`,
        { headers, signal: AbortSignal.timeout(6000), redirect: 'error' });
      if (!response.ok) throw new Error('GitHub read unavailable');
      const value = await response.json();
      reads++;
      return value;
    } catch {
      failures++;
      return null;
    }
  }
  const ref = async branch => (await read(`git/ref/heads/${branch.split('/').map(encodeURIComponent).join('/')}`))?.object?.sha;
  const pagesCache = new Map();
  function pages(sha) {
    if (!validSha(sha)) return null;
    if (!pagesCache.has(sha)) {
      pagesCache.set(sha, (async () => {
        const runs = await read(`actions/workflows/deploy.yml/runs?branch=main&head_sha=${sha}&per_page=10`);
        const match = runs?.workflow_runs?.find(r => r.head_sha === sha && r.head_branch === 'main');
        if (!Number.isSafeInteger(match?.id) || match.id <= 0) return null;
        const jobs = await read(`actions/runs/${match.id}/jobs?per_page=100`);
        const deploy = jobs?.jobs?.find(j => j.name === 'deploy');
        return { id: match.id, sha, status: deploy ? workflowStatus(deploy) : null };
      })());
    }
    return pagesCache.get(sha);
  }
  async function quality(pr) {
    if (!validSha(pr.headSha)) return null;
    const runs = await read(`actions/workflows/quality.yml/runs?event=pull_request&head_sha=${pr.headSha}&per_page=10`);
    const match = runs?.workflow_runs?.find(r => r.head_sha === pr.headSha
      && r.pull_requests?.some(p => p.number === pr.number));
    if (!Number.isSafeInteger(match?.id) || match.id <= 0) return null;
    const jobs = await read(`actions/runs/${match.id}/jobs?per_page=100`);
    return {
      ci: { id: match.id, sha: pr.headSha, status: workflowStatus(match) },
      gate: { id: match.id, sha: pr.headSha, status: workflowStatus(jobs?.jobs?.find(j => j.name === 'PR quality gate')) },
    };
  }
  const [mainSha, stablePages, entries] = await Promise.all([
    ref('main'), pages(registry.stable.commit),
    Promise.all(registry.tasks.map(async task => {
      const [branchSha, raw] = await Promise.all([task.sourceBranch ? ref(task.sourceBranch) : null,
        task.pr ? read(`pulls/${task.pr}`) : null]);
      const pr = raw?.number === task.pr && raw?.head?.repo?.full_name === repository && raw?.base?.ref === 'main'
        ? { number: raw.number, state: raw.merged ? 'merged' : raw.state, headSha: raw.head.sha,
            mergeSha: raw.merged ? raw.merge_commit_sha : null } : null;
      const [gate, deployment] = await Promise.all([pr ? quality(pr) : null, pr ? pages(pr.mergeSha) : null]);
      return [task.id, { branchSha, pr, ci: gate?.ci, quality: gate?.gate, pages: deployment }];
    })),
  ]);
  return publicSnapshot({
    repository, observedAt: reads > 0 ? now().toISOString() : null,
    coverage: failures === 0 ? 'complete' : 'partial', mainSha, stablePages,
    tasks: Object.fromEntries(entries),
  }, registry);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const registry = JSON.parse(await readFile(new URL('../mission-control/tasks.json', import.meta.url), 'utf8'));
  const output = process.argv[2] ?? 'dist/mission-control/github-status.json';
  const snapshot = await collectGitHubStatus(registry, fetch, process.env.GITHUB_TOKEN ?? '');
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, JSON.stringify(snapshot, null, 2) + '\n');
  console.log(snapshot.observedAt ? `Mission Control GitHub snapshot: ${snapshot.coverage}`
    : 'Mission Control GitHub snapshot unavailable; dashboard uses the source registry');
}
