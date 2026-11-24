import type { SpeechService } from './SpeechService';

export type RecognitionPhase = 'starting' | 'listening' | 'processing';
type Failure = 'unsupported' | 'busy' | 'denied' | 'retry' | 'error';

export class RecognitionFailure extends Error {
  readonly reason: Failure;

  constructor(reason: Failure) {
    super(reason);
    this.reason = reason;
  }
}

type NativeRecognition = EventTarget & {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives?: number;
  start(): void;
  stop(): void;
  abort(): void;
};

type RecognitionHost = {
  SpeechRecognition?: new () => NativeRecognition;
  webkitSpeechRecognition?: new () => NativeRecognition;
};

type ResultEvent = Event & {
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string }; length?: number; [index: number]: { transcript: string } }>;
};

export class SpeechRecognitionService implements SpeechService {
  private readonly host: RecognitionHost;
  private active?: { stop: () => void };

  constructor(host = globalThis as RecognitionHost) {
    this.host = host;
  }

  get supported(): boolean { return Boolean(this.host.SpeechRecognition ?? this.host.webkitSpeechRecognition); }

  recognize(
    locale: string,
    signal: AbortSignal,
    onPhase?: (phase: RecognitionPhase) => void,
  ): ReturnType<SpeechService['recognize']> {
    if (signal.aborted) return Promise.reject(signal.reason);
    if (this.active) return Promise.reject(new RecognitionFailure('busy'));
    const Recognition = this.host.SpeechRecognition ?? this.host.webkitSpeechRecognition;
    if (!Recognition) return Promise.reject(new RecognitionFailure('unsupported'));

    return new Promise((resolve, reject) => {
      const recognition = new Recognition();
      recognition.lang = locale;
      recognition.continuous = false;
      recognition.interimResults = false;
      if ('maxAlternatives' in recognition) {
        try { recognition.maxAlternatives = 3; } catch { /* Some browsers expose one result only. */ }
      }
      let transcript = '';
      let alternatives: string[] = [];
      let settled = false;
      let processing = false;
      const listeners = new AbortController();

      const settle = (error?: unknown, abortNative = false) => {
        if (settled) return;
        settled = true;
        listeners.abort();
        signal.removeEventListener('abort', cancel);
        clearTimeout(deadline);
        if (abortNative) {
          try { recognition.abort(); } catch { /* The browser may have already stopped. */ }
        }
        this.active = undefined;
        if (error === undefined) resolve(alternatives.length ? { transcript, alternatives } : { transcript });
        else reject(error);
      };
      const cancel = () => settle(signal.reason ?? new DOMException('Aborted', 'AbortError'), true);
      const endedSpeech = () => {
        if (processing) return;
        processing = true;
        onPhase?.('processing');
      };

      const options = { signal: listeners.signal };
      recognition.addEventListener('audiostart', () => {
        if (!processing) onPhase?.('listening');
      }, options);
      recognition.addEventListener('speechend', endedSpeech, options);
      recognition.addEventListener('audioend', endedSpeech, options);
      recognition.addEventListener('result', event => {
        const finals = Array.from((event as ResultEvent).results).filter(result => result.isFinal);
        if (finals.length === 0) return;
        transcript = finals.map(result => result[0]?.transcript ?? '').join(' ').trim();
        // Alternatives describe a single utterance. Avoid combining guesses from multiple segments.
        const single = finals.length === 1 ? finals[0] : undefined;
        alternatives = single ? Array.from({ length: Math.min(3, single.length ?? 1) - 1 },
          (_, index) => single[index + 1]?.transcript.trim() ?? '').filter(Boolean) : [];
        endedSpeech();
      }, options);
      recognition.addEventListener('error', event => {
        const { error } = event as Event & { error: string };
        const denied = error === 'not-allowed' || error === 'service-not-allowed';
        settle(new RecognitionFailure(denied ? 'denied' : error === 'no-speech' ? 'retry' : 'error'), true);
      }, options);
      recognition.addEventListener('end', () => {
        settle(transcript || alternatives.length ? undefined : new RecognitionFailure('retry'));
      }, options);

      const deadline = setTimeout(() => settle(new RecognitionFailure('retry'), true), 18_000);
      this.active = {
        stop: () => {
          endedSpeech();
          try { recognition.stop(); } catch { settle(new RecognitionFailure('error'), true); }
        },
      };
      signal.addEventListener('abort', cancel, { once: true });
      try {
        onPhase?.('starting');
        if (!settled) recognition.start();
      } catch (error) {
        const denied = error instanceof DOMException && ['NotAllowedError', 'SecurityError'].includes(error.name);
        settle(new RecognitionFailure(denied ? 'denied' : 'error'), true);
      }
    });
  }

  stop(): void { this.active?.stop(); }
}
