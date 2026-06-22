import { SpeechToTextProvider } from './SpeechToTextProvider';

const SAMPLE_RATE = 16000;

export class DeepgramSpeechProvider implements SpeechToTextProvider {
  private socket: WebSocket | null = null;
  private audioContext: AudioContext | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;

  constructor(private apiKey: string) {}

  public start(stream: MediaStream, onTextCaptured: (text: string) => void): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      let isInitialized = false;

      try {
        this.socket = new WebSocket(
          'wss://api.deepgram.com/v1/listen?language=id&model=nova-2&encoding=linear16&sample_rate=16000',
          ['token', this.apiKey]
        );

        this.socket.binaryType = 'arraybuffer';

        this.socket.onopen = () => {
          console.log('[ASR] Deepgram WebSocket connection established.');
          try {
            this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
              sampleRate: SAMPLE_RATE,
            });

            this.source = this.audioContext.createMediaStreamSource(stream);

            this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);
            this.processor.onaudioprocess = (event) => {
              if (this.socket?.readyState !== WebSocket.OPEN) return;
              const input = event.inputBuffer.getChannelData(0);
              const pcm = this.float32ToInt16(input);
              this.socket.send(pcm.buffer);
            };

            this.source.connect(this.processor);
            this.processor.connect(this.audioContext.destination);

            isInitialized = true;
            resolve();
          } catch (err) {
            console.error('[ASR] Audio setup error:', err);
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

            console.log('[ASR] Deepgram raw message:', JSON.stringify(data));
            if (isFinal && transcript && transcript.trim().length > 0) {
              console.log('[ASR] Captured:', transcript.trim());
              onTextCaptured(transcript.trim());
            }
          } catch (err) {
            console.error('[ASR] Deepgram message parsing error:', err);
          }
        };

        this.socket.onerror = (err) => {
          console.error('[ASR] Deepgram Socket Error:', err);
          if (!isInitialized) {
            isInitialized = true;
            reject(new Error('Deepgram socket connection failed'));
          }
        };

        this.socket.onclose = () => {
          console.log('[ASR] Deepgram WebSocket connection closed.');
          if (!isInitialized) {
            isInitialized = true;
            reject(new Error('Deepgram socket closed before opening'));
          }
        };
      } catch (err) {
        console.error('[ASR] Deepgram initialization error:', err);
        if (!isInitialized) {
          isInitialized = true;
          reject(err);
        }
      }
    });
  }

  public async stop(): Promise<void> {
    try {
      if (this.processor) {
        this.processor.disconnect();
        this.processor = null;
      }
      if (this.source) {
        this.source.disconnect();
        this.source = null;
      }
      if (this.audioContext) {
        await this.audioContext.close();
        this.audioContext = null;
      }
    } catch (err) {
      console.error('[ASR] Error stopping audio context:', err);
    }

    if (this.socket) {
      try {
        this.socket.close();
      } catch (err) {
        console.error('[ASR] Error closing Deepgram socket:', err);
      } finally {
        this.socket = null;
      }
    }
  }

  private float32ToInt16(float32: Float32Array): Int16Array {
    const int16 = new Int16Array(float32.length);
    for (let i = 0; i < float32.length; i++) {
      const s = Math.max(-1, Math.min(1, float32[i]));
      int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return int16;
  }
}
