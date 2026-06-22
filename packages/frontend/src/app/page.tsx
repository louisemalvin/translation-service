'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { subscribeToLiveSermon, type TranslationSegment } from '@/services/realtime/liveSync';
import { TextToSpeechService } from '@/services/speech/TextToSpeechService';
import { StatusDot } from '@/components/StatusDot';
import { Icon } from '@/components/Icon';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';

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

export default function Home() {
  const [segments, setSegments] = useState<TranslationSegment[]>([]);
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const [connected, setConnected] = useState(false);
  const [showGreeting, setShowGreeting] = useState(false);
  const [fontSizeIdx, setFontSizeIdx] = useState(5); // Default to 'text-3xl' (index 5)

  const ttsRef = useRef<TextToSpeechService>(new TextToSpeechService());
  const prevSegmentsLengthRef = useRef(0);
  const hasReceivedSegmentRef = useRef(false);

  useEffect(() => {
    const currentTts = ttsRef.current;
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
      currentTts.setEnabled(false);
    };
  }, []);

  useEffect(() => {
    if (ttsEnabled && segments.length > prevSegmentsLengthRef.current) {
      const newSegments = segments.slice(prevSegmentsLengthRef.current);
      for (const seg of newSegments) ttsRef.current.speak(seg.translated_text);
    }
    prevSegmentsLengthRef.current = segments.length;
  }, [segments, ttsEnabled]);

  const toggleTts = useCallback(() => setTtsEnabled(prev => { ttsRef.current.setEnabled(!prev); return !prev; }), []);
  const dismissGreeting = useCallback(() => setShowGreeting(false), []);

  // Teleprompter calculations
  const latestSegments = segments.slice(-3);
  const segBeforeThat = latestSegments[latestSegments.length - 3];
  const precedingSeg = latestSegments[latestSegments.length - 2];
  const latestSeg = latestSegments[latestSegments.length - 1];

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-slate-950 text-slate-100">
      <header className="flex items-center justify-between px-4 py-3 bg-slate-900/80 border-b border-slate-800 backdrop-blur-sm flex-shrink-0">
        <div className="flex items-center gap-3">
          <StatusDot
            state={connected ? 'live' : 'error'}
            label="LIVE"
            ariaLabel={connected ? 'Connected' : 'Disconnected'}
            labelClassName="text-slate-400"
          />
          <h1 className="text-sm font-semibold tracking-tight text-slate-100">
            Live Translation
          </h1>
        </div>
        <Button
          variant="ghost"
          size="md"
          onClick={toggleTts}
          className={`p-2 rounded-lg transition-all duration-200 !min-h-0 h-9 w-9 flex items-center justify-center ${
            ttsEnabled
              ? 'bg-accent text-white shadow-[0_0_12px_rgba(99,102,241,0.6)] scale-105 border border-accent/30'
              : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'
          }`}
          aria-label={ttsEnabled ? 'Disable text-to-speech' : 'Enable text-to-speech'}
          title={ttsEnabled ? 'Disable TTS' : 'Enable TTS'}
          iconLeft={<Icon name="Headphones" className="w-5 h-5" />}
        />
      </header>

      <main className="flex-1 flex flex-col justify-center items-center relative px-6 md:px-12 py-12 overflow-hidden">
        {showGreeting && segments.length > 0 && (
          <div className="absolute top-4 left-4 right-4 z-10 max-w-md mx-auto">
            <Card variant="accent" padding="md" className="relative shadow-lg border border-accent/30 bg-accent/15 backdrop-blur-sm">
              <p className="font-semibold text-accent">Live Translation Active</p>
              <p className="text-accent/80 text-xs mt-0.5">Text will update as the speaker talks.</p>
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

        {segments.length === 0 ? (
          <div className="flex-1 flex items-center justify-center px-6">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center bg-slate-900">
                <Icon name="Microphone" size="lg" className="text-slate-500" />
              </div>
              <p className="text-lg font-medium text-slate-300">
                Waiting for the sermon to begin...
              </p>
              <p className="text-sm mt-2 text-slate-500">
                Live translation will appear here automatically
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-8 md:gap-12 w-full max-w-4xl text-center">
            {segBeforeThat && (
              <p
                key={segBeforeThat.sequence_number}
                className={`opacity-25 transition-all duration-500 font-medium leading-relaxed tracking-wide ${ALL_SIZES[Math.max(0, fontSizeIdx - 2)]}`}
              >
                {segBeforeThat.translated_text}
              </p>
            )}
            {precedingSeg && (
              <p
                key={precedingSeg.sequence_number}
                className={`opacity-50 transition-all duration-500 font-semibold leading-relaxed tracking-wide ${ALL_SIZES[Math.max(0, fontSizeIdx - 1)]}`}
              >
                {precedingSeg.translated_text}
              </p>
            )}
            {latestSeg && (
              <p
                key={latestSeg.sequence_number}
                className={`opacity-100 animate-fade-in-up font-bold leading-relaxed tracking-wide ${ALL_SIZES[fontSizeIdx]} scale-105 transform origin-center`}
              >
                {latestSeg.translated_text}
              </p>
            )}
          </div>
        )}

        {/* Floating persistent toolbar */}
        <div className="absolute bottom-6 flex items-center gap-4 px-6 py-2.5 rounded-full z-20 transition-all duration-300 bg-slate-900/90 border border-slate-800 backdrop-blur-md shadow-xl text-slate-100">
          {/* Font Size Adjuster */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setFontSizeIdx((prev) => Math.max(MIN_FONT_IDX, prev - 1))}
              disabled={fontSizeIdx === MIN_FONT_IDX}
              className="w-9 h-9 flex items-center justify-center rounded-full text-xs font-bold transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-800 text-slate-100 active:bg-slate-700"
              title="Decrease font size"
              aria-label="Decrease font size"
            >
              A-
            </button>
            <span className="text-xs font-bold select-none min-w-[32px] text-center opacity-85">
              {FONT_SIZE_LABELS[fontSizeIdx]}
            </span>
            <button
              onClick={() => setFontSizeIdx((prev) => Math.min(MAX_FONT_IDX, prev + 1))}
              disabled={fontSizeIdx === MAX_FONT_IDX}
              className="w-9 h-9 flex items-center justify-center rounded-full text-xs font-bold transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-800 text-slate-100 active:bg-slate-700"
              title="Increase font size"
              aria-label="Increase font size"
            >
              A+
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
