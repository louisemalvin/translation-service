'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAudioCapture } from '../../hooks/useAudioCapture';
import { Icon } from '@/components/Icon';
import { Button } from '@/components/Button';
import { PinGate } from '@/components/PinGate';

export default function SpeakerPage() {
  const [isMounted, setIsMounted] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [rememberDevice, setRememberDevice] = useState(false);
  const sermonIdRef = useRef(Date.now().toString());

  const { isListening, start, stop, error } =
    useAudioCapture(sermonIdRef.current);

  useEffect(() => {
    setIsMounted(true);
    const pin = sessionStorage.getItem('speaker_pin') || localStorage.getItem('speaker_pin');
    if (pin) {
      sessionStorage.setItem('speaker_pin', pin);
      setIsAuthenticated(true);
    }
  }, []);

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pinInput.trim()) return setPinError('PIN cannot be empty.');
    sessionStorage.setItem('speaker_pin', pinInput);
    if (rememberDevice) localStorage.setItem('speaker_pin', pinInput);
    setIsAuthenticated(true); setPinError(null);
  };

  const handleLock = () => {
    if (isListening) stop();
    sessionStorage.removeItem('speaker_pin'); localStorage.removeItem('speaker_pin');
    setIsAuthenticated(false); setPinInput('');
  };

  if (!isMounted) return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center font-sans">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin" />
        <span className="text-sm text-slate-400 font-medium">Loading console...</span>
      </div>
    </div>
  );

  if (!isAuthenticated) return <PinGate pinInput={pinInput} pinError={pinError} rememberDevice={rememberDevice} onPinInputChange={setPinInput} onRememberDeviceChange={setRememberDevice} onSubmit={handlePinSubmit} />;

  const gradientClasses = isListening
    ? 'bg-gradient-to-br from-status-error to-status-error-dark hover:from-status-error-bright hover:to-status-error shadow-status-error-dark/20'
    : 'bg-gradient-to-br from-accent-strong to-accent-deep hover:from-accent-hover hover:to-accent-strong shadow-accent-strong/20';

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 md:p-8 font-sans">
      <div className="relative flex items-center justify-center mb-8">
        {isListening && <div className="absolute inset-0 rounded-full bg-status-error/20 border-2 border-status-error/30 animate-pulse-ring" />}
        <Button
          variant="primary"
          size="lg"
          iconLeft={<Icon name={isListening ? 'Stop' : 'Play'} className="!w-10 !h-10 mb-1" />}
          onClick={isListening ? stop : start}
          className={`relative z-10 w-48 h-48 rounded-full flex flex-col items-center justify-center gap-2 transition-all duration-300 active:scale-95 cursor-pointer text-center select-none shadow-2xl !p-0 text-white ${gradientClasses}`}
        >
          <span className="font-bold tracking-wider text-base uppercase">{isListening ? 'Stop Broadcast' : 'Start Broadcast'}</span>
        </Button>
      </div>

      {error && (
        <div className="w-full max-w-md mb-6 bg-red-900/30 border border-red-800 rounded-xl p-4 flex items-start gap-3">
          <Icon name="ErrorCircle" className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <div className="text-sm">
            <span className="font-semibold block mb-0.5 text-red-300">Broadcast Error</span>
            <p className="text-red-200/90">{error}</p>
          </div>
        </div>
      )}

      <div className="pt-4">
        <Button variant="secondary" size="md" iconLeft={<Icon name="Lock" className="w-4 h-4" />} onClick={handleLock}>Lock Console</Button>
      </div>
    </main>
  );
}
