import assert from 'node:assert/strict';
import { afterEach, mock, test } from 'node:test';
import { BrowserAudioCapture } from '../src/speech/AudioCapture.ts';

class TestRecorder extends EventTarget {
  state = 'inactive';
  mimeType = 'audio/mp4';

  start() {
    this.state = 'recording';
  }

  stop() {
    this.state = 'inactive';
    queueMicrotask(() => {
      this.dispatchEvent(Object.assign(new Event('dataavailable'), { data: new Blob(['audio']) }));
      this.dispatchEvent(new Event('stop'));
    });
  }
}

function audioEnvironment(getStream) {
  const track = { stop: mock.fn() };
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia: mock.fn(getStream ?? (async () => ({ getTracks: () => [track] }))) },
  });
  globalThis.MediaRecorder = TestRecorder;
  return track;
}

afterEach(() => {
  delete navigator.mediaDevices;
  delete globalThis.MediaRecorder;
});

test('reports unsupported capture if browser APIs are missing', () => {
  assert.equal(new BrowserAudioCapture().supported, false);
});

test('starts microphone capture and releases its tracks after Stop', async () => {
  const track = audioEnvironment();
  const capture = new BrowserAudioCapture();
  assert.equal(capture.supported, true);
  const recording = await capture.start(new AbortController().signal);
  assert.deepEqual(navigator.mediaDevices.getUserMedia.mock.calls[0].arguments, [{ audio: true }]);
  assert.equal(track.stop.mock.callCount(), 0);
  recording.stop();
  const clip = await recording.result;
  assert.equal(clip.type, 'audio/mp4');
  assert.equal(await clip.text(), 'audio');
  assert.equal(track.stop.mock.callCount(), 1);
});

test('surfaces microphone permission denial', async () => {
  const denial = new DOMException('Permission denied', 'NotAllowedError');
  audioEnvironment(async () => { throw denial; });
  await assert.rejects(new BrowserAudioCapture().start(new AbortController().signal), denial);
});

test('releases tracks when permission arrives after the player closes the panel', async () => {
  const pending = Promise.withResolvers();
  const track = audioEnvironment(() => pending.promise);
  const controller = new AbortController();
  const start = new BrowserAudioCapture().start(controller.signal);
  controller.abort();
  pending.resolve({ getTracks: () => [track] });
  await assert.rejects(start, { name: 'AbortError' });
  assert.equal(track.stop.mock.callCount(), 1);
});

test('aborting an active recording releases tracks and discards the result', async () => {
  const track = audioEnvironment();
  const controller = new AbortController();
  const recording = await new BrowserAudioCapture().start(controller.signal);
  controller.abort();
  await assert.rejects(recording.result, { name: 'AbortError' });
  assert.equal(track.stop.mock.callCount(), 1);
});
