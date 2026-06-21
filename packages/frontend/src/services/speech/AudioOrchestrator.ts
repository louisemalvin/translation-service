import { SpeechToTextProvider } from './SpeechToTextProvider';
import { DeepgramSpeechProvider } from './DeepgramSpeechProvider';
import { WebSpeechProvider } from './WebSpeechProvider';
import { requestWakeLock, releaseWakeLock } from '../../lib/wakeLock';

export class AudioOrchestrator {
  private stream: MediaStream | null = null;
  private isRunning = false;
  private provider: SpeechToTextProvider;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private animationFrameId: number | null = null;

  constructor(
    providerType: 'deepgram' | 'webspeech',
    config: { apiKey?: string },
    private onTextCaptured: (text: string) => void,
    private onVolumeChange?: (volume: number) => void
  ) {
    if (providerType === 'deepgram') {
      this.provider = new DeepgramSpeechProvider(config.apiKey || '');
    } else {
      this.provider = new WebSpeechProvider();
    }
  }

  async start(): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.isRunning = true;
    await requestWakeLock();
    await this.provider.start(this.stream, this.onTextCaptured);
    this.startVolumeAnalysis();
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    this.stopVolumeAnalysis();
    await this.provider.stop();

    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;

    releaseWakeLock();
  }

  private startVolumeAnalysis(): void {
    if (!this.stream || !this.onVolumeChange) return;

    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;

      this.audioContext = new AudioContextClass();
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      this.source = this.audioContext.createMediaStreamSource(this.stream);
      this.source.connect(this.analyser);

      const bufferLength = this.analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const analyze = () => {
        if (!this.isRunning || !this.analyser || !this.onVolumeChange) return;

        this.analyser.getByteFrequencyData(dataArray);

        // Compute Root Mean Square (RMS) of frequency byte data
        let sumSquares = 0;
        for (let i = 0; i < bufferLength; i++) {
          sumSquares += dataArray[i] * dataArray[i];
        }
        const rms = Math.sqrt(sumSquares / bufferLength);

        // Normalize (rms goes up to 255). Let's scale it to 0-100 range.
        // Conversational volume doesn't easily reach 255 RMS on frequency spectrum, so apply a scaling factor of 1.5x.
        const normalized = Math.min(100, Math.round((rms / 255) * 100 * 1.5));

        this.onVolumeChange(normalized);

        this.animationFrameId = requestAnimationFrame(analyze);
      };

      this.animationFrameId = requestAnimationFrame(analyze);
    } catch (err) {
      console.error('Failed to initialize volume analysis:', err);
    }
  }

  private stopVolumeAnalysis(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }
    if (this.analyser) {
      this.analyser = null;
    }
    if (this.audioContext) {
      if (this.audioContext.state !== 'closed') {
        this.audioContext.close().catch((err) => console.error('Error closing AudioContext:', err));
      }
      this.audioContext = null;
    }
    if (this.onVolumeChange) {
      this.onVolumeChange(0);
    }
  }
}

