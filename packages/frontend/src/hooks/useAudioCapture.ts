import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { AudioOrchestrator } from '../services/speech/AudioOrchestrator';

export interface UseAudioCaptureResult {
  isListening: boolean;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  latestTranscribedText: string;
  latestTranslatedText: string;
  error: string | null;
  volume: number;
}

export function useAudioCapture(sermonId: string): UseAudioCaptureResult {
  const [isListening, setIsListening] = useState(false);
  const [latestTranscribedText, setLatestTranscribedText] = useState('');
  const [latestTranslatedText, setLatestTranslatedText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [volume, setVolume] = useState<number>(0);

  const orchestratorRef = useRef<AudioOrchestrator | null>(null);
  const sequenceRef = useRef<number>(1);
  const historyRef = useRef<{ raw: string; translated: string }[]>([]);
  const channelRef = useRef<any>(null);

  const start = async () => {
    try {
      setError(null);

      // 1. Fetch Speaker configuration (PIN and active ASR provider choice)
      const pin = sessionStorage.getItem('speaker_pin') || '';
      const providerType = (process.env.NEXT_PUBLIC_ASR_PROVIDER || localStorage.getItem('asr_provider') || 'deepgram') as 'deepgram' | 'webspeech';
      const deepgramKey = process.env.NEXT_PUBLIC_DEEPGRAM_API_KEY || localStorage.getItem('deepgram_api_key') || '';

      console.log('[BOOT] Provider:', providerType, 'DeepgramKey:', deepgramKey ? 'SET' : 'NOT SET', 'Pin:', pin ? 'SET' : 'NOT SET');

      // 2. Initialize Supabase Realtime Broadcast Channel
      channelRef.current = supabase.channel('sermon-live');
      await channelRef.current.subscribe();
      console.log('[BOOT] Realtime channel sermon-live subscribed');

      // 3. Instantiate and run orchestrator with text capture handler
      orchestratorRef.current = new AudioOrchestrator(
        providerType,
        { apiKey: deepgramKey },
        async (rawText) => {
          console.log('[PIPELINE] ASR text captured:', rawText);
          setLatestTranscribedText(rawText);

          try {
            console.log('[PIPELINE] Sending to translate...');
            const { data, error: fnError } = await supabase.functions.invoke('translate', {
              body: {
                raw_text: rawText,
                history: historyRef.current,
              },
              headers: {
                'x-admin-pin': pin,
              },
            });

            if (fnError) {
              console.error('[PIPELINE] Translate error:', fnError);
              throw new Error(`Translation server error: ${fnError.message || fnError}`);
            }

            const translatedText = data.translated_text;
            console.log('[PIPELINE] Translation result:', translatedText);

            if (!translatedText) {
              throw new Error('Translation response missing translated_text');
            }

            setLatestTranslatedText(translatedText);

            // Update in-memory sliding history (max 3 items)
            const updatedHistory = [...historyRef.current, { raw: rawText, translated: translatedText }];
            if (updatedHistory.length > 3) updatedHistory.shift();
            historyRef.current = updatedHistory;

                        // Broadcast final translation ephemerally to all viewers
            if (channelRef.current) {
              console.log('[PIPELINE] Broadcasting to sermon-live...');
              await channelRef.current.send({
                type: 'broadcast',
                event: 'translation_segment',
                payload: {
                  sequence_number: sequenceRef.current,
                  raw_text: rawText,
                  translated_text: translatedText,
                  timestamp: Date.now(),
                },
              });
              console.log('[PIPELINE] Broadcast sent, seq:', sequenceRef.current);
              sequenceRef.current += 1;
            } else {
              console.error('[PIPELINE] No channel ref to broadcast!');
            }


          } catch (apiErr: any) {
            console.error('Translation pipeline error:', apiErr.message);
            setError(`Translation failed: ${apiErr.message}`);
          }
        },
        (vol) => {
          setVolume(vol);
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
