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
  const accumulationBufferRef = useRef<string[]>([]);
  const accumulationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sendingRef = useRef(false);
  const segmentStartTimestampRef = useRef<number | null>(null);

  const start = async () => {
    try {
      setError(null);
      segmentStartTimestampRef.current = Date.now();

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

      // 3. Define flushBuffer
      const ACCUMULATION_TIMEOUT_MS = 2000;

      const flushBuffer = async () => {
        if (accumulationTimerRef.current !== null) {
          clearTimeout(accumulationTimerRef.current);
          accumulationTimerRef.current = null;
        }

        if (sendingRef.current) return;

        const buffer = accumulationBufferRef.current;
        if (buffer.length === 0) return;
        const joined = buffer.join(' ');

        const audioStartTime = segmentStartTimestampRef.current || Date.now();
        const sttReceivedTime = Date.now();

        accumulationBufferRef.current = [];
        segmentStartTimestampRef.current = Date.now();

        const seq = sequenceRef.current;
        sequenceRef.current += 1;

        sendingRef.current = true;

        setLatestTranscribedText(joined);

        try {
          const { data, error: fnError } = await supabase.functions.invoke('translate', {
            body: {
              raw_text: joined,
              history: historyRef.current,
              sequence_number: seq,
              audio_start_time: audioStartTime,
              stt_received_time: sttReceivedTime,
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

          const updatedHistory = [...historyRef.current, { raw: joined, translated: translatedText }];
          if (updatedHistory.length > MAX_HISTORY_WINDOW) updatedHistory.shift();
          historyRef.current = updatedHistory;
        } catch (apiErr: unknown) {
          const errMsg = apiErr instanceof Error ? apiErr.message : String(apiErr);
          setError(`Translation failed: ${errMsg}`);
        } finally {
          sendingRef.current = false;

          if (accumulationBufferRef.current.length > 0) {
            void flushBuffer();
          }
        }
      };

      // 4. Accumulating onTextCaptured callback
      const onTextCaptured = (rawText: string) => {
        // Push the new fragment to the buffer
        accumulationBufferRef.current.push(rawText);

        const joined = accumulationBufferRef.current.join(' ');
        const wordCount = joined.trim().split(/\s+/).filter(Boolean).length;

        // Check if the segment is long enough or ends with sentence-ending punctuation
        const lastChar = rawText.trim().charAt(rawText.trim().length - 1);
        const hasPunctuation = lastChar === '.' || lastChar === '!' || lastChar === '?';

        if (wordCount >= 8 || hasPunctuation) {
          void flushBuffer();
          return;
        }

        // Reset the 2-second silence timer for short segments
        if (accumulationTimerRef.current !== null) {
          clearTimeout(accumulationTimerRef.current);
        }
        accumulationTimerRef.current = setTimeout(() => {
          void flushBuffer();
        }, ACCUMULATION_TIMEOUT_MS);
      };

      const onInterimTextCaptured = (interimRawText: string) => {
        const stableText = accumulationBufferRef.current.join(' ');
        const combinedPreview = stableText ? `${stableText} ${interimRawText}` : interimRawText;
        if (channelRef.current) {
          void channelRef.current.send({
            type: 'broadcast',
            event: 'interim_transcript',
            payload: { text: combinedPreview },
          });
        }
      };

      const onUtteranceEnd = () => {
        if (accumulationTimerRef.current !== null) {
          clearTimeout(accumulationTimerRef.current);
          accumulationTimerRef.current = null;
        }
        void flushBuffer();
      };

      // 5. Create orchestrator with accumulating callback
      orchestratorRef.current = new AudioOrchestrator(
        providerType,
        { apiKey: token },
        onTextCaptured,
        (vol) => {
          setVolume(vol);
        },
        onInterimTextCaptured,
        onUtteranceEnd
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
    // Flush any accumulated fragments before stopping
    if (accumulationBufferRef.current.length > 0) {
      if (accumulationTimerRef.current !== null) {
        clearTimeout(accumulationTimerRef.current);
        accumulationTimerRef.current = null;
      }

      const accumulatedText = accumulationBufferRef.current.join(' ');
      const audioStartTime = segmentStartTimestampRef.current || Date.now();
      const sttReceivedTime = Date.now();

      accumulationBufferRef.current = [];
      segmentStartTimestampRef.current = null;

      setLatestTranscribedText(accumulatedText);

      try {
        const pin = sessionStorage.getItem('speaker_pin') || '';
        const { data, error: fnError } = await supabase.functions.invoke('translate', {
          body: {
            raw_text: accumulatedText,
            history: historyRef.current,
            sequence_number: sequenceRef.current,
            audio_start_time: audioStartTime,
            stt_received_time: sttReceivedTime,
          },
          headers: { 'x-admin-pin': pin },
        });

        if (!fnError && data?.translated_text) {
          setLatestTranslatedText(data.translated_text);
          const updatedHistory = [...historyRef.current, { raw: accumulatedText, translated: data.translated_text }];
          if (updatedHistory.length > MAX_HISTORY_WINDOW) updatedHistory.shift();
          historyRef.current = updatedHistory;
          sequenceRef.current += 1;
        }
      } catch {
        // Best-effort flush on stop; silently ignore errors
      }
    }

    // Clear any pending timer
    if (accumulationTimerRef.current !== null) {
      clearTimeout(accumulationTimerRef.current);
      accumulationTimerRef.current = null;
    }

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
