export interface SpeechService {
  recognize(locale: string, signal: AbortSignal): Promise<{ transcript: string; alternatives?: readonly string[] }>;
}
