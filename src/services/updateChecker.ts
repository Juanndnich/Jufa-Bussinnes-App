import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { FileOpener } from '@capacitor-community/file-opener';
import Swal from 'sweetalert2';
import { formatNumber } from '../utils/formatters';

export const GITHUB_REPO_OWNER = 'Juanndnich';
export const GITHUB_REPO_NAME = 'Jufa-Bussinnes-App';
export const GITHUB_LATEST_RELEASE_URL = `https://api.github.com/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/releases/latest`;
export const TARGET_APK_NAME = 'JufaStore.apk';

const LAST_CHECK_KEY = 'jufastore_last_update_check_time';
const DISMISSED_VERSION_KEY = 'jufastore_dismissed_update_version';
const UPDATE_CACHE_FILENAME = 'JufaStore-update.apk';
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
  assets?: GitHubReleaseAsset[];
}

export interface UpdateInfo {
  version: string; // e.g. "2.1.1"
  currentVersion: string; // e.g. "2.1.0"
  tagName: string; // e.g. "v2.1.1"
  releaseNotes: string;
  downloadUrl: string;
  apkSize: number; // in bytes
  hasUpdate: boolean;
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

export interface ApkHeaderValidationResult {
  isValid: boolean;
  hex: string;
  ascii: string;
  rawBase64Header: string;
}

/**
 * Validasi 4-byte magic number dari file APK/ZIP.
 * APK/ZIP yang valid WAJIB diawali:
 * 0x50, 0x4B, 0x03, 0x04 ("PK\x03\x04" / hex: "50 4B 03 04").
 * Dalam representasi Base64, header ini selalu diawali string "UEsDB".
 * Jika file adalah HTML error/redirect (misal <!DOCTYPE atau <html), byte pertama adalah 0x3C ('<').
 */
export function verifyApkMagicBytes(base64Data: string): ApkHeaderValidationResult {
  if (!base64Data || typeof base64Data !== 'string') {
    return {
      isValid: false,
      hex: '',
      ascii: '',
      rawBase64Header: '',
    };
  }

  // Bersihkan data URL prefix jika ada (misal data:application/...;base64,...)
  const cleanBase64 = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
  const rawBase64Header = cleanBase64.slice(0, 16);

  try {
    // Ambil binary string dari potongan awal base64 (8 karakter base64 = 6 bytes)
    const decoded = atob(cleanBase64.slice(0, 8));
    if (decoded.length < 4) {
      return {
        isValid: false,
        hex: '',
        ascii: decoded,
        rawBase64Header,
      };
    }

    const b0 = decoded.charCodeAt(0);
    const b1 = decoded.charCodeAt(1);
    const b2 = decoded.charCodeAt(2);
    const b3 = decoded.charCodeAt(3);

    const hex = [b0, b1, b2, b3]
      .map((b) => b.toString(16).padStart(2, '0').toUpperCase())
      .join(' ');

    const ascii = [b0, b1, b2, b3]
      .map((b) => (b >= 32 && b <= 126 ? String.fromCharCode(b) : `\\x${b.toString(16).padStart(2, '0')}`))
      .join('');

    const isValid = b0 === 0x50 && b1 === 0x4b && b2 === 0x03 && b3 === 0x04;

    return {
      isValid,
      hex,
      ascii,
      rawBase64Header,
    };
  } catch {
    return {
      isValid: false,
      hex: '',
      ascii: '',
      rawBase64Header,
    };
  }
}

/**
 * Membuka URL unduhan rilis langsung di browser bawaan sistem HP.
 * Berfungsi sebagai jalur alternatif handal ketika package installer in-app bermasalah.
 */
export function openInSystemBrowser(url: string): void {
  try {
    if (typeof window !== 'undefined' && typeof window.open === 'function') {
      window.open(url, '_system') || window.open(url, '_blank');
    }
  } catch {
    if (typeof window !== 'undefined') {
      window.location.href = url;
    }
  }
}

/**
 * Dialog panduan instalasi manual melalui browser perangkat
 */
export async function showBrowserFallbackDialog(
  updateInfo: UpdateInfo,
  diagnosticDetails?: string
): Promise<void> {
  const theme = getSwalTheme();
  const sizeMb = (updateInfo.apkSize / (1024 * 1024)).toFixed(1);

  const res = await Swal.fire({
    icon: 'info',
    title: 'Unduh Melalui Browser',
    html: `
      <div class="space-y-3 text-xs text-left">
        <p class="text-zinc-600 dark:text-zinc-400">
          Anda dapat mengunduh langsung file resmi <strong>JufaStore.apk</strong> (v${updateInfo.version}, ~${sizeMb} MB) lewat browser HP Anda.
        </p>

        <div class="p-3 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-2">
          <div class="font-bold text-zinc-700 dark:text-zinc-300">Langkah Pemasangan Mudah:</div>
          <ol class="list-decimal pl-4 space-y-1.5 text-zinc-600 dark:text-zinc-400">
            <li>Tekan tombol <strong>"Buka Browser & Unduh"</strong> di bawah.</li>
            <li>Setelah selesai, buka panel notifikasi HP atau buka folder <strong>Download</strong>.</li>
            <li>Ketuk file <strong>JufaStore.apk</strong> untuk memperbarui aplikasi.</li>
          </ol>
        </div>

        <div class="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400">
          🛡️ <strong>Aman & Tanpa Kehilangan Data:</strong> Pembaruan APK resmi tidak akan menghapus data toko atau catatan keuangan Anda.
        </div>

        ${
          diagnosticDetails
            ? `
          <div class="p-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-[10px] font-mono text-zinc-500 space-y-1 overflow-x-auto">
            <div class="font-bold text-zinc-700 dark:text-zinc-300">Data Diagnostik:</div>
            ${diagnosticDetails}
          </div>
        `
            : ''
        }
      </div>
    `,
    showCancelButton: true,
    confirmButtonText: 'Buka Browser & Unduh',
    cancelButtonText: 'Tutup',
    ...theme,
  });

  if (res.isConfirmed) {
    openInSystemBrowser(updateInfo.downloadUrl);
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
    (a) => a.name.toLowerCase() === TARGET_APK_NAME.toLowerCase()
  );
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
  return '2.1.0';
}

/**
 * Hapus file APK lama dari direktori cache aplikasi
 */
export async function cleanupOldUpdateApks(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await Filesystem.deleteFile({
      path: UPDATE_CACHE_FILENAME,
      directory: Directory.Cache,
    });
  } catch {
    // Abaikan jika file memang tidak ada
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
      confirmButton: 'px-5 py-2.5 rounded-xl font-medium text-sm transition shadow-sm',
      cancelButton: 'px-5 py-2.5 rounded-xl font-medium text-sm transition',
    },
  };
}

/**
 * Cek Pembaruan dari GitHub Releases
 */
export async function checkForUpdates(options: {
  manual?: boolean;
  onNavigateToBackup?: () => void;
}): Promise<UpdateInfo | null> {
  const isNative = Capacitor.isNativePlatform();

  // Jika di browser/PWA biasa (bukan native), lewati pengecekan sepenuhnya
  if (!isNative) {
    if (options.manual) {
      const theme = getSwalTheme();
      await Swal.fire({
        icon: 'info',
        title: 'Pembaruan Otomatis Khusus Android',
        text: 'Fitur pembaruan APK otomatis hanya aktif pada aplikasi native Android.',
        confirmButtonText: 'Mengerti',
        ...theme,
      });
    }
    return null;
  }

  // Cek batas waktu 6 jam jika auto-check
  if (!options.manual) {
    const lastCheckStr = localStorage.getItem(LAST_CHECK_KEY);
    if (lastCheckStr) {
      const lastCheck = parseInt(lastCheckStr, 10);
      if (!isNaN(lastCheck) && Date.now() - lastCheck < CHECK_INTERVAL_MS) {
        return latestDiscoveredUpdate;
      }
    }
  }

  // Deteksi online dasar
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
    const apkAsset = findApkAsset(release);

    if (!hasUpdate || !apkAsset) {
      notifyUpdateListeners(null);
      if (options.manual) {
        const theme = getSwalTheme();
        await Swal.fire({
          icon: 'success',
          title: 'Versi Sudah Terbaru',
          html: `<p>Aplikasi JufaStore Anda sudah menggunakan versi terbaru: <strong>v${currentVersion}</strong>.</p>`,
          confirmButtonText: 'Mantap',
          ...theme,
        });
      }
      return null;
    }

    const updateInfo: UpdateInfo = {
      version: cleanRemoteVersion,
      currentVersion,
      tagName: remoteTag,
      releaseNotes: release.body?.trim() || 'Pembaruan stabilitas dan peningkatan performa.',
      downloadUrl: apkAsset.downloadUrl,
      apkSize: apkAsset.size,
      hasUpdate: true,
    };

    notifyUpdateListeners(updateInfo);

    // Cek apakah versi ini di-dismiss oleh pengguna untuk auto-check
    const dismissedVersion = localStorage.getItem(DISMISSED_VERSION_KEY);
    if (!options.manual && dismissedVersion === cleanRemoteVersion) {
      return updateInfo;
    }

    // Tampilkan Dialog Pembaruan
    await promptUpdateDialog(updateInfo, options.onNavigateToBackup);
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
 * Tampilkan Dialog Konfirmasi Pembaruan Versi Baru
 */
export async function promptUpdateDialog(
  updateInfo: UpdateInfo,
  onNavigateToBackup?: () => void
): Promise<void> {
  const theme = getSwalTheme();
  const sizeMb = (updateInfo.apkSize / (1024 * 1024)).toFixed(1);

  // Format release notes sederhana
  const escapedNotes = updateInfo.releaseNotes
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br/>');

  const result = await Swal.fire({
    title: '🚀 Pembaruan Aplikasi Tersedia',
    html: `
      <div class="space-y-3.5 text-xs">
        <div class="flex items-center justify-between p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-mono">
          <span>Versi Sekarang: <strong>v${updateInfo.currentVersion}</strong></span>
          <span>➜</span>
          <span>Versi Baru: <strong>v${updateInfo.version}</strong></span>
        </div>

        <div class="p-3 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-1.5 max-h-36 overflow-y-auto">
          <div class="font-bold text-zinc-700 dark:text-zinc-300">Catatan Rilis (${updateInfo.tagName}):</div>
          <div class="text-zinc-600 dark:text-zinc-400 leading-relaxed font-sans">${escapedNotes}</div>
        </div>

        <div class="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 flex items-start gap-2">
          <span class="text-base leading-none">🛡️</span>
          <div>
            <strong>Data Anda Tetap Aman:</strong> Pembaruan tidak akan menghapus data toko Anda. Namun untuk perlindungan ekstra, Anda disarankan mengekspor file backup.
          </div>
        </div>

        <div class="text-[11px] text-zinc-500 text-right">
          Ukuran File: ~${sizeMb} MB
        </div>
      </div>
    `,
    showCancelButton: true,
    showDenyButton: Boolean(onNavigateToBackup),
    confirmButtonText: 'Perbarui Sekarang',
    denyButtonText: 'Ekspor Backup Dulu',
    cancelButtonText: 'Nanti',
    denyButtonColor: '#3b82f6',
    reverseButtons: true,
    ...theme,
  });

  if (result.isConfirmed) {
    await startDownloadAndInstall(updateInfo);
  } else if (result.isDenied) {
    if (onNavigateToBackup) {
      onNavigateToBackup();
    }
  } else if (result.isDismissed) {
    // Pengguna memilih "Nanti" -> ingat versi ini agar tidak mengganggu pengecekan otomatis berikutnya
    localStorage.setItem(DISMISSED_VERSION_KEY, updateInfo.version);
  }
}

/**
 * Mulai Download APK dan Luncurkan Installer Paket
 */
export async function startDownloadAndInstall(updateInfo: UpdateInfo): Promise<void> {
  const isNative = Capacitor.isNativePlatform();
  if (!isNative) {
    // Pada browser/PWA, arahkan langsung ke URL download APK
    window.open(updateInfo.downloadUrl, '_blank');
    return;
  }

  // Bersihkan sisa download lama terlebih dahulu
  await cleanupOldUpdateApks();

  const theme = getSwalTheme();
  let isCancelled = false;

  // Dialog Progress Download
  Swal.fire({
    title: 'Mengunduh Pembaruan...',
    html: `
      <div class="space-y-3 text-xs text-left">
        <p class="text-zinc-600 dark:text-zinc-400">
          Sedang mengunduh file <strong>JufaStore.apk</strong> (v${updateInfo.version}). Mohon tidak menutup aplikasi hingga selesai.
        </p>
        
        <div class="w-full bg-zinc-200 dark:bg-zinc-800 rounded-full h-3 overflow-hidden border border-zinc-300 dark:border-zinc-700">
          <div id="swal-update-progress-bar" class="bg-emerald-500 h-full rounded-full transition-all duration-150" style="width: 0%"></div>
        </div>

        <div class="flex items-center justify-between font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
          <span id="swal-update-percent">0%</span>
          <span id="swal-update-bytes">0 MB / ${(updateInfo.apkSize / (1024 * 1024)).toFixed(1)} MB</span>
        </div>
      </div>
    `,
    showConfirmButton: false,
    showCancelButton: true,
    cancelButtonText: 'Batalkan',
    allowOutsideClick: false,
    allowEscapeKey: false,
    ...theme,
  }).then((res) => {
    if (res.isDismissed) {
      isCancelled = true;
      cleanupOldUpdateApks();
    }
  });

  let progressHandle: any = null;

  try {
    // Daftarkan listener progress unduhan
    progressHandle = await Filesystem.addListener('progress', (status) => {
      if (isCancelled) return;
      const total = status.contentLength > 0 ? status.contentLength : updateInfo.apkSize;
      const downloaded = status.bytes || 0;
      const percent = total > 0 ? Math.min(100, Math.round((downloaded / total) * 100)) : 0;

      const barEl = document.getElementById('swal-update-progress-bar');
      const percentEl = document.getElementById('swal-update-percent');
      const bytesEl = document.getElementById('swal-update-bytes');

      if (barEl) barEl.style.width = `${percent}%`;
      if (percentEl) percentEl.innerText = `${percent}%`;
      if (bytesEl) {
        const dMb = (downloaded / (1024 * 1024)).toFixed(1);
        const tMb = (total / (1024 * 1024)).toFixed(1);
        bytesEl.innerText = `${dMb} MB / ${tMb} MB`;
      }
    });

    // Coba resolve URL redirect langsung jika didukung
    let targetDownloadUrl = updateInfo.downloadUrl;
    try {
      const headRes = await fetch(updateInfo.downloadUrl, { method: 'HEAD', redirect: 'follow' });
      if (headRes.url && headRes.url.startsWith('https://')) {
        targetDownloadUrl = headRes.url;
      }
    } catch {
      // Abaikan fallback jika fetch terhalang CORS
    }

    // Jalankan download file ke cache dengan User-Agent eksplisit
    await Filesystem.downloadFile({
      url: targetDownloadUrl,
      path: UPDATE_CACHE_FILENAME,
      directory: Directory.Cache,
      headers: {
        'User-Agent': 'JufaStore-Android-Updater',
        Accept: 'application/vnd.android.package-archive,application/octet-stream,*/*',
      },
      progress: true,
    });

    if (progressHandle) {
      await progressHandle.remove();
      progressHandle = null;
    }

    if (isCancelled) {
      await cleanupOldUpdateApks();
      return;
    }

    // Ambil statistik file yang terunduh
    const fileStat = await Filesystem.stat({
      path: UPDATE_CACHE_FILENAME,
      directory: Directory.Cache,
    });

    // Ambil native URI untuk FileOpener
    const uriResult = await Filesystem.getUri({
      path: UPDATE_CACHE_FILENAME,
      directory: Directory.Cache,
    });

    // Validasi 4-byte header awal (Magic Number APK/ZIP)
    const readFileResult = await Filesystem.readFile({
      path: UPDATE_CACHE_FILENAME,
      directory: Directory.Cache,
    });
    const rawData = typeof readFileResult.data === 'string' ? readFileResult.data : '';
    const headerValidation = verifyApkMagicBytes(rawData);

    // Bangun string informasi diagnostik
    const sizeMb = (fileStat.size / (1024 * 1024)).toFixed(2);
    const expectedMb = (updateInfo.apkSize / (1024 * 1024)).toFixed(2);
    const diagHtml = `
      <div><strong>Nama File:</strong> ${UPDATE_CACHE_FILENAME}</div>
      <div><strong>URI Native:</strong> ${uriResult.uri}</div>
      <div><strong>Ukuran:</strong> ${formatNumber(fileStat.size)} bytes (~${sizeMb} MB) vs Rilis: ${formatNumber(updateInfo.apkSize)} bytes (~${expectedMb} MB)</div>
      <div><strong>Header 4-Byte:</strong> Hex: ${headerValidation.hex || 'N/A'} (ASCII: ${headerValidation.ascii || 'N/A'})</div>
      <div><strong>Ekspektasi Magic:</strong> Hex: 50 4B 03 04 (ASCII: PK\\x03\\x04)</div>
    `;

    // 1. Validasi Integritas Header APK
    if (!headerValidation.isValid) {
      console.error('[UpdateChecker] Validasi header APK gagal:', {
        file: UPDATE_CACHE_FILENAME,
        uri: uriResult.uri,
        statSize: fileStat.size,
        expectedSize: updateInfo.apkSize,
        hex: headerValidation.hex,
        ascii: headerValidation.ascii,
      });

      await cleanupOldUpdateApks();
      Swal.close();

      await Swal.fire({
        icon: 'error',
        title: 'Paket Tidak Valid (Bukan APK)',
        html: `
          <div class="space-y-3 text-xs text-left">
            <p class="text-rose-600 dark:text-rose-400 font-semibold">
              File yang terunduh bukan merupakan paket instalasi Android (APK) yang valid.
            </p>
            <p class="text-zinc-600 dark:text-zinc-400">
              Header file terbaca <strong>${headerValidation.ascii || headerValidation.hex || 'Kosong'}</strong>, bukan header arsip ZIP/APK yang sah (<strong>PK\\x03\\x04</strong>). Hal ini biasanya terjadi jika server pengunduhan merespons dengan halaman error HTML atau koneksi terputus di tengah jalan.
            </p>
            <div class="p-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-[10px] font-mono text-zinc-500 space-y-1">
              <div class="font-bold text-zinc-700 dark:text-zinc-300">Hasil Diagnostik:</div>
              ${diagHtml}
            </div>
            <p class="text-zinc-600 dark:text-zinc-400">
              File rusak telah dibersihkan demi keamanan perangkat. Anda dapat mengunduh rilis resmi langsung melalui browser HP.
            </p>
          </div>
        `,
        showCancelButton: true,
        confirmButtonText: 'Unduh lewat Browser',
        cancelButtonText: 'Tutup',
        ...theme,
      }).then((res) => {
        if (res.isConfirmed) {
          openInSystemBrowser(updateInfo.downloadUrl);
        }
      });
      return;
    }

    // 2. Validasi Ukuran File APK
    if (updateInfo.apkSize > 0 && fileStat.size !== updateInfo.apkSize) {
      console.error('[UpdateChecker] Ukuran file APK tidak cocok:', {
        statSize: fileStat.size,
        expectedSize: updateInfo.apkSize,
      });

      await cleanupOldUpdateApks();
      Swal.close();

      await Swal.fire({
        icon: 'error',
        title: 'Unduhan Tidak Lengkap',
        html: `
          <div class="space-y-3 text-xs text-left">
            <p class="text-zinc-600 dark:text-zinc-400">
              Ukuran file terunduh (${formatNumber(fileStat.size)} bytes) tidak sesuai dengan ukuran rilis resmi (${formatNumber(updateInfo.apkSize)} bytes). File telah dibersihkan.
            </p>
            <div class="p-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-[10px] font-mono text-zinc-500 space-y-1">
              <div class="font-bold text-zinc-700 dark:text-zinc-300">Hasil Diagnostik:</div>
              ${diagHtml}
            </div>
          </div>
        `,
        showCancelButton: true,
        confirmButtonText: 'Unduh lewat Browser',
        cancelButtonText: 'Tutup',
        ...theme,
      }).then((res) => {
        if (res.isConfirmed) {
          openInSystemBrowser(updateInfo.downloadUrl);
        }
      });
      return;
    }

    // 3. Log Diagnostik Lengkap Sukses
    console.info('[UpdateChecker] Validasi APK berhasil 100%:', {
      file: UPDATE_CACHE_FILENAME,
      uri: uriResult.uri,
      size: fileStat.size,
      magicHeader: headerValidation.hex,
    });

    Swal.close();

    // 4. Buka installer paket Android menggunakan FileOpener
    try {
      await FileOpener.open({
        filePath: uriResult.uri,
        contentType: 'application/vnd.android.package-archive',
        openWithDefault: true,
      });
    } catch (openErr: any) {
      console.error('[UpdateChecker] Gagal membuka installer via FileOpener:', openErr);

      await Swal.fire({
        icon: 'warning',
        title: 'Gagal Membuka Penginstal Paket',
        html: `
          <div class="space-y-3 text-xs text-left">
            <p class="text-zinc-600 dark:text-zinc-400">
              File APK telah terunduh dan terverifikasi sah (<strong>PK\\x03\\x04</strong>, ~${sizeMb} MB), namun sistem Android tidak dapat menjalankan penginstal paket otomatis (${openErr?.message || openErr}).
            </p>
            <div class="p-3 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-1.5">
              <div class="font-bold text-zinc-700 dark:text-zinc-300">Solusi Cepat:</div>
              <p class="text-zinc-600 dark:text-zinc-400">
                Tekan tombol <strong>"Unduh lewat Browser"</strong> di bawah untuk mengunduh dan memasang pembaruan langsung dari browser bawaan HP Anda.
              </p>
            </div>
            <div class="p-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-[10px] font-mono text-zinc-500 space-y-1">
              <div class="font-bold text-zinc-700 dark:text-zinc-300">Detail Teknis:</div>
              ${diagHtml}
            </div>
          </div>
        `,
        showCancelButton: true,
        confirmButtonText: 'Unduh lewat Browser',
        cancelButtonText: 'Tutup',
        ...theme,
      }).then((res) => {
        if (res.isConfirmed) {
          openInSystemBrowser(updateInfo.downloadUrl);
        }
      });
    }
  } catch (err: any) {
    if (progressHandle) {
      try {
        await progressHandle.remove();
      } catch {}
    }
    await cleanupOldUpdateApks();

    if (!isCancelled) {
      await Swal.fire({
        icon: 'error',
        title: 'Gagal Mengunduh',
        html: `
          <div class="space-y-3 text-xs text-left">
            <p class="text-zinc-600 dark:text-zinc-400">
              Terjadi kendala jaringan saat mengunduh paket pembaruan (${err?.message || 'Koneksi terputus'}). Anda dapat mengunduh langsung melalui browser.
            </p>
          </div>
        `,
        showCancelButton: true,
        confirmButtonText: 'Unduh lewat Browser',
        cancelButtonText: 'Tutup',
        ...theme,
      }).then((res) => {
        if (res.isConfirmed) {
          openInSystemBrowser(updateInfo.downloadUrl);
        }
      });
    }
  }
}
