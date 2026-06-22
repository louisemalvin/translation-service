import { SpeechToTextProvider } from './SpeechToTextProvider';

const SAMPLE_RATE = 16000;

export class DeepgramSpeechProvider implements SpeechToTextProvider {
  private socket: WebSocket | null = null;
  private audioContext: AudioContext | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;

  constructor(private token: string) {}

  public start(stream: MediaStream, onTextCaptured: (text: string) => void): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      let isInitialized = false;

      try {
        this.socket = new WebSocket(
          'wss://api.deepgram.com/v1/listen?language=id&model=nova-2&encoding=linear16&sample_rate=16000',
          ['token', this.token]
        );

        this.socket.binaryType = 'arraybuffer';

        this.socket.onopen = async () => {
          try {
            this.audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)({
              sampleRate: SAMPLE_RATE,
            });

            await this.audioContext.audioWorklet.addModule('/audio-processor.js');

            this.source = this.audioContext.createMediaStreamSource(stream);

            this.workletNode = new AudioWorkletNode(this.audioContext, 'audio-processor');
            this.workletNode.port.onmessage = (event) => {
              if (this.socket?.readyState !== WebSocket.OPEN) return;
              this.socket.send(event.data);
            };

            this.source.connect(this.workletNode);
            this.workletNode.connect(this.audioContext.destination);

            isInitialized = true;
            resolve();
          } catch (err) {
            if (!isInitialized) {
              isInitialized = true;
              reject(err);
            }
          }
        };

        this.socket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            const transcript = data.channel?.alternatives?.[0]?.transcript;
            const isFinal = data.is_final;

            if (isFinal && transcript && transcript.trim().length > 0) {
              onTextCaptured(transcript.trim());
            }
          } catch {
            // Ignored
          }
        };

        this.socket.onerror = () => {
          if (!isInitialized) {
            isInitialized = true;
            reject(new Error('Deepgram socket connection failed'));
          }
        };

        this.socket.onclose = () => {
          if (!isInitialized) {
            isInitialized = true;
            reject(new Error('Deepgram socket closed before opening'));
          }
        };
      } catch (err) {
        if (!isInitialized) {
          isInitialized = true;
          reject(err);
        }
      }
    });
  }

  public async stop(): Promise<void> {
    try {
      if (this.workletNode) {
        this.workletNode.disconnect();
        this.workletNode = null;
      }
      if (this.source) {
        this.source.disconnect();
        this.source = null;
      }
      if (this.audioContext) {
        await this.audioContext.close();
        this.audioContext = null;
      }
    } catch {
      // Ignored
    }

    if (this.socket) {
      try {
        this.socket.close();
      } catch {
        // Ignored
      } finally {
        this.socket = null;
      }
    }
  }
}
