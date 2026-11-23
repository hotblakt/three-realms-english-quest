export interface SpeechPlayback {
  readonly supported: boolean;
  speak(text: string, locale: string, onError: () => void): void;
  stop(): void;
}

export class BrowserSpeechPlayback implements SpeechPlayback {
  private active?: SpeechSynthesisUtterance;

  get supported(): boolean {
    return Boolean(window.speechSynthesis && typeof SpeechSynthesisUtterance === 'function');
  }

  speak(text: string, locale: string, onError: () => void): void {
    this.stop();
    if (!this.supported) {
      onError();
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = locale;
    utterance.rate = .85;
    this.active = utterance;
    utterance.onend = () => {
      if (this.active === utterance) this.active = undefined;
    };
    utterance.onerror = () => {
      if (this.active !== utterance) return;
      this.active = undefined;
      onError();
    };
    try {
      const voices = speechSynthesis.getVoices();
      const language = locale.toLowerCase();
      const voice = voices.find(candidate => candidate.lang.toLowerCase() === language)
        ?? voices.find(candidate => {
          const tag = candidate.lang.toLowerCase();
          return language === 'zh-tw' ? tag.startsWith('zh-hant') : tag.startsWith(language.split('-')[0] + '-');
        });
      if (!voice && voices.length) {
        this.active = undefined;
        onError();
        return;
      }
      if (voice) utterance.voice = voice;
      speechSynthesis.speak(utterance);
    } catch {
      this.active = undefined;
      onError();
    }
  }

  stop(): void {
    if (!this.active) return;
    this.active = undefined;
    speechSynthesis.cancel();
  }
}

export class RecordingPlayback {
  private readonly audio = new Audio();
  private url?: string;

  load(recording: Blob): void {
    this.clear();
    this.url = URL.createObjectURL(recording);
    this.audio.src = this.url;
  }

  play(): Promise<void> {
    this.audio.currentTime = 0;
    return this.audio.play();
  }

  stop(): void {
    this.audio.pause();
  }

  clear(): void {
    this.stop();
    if (!this.url) return;
    this.audio.removeAttribute('src');
    this.audio.load();
    URL.revokeObjectURL(this.url);
    this.url = undefined;
  }
}
