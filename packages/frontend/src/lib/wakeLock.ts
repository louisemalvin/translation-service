let wakeLockSentinel: WakeLockSentinel | null = null;

export async function requestWakeLock(): Promise<void> {
  if (!('wakeLock' in navigator)) {
    console.log('Wake Lock API not available');
    return;
  }

  try {
    wakeLockSentinel = await navigator.wakeLock.request('screen');
    wakeLockSentinel.onrelease = () => {
      wakeLockSentinel = null;
    };
  } catch (err) {
    console.warn('Failed to request wake lock:', err);
  }
}

export function releaseWakeLock(): void {
  if (wakeLockSentinel) {
    wakeLockSentinel
      .release()
      .then(() => {
        wakeLockSentinel = null;
      })
      .catch((err) => {
        console.error('Failed to release wake lock:', err);
      });
  }
}
