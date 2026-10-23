import Swal from 'sweetalert2';
import { showToast, cleanupSwalLocks } from '../utils/alert';

const GITHUB_REPO = 'Juanndnich/Jufa-Bussinnes-App';
const LATEST_RELEASE_API = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;
export const APK_DOWNLOAD_URL = `https://github.com/${GITHUB_REPO}/releases/latest/download/JUFA-STORE.apk`;

export interface UpdateInfo {
  available: boolean;
  tagName: string;
  releaseDate: string;
  downloadUrl: string;
  notes: string;
}

/**
 * Check if a newer release exists on GitHub
 */
export async function checkAppUpdate(manual: boolean = false): Promise<UpdateInfo | null> {
  try {
    const res = await fetch(LATEST_RELEASE_API, {
      headers: {
        Accept: 'application/vnd.github.v3+json',
      },
      cache: 'no-cache',
    });

    if (!res.ok) {
      if (manual) {
        if (res.status === 404) {
          showToast('Repositori belum memiliki rilis atau masih disetel Private (harus Public).', 'warning');
        } else {
          showToast(`Gagal memeriksa update (HTTP ${res.status})`, 'warning');
        }
      }
      return null;
    }

    const data = await res.json();
    const publishedAt = data.published_at || data.created_at || '';
    const lastInstalled = localStorage.getItem('jufa_last_installed_release_date') || '';

    // Check if new release has a newer timestamp or different ID
    const lastReleaseId = localStorage.getItem('jufa_last_release_id');
    const isNewer = !lastReleaseId || (data.id && String(data.id) !== lastReleaseId);

    const updateInfo: UpdateInfo = {
      available: isNewer,
      tagName: data.tag_name || 'Terbaru',
      releaseDate: publishedAt ? new Date(publishedAt).toLocaleDateString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : '',
      downloadUrl: APK_DOWNLOAD_URL,
      notes: data.body || 'Pembaruan otomatis dari GitHub Actions.',
    };

    if (manual && !isNewer) {
      showToast('Aplikasi sudah versi paling baru!', 'success');
      return updateInfo;
    }

    if (isNewer) {
      showUpdateDialog(updateInfo, data.id);
    }

    return updateInfo;
  } catch (err: any) {
    if (manual) {
      showToast('Tidak dapat terhubung ke server update', 'warning');
    }
    return null;
  }
}

/**
 * Display clean in-app update prompt with direct 1-tap download
 */
export function showUpdateDialog(info: UpdateInfo, releaseId?: number): void {
  cleanupSwalLocks();

  Swal.fire({
    title: '🚀 Pembaruan Tersedia!',
    html: `
      <div style="text-align: left; font-size: 13px; line-height: 1.6;">
        <div style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 12px; margin-bottom: 12px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
            <span style="opacity: 0.7;">Versi Rilis:</span>
            <strong style="color: #38bdf8;">${info.tagName}</strong>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
            <span style="opacity: 0.7;">Waktu Rilis:</span>
            <span>${info.releaseDate || 'Baru saja'}</span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span style="opacity: 0.7;">Format:</span>
            <span style="font-family: monospace; color: #34d399;">JUFA-STORE.apk</span>
          </div>
        </div>
        <p style="opacity: 0.8; font-size: 12px; margin: 0;">
          Tekan tombol di bawah untuk langsung mengunduh dan memperbarui aplikasi di HP Anda tanpa kehilangan data transaksi lama.
        </p>
      </div>
    `,
    icon: 'info',
    showCancelButton: true,
    confirmButtonText: '📥 Unduh & Pasang APK',
    cancelButtonText: 'Nanti Saja',
    confirmButtonColor: '#22c55e',
    didClose: () => cleanupSwalLocks(),
  }).then(result => {
    if (result.isConfirmed) {
      if (releaseId) {
        localStorage.setItem('jufa_last_release_id', String(releaseId));
      }
      localStorage.setItem('jufa_last_installed_release_date', new Date().toISOString());
      window.open(APK_DOWNLOAD_URL, '_system');
    }
    cleanupSwalLocks();
  });
}
