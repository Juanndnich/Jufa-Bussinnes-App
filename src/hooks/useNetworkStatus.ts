import { useState, useEffect, useRef, useCallback } from 'react';
import { Network } from '@capacitor/network';
import { Capacitor } from '@capacitor/core';
import { showToast } from '../utils/alert';

const PING_URL = 'https://www.gstatic.com/generate_204';
const PING_TIMEOUT_MS = 4000;
const AMBIGUOUS_CHECK_INTERVAL_MS = 30000;

// Listeners untuk event onBackOnline (dapat digunakan oleh SyncService)
const backOnlineListeners = new Set<() => void>();

export function subscribeOnBackOnline(callback: () => void): () => void {
  backOnlineListeners.add(callback);
  return () => {
    backOnlineListeners.delete(callback);
  };
}

function triggerBackOnline() {
  for (const listener of backOnlineListeners) {
    try {
      listener();
    } catch (err) {
      console.error('Error in onBackOnline listener:', err);
    }
  }
}

/**
 * Verifikasi koneksi nyata ke internet melalui fetch ringan generate_204
 */
export async function verifyRealInternet(timeoutMs: number = PING_TIMEOUT_MS): Promise<boolean> {
  if (typeof window === 'undefined') return true;

  // Browser offline check cepat
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return false;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    await fetch(PING_URL, {
      method: 'GET',
      mode: 'no-cors',
      cache: 'no-store',
      signal: controller.signal,
    });
    clearTimeout(timer);
    return true;
  } catch {
    clearTimeout(timer);
    return false;
  }
}

export interface NetworkStatus {
  isOnline: boolean;
  connectionType?: string;
  checkNow: () => Promise<boolean>;
}

export function useNetworkStatus(): NetworkStatus {
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    if (typeof navigator !== 'undefined') {
      return navigator.onLine;
    }
    return true;
  });
  const [connectionType, setConnectionType] = useState<string>('unknown');

  const prevOnlineRef = useRef<boolean | null>(null);
  const isInitializedRef = useRef<boolean>(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const checkConnection = useCallback(async (hardwareConnected?: boolean) => {
    let connected = hardwareConnected;
    let type = 'unknown';

    if (connected === undefined) {
      try {
        if (Capacitor.isNativePlatform()) {
          const status = await Network.getStatus();
          connected = status.connected;
          type = status.connectionType;
        } else if (typeof navigator !== 'undefined') {
          connected = navigator.onLine;
        }
      } catch {
        connected = typeof navigator !== 'undefined' ? navigator.onLine : true;
      }
    }

    setConnectionType(type);

    let realOnline = false;
    if (connected) {
      realOnline = await verifyRealInternet(PING_TIMEOUT_MS);
    } else {
      realOnline = false;
    }

    setIsOnline(realOnline);

    // Debounce penanganan toast perubahan status
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      if (!isInitializedRef.current) {
        // Jangan munculkan toast saat pertama kali startup jika status belum pernah berubah
        isInitializedRef.current = true;
        prevOnlineRef.current = realOnline;
        return;
      }

      if (prevOnlineRef.current !== null && prevOnlineRef.current !== realOnline) {
        if (realOnline) {
          showToast('Anda sedang online', 'success');
          triggerBackOnline();
        } else {
          showToast('Anda sedang offline, data tetap tersimpan di perangkat', 'info');
        }
      }

      prevOnlineRef.current = realOnline;
    }, 400);

    return realOnline;
  }, []);

  useEffect(() => {
    checkConnection();

    let networkListener: any = null;

    if (Capacitor.isNativePlatform()) {
      Network.addListener('networkStatusChange', (status) => {
        checkConnection(status.connected);
      }).then((handle) => {
        networkListener = handle;
      });
    }

    const handleWebOnline = () => checkConnection(true);
    const handleWebOffline = () => checkConnection(false);

    window.addEventListener('online', handleWebOnline);
    window.addEventListener('offline', handleWebOffline);

    // Polling verifikasi setiap 30 detik untuk mendeteksi perubahan nyata
    const intervalTimer = setInterval(() => {
      checkConnection();
    }, AMBIGUOUS_CHECK_INTERVAL_MS);

    return () => {
      if (networkListener) {
        networkListener.remove();
      }
      window.removeEventListener('online', handleWebOnline);
      window.removeEventListener('offline', handleWebOffline);
      clearInterval(intervalTimer);
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [checkConnection]);

  return {
    isOnline,
    connectionType,
    checkNow: () => checkConnection(),
  };
}
