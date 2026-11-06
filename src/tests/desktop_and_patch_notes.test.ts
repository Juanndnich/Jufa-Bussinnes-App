import { describe, it, expect, vi } from 'vitest';
import {
  CURRENT_APP_VERSION,
  CURRENT_PATCH_NOTE,
  UPCOMING_ROADMAP,
  HISTORICAL_PATCH_NOTES,
} from '../domain/patchNotes';
import {
  getCurrentPlatform,
  getPlatformLabel,
  isNativeAndroid,
  isTauriDesktop,
} from '../utils/platform';
import {
  findDesktopAsset,
  findApkAsset,
  TARGET_EXE_NAME,
  TARGET_APK_NAME,
  GitHubReleaseResponse,
  getInstalledVersion,
  isNewerVersion,
} from '../services/updateChecker';

describe('JufaStore - Desktop Support & Patch Notes Integrity Tests', () => {
  // =========================================================================
  // 1. PATCH NOTES & CHANGELOG STRUCTURE
  // =========================================================================
  describe('1. Struktur Catatan Pembaruan (Play Store Style)', () => {
    it('1.1. Versi saat ini harus valid SemVer dan berformat v2.1.29', () => {
      expect(CURRENT_APP_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
      expect(CURRENT_PATCH_NOTE.version).toBe(CURRENT_APP_VERSION);
    });

    it('1.2. Catatan rilis versi saat ini memiliki judul, ringkasan, dan sorotan utama', () => {
      expect(CURRENT_PATCH_NOTE.title).toBeTruthy();
      expect(CURRENT_PATCH_NOTE.summary).toBeTruthy();
      expect(CURRENT_PATCH_NOTE.highlights.length).toBeGreaterThanOrEqual(3);
      expect(CURRENT_PATCH_NOTE.categories.length).toBeGreaterThanOrEqual(2);
    });

    it('1.3. Setiap kategori pada patch note memiliki nama kategori dan item terperinci', () => {
      for (const cat of CURRENT_PATCH_NOTE.categories) {
        expect(cat.categoryName).toBeTruthy();
        expect(cat.items.length).toBeGreaterThan(0);
        for (const item of cat.items) {
          expect(typeof item).toBe('string');
          expect(item.trim().length).toBeGreaterThan(5);
        }
      }
    });

    it('1.4. Peta jalan pembaruan mendatang (upcoming roadmap) terisi lengkap dengan status valid', () => {
      expect(UPCOMING_ROADMAP.length).toBeGreaterThan(0);
      const validStatuses = ['Dalam Pengerjaan', 'Direncanakan', 'Eksplorasi'];
      for (const item of UPCOMING_ROADMAP) {
        expect(item.id).toBeTruthy();
        expect(item.title).toBeTruthy();
        expect(validStatuses).toContain(item.status);
        expect(item.targetVersion).toMatch(/^v\d+\.\d+\.\d+$/);
        expect(item.description).toBeTruthy();
        expect(item.benefits.length).toBeGreaterThan(0);
      }
    });

    it('1.5. Riwayat rilis terdahulu berisi versi v2.1.28, v2.1.27, v2.1.26, dst', () => {
      expect(HISTORICAL_PATCH_NOTES.length).toBeGreaterThanOrEqual(4);
      const versions = HISTORICAL_PATCH_NOTES.map((h) => h.version);
      expect(versions).toContain('2.1.28');
      expect(versions).toContain('2.1.27');
      expect(versions).toContain('2.1.26');
      expect(versions).toContain('2.1.25');
    });
  });

  // =========================================================================
  // 2. PLATFORM DETECTION & LABELS
  // =========================================================================
  describe('2. Deteksi Platform Lintas Perangkat', () => {
    it('2.1. Mengembalikan label platform yang ramah pengguna untuk UI', () => {
      const label = getPlatformLabel();
      expect(typeof label).toBe('string');
      expect(label.length).toBeGreaterThan(3);
    });

    it('2.2. Deteksi tauri desktop bernilai false di lingkungan non-tauri default', () => {
      expect(isTauriDesktop()).toBe(false);
    });

    it('2.3. Mendeteksi desktop tauri jika window.__TAURI_INTERNALS__ ada', () => {
      const originalWindow = (globalThis as any).window;
      (globalThis as any).window = { __TAURI_INTERNALS__: {} };
      expect(isTauriDesktop()).toBe(true);
      expect(getCurrentPlatform()).toBe('desktop');
      expect(getPlatformLabel()).toBe('Windows PC (Desktop Native)');
      if (originalWindow === undefined) {
        delete (globalThis as any).window;
      } else {
        (globalThis as any).window = originalWindow;
      }
    });
  });

  // =========================================================================
  // 3. DESKTOP ASSET RESOLUTION & UPDATE COMPATIBILITY
  // =========================================================================
  describe('3. Resolusi Asset Update Multi-Platform', () => {
    it('3.1. TARGET_EXE_NAME terkunci pada JufaStore-Setup.exe', () => {
      expect(TARGET_EXE_NAME).toBe('JufaStore-Setup.exe');
      expect(TARGET_APK_NAME).toBe('JufaStore.apk');
    });

    it('3.2. Menemukan asset installer .exe dari respons GitHub Release', () => {
      const mockRelease: GitHubReleaseResponse = {
        tag_name: 'v2.1.29',
        assets: [
          {
            name: 'JufaStore.apk',
            browser_download_url: 'https://github.com/.../JufaStore.apk',
            size: 9200000,
          },
          {
            name: 'JufaStore-Setup.exe',
            browser_download_url: 'https://github.com/.../JufaStore-Setup.exe',
            size: 5300000,
          },
        ],
      };

      const apkAsset = findApkAsset(mockRelease);
      expect(apkAsset?.name).toBe('JufaStore.apk');

      const desktopAsset = findDesktopAsset(mockRelease);
      expect(desktopAsset?.name).toBe('JufaStore-Setup.exe');
      expect(desktopAsset?.downloadUrl).toBe('https://github.com/.../JufaStore-Setup.exe');
      expect(desktopAsset?.size).toBe(5300000);
    });

    it('3.3. Menemukan asset .exe dengan huruf besar/kecil bervariasi atau prefiks', () => {
      const mockRelease: GitHubReleaseResponse = {
        tag_name: 'v2.1.29',
        assets: [
          {
            name: 'jufastore_2.1.29_x64-setup.exe',
            browser_download_url: 'https://github.com/.../jufastore_setup.exe',
            size: 5100000,
          },
        ],
      };

      const desktopAsset = findDesktopAsset(mockRelease);
      expect(desktopAsset).not.toBeNull();
      expect(desktopAsset?.name).toBe('jufastore_2.1.29_x64-setup.exe');
    });

    it('3.4. Mengembalikan null jika respons GitHub Release tidak memiliki asset .exe', () => {
      const mockRelease: GitHubReleaseResponse = {
        tag_name: 'v2.1.29',
        assets: [
          {
            name: 'JufaStore.apk',
            browser_download_url: 'https://github.com/.../JufaStore.apk',
            size: 9200000,
          },
        ],
      };

      expect(findDesktopAsset(mockRelease)).toBeNull();
    });

    it('3.5. getInstalledVersion mengembalikan CURRENT_APP_VERSION di lingkungan non-native', async () => {
      const version = await getInstalledVersion();
      expect(version).toBe(CURRENT_APP_VERSION);
    });

    it('3.6. SemVer comparison mendeteksi versi lebih baru dengan tepat', () => {
      expect(isNewerVersion('2.1.30', CURRENT_APP_VERSION)).toBe(true);
      expect(isNewerVersion('2.1.29', CURRENT_APP_VERSION)).toBe(false);
      expect(isNewerVersion('2.1.28', CURRENT_APP_VERSION)).toBe(false);
    });
  });
});
