import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { AudioOrchestrator } from '../services/speech/AudioOrchestrator';
import { MAX_HISTORY_WINDOW } from 'shared';
import { RealtimeChannel } from '@supabase/supabase-js';

export interface UseAudioCaptureResult {
  isListening: boolean;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  latestTranscribedText: string;
  latestTranslatedText: string;
  error: string | null;
  volume: number;
}

export function useAudioCapture(): UseAudioCaptureResult {
  const [isListening, setIsListening] = useState(false);
  const [latestTranscribedText, setLatestTranscribedText] = useState('');
  const [latestTranslatedText, setLatestTranslatedText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [volume, setVolume] = useState<number>(0);

  const orchestratorRef = useRef<AudioOrchestrator | null>(null);
  const sequenceRef = useRef<number>(1);
  const historyRef = useRef<{ raw: string; translated: string }[]>([]);
  const channelRef = useRef<RealtimeChannel | null>(null);

  const start = async () => {
    try {
      setError(null);

      // 1. Fetch Speaker configuration (PIN and active ASR provider choice)
      const pin = sessionStorage.getItem('speaker_pin') || '';
      const providerType = (process.env.NEXT_PUBLIC_ASR_PROVIDER || localStorage.getItem('asr_provider') || 'deepgram') as 'deepgram' | 'webspeech';

      let token = '';
      if (providerType === 'deepgram') {
        const { data: tokenData, error: tokenError } = await supabase.functions.invoke('get-deepgram-token', {
          headers: {
            'x-admin-pin': pin,
          },
        });
        if (tokenError) {
          throw new Error(`Failed to fetch Deepgram token: ${tokenError.message || tokenError}`);
        }
        token = tokenData?.token || '';
        if (!token) {
          throw new Error('Received empty token from server');
        }
      }

      // 2. Initialize Supabase Realtime Broadcast Channel
      channelRef.current = supabase.channel('sermon-live');
      await channelRef.current.subscribe();

      // 3. Instantiate and run orchestrator with text capture handler
      orchestratorRef.current = new AudioOrchestrator(
        providerType,
        { apiKey: token },
        async (rawText) => {
          setLatestTranscribedText(rawText);

          try {
            const { data, error: fnError } = await supabase.functions.invoke('translate', {
              body: {
                raw_text: rawText,
                history: historyRef.current,
                sequence_number: sequenceRef.current,
              },
              headers: {
                'x-admin-pin': pin,
              },
            });

            if (fnError) {
              throw new Error(`Translation server error: ${fnError.message || fnError}`);
            }

            const translatedText = data.translated_text;

            if (!translatedText) {
              throw new Error('Translation response missing translated_text');
            }

            setLatestTranslatedText(translatedText);

            // Update in-memory sliding history (max MAX_HISTORY_WINDOW items)
            const updatedHistory = [...historyRef.current, { raw: rawText, translated: translatedText }];
            if (updatedHistory.length > MAX_HISTORY_WINDOW) updatedHistory.shift();
            historyRef.current = updatedHistory;

            sequenceRef.current += 1;
          } catch (apiErr: unknown) {
            const errMsg = apiErr instanceof Error ? apiErr.message : String(apiErr);
            setError(`Translation failed: ${errMsg}`);
          }
        },
        (vol) => {
          setVolume(vol);
        }
      );

      await orchestratorRef.current.start();
      setIsListening(true);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      setError(errMsg);
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
    setVolume(0);
    setIsListening(false);
  };

  useEffect(() => {
    return () => {
      if (orchestratorRef.current) {
        orchestratorRef.current.stop();
      }
      if (channelRef.current) {
        channelRef.current.unsubscribe();
      }
    };
  }, []);

  return { isListening, start, stop, latestTranscribedText, latestTranslatedText, error, volume };
}
