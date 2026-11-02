import { describe, it, expect } from 'vitest';
import {
  calculateBackoffSeconds,
  compactQueueOperation,
} from '../services/syncService';
import { sanitizeSettingsForBackup, BackupSchema } from '../services/backupService';
import { GOOGLE_SHEETS_TABLES } from '../utils/googleSheets';

describe('JufaStore - Google Sheets Sync & Backup Service Tests (Release B)', () => {
  describe('1. Pemadatan Antrean (Queue Compaction)', () => {
    it('1.1. Operasi beruntun pada satu entri: upsert diikuti upsert tetap menghasilkan satu upsert terbaru', () => {
      const op = compactQueueOperation('upsert', 'upsert');
      expect(op).toBe('upsert');
    });

    it('1.2. Record dibuat lalu dihapus: upsert diikuti delete menghasilkan delete', () => {
      const op = compactQueueOperation('upsert', 'delete');
      expect(op).toBe('delete');
    });

    it('1.3. Record baru tanpa riwayat sebelumnya menghasilkan operasi baru tersebut', () => {
      expect(compactQueueOperation(undefined, 'upsert')).toBe('upsert');
      expect(compactQueueOperation(undefined, 'delete')).toBe('delete');
    });
  });

  describe('2. Ketahanan Retry & Exponential Backoff', () => {
    it('2.1. Backoff bertambah secara eksponensial berdasarkan retryCount', () => {
      // 2^1 * 10 = 20 detik
      expect(calculateBackoffSeconds(1)).toBe(20);
      // 2^2 * 10 = 40 detik
      expect(calculateBackoffSeconds(2)).toBe(40);
      // 2^3 * 10 = 80 detik
      expect(calculateBackoffSeconds(3)).toBe(80);
      // 2^4 * 10 = 160 detik
      expect(calculateBackoffSeconds(4)).toBe(160);
      // 2^5 * 10 = 320 detik
      expect(calculateBackoffSeconds(5)).toBe(320);
    });

    it('2.2. Backoff memiliki batas atas maksimal (cap) 3600 detik (1 jam)', () => {
      // 2^10 * 10 = 10240 -> dibatasi ke 3600 detik
      expect(calculateBackoffSeconds(10)).toBe(3600);
      expect(calculateBackoffSeconds(20)).toBe(3600);
    });
  });

  describe('3. Keamanan Backup & Restore (Pengecualian Token Kredensial)', () => {
    it('3.1. Ekspor cadangan JSON mengecualikan googleSheetsToken demi keamanan kredensial', () => {
      const rawSettings = [
        {
          id: 'current',
          storeName: 'JufaStore Official',
          theme: 'dark',
          googleSheetsUrl: 'https://script.google.com/macros/s/AKfycbx.../exec',
          googleSheetsToken: 'SECRET_TOKEN_RAHASIA_123',
          autoSyncEnabled: true,
          schemaVersion: 1,
        },
      ];

      const sanitized = sanitizeSettingsForBackup(rawSettings);
      expect(sanitized.length).toBe(1);
      expect(sanitized[0].storeName).toBe('JufaStore Official');
      expect(sanitized[0].googleSheetsUrl).toBe('https://script.google.com/macros/s/AKfycbx.../exec');
      expect(sanitized[0].autoSyncEnabled).toBe(true);

      // Token WAJIB dihapus dari data cadangan
      expect(sanitized[0].googleSheetsToken).toBeUndefined();
      expect('googleSheetsToken' in sanitized[0]).toBe(false);
    });

    it('3.2. BackupSchema memvalidasi payload cadangan yang memiliki status sinkronisasi baru', () => {
      const validBackup = {
        version: 3,
        exportedAt: new Date().toISOString(),
        settings: [
          {
            id: 'current',
            storeName: 'JufaStore',
            lastSyncAt: new Date().toISOString(),
            lastSyncStatus: 'SUCCESS',
            autoSyncEnabled: true,
          },
        ],
        sales: [],
        stockBatches: [],
        cashLedger: [],
      };

      const result = BackupSchema.safeParse(validBackup);
      expect(result.success).toBe(true);
    });
  });

  describe('4. Idempotensi & Struktur Kolom Google Sheets Multi-Sheet', () => {
    it('4.1. Kolom ID unik terdefinisi dengan tepat di setiap tabel', () => {
      // Pada Penjualan, ID adalah kolom B (No Invoice, index 1)
      expect(GOOGLE_SHEETS_TABLES.penjualan.idColumnIndex).toBe(1);
      expect(GOOGLE_SHEETS_TABLES.penjualan.headers[1]).toBe('No Invoice');

      // Pada Stok Batch FIFO, ID adalah kolom A (ID Batch, index 0)
      expect(GOOGLE_SHEETS_TABLES.stokBatches.idColumnIndex).toBe(0);
      expect(GOOGLE_SHEETS_TABLES.stokBatches.headers[0]).toBe('ID Batch');

      // Pada Buku Kas, ID adalah kolom A (ID Transaksi, index 0)
      expect(GOOGLE_SHEETS_TABLES.bukuKas.idColumnIndex).toBe(0);
      expect(GOOGLE_SHEETS_TABLES.bukuKas.headers[0]).toBe('ID Transaksi');

      // Pada Pinjaman Modal, ID adalah kolom A (ID Pinjaman, index 0)
      expect(GOOGLE_SHEETS_TABLES.pinjamanModal.idColumnIndex).toBe(0);
      expect(GOOGLE_SHEETS_TABLES.pinjamanModal.headers[0]).toBe('ID Pinjaman');

      // Pada Investor, ID adalah kolom A (ID Investor, index 0)
      expect(GOOGLE_SHEETS_TABLES.investor.idColumnIndex).toBe(0);
      expect(GOOGLE_SHEETS_TABLES.investor.headers[0]).toBe('ID Investor');

      // Pada Pemakaian Pribadi, ID adalah kolom A (ID Prive, index 0)
      expect(GOOGLE_SHEETS_TABLES.pemakaianPribadi.idColumnIndex).toBe(0);
      expect(GOOGLE_SHEETS_TABLES.pemakaianPribadi.headers[0]).toBe('ID Prive');
    });
  });
});
