import assert from 'node:assert/strict';
import test from 'node:test';
import { loadOptionalImage } from '../forest-preview/startup.ts';

test('optional atlas decoder verifies dimensions and removes callbacks', async () => {
  const image = { naturalWidth: 768, naturalHeight: 384 };
  const result = loadOptionalImage('/forest.webp', 768, 384, 1000, image);
  assert.equal(image.src, '/forest.webp');
  image.onload();
  assert.deepEqual(await result, { status: 'loaded', image });
  assert.equal(image.onload, null);
  assert.equal(image.onerror, null);
});

test('a broken response or mixed-version atlas falls back safely', async () => {
  for (const signal of ['onerror', 'onload']) {
    const image = { naturalWidth: 512, naturalHeight: 256 };
    const result = loadOptionalImage('/forest.webp', 768, 384, 1000, image);
    image[signal]();
    assert.deepEqual(await result, { status: signal === 'onerror' ? 'missing' : 'invalid-size' });
  }
});

test('a decoder that never completes times out and releases its request', async () => {
  let removed;
  const image = { removeAttribute: name => { removed = name; } };
  const result = loadOptionalImage('/forest.webp', 768, 384, 5, image);
  assert.deepEqual(await result, { status: 'timeout' });
  assert.equal(removed, 'src');
  assert.equal(image.onload, null);
  assert.equal(image.onerror, null);
});
