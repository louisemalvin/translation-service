import { SpeechToTextProvider } from './SpeechToTextProvider';
import { DeepgramSpeechProvider } from './DeepgramSpeechProvider';
import { WebSpeechProvider } from './WebSpeechProvider';
import { requestWakeLock, releaseWakeLock } from '../../lib/wakeLock';

export class AudioOrchestrator {
  private stream: MediaStream | null = null;
  private backupRecorder: MediaRecorder | null = null;
  private isRunning = false;
  private db: IDBDatabase | null = null;
  private provider: SpeechToTextProvider;

  constructor(
    private sermonId: string,
    providerType: 'deepgram' | 'webspeech',
    config: { apiKey?: string },
    private onTextCaptured: (text: string) => void
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
    await this.initIndexedDB();
    await this.provider.start(this.stream, this.onTextCaptured);
    this.startBackupRecording();
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    await this.provider.stop();

    if (this.backupRecorder && this.backupRecorder.state !== 'inactive') {
      this.backupRecorder.stop();
    }
    this.backupRecorder = null;

    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;

    releaseWakeLock();

    this.db?.close();
    this.db = null;
  }

  private initIndexedDB(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('SermonAudioBackup', 1);

      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains('audio_chunks')) {
          request.result.createObjectStore('audio_chunks', { keyPath: 'timestamp' });
        }
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  private startBackupRecording(): void {
    this.backupRecorder = new MediaRecorder(this.stream!);
    this.backupRecorder.ondataavailable = (event) => {
      if (event.data.size > 0 && this.db) {
        const transaction = this.db.transaction('audio_chunks', 'readwrite');
        const store = transaction.objectStore('audio_chunks');
        store.put({
          sermon_id: this.sermonId,
          timestamp: Date.now(),
          blob: event.data,
        });
      }
    };
    this.backupRecorder.start(5000);
  }
}
