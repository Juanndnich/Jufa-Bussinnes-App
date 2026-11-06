/**
 * JufaStore - Utilitas Deteksi Platform Lintas Perangkat (Android, Desktop, Web)
 */

import { Capacitor } from '@capacitor/core';

export type AppPlatform = 'android' | 'desktop' | 'web';

/**
 * Cek apakah aplikasi berjalan di perangkat native Android (Capacitor)
 */
export function isNativeAndroid(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}

/**
 * Cek apakah aplikasi berjalan di lingkungan Desktop Windows / Tauri
 */
export function isTauriDesktop(): boolean {
  if (typeof window === 'undefined') return false;
  return '__TAURI_INTERNALS__' in window || '__TAURI__' in window;
}

/**
 * Mendapatkan identifier platform aplikasi saat ini
 */
export function getCurrentPlatform(): AppPlatform {
  if (isNativeAndroid()) return 'android';
  if (isTauriDesktop()) return 'desktop';
  return 'web';
}

/**
 * Mendapatkan label tampilan platform resmi untuk UI
 */
export function getPlatformLabel(): string {
  const p = getCurrentPlatform();
  if (p === 'android') return 'Android (APK Native)';
  if (p === 'desktop') return 'Windows PC (Desktop Native)';
  return 'Web Browser / PWA';
}
