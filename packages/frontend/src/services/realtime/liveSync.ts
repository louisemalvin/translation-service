import { supabase } from '../../lib/supabaseClient';

export interface TranslationSegment {
  sequence_number: number;
  raw_text: string;
  translated_text: string;
  timestamp: number;
  audio_start_time?: number;
  stt_received_time?: number;
  deepseek_start_time?: number;
  deepseek_received_time?: number;
}

export function subscribeToLiveSermon(
  onSegmentReceived: (segment: TranslationSegment) => void,
  onInterimReceived?: (text: string) => void
): () => void {
  const channel = supabase.channel('sermon-live');

  channel
    .on('broadcast', { event: 'translation_segment' }, ({ payload }) => {
      onSegmentReceived(payload as TranslationSegment);
    })
    .on('broadcast', { event: 'interim_transcript' }, ({ payload }) => {
      if (onInterimReceived && payload && typeof payload.text === 'string') {
        onInterimReceived(payload.text);
      }
    })
    .subscribe();

  return () => {
    void channel.unsubscribe();
  };
}
