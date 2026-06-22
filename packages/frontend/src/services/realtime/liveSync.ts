import { supabase } from '../../lib/supabaseClient';

export interface TranslationSegment {
  sequence_number: number;
  raw_text: string;
  translated_text: string;
  timestamp: number;
}

export function subscribeToLiveSermon(
  onSegmentReceived: (segment: TranslationSegment) => void
): () => void {
  const channel = supabase.channel('sermon-live');

  channel
    .on('broadcast', { event: 'translation_segment' }, ({ payload }) => {
      console.log('[VIEWER] Received translation_segment:', payload);
      onSegmentReceived(payload as TranslationSegment);
    })
    .subscribe();

  return () => {
    void channel.unsubscribe();
  };
}
