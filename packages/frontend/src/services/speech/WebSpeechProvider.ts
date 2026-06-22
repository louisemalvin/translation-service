import { SpeechToTextProvider } from './SpeechToTextProvider';

interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string;
  readonly message: string;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => void) | null;
  onend: ((this: SpeechRecognition, ev: Event) => void) | null;
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => void) | null;
  onstart: ((this: SpeechRecognition, ev: Event) => void) | null;
  start(): void;
  stop(): void;
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognition;
}

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

export class WebSpeechProvider implements SpeechToTextProvider {
  private recognition: SpeechRecognition | null = null;
  private isRunning = false;

  public start(stream: MediaStream, onTextCaptured: (text: string) => void): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      try {
        const SpeechRecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognitionClass) {
          const err = new Error('SpeechRecognition is not supported in this browser.');
          console.error(err.message);
          return reject(err);
        }

        this.recognition = new SpeechRecognitionClass();
        this.recognition.continuous = true;
        this.recognition.interimResults = false;
        this.recognition.lang = 'id-ID';
        this.isRunning = true;

        let isInitialized = false;

        this.recognition.onstart = () => {
          console.log('WebSpeech SpeechRecognition started.');
          if (!isInitialized) {
            isInitialized = true;
            resolve();
          }
        };

        this.recognition.onresult = (event: SpeechRecognitionEvent) => {
          let finalTranscript = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              finalTranscript += event.results[i][0].transcript;
            }
          }
          if (finalTranscript.trim().length > 0) {
            onTextCaptured(finalTranscript.trim());
          }
        };

        this.recognition.onend = () => {
          console.log('WebSpeech SpeechRecognition ended.');
          if (this.isRunning) {
            try {
              this.recognition?.start(); // Auto-restart on silent timeouts
            } catch (err) {
              console.error('WebSpeech auto-restart error:', err);
            }
          }
        };

        this.recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
          console.error('WebSpeech SpeechRecognition error:', event);
          if (!isInitialized) {
            isInitialized = true;
            reject(new Error(`WebSpeech recognition error: ${event.error}`));
          }
        };

        this.recognition.start();
      } catch (err) {
        console.error('WebSpeech initialization error:', err);
        reject(err);
      }
    });
  }

  public async stop(): Promise<void> {
    this.isRunning = false;
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch (err) {
        console.error('Error stopping WebSpeech recognition:', err);
      } finally {
        this.recognition = null;
      }
    }
  }
}
