'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { subscribeToLiveSermon, type TranslationSegment } from '@/services/realtime/liveSync';
import { TextToSpeechService } from '@/services/speech/TextToSpeechService';
import { Icon } from '@/components/Icon';
import { Button } from '@/components/Button';
import { SegmentCard } from '@/components/SegmentCard';

const ALL_SIZES = ['text-sm', 'text-base', 'text-lg', 'text-xl', 'text-2xl', 'text-3xl', 'text-4xl', 'text-5xl'] as const;
const MIN_FONT_IDX = 3; // 'text-xl'
const MAX_FONT_IDX = 7; // 'text-5xl'

const FONT_SIZE_LABELS: Record<number, string> = {
  3: 'XL',
  4: '2XL',
  5: '3XL',
  6: '4XL',
  7: '5XL',
};

const AUTO_SCROLL_THRESHOLD = 80; // px from bottom to consider "at bottom"

export default function Home() {
  const [segments, setSegments] = useState<TranslationSegment[]>([]);
  const [interimText, setInterimText] = useState('');
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const [fontSizeIdx, setFontSizeIdx] = useState(5); // Default to 'text-3xl' (index 5)
  const [isScrolledUp, setIsScrolledUp] = useState(false);

  const ttsRef = useRef<TextToSpeechService>(new TextToSpeechService());
  const prevSegmentsLengthRef = useRef(0);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const seenSeqRef = useRef(new Set<number>());

  // Subscription
  useEffect(() => {
    const currentTts = ttsRef.current;
    const unsubscribe = subscribeToLiveSermon(
      (segment: TranslationSegment) => {
        if (seenSeqRef.current.has(segment.sequence_number)) return;
        seenSeqRef.current.add(segment.sequence_number);
        setSegments((prev) => [...prev, segment]);
        setInterimText('');
      },
      (text: string) => {
        setInterimText(text);
      }
    );

    return () => {
      unsubscribe();
      currentTts.setEnabled(false);
    };
  }, []);

  // TTS speak on new segments
  useEffect(() => {
    if (ttsEnabled && segments.length > prevSegmentsLengthRef.current) {
      const newSegments = segments.slice(prevSegmentsLengthRef.current);
      for (const seg of newSegments) ttsRef.current.speak(seg.translated_text);
    }
    prevSegmentsLengthRef.current = segments.length;
  }, [segments, ttsEnabled]);

  // Auto-scroll on new segments or interim transcript updates
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    // Only auto-scroll if user is already at (or near) the bottom
    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    if (distanceFromBottom <= AUTO_SCROLL_THRESHOLD) {
      container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
    }
  }, [segments, interimText]);

  const toggleTts = useCallback(() => setTtsEnabled(prev => { ttsRef.current.setEnabled(!prev); return !prev; }), []);

  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    setIsScrolledUp(distanceFromBottom > AUTO_SCROLL_THRESHOLD);
  }, []);

  const jumpToLatest = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
    setIsScrolledUp(false);
  }, []);

  return (
    <div className="relative h-dvh w-full flex flex-col bg-surface-primary text-text-primary overflow-hidden">
      {/* ── Header ── */}
      <header className="flex items-center px-4 py-3 bg-surface-secondary/80 border-b border-surface-border backdrop-blur-sm flex-shrink-0">
        <h1 className="text-sm font-semibold tracking-tight text-text-primary">
          Speechcraft
        </h1>
      </header>



      {/* ── Feed Area ── */}
      <main
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto overscroll-contain px-6 md:px-12 py-8 relative"
      >
        {segments.length === 0 && !interimText ? (
          /* Empty state */
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center bg-surface-secondary">
                <Icon name="Microphone" size="lg" className="text-text-muted" />
              </div>
              <p className="text-lg font-medium text-text-primary">
                Waiting for the sermon to begin...
              </p>
              <p className="text-sm mt-2 text-text-muted">
                Live translation will appear here automatically
              </p>
            </div>
          </div>
        ) : (
          /* Segment feed */
          <div className="flex flex-col gap-8 max-w-4xl mx-auto">
            {segments.map((seg) => (
              <SegmentCard
                key={seg.sequence_number}
                translatedText={seg.translated_text}
                className={`${ALL_SIZES[fontSizeIdx]} leading-relaxed tracking-wide`}
              />
            ))}

            {interimText && (
              <div className="flex items-center gap-3 bg-surface-secondary/40 border border-surface-border/30 border-l-4 border-l-accent/40 rounded-xl p-4 shadow-sm text-text-secondary/80 opacity-75 animate-pulse transition-all duration-300">
                <div className="relative flex h-2 w-2 flex-shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-accent"></span>
                </div>
                <p className={`${ALL_SIZES[fontSizeIdx]} italic font-light leading-relaxed tracking-wide`}>
                  {interimText}
                </p>
              </div>
            )}

            {/* Bottom spacer so last segment isn't flush against the edge */}
            <div className="h-4 flex-shrink-0" />
          </div>
        )}
      </main>

      {/* ── Jump-to-Latest Button ── */}
      {segments.length > 0 && isScrolledUp && (
        <button
          onClick={jumpToLatest}
          className="absolute bottom-20 right-6 z-30 w-10 h-10 rounded-full bg-accent text-text-primary shadow-lg flex items-center justify-center animate-fade-in-up"
          aria-label="Jump to latest translation"
          title="Jump to latest"
        >
          <span className="text-lg font-bold leading-none">↓</span>
        </button>
      )}

      {/* ── Bottom Bar ── */}
      <footer
        role="toolbar"
        aria-label="Viewer controls"
        className="flex items-center justify-between px-4 py-3 bg-surface-glass backdrop-blur-md border-t border-surface-border flex-shrink-0"
      >
        {/* Font size controls */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setFontSizeIdx((prev) => Math.max(MIN_FONT_IDX, prev - 1))}
            disabled={fontSizeIdx === MIN_FONT_IDX}
            className="w-9 h-9 flex items-center justify-center rounded-full text-xs font-bold transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-surface-tertiary text-text-primary active:bg-surface-muted"
            aria-label="Decrease font size"
          >
            A-
          </button>
          <span className="text-xs font-bold select-none min-w-[32px] text-center opacity-85 text-text-primary">
            {FONT_SIZE_LABELS[fontSizeIdx]}
          </span>
          <button
            onClick={() => setFontSizeIdx((prev) => Math.min(MAX_FONT_IDX, prev + 1))}
            disabled={fontSizeIdx === MAX_FONT_IDX}
            className="w-9 h-9 flex items-center justify-center rounded-full text-xs font-bold transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-surface-tertiary text-text-primary active:bg-surface-muted"
            aria-label="Increase font size"
          >
            A+
          </button>
        </div>

        {/* Read Aloud button */}
        <Button
          variant={ttsEnabled ? 'primary' : 'secondary'}
          size="md"
          onClick={toggleTts}
          iconLeft={<Icon name="Volume" className="w-5 h-5" />}
          aria-label={ttsEnabled ? 'Disable read aloud' : 'Enable read aloud'}
        >
          {ttsEnabled ? 'Reading Aloud...' : 'Read Aloud'}
        </Button>
      </footer>
    </div>
  );
}
