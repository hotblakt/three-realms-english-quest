import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { promisify } from 'node:util';

const stable = '62e590f665781822ac48bf691e6507f920bf6b68';
const production = '9721c466691c33de53a03d653b1673b50ed002c4';
const run = promisify(execFile);
const git = async (...args) => (await run('git', args, { encoding: 'buffer', maxBuffer: 16 * 1024 * 1024 })).stdout;

test('all 56 public assets match by path, blob and independently computed SHA-256', async () => {
  const known = await git('ls-tree', '-rz', stable, 'public');
  assert.deepEqual(await git('ls-tree', '-rz', production, 'public'), known);
  const paths = (await git('ls-tree', '-rz', '--name-only', stable, 'public')).toString().split('\0').filter(Boolean);
  assert.equal(paths.length, 56);
  for (const path of paths) {
    const digest = async commit => createHash('sha256').update(await git('show', commit + ':' + path)).digest('hex');
    assert.equal(await digest(production), await digest(stable), path);
  }
});

test('PR #42 game runtime, entry and dependency source match PR #39', async () => {
  await git('merge-base', '--is-ancestor', stable, production);
  assert.equal((await git('diff', '--name-only', stable, production, '--', 'src', 'public', 'forest-preview',
    'forest-batch-b-preview', 'forest-batch-c-preview', 'forest-diagnostics', 'art-workbench',
    'index.html', 'package.json', 'package-lock.json')).toString(), '');
});
