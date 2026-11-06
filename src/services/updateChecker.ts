import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Browser } from '@capacitor/browser';
import Swal from 'sweetalert2';
import { getCurrentPlatform, AppPlatform } from '../utils/platform';
import { CURRENT_APP_VERSION, CURRENT_PATCH_NOTE } from '../domain/patchNotes';

export const GITHUB_REPO_OWNER = 'Juanndnich';
export const GITHUB_REPO_NAME = 'Jufa-Bussinnes-App';
export const GITHUB_LATEST_RELEASE_URL = `https://api.github.com/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/releases/latest`;
export const TARGET_APK_NAME = 'JufaStore.apk';
export const TARGET_EXE_NAME = 'JufaStore-Setup.exe';

const LAST_CHECK_KEY = 'jufastore_last_update_check_time';
const DISMISSED_VERSION_KEY = 'jufastore_dismissed_update_version';
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 Jam

export interface GitHubReleaseAsset {
  name: string;
  browser_download_url: string;
  size: number;
  content_type?: string;
}

export interface GitHubReleaseResponse {
  tag_name: string;
  name?: string;
  body?: string;
  html_url?: string;
  assets?: GitHubReleaseAsset[];
}

export interface UpdateInfo {
  version: string; // contoh: "2.1.29"
  currentVersion: string; // contoh: "2.1.28"
  tagName: string; // contoh: "v2.1.29"
  releaseNotes: string;
  downloadUrl: string; // direct download URL asset
  releasePageUrl: string; // URL halaman release GitHub (html_url)
  apkSize: number; // in bytes
  hasUpdate: boolean;
  assetName?: string;
  platform?: AppPlatform;
}

let latestDiscoveredUpdate: UpdateInfo | null = null;
const updateListeners = new Set<(info: UpdateInfo | null) => void>();

export function subscribeUpdateState(listener: (info: UpdateInfo | null) => void): () => void {
  updateListeners.add(listener);
  listener(latestDiscoveredUpdate);
  return () => {
    updateListeners.delete(listener);
  };
}

function notifyUpdateListeners(info: UpdateInfo | null) {
  latestDiscoveredUpdate = info;
  for (const listener of updateListeners) {
    try {
      listener(info);
    } catch {
      // Ignore listener error
    }
  }
}

export function getDiscoveredUpdate(): UpdateInfo | null {
  return latestDiscoveredUpdate;
}

/**
 * Membuka URL langsung di browser sistem perangkat menggunakan @capacitor/browser dengan fallback aman
 */
export async function openInSystemBrowser(url: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    try {
      await Browser.open({ url });
      return;
    } catch {
      // Fallback
    }
  }

  if (typeof window !== 'undefined') {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

/**
 * Parsing SemVer menjadi array angka (misal: "v2.1.10" -> [2, 1, 10])
 */
export function parseSemver(v: string): number[] {
  if (!v) return [0, 0, 0];
  const clean = v.replace(/^[vV]/, '').trim();
  const mainPart = clean.split('-')[0].split('+')[0];
  const parts = mainPart.split('.').map((p) => {
    const n = parseInt(p, 10);
    return isNaN(n) ? 0 : n;
  });
  while (parts.length < 3) {
    parts.push(0);
  }
  return parts;
}

/**
 * Membandingkan dua versi SemVer
 * Mengembalikan:
 *  1 jika v1 > v2 (v1 lebih baru)
 * -1 jika v1 < v2
 *  0 jika sama
 */
export function compareSemver(v1: string, v2: string): number {
  const p1 = parseSemver(v1);
  const p2 = parseSemver(v2);
  const maxLen = Math.max(p1.length, p2.length);

  for (let i = 0; i < maxLen; i++) {
    const num1 = p1[i] ?? 0;
    const num2 = p2[i] ?? 0;
    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }
  return 0;
}

/**
 * Cek apakah release tag lebih baru daripada versi terpasang
 */
export function isNewerVersion(latestTagOrVersion: string, currentVersion: string): boolean {
  return compareSemver(latestTagOrVersion, currentVersion) > 0;
}

/**
 * Ekstraksi asset APK bernama JufaStore.apk dari respons GitHub Release
 */
export function findApkAsset(
  release: GitHubReleaseResponse
): { downloadUrl: string; size: number; name: string } | null {
  if (!release.assets || !Array.isArray(release.assets)) return null;
  const asset = release.assets.find(
    (a) => (a.name || '').toLowerCase() === TARGET_APK_NAME.toLowerCase()
  );
  if (!asset || !asset.browser_download_url) return null;
  return {
    downloadUrl: asset.browser_download_url,
    size: Number(asset.size) || 0,
    name: asset.name,
  };
}

/**
 * Ekstraksi asset Desktop Windows (.exe) dari respons GitHub Release
 */
export function findDesktopAsset(
  release: GitHubReleaseResponse
): { downloadUrl: string; size: number; name: string } | null {
  if (!release.assets || !Array.isArray(release.assets)) return null;
  const asset = release.assets.find((a) => {
    const lower = (a.name || '').toLowerCase();
    return (
      lower === TARGET_EXE_NAME.toLowerCase() ||
      (lower.startsWith('jufastore') && lower.endsWith('.exe')) ||
      lower.endsWith('.exe')
    );
  });
  if (!asset || !asset.browser_download_url) return null;
  return {
    downloadUrl: asset.browser_download_url,
    size: Number(asset.size) || 0,
    name: asset.name,
  };
}

/**
 * Mengambil versi aplikasi saat ini
 */
export async function getInstalledVersion(): Promise<string> {
  if (Capacitor.isNativePlatform()) {
    try {
      const info = await App.getInfo();
      if (info?.version) return info.version;
    } catch {
      // Fallback
    }
  }
  return CURRENT_APP_VERSION;
}

/**
 * Pembersihan file sisa APK update lama di direktori external & cache
 */
export async function cleanupOldUpdateApks(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  const oldFiles = ['JufaStore-update.apk', 'JufaStore.apk'];
  const targets = [Directory.External, Directory.Cache];

  for (const targetDir of targets) {
    for (const fileName of oldFiles) {
      try {
        await Filesystem.deleteFile({
          path: fileName,
          directory: targetDir,
        });
      } catch {
        // Gagal dengan tenang
      }
    }
  }
}

/**
 * Mendapatkan tema gelap/terang untuk dialog SweetAlert2
 */
function getSwalTheme() {
  const dark =
    typeof document !== 'undefined' &&
    (document.documentElement.classList.contains('dark') ||
      (!document.documentElement.classList.contains('light') &&
        window.matchMedia('(prefers-color-scheme: dark)').matches));

  return {
    background: dark ? '#18181b' : '#ffffff',
    color: dark ? '#f4f4f5' : '#09090b',
    confirmButtonColor: '#10b981',
    cancelButtonColor: dark ? '#3f3f46' : '#94a3b8',
    customClass: {
      popup: 'rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-2xl p-5 text-left',
      title: 'text-lg font-bold tracking-tight text-zinc-900 dark:text-zinc-100 text-left',
      htmlContainer: 'text-sm text-zinc-600 dark:text-zinc-300 text-left',
      confirmButton: 'px-4 py-2.5 rounded-xl font-medium text-xs sm:text-sm transition shadow-sm',
      denyButton: 'px-4 py-2.5 rounded-xl font-medium text-xs sm:text-sm transition shadow-sm',
      cancelButton: 'px-4 py-2.5 rounded-xl font-medium text-xs sm:text-sm transition',
    },
  };
}

/**
 * Cek Pembaruan dari GitHub Releases (Mendukung Android, Windows Desktop, dan Web)
 */
export async function checkForUpdates(options: {
  manual?: boolean;
  onNavigateToBackup?: () => void;
  onViewPatchNotes?: () => void;
}): Promise<UpdateInfo | null> {
  const platform = getCurrentPlatform();

  // Cek batas interval waktu 6 jam jika auto-check
  if (!options.manual) {
    const lastCheckStr = localStorage.getItem(LAST_CHECK_KEY);
    if (lastCheckStr) {
      const lastCheck = parseInt(lastCheckStr, 10);
      if (!isNaN(lastCheck) && Date.now() - lastCheck < CHECK_INTERVAL_MS) {
        return latestDiscoveredUpdate;
      }
    }
  }

  // Deteksi koneksi offline dasar
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    if (options.manual) {
      const theme = getSwalTheme();
      await Swal.fire({
        icon: 'warning',
        title: 'Perangkat Offline',
        text: 'Tidak dapat memeriksa pembaruan karena koneksi internet terputus. Mohon periksa jaringan Anda.',
        confirmButtonText: 'Mengerti',
        ...theme,
      });
    }
    return null;
  }

  try {
    const currentVersion = await getInstalledVersion();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000); // 12s timeout

    const res = await fetch(GITHUB_LATEST_RELEASE_URL, {
      signal: controller.signal,
      headers: {
        Accept: 'application/vnd.github.v3+json',
      },
    });
    clearTimeout(timeoutId);

    // Simpan timestamp pengecekan sukses
    localStorage.setItem(LAST_CHECK_KEY, Date.now().toString());

    if (!res.ok) {
      if (options.manual) {
        const theme = getSwalTheme();
        if (res.status === 403) {
          await Swal.fire({
            icon: 'info',
            title: 'Batas Permintaan Tercapai',
            text: 'Batas permintaan API GitHub publik telah tercapai sementara. Silakan coba kembali dalam beberapa saat.',
            confirmButtonText: 'Tutup',
            ...theme,
          });
        } else if (res.status === 404) {
          await Swal.fire({
            icon: 'info',
            title: 'Belum Ada Rilis',
            text: 'Belum ada rilis resmi yang dipublikasikan di repositori GitHub.',
            confirmButtonText: 'Tutup',
            ...theme,
          });
        } else {
          await Swal.fire({
            icon: 'error',
            title: 'Gagal Memeriksa Pembaruan',
            text: `Server GitHub mengembalikan status: ${res.status}. Silakan coba beberapa saat lagi.`,
            confirmButtonText: 'Tutup',
            ...theme,
          });
        }
      }
      return null;
    }

    const release: GitHubReleaseResponse = await res.json();
    const remoteTag = release.tag_name || '';
    const cleanRemoteVersion = remoteTag.replace(/^[vV]/, '');
    const hasUpdate = isNewerVersion(cleanRemoteVersion, currentVersion);

    // Cari asset berdasarkan platform yang sedang berjalan
    let chosenAsset: { downloadUrl: string; size: number; name: string } | null = null;
    if (platform === 'desktop') {
      chosenAsset = findDesktopAsset(release) || findApkAsset(release);
    } else {
      chosenAsset = findApkAsset(release);
    }

    const releasePageUrl =
      release.html_url ||
      `https://github.com/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/releases/tag/${remoteTag}`;

    if (!hasUpdate) {
      notifyUpdateListeners(null);
      if (options.manual) {
        const theme = getSwalTheme();
        const resAlert = await Swal.fire({
          icon: 'success',
          title: 'Versi Sudah Terbaru',
          html: `
            <div class="space-y-2 text-xs">
              <p>Aplikasi JufaStore Anda sudah menggunakan versi resmi terbaru: <strong>v${currentVersion}</strong>.</p>
              <div class="p-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 font-mono">
                Platform Aktif: <strong>${platform === 'desktop' ? 'Windows Desktop' : platform === 'android' ? 'Android APK' : 'Web Browser'}</strong>
              </div>
            </div>
          `,
          showCancelButton: true,
          confirmButtonText: 'Mengerti',
          cancelButtonText: 'Buka Catatan Pembaruan',
          ...theme,
          cancelButtonColor: '#3b82f6',
        });

        if (resAlert.isDismissed && resAlert.dismiss === Swal.DismissReason.cancel) {
          options.onViewPatchNotes?.();
        }
      }
      return null;
    }

    // Jika ada update tapi asset spesifik belum ada (misal masih diproses CI), gunakan fallback halaman rilis
    const downloadUrl = chosenAsset?.downloadUrl || releasePageUrl;
    const assetSize = chosenAsset?.size || 0;
    const assetName = chosenAsset?.name || (platform === 'desktop' ? TARGET_EXE_NAME : TARGET_APK_NAME);

    const updateInfo: UpdateInfo = {
      version: cleanRemoteVersion,
      currentVersion,
      tagName: remoteTag,
      releaseNotes: release.body?.trim() || 'Pembaruan performa dan stabilitas aplikasi.',
      downloadUrl,
      releasePageUrl,
      apkSize: assetSize,
      hasUpdate: true,
      assetName,
      platform,
    };

    notifyUpdateListeners(updateInfo);

    // Cek apakah versi ini di-dismiss oleh pengguna untuk auto-check
    const dismissedVersion = localStorage.getItem(DISMISSED_VERSION_KEY);
    if (!options.manual && dismissedVersion === cleanRemoteVersion) {
      return updateInfo;
    }

    // Tampilkan dialog update jika auto-check atau manual
    await promptUpdateDialog(updateInfo);
    return updateInfo;
  } catch {
    if (options.manual) {
      const theme = getSwalTheme();
      await Swal.fire({
        icon: 'warning',
        title: 'Koneksi Terganggu',
        text: 'Tidak dapat terhubung ke server pembaruan GitHub. Pastikan internet Anda aktif dan stabil.',
        confirmButtonText: 'Tutup',
        ...theme,
      });
    }
    return null;
  }
}

/**
 * Tampilkan Dialog Konfirmasi Pembaruan Versi Baru (Play Store Style)
 */
export async function promptUpdateDialog(updateInfo: UpdateInfo): Promise<void> {
  const theme = getSwalTheme();
  const sizeMb = (updateInfo.apkSize / (1024 * 1024)).toFixed(1);
  const isDesktop = updateInfo.platform === 'desktop';

  const escapedNotes = updateInfo.releaseNotes
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br/>');

  const installInstructions = isDesktop
    ? `
      <ol class="list-decimal pl-4 space-y-1 text-zinc-600 dark:text-zinc-400 leading-relaxed">
        <li>Tekan tombol <strong>"Unduh Installer PC (.exe)"</strong> di bawah.</li>
        <li>Buka file <strong>${updateInfo.assetName || TARGET_EXE_NAME}</strong> dari folder Download.</li>
        <li>Jalankan pemasangan hingga selesai (seluruh database IndexedDB Anda aman).</li>
      </ol>
    `
    : `
      <ol class="list-decimal pl-4 space-y-1 text-zinc-600 dark:text-zinc-400 leading-relaxed">
        <li>Tekan tombol <strong>"Unduh di GitHub"</strong> di bawah.</li>
        <li>Buka file dari panel notifikasi HP atau folder <strong>Download</strong>.</li>
        <li>Tekan <strong>Instal</strong> saat installer muncul (seluruh data toko & kas aman 100%).</li>
      </ol>
    `;

  const primaryBtnText = isDesktop ? 'Unduh Installer PC (.exe)' : 'Unduh di GitHub';

  const result = await Swal.fire({
    title: 'Pembaruan Tersedia',
    html: `
      <div class="space-y-3.5 text-xs">
        <div class="flex items-center justify-between p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-mono">
          <span>Versi Terpasang: <strong>v${updateInfo.currentVersion}</strong></span>
          <span class="font-bold">&rarr;</span>
          <span>Versi Baru: <strong>v${updateInfo.version}</strong></span>
        </div>

        <div class="p-3 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-1.5 max-h-36 overflow-y-auto">
          <div class="font-bold text-zinc-700 dark:text-zinc-300">Yang Baru di Versi ${updateInfo.tagName} (Play Store Style):</div>
          <div class="text-zinc-600 dark:text-zinc-400 leading-relaxed font-sans">${escapedNotes}</div>
        </div>

        <div class="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 space-y-2">
          <div class="font-bold text-zinc-800 dark:text-zinc-200 flex items-center justify-between">
            <span>Petunjuk Pemasangan Pembaruan:</span>
            <span class="text-[10px] font-mono text-zinc-500 font-normal">${updateInfo.apkSize > 0 ? `~${sizeMb} MB` : 'Rilis Resmi'}</span>
          </div>
          ${installInstructions}
        </div>
      </div>
    `,
    showCancelButton: true,
    showDenyButton: true,
    confirmButtonText: primaryBtnText,
    denyButtonText: 'Lihat Halaman Rilis',
    cancelButtonText: 'Nanti',
    denyButtonColor: '#3b82f6',
    reverseButtons: true,
    ...theme,
  });

  if (result.isConfirmed) {
    await openInSystemBrowser(updateInfo.downloadUrl);
  } else if (result.isDenied) {
    await openInSystemBrowser(updateInfo.releasePageUrl);
  } else if (result.isDismissed) {
    localStorage.setItem(DISMISSED_VERSION_KEY, updateInfo.version);
  }
}
