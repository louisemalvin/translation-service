export interface SpeechToTextProvider {
  start(
    stream: MediaStream,
    onTextCaptured: (text: string) => void,
    onInterimTextCaptured?: (text: string) => void,
    onUtteranceEnd?: () => void
  ): Promise<void>;
  stop(): Promise<void>;
}
