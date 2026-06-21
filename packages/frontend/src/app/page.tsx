'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { subscribeToLiveSermon, type TranslationSegment } from '@/services/realtime/liveSync';
import { TextToSpeechService } from '@/services/speech/TextToSpeechService';
import { StatusDot } from '@/components/StatusDot';
import { Icon } from '@/components/Icon';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { SegmentCard } from '@/components/SegmentCard';

export default function Home() {
  const [segments, setSegments] = useState<TranslationSegment[]>([]);
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [connected, setConnected] = useState(false);
  const [showGreeting, setShowGreeting] = useState(false);

  const ttsRef = useRef<TextToSpeechService>(new TextToSpeechService());
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const prevSegmentsLengthRef = useRef(0);
  const hasReceivedSegmentRef = useRef(false);

  useEffect(() => {
    const unsubscribe = subscribeToLiveSermon((segment: TranslationSegment) => {
      setSegments((prev) => [...prev, segment]);
      if (!hasReceivedSegmentRef.current) {
        hasReceivedSegmentRef.current = true;
        setConnected(true);
        setShowGreeting(true);
        setTimeout(() => setShowGreeting(false), 5000);
      }
    });
    return () => {
      unsubscribe();
      ttsRef.current.setEnabled(false);
    };
  }, []);

  useEffect(() => {
    if (ttsEnabled && segments.length > prevSegmentsLengthRef.current) {
      const newSegments = segments.slice(prevSegmentsLengthRef.current);
      for (const seg of newSegments) ttsRef.current.speak(seg.translated_text);
    }
    prevSegmentsLengthRef.current = segments.length;
  }, [segments, ttsEnabled]);

  useEffect(() => {
    if (autoScroll && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [segments, autoScroll]);

  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const { scrollTop, scrollHeight, clientHeight } = container;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
    if (isAtBottom) setAutoScroll(true);
    else setAutoScroll(false);
  }, []);

  const scrollToBottom = useCallback(() => {
    if (scrollContainerRef.current) scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    setAutoScroll(true);
  }, []);

  const toggleTts = useCallback(() => setTtsEnabled(prev => { ttsRef.current.setEnabled(!prev); return !prev; }), []);
  const dismissGreeting = useCallback(() => setShowGreeting(false), []);

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-slate-950 text-slate-100">
      <header className="flex items-center justify-between px-4 py-3 bg-slate-900/80 backdrop-blur-sm border-b border-slate-800 flex-shrink-0">
        <div className="flex items-center gap-3">
          <StatusDot state={connected ? 'live' : 'error'} label="LIVE" ariaLabel={connected ? 'Connected' : 'Disconnected'} />
          <h1 className="text-sm font-semibold text-slate-100 tracking-tight">Live Translation</h1>
        </div>
        <Button
          variant="ghost"
          size="md"
          onClick={toggleTts}
          className={`p-2 rounded-lg transition-colors !min-h-0 h-9 w-9 ${ttsEnabled ? 'bg-accent/20 text-accent' : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'}`}
          aria-label={ttsEnabled ? 'Disable text-to-speech' : 'Enable text-to-speech'}
          title={ttsEnabled ? 'Disable TTS' : 'Enable TTS'}
          iconLeft={<Icon name="Headphones" className="w-5 h-5" />}
        />
      </header>

      <main className="flex-1 flex flex-col overflow-hidden relative">
        {segments.length === 0 ? (
          <div className="flex-1 flex items-center justify-center px-6">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-800 flex items-center justify-center">
                <Icon name="Microphone" size="lg" className="text-slate-500" />
              </div>
              <p className="text-lg font-medium text-slate-300">Waiting for the sermon to begin...</p>
              <p className="text-sm text-slate-500 mt-2">Live translation will appear here automatically</p>
            </div>
          </div>
        ) : (
          <>
            {showGreeting && (
              <div className="px-4 pt-3 pb-1 flex-shrink-0">
                <Card variant="accent" padding="md" className="relative">
                  <p className="font-medium text-accent">Live Translation Active</p>
                  <p className="text-accent/80 text-xs mt-0.5">Text will scroll as the speaker talks.</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={dismissGreeting}
                    className="absolute top-2 right-2 p-0.5 rounded text-accent/60 hover:text-accent transition-colors !min-h-0 h-6 w-6"
                    aria-label="Dismiss greeting"
                    iconLeft={<Icon name="Close" className="w-4 h-4" />}
                  />
                </Card>
              </div>
            )}
            <div ref={scrollContainerRef} onScroll={handleScroll} className="flex-1 overflow-y-auto px-4 py-3 space-y-3 scroll-smooth">
              {segments.map((seg, idx) => (
                <SegmentCard key={seg.sequence_number} segment={seg} isLatest={idx === segments.length - 1} fontSizeClass="text-base" />
              ))}
            </div>
            {!autoScroll && (
              <div className="absolute bottom-4 left-0 right-0 flex justify-center pointer-events-none">
                <Button
                  variant="primary"
                  size="md"
                  onClick={scrollToBottom}
                  className="pointer-events-auto rounded-full shadow-lg shadow-accent/25 transition-all duration-200"
                  aria-label="Scroll to bottom"
                  iconLeft={<Icon name="ChevronDown" className="w-4 h-4" />}
                >
                  Scroll to bottom
                </Button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
