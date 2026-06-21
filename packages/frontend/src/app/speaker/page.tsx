'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAudioCapture } from '../../hooks/useAudioCapture';

export default function SpeakerPage() {
  const [isMounted, setIsMounted] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);

  // Keep sermon ID stable across re-renders
  const sermonIdRef = useRef(Date.now().toString());

  // Hook handles audio capture and translation
  const {
    isListening,
    start,
    stop,
    latestTranscribedText,
    latestTranslatedText,
    error,
  } = useAudioCapture(sermonIdRef.current);

  // Check authentication status on mount to avoid SSR mismatches
  useEffect(() => {
    setIsMounted(true);
    const existingPin = sessionStorage.getItem('speaker_pin');
    if (existingPin) {
      setIsAuthenticated(true);
    }
  }, []);

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pinInput.trim()) {
      setPinError('PIN cannot be empty.');
      return;
    }
    sessionStorage.setItem('speaker_pin', pinInput);
    setIsAuthenticated(true);
    setPinError(null);
  };

  const handleLock = () => {
    if (isListening) {
      stop();
    }
    sessionStorage.removeItem('speaker_pin');
    setIsAuthenticated(false);
    setPinInput('');
  };

  const handleDownloadBackup = () => {
    // TODO: Open IndexedDB "SermonAudioBackup", compile all chunks from "audio_chunks"
    // object store into a single blob, trigger browser download.
    alert("Backup download initiated. (Stub handler logic executes - full logic deferred as per task spec)");
  };

  // Avoid rendering during SSR/hydration to prevent mismatches
  if (!isMounted) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center font-sans">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm text-slate-400 font-medium">Loading console...</span>
        </div>
      </div>
    );
  }

  // Render PIN Gate if not authenticated
  if (!isAuthenticated) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center px-4 py-12 font-sans select-none">
        <div className="w-full max-w-md bg-slate-900/60 border border-slate-800/80 backdrop-blur-md rounded-2xl p-8 shadow-2xl">
          <div className="flex flex-col items-center text-center mb-8">
            <div className="w-12 h-12 rounded-xl bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mb-4">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white mb-2">Speaker Console</h1>
            <p className="text-slate-400 text-sm">Please enter the speaker PIN to access the broadcast controls.</p>
          </div>

          <form onSubmit={handlePinSubmit} className="space-y-6">
            <div>
              <label htmlFor="pin-input" className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Speaker PIN
              </label>
              <input
                id="pin-input"
                type="password"
                value={pinInput}
                onChange={(e) => {
                  setPinInput(e.target.value);
                  if (pinError) setPinError(null);
                }}
                placeholder="••••••"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-center text-lg tracking-widest text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all font-mono"
              />
              {pinError && (
                <p className="text-red-400 text-sm mt-2 font-medium flex items-center gap-1.5 justify-center">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  {pinError}
                </p>
              )}
            </div>

            <button
              type="submit"
              className="w-full min-h-[48px] bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] text-white font-semibold rounded-xl transition-all duration-200 shadow-lg shadow-indigo-600/20 cursor-pointer flex items-center justify-center gap-2"
            >
              Unlock Console
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
              </svg>
            </button>
          </form>
        </div>
      </main>
    );
  }

  // Render Main Console
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-6 md:p-8 font-sans">
      <style>{`
        @keyframes wave-1 {
          0%, 100% { height: 8px; }
          50% { height: 28px; }
        }
        @keyframes wave-2 {
          0%, 100% { height: 12px; }
          50% { height: 38px; }
        }
        @keyframes wave-3 {
          0%, 100% { height: 6px; }
          50% { height: 24px; }
        }
        @keyframes wave-4 {
          0%, 100% { height: 14px; }
          50% { height: 42px; }
        }
        @keyframes wave-5 {
          0%, 100% { height: 10px; }
          50% { height: 32px; }
        }
        .animate-wave-1 { animation: wave-1 1.2s ease-in-out infinite; }
        .animate-wave-2 { animation: wave-2 0.9s ease-in-out infinite; }
        .animate-wave-3 { animation: wave-3 1.5s ease-in-out infinite; }
        .animate-wave-4 { animation: wave-4 1.1s ease-in-out infinite; }
        .animate-wave-5 { animation: wave-5 1.3s ease-in-out infinite; }

        @keyframes pulse-ring {
          0% { transform: scale(0.95); opacity: 0.8; }
          50% { transform: scale(1.05); opacity: 0.4; }
          100% { transform: scale(0.95); opacity: 0.8; }
        }
        .animate-pulse-ring {
          animation: pulse-ring 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
      `}</style>

      {/* Top Header Row */}
      <header className="w-full max-w-2xl mx-auto flex items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-white">Speaker Console</h1>
            <p className="text-xs text-slate-400">Sermon Translation System</p>
          </div>
        </div>

        {/* Connection Indicator */}
        <div className="bg-slate-900 border border-slate-800 rounded-full px-3.5 py-1.5 flex items-center gap-2 text-xs font-semibold tracking-wide">
          <span className={`h-2 w-2 rounded-full transition-all duration-300 ${
            isListening
              ? 'bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.8)] animate-pulse'
              : 'bg-slate-600'
          }`} />
          <span className={isListening ? 'text-green-400' : 'text-slate-400'}>
            {isListening ? 'LIVE BROADCAST' : 'READY TO START'}
          </span>
        </div>
      </header>

      {/* Mid Section: Controller & Visualizer */}
      <section className="flex-1 w-full max-w-2xl mx-auto flex flex-col items-center justify-center py-6">
        <div className="relative flex items-center justify-center mb-8">
          {/* Pulsing ring backdrop while broadcasting */}
          {isListening && (
            <div className="absolute inset-0 rounded-full bg-red-500/20 border-2 border-red-500/30 animate-pulse-ring" />
          )}

          {/* Large Start/Stop Toggle Button */}
          <button
            onClick={isListening ? stop : start}
            className={`relative z-10 w-48 h-48 rounded-full flex flex-col items-center justify-center gap-2 transition-all duration-300 active:scale-95 cursor-pointer text-center select-none shadow-2xl min-h-[48px] ${
              isListening
                ? 'bg-gradient-to-br from-red-600 to-red-800 hover:from-red-500 hover:to-red-700 text-white shadow-red-950/50'
                : 'bg-gradient-to-br from-indigo-600 to-indigo-800 hover:from-indigo-500 hover:to-indigo-700 text-white shadow-indigo-950/50'
            }`}
          >
            {isListening ? (
              <>
                <svg className="w-10 h-10 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                </svg>
                <span className="font-bold tracking-wider text-base uppercase">Stop Broadcast</span>
              </>
            ) : (
              <>
                <svg className="w-10 h-10 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="font-bold tracking-wider text-base uppercase">Start Broadcast</span>
              </>
            )}
          </button>
        </div>

        {/* Volume Visualizer (CSS Wave) */}
        <div className="flex items-end justify-center gap-1.5 h-12 w-32 my-4" aria-label="Volume visualizer">
          {[1, 2, 3, 4, 5].map((barIndex) => (
            <div
              key={barIndex}
              className={`w-2 rounded-full transition-all duration-300 ${
                isListening
                  ? `bg-indigo-500 animate-wave-${barIndex}`
                  : 'bg-slate-800 h-2'
              }`}
            />
          ))}
        </div>
      </section>

      {/* Bottom Section: Text Buffers and Error Banner */}
      <section className="w-full max-w-2xl mx-auto space-y-6">
        {/* Error Banner */}
        {error && (
          <div className="bg-red-900/50 border border-red-500 text-red-100 rounded-xl p-4 flex items-start gap-3 shadow-lg shadow-red-950/20">
            <svg className="w-5 h-5 text-red-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
            <div className="text-sm">
              <span className="font-semibold block mb-0.5">Broadcast Error</span>
              <p className="opacity-90">{error}</p>
            </div>
          </div>
        )}

        {/* Live Output Panels */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Indonesian Transcript Panel */}
          <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-5 shadow-inner">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
              Speech Transcription (Indonesian)
            </h3>
            <p className={`text-sm leading-relaxed min-h-[96px] max-h-[144px] overflow-y-auto ${
              latestTranscribedText ? 'text-slate-100 font-mono' : 'text-slate-500 italic'
            }`}>
              {latestTranscribedText || 'Waiting for speech...'}
            </p>
          </div>

          {/* English Translation Panel */}
          <div className="bg-indigo-950/15 border border-indigo-900/35 rounded-xl p-5 shadow-inner">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-indigo-400 mb-3 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
              Translation Output (English)
            </h3>
            <p className={`text-sm leading-relaxed min-h-[96px] max-h-[144px] overflow-y-auto ${
              latestTranslatedText ? 'text-indigo-100 font-sans' : 'text-indigo-400/50 italic'
            }`}>
              {latestTranslatedText || 'Translation will appear here...'}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="pt-4 border-t border-slate-900 flex flex-col sm:flex-row gap-3">
          <button
            onClick={handleDownloadBackup}
            className="flex-1 min-h-[48px] bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 font-medium px-4 py-2.5 rounded-xl text-sm transition-all duration-200 active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download Backup Audio
          </button>

          <button
            onClick={handleLock}
            className="min-h-[48px] sm:w-auto px-6 bg-slate-950 border border-slate-800 hover:bg-slate-900 text-slate-400 hover:text-slate-300 font-medium rounded-xl text-sm transition-all duration-200 active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            Lock Console
          </button>
        </div>
      </section>
    </main>
  );
}
