import { useState, useEffect, FormEvent } from 'react';

export function usePinAuth() {
  const [isMounted, setIsMounted] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [rememberDevice, setRememberDevice] = useState(false);

  useEffect(() => {
    const pin = sessionStorage.getItem('speaker_pin') || localStorage.getItem('speaker_pin');
    const timer = setTimeout(() => {
      setIsMounted(true);
      if (pin) {
        sessionStorage.setItem('speaker_pin', pin);
        setIsAuthenticated(true);
      }
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const handlePinSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!pinInput.trim()) {
      setPinError('PIN cannot be empty.');
      return;
    }
    sessionStorage.setItem('speaker_pin', pinInput);
    if (rememberDevice) {
      localStorage.setItem('speaker_pin', pinInput);
    }
    setIsAuthenticated(true);
    setPinError(null);
  };

  const handleLock = (onLock?: () => void) => {
    if (onLock) {
      onLock();
    }
    sessionStorage.removeItem('speaker_pin');
    localStorage.removeItem('speaker_pin');
    setIsAuthenticated(false);
    setPinInput('');
  };

  return {
    isMounted,
    isAuthenticated,
    pinInput,
    pinError,
    rememberDevice,
    setPinInput,
    setRememberDevice,
    handlePinSubmit,
    handleLock,
  };
}
