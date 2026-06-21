# Frontend Specification: Admin Console & Congregation Live Stream

This document specifies the user interface design, routing structure, browser Web Speech API integration, and Supabase Realtime synchronization logic for the Next.js application inside `packages/frontend`.

## Routing & Layout Structure

The Next.js application defines two core visual states:
- `/` - Viewer Console (Public congregation live translation scrolling feed).
- `/speaker` - Speaker Console (PIN gate, microphone capture, wake lock, and real-time broadcasting - zero configuration).
- `/admin` - Admin Console (PIN gate, ASR provider selection, and API key configuration).

---

## Access Control: PIN Authorization

To maintain a zero-cost infrastructure and reduce onboarding friction, write authorization is handled via a PIN code:
1. The speaker enters a PIN code on `/speaker`.
2. This PIN is stored in `sessionStorage` and sent in the header `x-admin-pin` of HTTP requests to `/functions/v1/translate`.
3. The Edge Function verifies the PIN against a secure server environment variable `ADMIN_PIN_HASH` before proceeding with DeepSeek translation. No database write actions are permitted without PIN validation.

---

## Technical Specifications: PWA & Speech Capture Integration

The speaker's device (the pastor's or admin's recording smartphone) runs a Progressive Web App (PWA) configuration on `/speaker` to maximize microphone keep-alive reliability and prevent OS sleep states.

### 1. PWA Keep-Alive & Wake Lock
To prevent mobile operating systems (particularly iOS Safari and Android Chrome) from locking the screen and suspending the browser's microphone access during a long sermon:
- A Web App Manifest (`manifest.json`) and Service Worker are configured to register the admin app as an installable standalone app.
- The browser **Screen Wake Lock API** is requested upon initiating a sermon session to lock the screen CPU active.

```typescript
let wakeLockSentinel: WakeLockSentinel | null = null;

async function requestWakeLock() {
  if ('wakeLock' in navigator) {
    try {
      wakeLockSentinel = await navigator.wakeLock.request('screen');
      console.log('Screen Wake Lock is active.');
    } catch (err: any) {
      console.warn(`Screen Wake Lock failed: ${err.message}`);
    }
  }
}

function releaseWakeLock() {
  if (wakeLockSentinel) {
    wakeLockSentinel.release().then(() => {
      wakeLockSentinel = null;
    });
  }
}
```

### 2. Modular Speech-to-Text Architecture
To ensure the ASR engine is easily swappable, the capture pipeline is decoupled into a modular provider interface. The application will support **Deepgram** as the primary engine (via WebSocket audio streaming) and browser-native **Web Speech API** as a backup.

```typescript
export interface SpeechToTextProvider {
  start(stream: MediaStream, onTextCaptured: (text: string) => void): Promise<void>;
  stop(): Promise<void>;
}

// 1. Deepgram WebSocket Provider
export class DeepgramSpeechProvider implements SpeechToTextProvider {
  private socket: WebSocket | null = null;
  private mediaRecorder: MediaRecorder | null = null;

  constructor(private apiKey: string) {}

  public async start(stream: MediaStream, onTextCaptured: (text: string) => void): Promise<void> {
    // Open a direct streaming connection to Deepgram's Nova model
    this.socket = new WebSocket(
      'wss://api.deepgram.com/v1/listen?language=id&model=nova-2&encoding=linear16&sample_rate=16000',
      ['token', this.apiKey]
    );

    this.socket.onopen = () => {
      console.log('Deepgram WebSocket connection established.');
      
      // Capture microphone audio and stream raw chunks to the WebSocket
      this.mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0 && this.socket?.readyState === WebSocket.OPEN) {
          this.socket.send(event.data);
        }
      };
      this.mediaRecorder.start(250); // Stream in 250ms small audio intervals
    };

    this.socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      const transcript = data.channel?.alternatives?.[0]?.transcript;
      const isFinal = data.is_final;

      if (isFinal && transcript && transcript.trim().length > 0) {
        onTextCaptured(transcript.trim());
      }
    };

    this.socket.onerror = (err) => console.error('Deepgram Socket Error:', err);
  }

  public async stop(): Promise<void> {
    this.mediaRecorder?.stop();
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }
}

// 2. Browser Web Speech Provider (Fallback)
export class WebSpeechProvider implements SpeechToTextProvider {
  private recognition: SpeechRecognition | null = null;
  private isRunning = false;

  public async start(stream: MediaStream, onTextCaptured: (text: string) => void): Promise<void> {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.recognition = new SpeechRecognition();
    this.recognition.continuous = true;
    this.recognition.interimResults = false;
    this.recognition.lang = 'id-ID';
    this.isRunning = true;

    this.recognition.onresult = (event) => {
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
      if (this.isRunning) this.recognition?.start(); // Auto-restart on silent timeouts
    };

    this.recognition.start();
  }

  public async stop(): Promise<void> {
    this.isRunning = false;
    this.recognition?.stop();
  }
}

// 3. Central Orchestrator managing capture pipeline and volume analysis
export class AudioOrchestrator {
  private stream: MediaStream | null = null;
  private isRunning = false;
  private provider: SpeechToTextProvider;

  constructor(
    providerType: 'deepgram' | 'webspeech',
    config: { apiKey?: string },
    private onTextCaptured: (text: string) => void,
    private onVolumeChange?: (volume: number) => void
  ) {
    this.provider = providerType === 'deepgram'
      ? new DeepgramSpeechProvider(config.apiKey || '')
      : new WebSpeechProvider();
  }

  public async start() {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.isRunning = true;
    
    // Lock CPU and screen active
    await requestWakeLock();

    // Start selected Speech Recognition Provider
    await this.provider.start(this.stream, this.onTextCaptured);
  }

  public async stop() {
    this.isRunning = false;
    await this.provider.stop();
    this.stream?.getTracks().forEach(track => track.stop());
    releaseWakeLock();
  }
}

```

---

## Clean React UI Hook Abstraction (Decoupled STT & Sync)

To keep the UI completely separated from the ASR engine choices and WebSockets sync details, a React hook `useAudioCapture` acts as the single boundary layer:

1. **State Isolation**: The React component does not manage WebSockets, media streams, API keys, or connections. It only triggers UI-facing controllers (`start`, `stop`) and reads state variables (`isListening`, `error`, `latestTranscribedText`).
2. **Automated Pipeline Broadcast**: When the ASR provider returns a final sentence, the hook calls the stateless Edge Function to perform DeepSeek translation, updates its sliding context window, and broadcasts the final result ephemerally over the Supabase Realtime WebSocket channel.

```typescript
import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { AudioOrchestrator } from './AudioOrchestrator';

export interface UseAudioCaptureResult {
  isListening: boolean;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  latestTranscribedText: string;
  error: string | null;
}

export function useAudioCapture(sermonId: string): UseAudioCaptureResult {
  const [isListening, setIsListening] = useState(false);
  const [latestTranscribedText, setLatestTranscribedText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const orchestratorRef = useRef<AudioOrchestrator | null>(null);
  const sequenceRef = useRef<number>(1);
  const historyRef = useRef<{ raw: string; translated: string }[]>([]);
  const channelRef = useRef<any>(null);

  const start = async () => {
    try {
      setError(null);
      
      // 1. Fetch Speaker configuration (PIN and active ASR provider choice)
      const pin = sessionStorage.getItem('speaker_pin') || '';
      const providerType = (localStorage.getItem('asr_provider') || 'deepgram') as 'deepgram' | 'webspeech';
      const deepgramKey = localStorage.getItem('deepgram_api_key') || '';

      // 2. Initialize Supabase Realtime Broadcast Channel
      channelRef.current = supabase.channel(`sermon_${sermonId}`);
      await channelRef.current.subscribe();

      // 3. Instantiate and run orchestrator with text capture handler
      orchestratorRef.current = new AudioOrchestrator(
        sermonId,
        providerType,
        { apiKey: deepgramKey },
        async (rawText) => {
          setLatestTranscribedText(rawText);
          
          try {
            // Send to Edge Function for translation (passing PIN and history context)
            const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/translate`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-admin-pin': pin
              },
              body: JSON.stringify({
                raw_text: rawText,
                history: historyRef.current
              })
            });

            if (!response.ok) {
              throw new Error(`Translation server error: ${response.statusText}`);
            }

            const data = await response.json();
            const translatedText = data.translated_text;

            // Update in-memory sliding history (max 3 items)
            const updatedHistory = [...historyRef.current, { raw: rawText, translated: translatedText }];
            if (updatedHistory.length > 3) updatedHistory.shift();
            historyRef.current = updatedHistory;

            // Broadcast final translation ephemerally to all viewers
            if (channelRef.current) {
              await channelRef.current.send({
                type: 'broadcast',
                event: 'translation_segment',
                payload: {
                  sequence_number: sequenceRef.current,
                  raw_text: rawText,
                  translated_text: translatedText,
                  timestamp: Date.now()
                }
              });
              sequenceRef.current += 1;
            }
          } catch (apiErr: any) {
            console.error('Translation pipeline error:', apiErr.message);
            setError(`Translation failed: ${apiErr.message}`);
          }
        }
      );

      await orchestratorRef.current.start();
      setIsListening(true);
    } catch (err: any) {
      setError(err.message);
      setIsListening(false);
    }
  };

  const stop = async () => {
    if (orchestratorRef.current) {
      await orchestratorRef.current.stop();
      orchestratorRef.current = null;
    }
    if (channelRef.current) {
      await channelRef.current.unsubscribe();
      channelRef.current = null;
    }
    setIsListening(false);
  };

  useEffect(() => {
    return () => {
      if (orchestratorRef.current) orchestratorRef.current.stop();
      if (channelRef.current) channelRef.current.unsubscribe();
    };
  }, []);

  return { isListening, start, stop, latestTranscribedText, error };
}
```

---

## Congregation Realtime Sync Interface

The congregation views the live sermon on `/`. The client establishes an ephemeral Supabase Realtime WebSocket subscription to the static `sermon-live` channel to receive broadcasted translation segments.

### Subscription Implementation
```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function subscribeToLiveSermon(onTranslationReceived: (payload: any) => void) {
  const channel = supabase.channel('sermon-live');

  channel
    .on('broadcast', { event: 'translation_segment' }, ({ payload }) => {
      // Receives: { sequence_number, raw_text, translated_text, timestamp }
      onTranslationReceived(payload);
    })
    .subscribe();

  return () => {
    channel.unsubscribe();
  };
}
```

---

## UI Components & Design System

In compliance with our rich styling guidelines, the application features a premium dark theme tailored for dark church environments (minimizing screen glare for attendees).

### 1. Congregation Live Stream Page (`/`)
- **Theme**: Near-black background (`bg-slate-950`), subtle dark blue/indigo gradients.
- **Header**: Sermon Title / Header, Live Indicator (glowing green/red dot based on WebSocket broadcast activity), and a **🎧 Listen Live (TTS) Toggle**.
- **Text-to-Speech (TTS) Integration**:
  - When the "Listen Live" toggle is enabled, the browser's built-in `window.speechSynthesis` speaks incoming translated English segments aloud.
  - The script filters and selects the highest quality english voice available on the device (e.g. Google Neural, iOS Siri, or Edge Natural voices).
- **Teleprompter Viewport**:
  - Displays only the latest translated sentence large and bright in the center.
  - Displays the previous 2 sentences pushed up and dimmed (50% opacity) for short-term context.
  - Fades out and automatically discards older segments, preventing visual clutter and ensuring viewers stay focused on the present sermon moment.
- **States & Typography**:
  - High-contrast crisp white text for readability in dimly-lit church halls.
- **Persistent Accessibility Toolbar**:
  - Font Size adjustments: Buttons to increment/decrement the text size scale.
  * Single Premium Theme: Styled in deep slate/near-black to eliminate light glare for adjacent congregation members.

### 2. Speaker Console (`/speaker`)
- **PIN Gate Screen**: Simple entry to input the session PIN before launching the interface.
- **Main Controls**: A large, easy-to-tap "Start Broadcast" / "Stop Broadcast" toggle button.
- **Visual Feedback**:
  - VU Meter: Animating wave surrounding or next to the broadcast button matching active microphone volume levels.
  - Connection Indicator: Glowing status light (Green for active websocket broadcast, Red for disconnected/inactive).

### 3. Admin Console (`/admin`)
- **PIN Gate Screen**: Simple entry to input the session PIN before launching the interface.
- **ASR & API Configuration**:
  - ASR Provider Selector: Select active engine (Deepgram vs Web Speech API).
  - API Key Field: Input field to save the Deepgram API Key safely in browser `localStorage`.



