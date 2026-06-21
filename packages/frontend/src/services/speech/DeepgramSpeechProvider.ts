import { SpeechToTextProvider } from './SpeechToTextProvider';

export class DeepgramSpeechProvider implements SpeechToTextProvider {
  private socket: WebSocket | null = null;
  private mediaRecorder: MediaRecorder | null = null;

  constructor(private apiKey: string) {}

  public start(stream: MediaStream, onTextCaptured: (text: string) => void): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      let isInitialized = false;

      try {
        // Open a direct streaming connection to Deepgram's Nova model
        this.socket = new WebSocket(
          'wss://api.deepgram.com/v1/listen?language=id&model=nova-2&encoding=linear16&sample_rate=16000',
          ['token', this.apiKey]
        );

        this.socket.onopen = () => {
          console.log('Deepgram WebSocket connection established.');
          try {
            // Capture microphone audio and stream raw chunks to the WebSocket
            this.mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
            
            this.mediaRecorder.ondataavailable = (event) => {
              if (event.data.size > 0 && this.socket?.readyState === WebSocket.OPEN) {
                this.socket.send(event.data);
              }
            };
            
            this.mediaRecorder.start(250); // Stream in 250ms small audio intervals
            isInitialized = true;
            resolve();
          } catch (err) {
            console.error('Deepgram MediaRecorder start error:', err);
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
          } catch (err) {
            console.error('Deepgram message parsing error:', err);
          }
        };

        this.socket.onerror = (err) => {
          console.error('Deepgram Socket Error:', err);
          if (!isInitialized) {
            isInitialized = true;
            reject(new Error('Deepgram socket connection failed'));
          }
        };

        this.socket.onclose = () => {
          console.log('Deepgram WebSocket connection closed.');
          if (!isInitialized) {
            isInitialized = true;
            reject(new Error('Deepgram socket closed before opening'));
          }
        };
      } catch (err) {
        console.error('Deepgram initialization error:', err);
        if (!isInitialized) {
          isInitialized = true;
          reject(err);
        }
      }
    });
  }

  public async stop(): Promise<void> {
    try {
      if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
        this.mediaRecorder.stop();
      }
    } catch (err) {
      console.error('Error stopping MediaRecorder:', err);
    } finally {
      this.mediaRecorder = null;
    }

    if (this.socket) {
      try {
        this.socket.close();
      } catch (err) {
        console.error('Error closing Deepgram socket:', err);
      } finally {
        this.socket = null;
      }
    }
  }
}
