export interface SpeechToTextProvider {
  start(stream: MediaStream, onTextCaptured: (text: string) => void): Promise<void>;
  stop(): Promise<void>;
}
