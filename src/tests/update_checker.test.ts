import { describe, it, expect } from 'vitest';
import {
  parseSemver,
  compareSemver,
  isNewerVersion,
  findApkAsset,
  GitHubReleaseResponse,
} from '../services/updateChecker';

describe('JufaStore - Auto-Update Service & SemVer Engine Tests', () => {
  // =========================================================================
  // 1. SEMVER PARSING TESTS
  // =========================================================================
  describe('1. SemVer Parsing', () => {
    it('1.1. Menguraikan versi standar dengan atau tanpa awalan "v"', () => {
      expect(parseSemver('v2.1.0')).toEqual([2, 1, 0]);
      expect(parseSemver('2.1.0')).toEqual([2, 1, 0]);
      expect(parseSemver('V1.0.5')).toEqual([1, 0, 5]);
    });

    it('1.2. Menguraikan versi multi-digit (misal: 2.1.10)', () => {
      expect(parseSemver('2.1.10')).toEqual([2, 1, 10]);
      expect(parseSemver('v12.34.56')).toEqual([12, 34, 56]);
    });

    it('1.3. Mengisi komponen patch jika hanya diberikan 2 angka', () => {
      expect(parseSemver('2.1')).toEqual([2, 1, 0]);
      expect(parseSemver('v3')).toEqual([3, 0, 0]);
    });

    it('1.4. Menghapus sufiks prerelease atau metadata build', () => {
      expect(parseSemver('v2.1.0-beta.1')).toEqual([2, 1, 0]);
      expect(parseSemver('2.1.0+build100')).toEqual([2, 1, 0]);
    });

    it('1.5. Menangani input kosong atau tidak valid dengan aman', () => {
      expect(parseSemver('')).toEqual([0, 0, 0]);
      expect(parseSemver('invalid')).toEqual([0, 0, 0]);
    });
  });

  // =========================================================================
  // 2. SEMVER COMPARISON & UPDATE DETECTION TESTS
  // =========================================================================
  describe('2. SemVer Comparison & Update Detection', () => {
    it('2.1. Membandingkan digit patch multi-digit dengan benar (2.1.10 > 2.1.9)', () => {
      // Masalah klasik string sorting: "2.1.9" > "2.1.10" jika dibandingkan secara alfabetikal
      // Namun secara semver numerik: 2.1.10 > 2.1.9
      expect(compareSemver('2.1.10', '2.1.9')).toBe(1);
      expect(compareSemver('2.1.9', '2.1.10')).toBe(-1);
      expect(isNewerVersion('2.1.10', '2.1.9')).toBe(true);
      expect(isNewerVersion('2.1.9', '2.1.10')).toBe(false);
    });

    it('2.2. Mengidentifikasi versi mayor dan minor yang lebih baru', () => {
      expect(compareSemver('3.0.0', '2.99.99')).toBe(1);
      expect(compareSemver('2.2.0', '2.1.99')).toBe(1);
      expect(isNewerVersion('v3.0.0', '2.1.0')).toBe(true);
      expect(isNewerVersion('v2.2.0', '2.1.0')).toBe(true);
    });

    it('2.3. Mengembalikan 0 / false jika versi sama persis', () => {
      expect(compareSemver('v2.1.0', '2.1.0')).toBe(0);
      expect(compareSemver('2.1.0', 'v2.1.0')).toBe(0);
      expect(isNewerVersion('v2.1.0', '2.1.0')).toBe(false);
    });

    it('2.4. Mengembalikan false jika versi remote lebih rendah dari versi terpasang', () => {
      expect(isNewerVersion('v2.0.9', '2.1.0')).toBe(false);
      expect(isNewerVersion('1.9.9', '2.1.0')).toBe(false);
    });
  });

  // =========================================================================
  // 3. GITHUB RELEASE ASSET SELECTION TESTS
  // =========================================================================
  describe('3. GitHub Release Asset Selection (JufaStore.apk)', () => {
    it('3.1. Memilih asset JufaStore.apk dari daftar file rilis GitHub', () => {
      const mockRelease: GitHubReleaseResponse = {
        tag_name: 'v2.1.10',
        name: 'JufaStore v2.1.10 (Rilis Resmi)',
        body: 'Pembaruan otomatis dan perbaikan stabilitas.',
        assets: [
          {
            name: 'source.zip',
            browser_download_url: 'https://github.com/Juanndnich/Jufa-Bussinnes-App/archive/v2.1.10.zip',
            size: 1500000,
          },
          {
            name: 'JufaStore.apk',
            browser_download_url: 'https://github.com/Juanndnich/Jufa-Bussinnes-App/releases/download/v2.1.10/JufaStore.apk',
            size: 6850000,
            content_type: 'application/vnd.android.package-archive',
          },
          {
            name: 'checksums.txt',
            browser_download_url: 'https://github.com/Juanndnich/Jufa-Bussinnes-App/releases/download/v2.1.10/checksums.txt',
            size: 250,
          },
        ],
      };

      const selected = findApkAsset(mockRelease);
      expect(selected).not.toBeNull();
      expect(selected?.name).toBe('JufaStore.apk');
      expect(selected?.size).toBe(6850000);
      expect(selected?.downloadUrl).toBe(
        'https://github.com/Juanndnich/Jufa-Bussinnes-App/releases/download/v2.1.10/JufaStore.apk'
      );
    });

    it('3.2. Case-insensitive matching: menerima "jufastore.apk" atau "JUFASTORE.APK"', () => {
      const mockRelease: GitHubReleaseResponse = {
        tag_name: 'v2.1.10',
        assets: [
          {
            name: 'jufastore.apk',
            browser_download_url: 'https://example.com/jufastore.apk',
            size: 5000000,
          },
        ],
      };

      const selected = findApkAsset(mockRelease);
      expect(selected).not.toBeNull();
      expect(selected?.downloadUrl).toBe('https://example.com/jufastore.apk');
    });

    it('3.3. Mengembalikan null jika asset JufaStore.apk tidak ditemukan dalam rilis', () => {
      const mockReleaseNoApk: GitHubReleaseResponse = {
        tag_name: 'v2.1.10',
        assets: [
          {
            name: 'source-code.zip',
            browser_download_url: 'https://example.com/source.zip',
            size: 1000,
          },
        ],
      };

      expect(findApkAsset(mockReleaseNoApk)).toBeNull();
    });

    it('3.4. Mengembalikan null jika assets kosong atau tidak terdefinisi', () => {
      expect(findApkAsset({ tag_name: 'v2.1.10', assets: [] })).toBeNull();
      expect(findApkAsset({ tag_name: 'v2.1.10' })).toBeNull();
    });
  });

  // =========================================================================
  // 4. END-TO-END MOCK RELEASE SCENARIO
  // =========================================================================
  describe('4. Mock Release Workflow Scenarios', () => {
    it('4.1. Skenario ada rilis baru resmi yang siap diunduh', () => {
      const installedVersion = '2.1.0';
      const latestRelease: GitHubReleaseResponse = {
        tag_name: 'v2.1.1',
        name: 'JufaStore v2.1.1',
        body: '- Peningkatan kalkulator FIFO\n- Perbaikan UI',
        assets: [
          {
            name: 'JufaStore.apk',
            browser_download_url: 'https://github.com/Juanndnich/Jufa-Bussinnes-App/releases/download/v2.1.1/JufaStore.apk',
            size: 7200000,
          },
        ],
      };

      const hasUpdate = isNewerVersion(latestRelease.tag_name, installedVersion);
      const apk = findApkAsset(latestRelease);

      expect(hasUpdate).toBe(true);
      expect(apk).not.toBeNull();
      expect(apk?.size).toBe(7200000);
    });

    it('4.2. Skenario versi rilis sama dengan yang terpasang (tidak ada update)', () => {
      const installedVersion = '2.1.0';
      const latestRelease: GitHubReleaseResponse = {
        tag_name: 'v2.1.0',
        assets: [
          {
            name: 'JufaStore.apk',
            browser_download_url: 'https://example.com/JufaStore.apk',
            size: 7000000,
          },
        ],
      };

      const hasUpdate = isNewerVersion(latestRelease.tag_name, installedVersion);
      expect(hasUpdate).toBe(false);
    });
  });
});
