'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Card } from '@/components/Card';
import { Icon } from '@/components/Icon';
import { Button } from '@/components/Button';
import { PinGate } from '@/components/PinGate';
import { StatusDot } from '@/components/StatusDot';
import { subscribeToLiveSermon, type TranslationSegment } from '@/services/realtime/liveSync';

export default function AdminPage() {
  const [isMounted, setIsMounted] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [rememberDevice, setRememberDevice] = useState(false);

  const [logs, setLogs] = useState<TranslationSegment[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    const pin = sessionStorage.getItem('speaker_pin') || localStorage.getItem('speaker_pin');
    if (pin) {
      sessionStorage.setItem('speaker_pin', pin);
      setIsAuthenticated(true);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;

    // Subscribe to the live broadcast feed for debugging logs
    const unsubscribe = subscribeToLiveSermon((segment: TranslationSegment) => {
      setConnected(true);
      setLogs((prev) => [segment, ...prev]); // Prepend to see the latest log first
    });

    // Simple ping timeout simulation to toggle connected state
    const interval = setInterval(() => {
      // If we haven't received anything or channel drops, you can keep connected status
      // We set connected state true initially because subscribeToLiveSermon handles connection.
      setConnected(true);
    }, 5000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [isAuthenticated]);

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pinInput.trim()) return setPinError('PIN cannot be empty.');
    sessionStorage.setItem('speaker_pin', pinInput);
    if (rememberDevice) localStorage.setItem('speaker_pin', pinInput);
    setIsAuthenticated(true); setPinError(null);
  };

  const handleLock = () => {
    sessionStorage.removeItem('speaker_pin'); localStorage.removeItem('speaker_pin');
    setIsAuthenticated(false); setPinInput('');
  };

  const clearLogs = () => {
    setLogs([]);
  };

  if (!isMounted) return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center font-sans">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin" />
        <span className="text-sm text-slate-400 font-medium">Loading debugger...</span>
      </div>
    </div>
  );

  if (!isAuthenticated) return <PinGate pinInput={pinInput} pinError={pinError} rememberDevice={rememberDevice} onPinInputChange={setPinInput} onRememberDeviceChange={setRememberDevice} onSubmit={handlePinSubmit} />;

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col p-4 md:p-8 font-sans">
      <div className="w-full max-w-6xl mx-auto space-y-6 flex-1 flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent/15 border border-accent/30 flex items-center justify-center text-accent">
              <Icon name="Settings" className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white">Developer Debug Console</h1>
              <p className="text-xs text-slate-400">Live monitor for speech-to-text (ASR) outputs and LLM translations</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" iconLeft={<Icon name="Lock" className="w-3.5 h-3.5" />} onClick={handleLock}>Lock</Button>
          </div>
        </div>

        {/* Info & Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-shrink-0">
          <Card variant="default" className="bg-surface-secondary/40 border border-surface-border/60 backdrop-blur-md rounded-xl p-4 flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Realtime Broadcast</span>
              <span className="text-sm font-bold text-white mt-1 block">sermon-live</span>
            </div>
            <StatusDot
              state={connected ? 'live' : 'error'}
              label={connected ? 'CONNECTED' : 'DISCONNECTED'}
              ariaLabel={connected ? 'Connected' : 'Disconnected'}
              labelClassName="text-[10px] font-bold"
            />
          </Card>

          <Card variant="default" className="bg-surface-secondary/40 border border-surface-border/60 backdrop-blur-md rounded-xl p-4 flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Total Segments Streamed</span>
              <span className="text-2xl font-mono font-bold text-accent mt-0.5 block">{logs.length}</span>
            </div>
            <div className="w-9 h-9 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400">
              <Icon name="Broadcast" className="w-4 h-4" />
            </div>
          </Card>

          <Card variant="default" className="bg-surface-secondary/40 border border-surface-border/60 backdrop-blur-md rounded-xl p-4 flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Console Navigation</span>
              <div className="flex gap-2 mt-1.5">
                <Link href="/speaker" className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-[11px] font-bold uppercase tracking-wider text-slate-300">
                  Speaker
                </Link>
                <Link href="/" className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-[11px] font-bold uppercase tracking-wider text-slate-300">
                  Viewer
                </Link>
              </div>
            </div>
          </Card>
        </div>

        {/* Debug Logs Terminal Grid */}
        <Card variant="default" className="flex-1 bg-slate-900/60 border border-slate-800 backdrop-blur-md rounded-2xl p-6 shadow-2xl flex flex-col min-h-[400px]">
          <div className="flex justify-between items-center pb-4 border-b border-slate-800 flex-shrink-0">
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-accent animate-pulse" />
              Live Debug Log Feed
            </h2>
            <Button
              variant="secondary"
              size="sm"
              onClick={clearLogs}
              className="text-xs !min-h-0 h-8 font-semibold"
              disabled={logs.length === 0}
              iconLeft={<Icon name="Close" className="w-3.5 h-3.5" />}
            >
              Clear Feed
            </Button>
          </div>

          {/* Logs Container */}
          <div className="flex-1 overflow-y-auto mt-4 pr-1 min-h-0">
            {logs.length === 0 ? (
              <div className="h-full flex items-center justify-center">
                <div className="text-center max-w-sm">
                  <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-slate-950 flex items-center justify-center border border-slate-800 text-slate-600">
                    <Icon name="Microphone" className="w-5 h-5" />
                  </div>
                  <p className="text-sm font-medium text-slate-400">Waiting for live broadcast packets...</p>
                  <p className="text-xs text-slate-600 mt-1">Speak into the speaker console to watch raw and translated logs populate here in real-time.</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {logs.map((log) => (
                  <div 
                    key={log.sequence_number} 
                    className="p-4 rounded-xl bg-slate-950/80 border border-slate-800/80 hover:border-slate-800 transition-colors flex flex-col md:flex-row gap-4"
                  >
                    {/* Log metadata */}
                    <div className="flex md:flex-col justify-between md:justify-start items-center md:items-start gap-1.5 flex-shrink-0 md:w-32 border-b md:border-b-0 md:border-r border-slate-800/80 pb-2 md:pb-0 md:pr-4">
                      <span className="text-[11px] font-bold text-accent font-mono bg-accent/10 px-2 py-0.5 rounded">
                        Seq #{log.sequence_number}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </span>
                    </div>

                    {/* Texts comparison */}
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block mb-1">Raw ASR (Indonesian)</span>
                        <p className="text-sm text-slate-300 leading-relaxed font-sans">{log.raw_text}</p>
                      </div>
                      <div className="border-t md:border-t-0 md:border-l border-slate-800/50 pt-3 md:pt-0 md:pl-4">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-accent block mb-1">Translation (English)</span>
                        <p className="text-sm text-slate-100 leading-relaxed font-sans font-medium">{log.translated_text}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>
    </main>
  );
}
