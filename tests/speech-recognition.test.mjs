import assert from 'node:assert/strict';
import test from 'node:test';
import { SpeechRecognitionService } from '../src/speech/SpeechRecognitionService.ts';
import { matchesSpokenText } from '../src/speech/matchSpokenText.ts';

function browser(prefixed = false) {
  const instances = [];
  class FakeRecognition extends EventTarget {
    start() { instances.push(this); }
    stop() { this.stopped = true; }
    abort() { this.aborted = true; }
    emit(type, data = {}) { this.dispatchEvent(Object.assign(new Event(type), data)); }
    hear(transcript, isFinal = true) {
      this.emit('result', { results: [{ 0: { transcript }, isFinal }] });
    }
  }
  return {
    instances,
    service: new SpeechRecognitionService(prefixed
      ? { webkitSpeechRecognition: FakeRecognition } : { SpeechRecognition: FakeRecognition }),
  };
}

test('speech text matching accepts capitalization, punctuation, and fillers but preserves meaning', () => {
  for (const line of ['I can run.', ' I CAN RUN! ', 'Uh, I can run', 'Ｉ can run', 'I — can, run!', 'I erm can run']) {
    assert.equal(matchesSpokenText(line, 'I can run.'), true, line);
  }
  for (const line of ['', 'I can’t run', 'I can not run', 'I can walk', 'I can run now', 'I can', '不 I can run']) {
    assert.equal(matchesSpokenText(line, 'I can run.'), false, line);
  }
});

test('unsupported browser rejects without trying to access a microphone', async () => {
  const service = new SpeechRecognitionService({});
  assert.equal(service.supported, false);
  await assert.rejects(service.recognize('en-US', new AbortController().signal), { reason: 'unsupported' });
});

test('prefixed API sets en-US, reports phases and returns final text after the session ends', async () => {
  const { service, instances } = browser(true);
  const controller = new AbortController();
  const phases = [];
  const pending = service.recognize('en-US', controller.signal, phase => phases.push(phase));
  const native = instances[0];
  assert.equal(service.supported, true);
  assert.equal(native.lang, 'en-US');
  assert.equal(native.continuous, false);
  assert.equal(native.interimResults, false);
  native.emit('audiostart');
  native.hear('I can', false);
  native.emit('speechend');
  native.hear('I can run.');
  assert.deepEqual(phases, ['starting', 'listening', 'processing']);
  await assert.rejects(service.recognize('en-US', controller.signal), { reason: 'busy' });
  native.emit('end');
  assert.deepEqual(await pending, { transcript: 'I can run.' });
  controller.abort();
  assert.equal(native.aborted, undefined);
});

test('permission, network, and no-speech failures release the session for retry', async () => {
  const { service, instances } = browser();
  const signal = new AbortController().signal;
  for (const [error, reason] of [['not-allowed', 'denied'], ['service-not-allowed', 'denied'],
    ['network', 'error'], ['no-speech', 'retry']]) {
    const pending = service.recognize('en-US', signal);
    const native = instances.at(-1);
    native.emit('error', { error });
    await assert.rejects(pending, { reason });
    assert.equal(native.aborted, true);
  }
  const retry = service.recognize('en-US', signal);
  instances.at(-1).emit('end');
  await assert.rejects(retry, { reason: 'retry' });
});

test('stop requests final processing; pause/exit abort removes old listeners and permits a new attempt', async () => {
  const { service, instances } = browser();
  const controller = new AbortController();
  const states = [];
  const pending = service.recognize('en-US', controller.signal, phase => states.push(phase));
  const first = instances[0];
  first.emit('audiostart');
  service.stop();
  assert.equal(first.stopped, true);
  assert.deepEqual(states, ['starting', 'listening', 'processing']);

  controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  assert.equal(first.aborted, true);
  first.hear('old result');
  first.emit('end');
  const next = service.recognize('en-US', new AbortController().signal);
  const second = instances[1];
  second.hear('I can run!');
  second.emit('end');
  assert.deepEqual(await next, { transcript: 'I can run!' });
  assert.deepEqual(states, ['starting', 'listening', 'processing']);
});


test('a silent or hung recognizer times out, aborts, and allows retry', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { service, instances } = browser();
  const pending = service.recognize('en-US', new AbortController().signal);
  t.mock.timers.tick(18_000);
  await assert.rejects(pending, { reason: 'retry' });
  assert.equal(instances[0].aborted, true);
  const next = service.recognize('en-US', new AbortController().signal);
  instances[1].hear('I can run.');
  instances[1].emit('end');
  assert.deepEqual(await next, { transcript: 'I can run.' });
});


test('native alternatives are forwarded without flattening unrelated segments', async () => {
  const { service, instances } = browser();
  const pending = service.recognize('en-US', new AbortController().signal);
  const native = instances[0];
  native.emit('result', { results: [{ isFinal: true, length: 3,
    0: { transcript: 'um' }, 1: { transcript: 'I can run' }, 2: { transcript: 'I can jump' } }] });
  native.emit('end');
  assert.deepEqual(await pending, { transcript: 'um', alternatives: ['I can run', 'I can jump'] });
});
