import { messages } from '../i18n';
import { firstSpeakingQuest } from '../quests/firstSpeakingQuest';
import { BrowserAudioCapture } from '../speech/AudioCapture';
import type { AudioRecording } from '../speech/AudioCapture';
import { BrowserSpeechPlayback, RecordingPlayback } from '../speech/AudioPlayback';

type RecordingState = 'idle' | 'requesting' | 'recording' | 'stopping';
const maxRecordingMs = 15_000;

export class SpeakingPractice {
  private readonly panel = document.querySelector<HTMLElement>('#speaking')!;
  private readonly prompt = this.panel.querySelector<HTMLElement>('#speaking-prompt')!;
  private readonly guidance = this.panel.querySelector<HTMLButtonElement>('#listen-guidance')!;
  private readonly example = this.panel.querySelector<HTMLButtonElement>('#replay-english')!;
  private readonly record = this.panel.querySelector<HTMLButtonElement>('#record-voice')!;
  private readonly complete = this.panel.querySelector<HTMLButtonElement>('#complete-speaking')!;
  private readonly note = this.panel.querySelector<HTMLElement>('#speaking-note')!;
  private readonly replay = this.panel.querySelector<HTMLButtonElement>('#replay-recording')!;
  private readonly status = this.panel.querySelector<HTMLElement>('#speaking-status')!;
  private readonly events = new AbortController();
  private readonly capture = new BrowserAudioCapture();
  private readonly speech = new BrowserSpeechPlayback();
  private readonly playback = new RecordingPlayback();
  private attempt?: AbortController;
  private recording?: AudioRecording;
  private timer?: number;
  private state: RecordingState = 'idle';
  private hasRecording = false;

  constructor(private readonly onClose: (completed: boolean) => void) {
    this.prompt.textContent = firstSpeakingQuest.prompt;
    this.prompt.lang = firstSpeakingQuest.locale;
    const options = { signal: this.events.signal };
    this.guidance.addEventListener('click', () => this.speak(messages.speakingGuidance, 'zh-TW'), options);
    this.example.addEventListener('click', () => this.speak(firstSpeakingQuest.prompt, firstSpeakingQuest.locale), options);
    this.record.addEventListener('click', () => {
      if (this.state === 'idle') void this.startRecording();
      else if (this.state === 'recording') this.stopRecording();
    }, options);
    this.replay.addEventListener('click', () => {
      this.speech.stop();
      void this.playback.play().catch(() => {
        if (this.visible && this.state === 'idle' && this.hasRecording) {
          this.status.textContent = messages.recordingPlaybackFailed;
        }
      });
    }, options);
    this.complete.addEventListener('click', () => this.close(true), options);
    this.panel.querySelector('#close-speaking')!.addEventListener('click', () => this.close(), options);
    this.panel.addEventListener('keydown', event => {
      if (event.key === ' ') event.stopPropagation();
      if (event.key === 'Escape') this.close();
      if (event.key === 'Tab') this.keepFocusInPanel(event);
    }, options);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.suspend();
    }, options);
    window.addEventListener('pagehide', () => {
      if (this.visible) this.close();
    }, options);
  }

  get visible(): boolean {
    return !this.panel.hidden;
  }

  open(chapterPractice = false): void {
    this.complete.hidden = !chapterPractice;
    this.note.textContent = chapterPractice ? messages.practiceInstructions : messages.practiceOnly;
    this.panel.querySelector<HTMLButtonElement>('#close-speaking')!.textContent = chapterPractice ? messages.returnToTrial : messages.backToGeno;
    this.panel.hidden = false;
    this.updateState('idle', this.capture.supported ? '' : messages.recordingUnsupported);
    this.panel.querySelector<HTMLElement>('#speaking-title')!.focus({ preventScroll: true });
  }

  private keepFocusInPanel(event: KeyboardEvent): void {
    const buttons = this.panel.querySelectorAll<HTMLButtonElement>('button:not(:disabled):not([hidden])');
    const first = buttons[0];
    const last = buttons[buttons.length - 1];
    if (event.shiftKey && (document.activeElement === first || event.target === this.panel.querySelector('h2'))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  private close(completed = false): void {
    this.reset();
    this.onClose(completed);
  }

  private reset(): void {
    this.panel.hidden = true;
    this.cancelCapture('');
    this.speech.stop();
    this.playback.clear();
    this.hasRecording = false;
  }

  private speak(text: string, locale: string): void {
    this.playback.stop();
    this.status.textContent = this.capture.supported ? '' : messages.recordingUnsupported;
    this.speech.speak(text, locale, () => {
      this.status.textContent = messages.voiceUnavailable;
    });
  }

  private async startRecording(): Promise<void> {
    if (!this.capture.supported) return;
    this.speech.stop();
    this.playback.clear();
    this.hasRecording = false;
    const attempt = new AbortController();
    this.attempt = attempt;
    this.updateState('requesting', messages.recordingPermission);
    try {
      const recording = await this.capture.start(attempt.signal);
      if (!attempt.signal.aborted) {
        this.recording = recording;
        this.updateState('recording', messages.recordingActive);
        this.timer = window.setTimeout(() => this.stopRecording(), maxRecordingMs);
      }
      const clip = await recording.result;
      if (attempt.signal.aborted) return;
      this.playback.load(clip);
      this.hasRecording = true;
      this.updateState('idle', messages.recordingReady);
    } catch (error) {
      if (attempt.signal.aborted) return;
      const denied = error instanceof DOMException && ['NotAllowedError', 'SecurityError'].includes(error.name);
      this.updateState('idle', denied ? messages.recordingDenied : messages.recordingFailed);
    } finally {
      if (this.attempt === attempt) this.clearAttempt();
    }
  }

  private stopRecording(): void {
    this.updateState('stopping', messages.recordingStopping);
    this.recording?.stop();
  }

  private cancelCapture(message: string): void {
    this.attempt?.abort();
    this.clearAttempt();
    this.updateState('idle', message);
  }

  private clearAttempt(): void {
    window.clearTimeout(this.timer);
    this.timer = undefined;
    this.recording = undefined;
    this.attempt = undefined;
  }

  private updateState(state: RecordingState, message: string): void {
    this.state = state;
    this.status.textContent = message;
    const busy = state !== 'idle';
    this.record.disabled = !this.capture.supported;
    this.record.setAttribute('aria-disabled', String(this.record.disabled || state === 'requesting' || state === 'stopping'));
    this.record.textContent = state === 'recording' || state === 'stopping' ? messages.stopRecording : messages.startRecording;
    this.record.classList.toggle('is-recording', state === 'recording');
    this.guidance.disabled = busy;
    this.example.disabled = busy;
    this.replay.disabled = busy || !this.hasRecording;
  }

  suspend(): void {
    if (!this.visible) return;
    if (this.attempt) this.cancelCapture(messages.recordingCancelled);
    this.speech.stop();
    this.playback.stop();
  }

  destroy(): void {
    this.events.abort();
    this.reset();
  }
}
