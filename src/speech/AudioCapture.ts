export interface AudioRecording {
  readonly result: Promise<Blob>;
  stop(): void;
}

export interface AudioCapture {
  readonly supported: boolean;
  start(signal: AbortSignal): Promise<AudioRecording>;
}

export class BrowserAudioCapture implements AudioCapture {
  get supported(): boolean {
    return typeof navigator.mediaDevices?.getUserMedia === 'function' && typeof MediaRecorder === 'function';
  }

  async start(signal: AbortSignal): Promise<AudioRecording> {
    if (signal.aborted) throw signal.reason;
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const release = () => stream.getTracks().forEach(track => track.stop());
    try {
      if (signal.aborted) throw signal.reason;
      // Let the browser choose a supported format, including Safari's MP4.
      const recorder = new MediaRecorder(stream);
      recorder.start();
      const chunks: Blob[] = [];
      let abort: () => void;
      const result = new Promise<Blob>((resolve, reject) => {
        abort = () => {
          if (recorder.state !== 'inactive') recorder.stop();
          reject(signal.reason);
        };
        signal.addEventListener('abort', abort, { once: true });
        recorder.addEventListener('dataavailable', ({ data }) => {
          if (data.size) chunks.push(data);
        });
        recorder.addEventListener('error', reject, { once: true });
        recorder.addEventListener('stop', () => {
          if (!chunks.length) {
            reject(new Error('No audio recorded'));
            return;
          }
          resolve(new Blob(chunks, { type: chunks[0].type || recorder.mimeType }));
        }, { once: true });
      }).finally(() => {
        signal.removeEventListener('abort', abort);
        release();
      });
      return {
        result,
        stop() {
          if (recorder.state !== 'inactive') recorder.stop();
        },
      };
    } catch (error) {
      release();
      throw error;
    }
  }
}
