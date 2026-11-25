import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { parseRunSource, runSources } from '../forest-preview/runSources.ts';

test('source switching keeps the approved benchmark as the default and static separate', () => {
  for (const source of ['static', 'chatgpt', 'framesprite']) assert.equal(parseRunSource(source), source);
  assert.equal(parseRunSource('unknown'), 'framesprite');
  assert.equal(runSources.static, undefined);
  assert.notEqual(runSources.chatgpt.id, runSources.framesprite.id);
  for (const field of ['fps', 'referenceSpeed', 'standingHeightInFrame', 'origin']) {
    assert.deepEqual(runSources.chatgpt[field], runSources.framesprite[field]);
  }
});

test('both source manifests point to verified, independently selectable runtime atlases', async () => {
  for (const source of Object.values(runSources)) {
    for (const resolution of [256, 384]) {
      const asset = source.textures[resolution];
      const file = await readFile(new URL(`../public/eiku-run/${asset.url}`, import.meta.url));
      assert.equal(file.byteLength, asset.bytes);
      assert.equal(createHash('sha256').update(file).digest('hex'), asset.sha256);
      assert.equal(asset.width / resolution * (asset.height / resolution), source.frameCount);
    }
  }
});
