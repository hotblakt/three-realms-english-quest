import assert from 'node:assert/strict';
import test from 'node:test';
import { optionalAtlas, registerOptionalAtlas } from '../forest-batch-b-preview/atlas.ts';

test('optional atlas readiness returns the prepared image without cancelling', async () => {
  let signal;
  const image = {};
  const result = await optionalAtlas(async current => { signal = current; return image; }, 100);
  assert.deepEqual(result, { ok: true, value: image });
  assert.equal(signal.aborted, false);
});

test('an optional network or decoder failure allows legacy vegetation', async () => {
  const result = await optionalAtlas(async () => { throw new Error('decode failed'); }, 100);
  assert.deepEqual(result, { ok: false, reason: 'decode failed' });
});

test('a stalled optional atlas is aborted even if its promise never settles', async () => {
  let signal;
  const result = await optionalAtlas(current => {
    signal = current;
    return new Promise(() => {});
  }, 5);
  assert.deepEqual(result, { ok: false, reason: '竹林圖集逾時' });
  assert.equal(signal.aborted, true);
});

test('texture registration rolls back partial or invalid textures', () => {
  let rollbacks = 0;
  const rollback = () => { rollbacks++; };
  assert.equal(registerOptionalAtlas(() => {}, () => true, rollback).ok, true);
  assert.deepEqual(registerOptionalAtlas(() => {}, () => false, rollback),
    { ok: false, reason: '圖集缺少必要幀' });
  assert.deepEqual(registerOptionalAtlas(() => { throw new Error('upload failed'); }, () => true, rollback),
    { ok: false, reason: 'upload failed' });
  assert.equal(rollbacks, 2);
});

test('independent Batch B and C atlas deadlines keep normal ecology available during a landmark failure', async () => {
  const ecology = optionalAtlas(async () => 'ecology', 100);
  const landmarks = optionalAtlas(() => new Promise(() => {}), 5, '地標圖集逾時');
  assert.deepEqual(await ecology, { ok: true, value: 'ecology' });
  assert.deepEqual(await landmarks, { ok: false, reason: '地標圖集逾時' });
});
