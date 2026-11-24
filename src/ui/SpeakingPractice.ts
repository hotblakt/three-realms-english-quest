import { messages } from '../i18n';
import { englishLocale, lessons, type Lesson, type LessonId } from '../learning/lessons';
import { type Completion, type LearningProgress } from '../learning/LearningProgress';
import { saveLearning } from '../save/learningSave';
import { BrowserAudioCapture } from '../speech/AudioCapture';
import { SpeechRecognitionService, RecognitionFailure, type RecognitionPhase } from '../speech/SpeechRecognitionService';
import { selectSpokenMatch } from '../speech/matchSpokenText';
import type { AudioRecording } from '../speech/AudioCapture';
import { BrowserSpeechPlayback, RecordingPlayback } from '../speech/AudioPlayback';

type RecordingState = 'idle' | 'requesting' | 'recording' | 'stopping';
const maxRecordingMs = 15_000;

export class SpeakingPractice {
  private readonly panel = document.querySelector<HTMLElement>('#speaking')!;
  private readonly prompt = this.panel.querySelector<HTMLElement>('#speaking-prompt')!;
  private readonly select = this.panel.querySelector<HTMLSelectElement>('#learning-lesson')!;
  private readonly meaning = this.panel.querySelector<HTMLElement>('#speaking-meaning')!;
  private readonly exp = this.panel.querySelector<HTMLElement>('#learning-exp')!;
  private readonly slow = this.panel.querySelector<HTMLButtonElement>('#slow-english')!;
  private readonly tools = this.panel.querySelector<HTMLDetailsElement>('#learning-tools')!;
  private lesson: Lesson = lessons[0];
  private required?: LessonId;
  private unsuccessful = 0;
  private readonly guidance = this.panel.querySelector<HTMLButtonElement>('#listen-guidance')!;
  private readonly example = this.panel.querySelector<HTMLButtonElement>('#replay-english')!;
  private readonly record = this.panel.querySelector<HTMLButtonElement>('#record-voice')!;
  private readonly complete = this.panel.querySelector<HTMLButtonElement>('#complete-speaking')!;
  private readonly note = this.panel.querySelector<HTMLElement>('#speaking-note')!;
  private readonly replay = this.panel.querySelector<HTMLButtonElement>('#replay-recording')!;
  private readonly recognition = new SpeechRecognitionService();
  private readonly recognizeButton = this.panel.querySelector<HTMLButtonElement>('#recognize-voice')!;
  private readonly recognitionResult = this.panel.querySelector<HTMLElement>('#recognition-result')!;
  private readonly recognitionStatus = this.panel.querySelector<HTMLElement>('#recognition-status')!;
  private readonly recognizedText = this.panel.querySelector<HTMLElement>('#recognized-text')!;
  private readonly recognizedTranscript = this.panel.querySelector<HTMLElement>('#recognized-transcript')!;
  private readonly status = this.panel.querySelector<HTMLElement>('#speaking-status')!;
  private readonly events = new AbortController();
  private readonly capture = new BrowserAudioCapture();
  private readonly speech = new BrowserSpeechPlayback();
  private readonly playback = new RecordingPlayback();
  private attempt?: AbortController;
  private recognitionAttempt?: AbortController;
  private recognitionPhase?: RecognitionPhase;
  private recording?: AudioRecording;
  private timer?: number;
  private state: RecordingState = 'idle';
  private hasRecording = false;

  constructor(private readonly learning: LearningProgress, private readonly onClose: (completed: boolean) => void) {
    this.prompt.lang = englishLocale;
    this.select.replaceChildren();
    for (const lesson of lessons) this.select.add(new Option(lesson.meaning, lesson.id));
    const options = { signal: this.events.signal };
    this.select.addEventListener('change', () => {
      const lesson = lessons.find(candidate => candidate.id === this.select.value);
      if (lesson) this.showLesson(lesson);
    }, options);
    this.guidance.addEventListener('click', () => this.speak(this.lesson.hint, 'zh-TW'), options);
    this.example.addEventListener('click', () => this.speak(this.lesson.target, englishLocale, 1), options);
    this.slow.addEventListener('click', () => this.speak(this.lesson.target, englishLocale, .7), options);
    this.record.addEventListener('click', () => {
      if (this.state === 'idle' && !this.attempt && !this.recognitionAttempt) void this.startRecording();
      else if (this.state === 'recording') this.stopRecording();
    }, options);
    this.recognizeButton.addEventListener('click', () => {
      if (this.recognitionPhase === 'starting' || this.recognitionPhase === 'listening') this.recognition.stop();
      else if (!this.recognitionAttempt && !this.attempt && !this.recognizeButton.hidden) void this.startRecognition();
    }, options);
    this.replay.addEventListener('click', () => {
      this.speech.stop();
      void this.playback.play().catch(() => {
        if (this.visible && this.state === 'idle' && this.hasRecording) {
          this.status.textContent = messages.recordingPlaybackFailed;
        }
      });
    }, options);
    this.complete.addEventListener('click', () => {
      this.cancelRecognition();
      this.cancelCapture('');
      this.speech.stop();
      this.playback.stop();
      if (this.learning.status(this.lesson.id) !== 'recognized') {
        this.award('assisted');
        this.showRecognition(messages.assistedDone);
      }
      if (this.lesson.id === this.required) this.close(true);
    }, options);
    this.panel.querySelector('#close-speaking')!.addEventListener('click', () => this.close(), options);
    this.panel.addEventListener('keydown', event => {
      if (event.key === ' ' || event.target === this.select) event.stopPropagation();
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

  open(recommended: LessonId, { required, returnLabel = messages.backToGeno }: {
    required?: LessonId; returnLabel?: string;
  } = {}): void {
    this.required = required;
    this.tools.open = false;
    this.panel.querySelector<HTMLButtonElement>('#close-speaking')!.textContent = returnLabel;
    this.panel.hidden = false;
    this.showLesson(lessons.find(lesson => lesson.id === recommended) ?? lessons[0]);
    this.panel.querySelector<HTMLElement>('#speaking-title')!.focus({ preventScroll: true });
  }

  private showLesson(lesson: Lesson): void {
    this.speech.stop();
    this.playback.clear();
    this.hasRecording = false;
    this.unsuccessful = 0;
    this.lesson = lesson;
    this.select.value = lesson.id;
    this.prompt.textContent = lesson.target;
    this.meaning.textContent = lesson.meaning;
    this.updateProgress();
    this.showRecognition(this.recognition.supported ? messages.recognitionReady : messages.recognitionUnsupported);
    this.updateState('idle', this.capture.supported ? '' : messages.recordingUnsupported);
  }

  private updateProgress(earned = 0): void {
    for (const option of this.select.options) {
      const lesson = lessons.find(item => item.id === option.value);
      if (lesson) option.textContent = `${lesson.meaning}・${messages.lessonStatus[this.learning.status(lesson.id)]}`;
    }
    this.exp.textContent = messages.learningScore(this.learning.exp, earned);
    const required = this.lesson.id === this.required;
    const recognized = this.learning.status(this.lesson.id) === 'recognized';
    this.complete.hidden = !required && recognized;
    this.complete.textContent = required && recognized ? messages.continueTrial : messages.assistedPractice;
    const requiredLesson = lessons.find(lesson => lesson.id === this.required);
    this.note.textContent = requiredLesson && !required
      ? messages.lessonRequirement(requiredLesson.meaning) : this.unsuccessful >= 2 ? messages.assistedOffer : this.lesson.hint;
  }

  private award(status: Completion): void {
    const earned = this.learning.complete(this.lesson, status);
    saveLearning(this.learning.snapshot());
    this.updateProgress(earned);
  }

  private keepFocusInPanel(event: KeyboardEvent): void {
    const buttons = [...this.panel.querySelectorAll<HTMLElement>('button:not(:disabled):not([hidden]), select:not(:disabled), summary')]
      .filter(control => control.getClientRects().length);
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
    this.cancelRecognition();
    this.cancelCapture('');
    this.speech.stop();
    this.playback.clear();
    this.hasRecording = false;
    this.showRecognition('');
  }

  private showRecognition(text: string, transcript = '', matched = false): void {
    this.recognitionResult.classList.toggle('is-matched', matched);
    this.recognitionStatus.textContent = text;
    this.recognizedTranscript.textContent = transcript;
    this.recognizedText.hidden = !transcript;
  }

  private async startRecognition(): Promise<void> {
    this.speech.stop();
    this.playback.stop();
    const attempt = new AbortController();
    this.recognitionAttempt = attempt;
    this.updateAudioControls();
    try {
      const result = await this.recognition.recognize(englishLocale, attempt.signal, phase => {
        this.recognitionPhase = phase;
        this.showRecognition({
          starting: messages.recognitionStarting,
          listening: messages.recognitionListening,
          processing: messages.recognitionProcessing,
        }[phase]);
        this.updateAudioControls();
      });
      if (attempt.signal.aborted) return;
      const match = selectSpokenMatch(result, this.lesson.target);
      if (match !== undefined) {
        this.unsuccessful = 0;
        this.award('recognized');
        this.showRecognition(messages.recognitionMatched, match, true);
      } else {
        this.unsuccessful++;
        this.updateProgress();
        this.showRecognition(messages.recognitionRetry, result.transcript);
      }
    } catch (error) {
      if (attempt.signal.aborted) return;
      const reason = error instanceof RecognitionFailure ? error.reason : 'error';
      const feedback = {
        denied: messages.recognitionDenied,
        retry: messages.recognitionRetry,
        unsupported: messages.recognitionUnsupported,
        busy: messages.recognitionError,
        error: messages.recognitionError,
      };
      this.unsuccessful++;
      this.updateProgress();
      this.showRecognition(feedback[reason]);
    } finally {
      this.recognitionPhase = undefined;
      this.recognitionAttempt = undefined;
      this.updateAudioControls();
    }
  }

  private cancelRecognition(): void {
    this.recognitionAttempt?.abort();
    this.recognitionPhase = undefined;
  }

  private speak(text: string, locale: string, rate = 1): void {
    this.playback.stop();
    this.status.textContent = this.capture.supported ? '' : messages.recordingUnsupported;
    this.speech.speak(text, locale, () => {
      this.showRecognition(messages.voiceUnavailable);
    }, rate);
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
    this.updateState('idle', message);
  }

  private clearAttempt(): void {
    window.clearTimeout(this.timer);
    this.timer = undefined;
    this.recording = undefined;
    this.attempt = undefined;
    this.updateAudioControls();
  }

  private updateState(state: RecordingState, message: string): void {
    this.state = state;
    this.status.textContent = message;
    this.updateAudioControls();
  }

  private updateAudioControls(): void {
    const { state } = this;
    const recognizing = Boolean(this.recognitionAttempt);
    const recording = Boolean(this.attempt);
    const stoppingCapture = recording && state === 'idle' && Boolean(this.attempt?.signal.aborted);
    const busy = state !== 'idle' || recognizing || stoppingCapture;
    const canStopRecognition = this.recognitionPhase === 'starting' || this.recognitionPhase === 'listening';
    this.recognizeButton.disabled = !this.recognition.supported || recording || (recognizing && !canStopRecognition);
    this.recognizeButton.textContent = canStopRecognition
      ? messages.stopRecognizing : messages.recognizeVoice;
    this.record.disabled = !this.capture.supported || recognizing || stoppingCapture;
    this.record.setAttribute('aria-disabled', String(this.record.disabled || state === 'requesting' || state === 'stopping'));
    this.record.textContent = state === 'recording' || state === 'stopping' ? messages.stopRecording : messages.startRecording;
    this.record.classList.toggle('is-recording', state === 'recording');
    this.guidance.disabled = busy;
    this.example.disabled = busy;
    this.slow.disabled = busy;
    this.select.disabled = busy;
    this.replay.disabled = busy || !this.hasRecording;
  }

  suspend(): void {
    if (!this.visible) return;
    if (this.attempt) this.cancelCapture(messages.recordingCancelled);
    if (this.recognitionAttempt) {
      this.cancelRecognition();
      this.showRecognition(messages.recognitionReady);
    }
    this.speech.stop();
    this.playback.stop();
  }

  destroy(): void {
    this.events.abort();
    this.reset();
  }
}
