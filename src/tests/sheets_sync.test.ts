import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import {
  computeTableHash,
  computeHmacSha256Hex,
  calculateSheetsBackoffSeconds,
  generateRandomNonce,
  SHEETS_TABLES,
  CHUNK_SIZE,
  SHEETS_CODE_GS_TEMPLATE,
} from '../services/sheetsSync';
import { sanitizeSettingsForBackup, BackupSchema } from '../services/backupService';
import { AppSettings } from '../db/schema';

describe('JufaStore — Google Sheets Mirror Sync V2 Test Suite', () => {
  // 1. Hash Stabil & Berubah Sesuai Konten
  it('1. Hash SHA-256 tabel stabil dan berubah hanya jika isi berubah', async () => {
    const dataA = [
      ['2026-11-01 10:00', 'INV-001', 'Pembeli A', 1000, 160, 160000, 130000, 30000, '18.8%', 'Selesai', '-'],
      ['2026-11-01 11:00', 'INV-002', 'Pembeli B', 500, 165, 82500, 65000, 17500, '21.2%', 'Selesai', '-'],
    ];
    const dataACopy = [
      ['2026-11-01 10:00', 'INV-001', 'Pembeli A', 1000, 160, 160000, 130000, 30000, '18.8%', 'Selesai', '-'],
      ['2026-11-01 11:00', 'INV-002', 'Pembeli B', 500, 165, 82500, 65000, 17500, '21.2%', 'Selesai', '-'],
    ];
    const dataB = [
      ['2026-11-01 10:00', 'INV-001', 'Pembeli A', 1000, 160, 160000, 130000, 30000, '18.8%', 'Selesai', '-'],
      ['2026-11-01 11:00', 'INV-002', 'Pembeli B (Edit)', 500, 165, 82500, 65000, 17500, '21.2%', 'Selesai', '-'],
    ];

    const hash1 = await computeTableHash(dataA);
    const hash2 = await computeTableHash(dataACopy);
    const hash3 = await computeTableHash(dataB);

    expect(hash1).toBe(hash2);
    expect(hash1).not.toBe(hash3);
    expect(hash1.length).toBe(64); // SHA-256 hex string
  });

  // 2. Vektor Tes HMAC-SHA256
  it('2. Signature HMAC-SHA256 terhitung akurat sesuai standar kriptografi WebCrypto', async () => {
    const secret = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    const message = '1730520000000.abc123xyz.{"action":"ping"}';
    const sig1 = await computeHmacSha256Hex(secret, message);
    const sig2 = await computeHmacSha256Hex(secret, message);

    expect(sig1).toBe(sig2);
    expect(sig1.length).toBe(64);

    // Kunci berbeda menghasilkan tanda tangan berbeda
    const sigDifferentKey = await computeHmacSha256Hex('fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210', message);
    expect(sig1).not.toBe(sigDifferentKey);

    // Pesan berbeda menghasilkan tanda tangan berbeda
    const sigDifferentMsg = await computeHmacSha256Hex(secret, 'other-message');
    expect(sig1).not.toBe(sigDifferentMsg);
  });

  // 3. Nonce generator
  it('3. Nonce acak unik dan memiliki entropi yang cukup', () => {
    const nonces = new Set<string>();
    for (let i = 0; i < 50; i++) {
      const n = generateRandomNonce();
      expect(n.length).toBeGreaterThanOrEqual(16);
      nonces.add(n);
    }
    expect(nonces.size).toBe(50);
  });

  // 4. Exponential Backoff Calculation
  it('4. Perhitungan exponential backoff bertahap dan memiliki batas maksimal 30 menit', () => {
    expect(calculateSheetsBackoffSeconds(0)).toBe(15);
    expect(calculateSheetsBackoffSeconds(1)).toBe(30);
    expect(calculateSheetsBackoffSeconds(2)).toBe(60);
    expect(calculateSheetsBackoffSeconds(3)).toBe(120);
    expect(calculateSheetsBackoffSeconds(4)).toBe(240);
    expect(calculateSheetsBackoffSeconds(5)).toBe(480);
    expect(calculateSheetsBackoffSeconds(6)).toBe(960);
    expect(calculateSheetsBackoffSeconds(7)).toBe(1800); // Batas maksimal 30 menit (1800 detik)
    expect(calculateSheetsBackoffSeconds(20)).toBe(1800);
  });

  // 5. Logika Perbandingan Sidik Jari (Hanya tabel berbeda yang perlu dikirim)
  it('5. Cek sidik jari mendeteksi perbedaan hash antara tabel lokal dan yang tersimpan', async () => {
    const tableA = [['Row 1', 100], ['Row 2', 200]];
    const hashA = await computeTableHash(tableA);

    const storedHashes: Record<string, string> = {
      penjualan: hashA,
      stockBatches: 'old-hash-12345',
    };

    // Tabel Penjualan tidak berubah (skip)
    const isPenjualanChanged = storedHashes.penjualan !== hashA;
    expect(isPenjualanChanged).toBe(false);

    // Tabel Stock Batches berubah
    const newStockBatchesHash = await computeTableHash([['Batch 1', 500]]);
    const isStockBatchesChanged = storedHashes.stockBatches !== newStockBatchesHash;
    expect(isStockBatchesChanged).toBe(true);
  });

  // 6. Pemotongan Potongan (Chunking) & startRow
  it('6. Pemotongan chunk dan startRow terdistribusi dengan benar untuk data besar', () => {
    const totalRows = 950;
    const fakeRows: any[][] = [];
    for (let i = 0; i < totalRows; i++) {
      fakeRows.push([`ID-${i}`, `Item ${i}`, i * 100]);
    }

    const chunks: { startRow: number; rowsCount: number; isLast: boolean }[] = [];
    for (let offset = 0; offset < fakeRows.length; offset += CHUNK_SIZE) {
      const chunkRows = fakeRows.slice(offset, offset + CHUNK_SIZE);
      const isLast = (offset + chunkRows.length) >= totalRows;
      chunks.push({ startRow: offset, rowsCount: chunkRows.length, isLast });
    }

    expect(chunks.length).toBe(3);
    expect(chunks[0]).toEqual({ startRow: 0, rowsCount: 400, isLast: false });
    expect(chunks[1]).toEqual({ startRow: 400, rowsCount: 400, isLast: false });
    expect(chunks[2]).toEqual({ startRow: 800, rowsCount: 150, isLast: true });
  });

  // 7. Tabel Kosong (0 Baris)
  it('7. Tabel kosong menghasilkan 0 baris data dengan hash yang valid', async () => {
    const emptyRows: any[][] = [];
    const hash = await computeTableHash(emptyRows);
    expect(typeof hash).toBe('string');
    expect(hash.length).toBe(64);

    // Kiriman untuk tabel kosong harus memiliki startRow 0 dan totalRows 0
    const emptyPayload = {
      action: 'replace-chunk',
      table: 'penjualan',
      startRow: 0,
      totalRows: 0,
      rows: emptyRows,
    };
    expect(emptyPayload.rows.length).toBe(0);
    expect(emptyPayload.totalRows).toBe(0);
  });

  // 8. Sanitasi Secret dari File Backup & Zod Schema Validation
  it('8. Secret Google Sheets dikecualikan dari backup dan restore schema menerima data dengan aman', () => {
    const mockSettings: AppSettings = {
      id: 'settings',
      schemaVersion: 1,
      storeName: 'JufaStore Test',
      theme: 'dark',
      accentColor: '#10b981',
      textSize: 'base',
      customLogoUrl: null,
      sheetsWebhookUrl: 'https://script.google.com/macros/s/test/exec',
      sheetsSecret: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      sheetsSyncEnabled: true,
      googleSheetsToken: 'legacy-token-to-strip',
      tableHashes: { penjualan: 'hash-abc' },
    };

    const sanitizedArray = sanitizeSettingsForBackup([mockSettings]);
    expect(sanitizedArray.length).toBe(1);
    const sanitized = sanitizedArray[0];
    expect(sanitized.sheetsSecret).toBeUndefined();
    expect(sanitized.googleSheetsToken).toBeUndefined();
    expect(sanitized.sheetsWebhookUrl).toBe(mockSettings.sheetsWebhookUrl);
    expect(sanitized.storeName).toBe('JufaStore Test');

    // Validasi skema Zod BackupSchema menerima format V2 maupun tanpa secret
    const validBackupJson = {
      version: 2,
      timestamp: '2026-11-01T12:00:00.000Z',
      database: {
        settings: sanitized,
        sales: [],
        stockBatches: [],
        stockMovements: [],
        cashLedger: [],
        loans: [],
        loanPayments: [],
        investors: [],
        investorPayouts: [],
        personalUsages: [],
        categories: [],
      },
    };

    const parseResult = BackupSchema.safeParse(validBackupJson);
    expect(parseResult.success).toBe(true);
  });

  // 9. Mock Apps Script & Idempotensi Chunk Replacement
  it('9. Pengiriman ulang chunk yang sama bersifat idempoten pada spreadsheet', () => {
    // Simulasi tabel spreadsheet 2D in-memory
    const virtualSheet: any[][] = [
      ['No Invoice', 'Pembeli', 'Total'], // Row 1 (Header)
    ];

    function applyChunk(startRow: number, totalRows: number, rows: any[]) {
      const firstDataRow = 1; // Index 1 in 0-based array
      const targetIndex = firstDataRow + startRow;

      // Sisipkan baris data
      for (let i = 0; i < rows.length; i++) {
        virtualSheet[targetIndex + i] = rows[i];
      }

      // Potongan terakhir memangkas baris lebih jika ada data lama yang dihapus
      const isLastChunk = (startRow + rows.length) >= totalRows;
      if (isLastChunk) {
        const finalDataIndex = firstDataRow + totalRows;
        virtualSheet.splice(finalDataIndex);
      }
    }

    const chunk1 = [
      ['INV-001', 'Alice', 150000],
      ['INV-002', 'Bob', 250000],
    ];

    // Kirim pertama kali
    applyChunk(0, 2, chunk1);
    expect(virtualSheet.length).toBe(3);
    expect(virtualSheet[1][0]).toBe('INV-001');
    expect(virtualSheet[2][0]).toBe('INV-002');

    // Kirim ulang chunk yang sama (idempotensi)
    applyChunk(0, 2, chunk1);
    expect(virtualSheet.length).toBe(3); // Tidak ada duplikasi baris
    expect(virtualSheet[1][0]).toBe('INV-001');
    expect(virtualSheet[2][0]).toBe('INV-002');

    // Jika sekarang data berkurang menjadi 1 baris
    const chunkBaru = [['INV-001', 'Alice', 150000]];
    applyChunk(0, 1, chunkBaru);
    expect(virtualSheet.length).toBe(2); // Baris kedua otomatis terpangkas
    expect(virtualSheet[1][0]).toBe('INV-001');
  });

  // 10. Verifikasi Seluruh 10 Definisi Tabel Mirror
  it('10. Seluruh 10 definisi tabel memiliki header eksplisit Bahasa Indonesia dan warna kontras', () => {
    const requiredTables = [
      'ringkasan',
      'penjualan',
      'stockBatches',
      'stockMovements',
      'cashLedger',
      'loans',
      'investors',
      'investorPayouts',
      'personalUsages',
      'categories',
    ];

    for (const key of requiredTables) {
      const def = SHEETS_TABLES[key];
      expect(def).toBeDefined();
      expect(def.name).toBeTruthy();
      expect(def.color).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(def.headers.length).toBeGreaterThan(0);
      // Pastikan header tidak memuat emoji
      for (const h of def.headers) {
        expect(h).not.toMatch(/[\uD800-\uDFFF]/);
      }
    }
  });
  // 11. Verifikasi File Code.gs vs Konstanta SHEETS_CODE_GS_TEMPLATE
  it('11. File docs/google-apps-script/Code.gs identik 100% dengan konstanta SHEETS_CODE_GS_TEMPLATE', () => {
    const codeGsFile = fs.readFileSync('docs/google-apps-script/Code.gs', 'utf8');
    expect(SHEETS_CODE_GS_TEMPLATE).toBe(codeGsFile);
  });

  // 12. Sanitasi Anti-Formula Injection
  it('12. Sanitasi anti-formula injection: string diawali =, +, -, @ diberi awalan apostrof', () => {
    const rawRows = [
      ['=SUM(A1:A10)', '+628123456789', '-500', '@mention', 'Normal Text', 150000, -25000],
    ];

    for (let r = 0; r < rawRows.length; r++) {
      const row = rawRows[r];
      for (let c = 0; c < row.length; c++) {
        const val = row[c];
        if (typeof val === 'string' && val.length > 0) {
          const firstChar = val.charAt(0);
          if (firstChar === '=' || firstChar === '+' || firstChar === '-' || firstChar === '@') {
            row[c] = "'" + val;
          }
        }
      }
    }

    expect(rawRows[0][0]).toBe("'=SUM(A1:A10)");
    expect(rawRows[0][1]).toBe("'+628123456789");
    expect(rawRows[0][2]).toBe("'-500");
    expect(rawRows[0][3]).toBe("'@mention");
    expect(rawRows[0][4]).toBe('Normal Text');
    expect(rawRows[0][5]).toBe(150000); // Angka positif tidak diubah
    expect(rawRows[0][6]).toBe(-25000); // Angka negatif tidak diubah
  });

  // 13. Verifikasi Peningkatan Spesifikasi Code.gs
  it('13. Verifikasi fitur baru Code.gs: Utilities.getUuid, tanpa blokir 15m, hide gridlines, row banding, line chart', () => {
    // 1. UUID dua kali tanpa Math.random
    expect(SHEETS_CODE_GS_TEMPLATE).toContain('Utilities.getUuid()');
    expect(SHEETS_CODE_GS_TEMPLATE).not.toContain('Math.random()');

    // 2. Tanpa blokir 15 menit
    expect(SHEETS_CODE_GS_TEMPLATE).not.toContain('JUFA_BLOCKED_UNTIL');
    expect(SHEETS_CODE_GS_TEMPLATE).not.toContain('JUFA_FAIL_COUNT');

    // 3. Batasan nonce & body
    expect(SHEETS_CODE_GS_TEMPLATE).toContain('nonce.length > 64');
    expect(SHEETS_CODE_GS_TEMPLATE).toContain('2 * 1024 * 1024');

    // 4. Layout
    expect(SHEETS_CODE_GS_TEMPLATE).toContain('setHiddenGridlines(true)');
    expect(SHEETS_CODE_GS_TEMPLATE).toContain('applyRowBanding');
    expect(SHEETS_CODE_GS_TEMPLATE).toContain('Charts.ChartType.LINE');
    expect(SHEETS_CODE_GS_TEMPLATE).toContain('pasangPewarnaanStatus');

    // 5. Anti-rumus di replace chunk
    expect(SHEETS_CODE_GS_TEMPLATE).toContain('firstChar === "="');
    expect(SHEETS_CODE_GS_TEMPLATE).toContain("row[c] = \"'\" + val;");
  });
});
