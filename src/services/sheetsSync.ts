/**
 * JufaStore — Google Sheets Mirror Sync Service (V2)
 * Cermin Per Tabel (Satu Arah: Dexie Aplikasi -> Google Sheets)
 * Fitur:
 * - 9 Tabel Bisnis Lengkap + 1 Sheet Ringkasan Dasbor
 * - Sidik Jari (Hash SHA-256) per tabel: hanya tabel yang berubah yang dikirim
 * - Pengiriman Berpotongan (Chunked ~400 baris) dengan startRow eksplisit (idempoten)
 * - Tanda Tangan Digital HMAC-SHA256 (Secret tidak pernah dikirim lewat jaringan)
 * - Dukungan CapacitorHttp di Android (Bebas CORS & Otomatis Ikuti Redirect 302)
 * - Pemicu Reaktif: Dexie hooks, kembali online, startup, polling 10 menit
 */

import { Capacitor } from '@capacitor/core';
import { CapacitorHttp } from '@capacitor/core';
import { db } from '../db/db';
import { repository } from '../db/repository';
import { AppSettings, Sale, StockBatch, StockMovement, CashLedgerEntry, Loan, Investor, InvestorPayout, PersonalUsage, Category } from '../db/schema';
import { subscribeOnBackOnline, verifyRealInternet } from '../hooks/useNetworkStatus';

// ============================================================================
// 1. DEFINISI TUNGGAL TABEL & KOLOM RESMI (SINGLE SOURCE OF TRUTH)
// ============================================================================

export interface TableDefinition {
  id: string;
  name: string; // Nama Sheet di Google Spreadsheet
  color: string;
  headers: string[];
}

export const SHEETS_TABLES: Record<string, TableDefinition> = {
  ringkasan: {
    id: 'ringkasan',
    name: 'Ringkasan',
    color: '#059669',
    headers: ['Metrik KPI', 'Nilai', 'Keterangan', 'Waktu Pembaruan'],
  },
  penjualan: {
    id: 'penjualan',
    name: 'Penjualan',
    color: '#10b981',
    headers: [
      'Waktu (WIB)',
      'No Invoice',
      'Nama Pembeli',
      'Jumlah Robux (R$)',
      'Rate Jual (Rp)',
      'Total Omzet (Rp)',
      'Modal HPP (Rp)',
      'Laba Kotor (Rp)',
      'Margin',
      'Status Transaksi',
      'Catatan',
    ],
  },
  stockBatches: {
    id: 'stockBatches',
    name: 'Batch_Stok',
    color: '#d97706',
    headers: [
      'ID Batch',
      'Waktu Masuk (WIB)',
      'Sumber Stok',
      'Sumber Dana',
      'Robux Awal (R$)',
      'Sisa Robux (R$)',
      'Total Modal Beli (Rp)',
      'Modal per Robux (Rp)',
      'Sisa Nilai Modal (Rp)',
      'Status Batch',
      'Catatan',
    ],
  },
  stockMovements: {
    id: 'stockMovements',
    name: 'Mutasi_Stok',
    color: '#f59e0b',
    headers: [
      'ID Mutasi',
      'ID Batch',
      'Waktu (WIB)',
      'Jenis Mutasi',
      'Jumlah Robux (R$)',
      'Alokasi Modal (Rp)',
      'Sisa Robux Setelah Mutasi',
      'Referensi Transaksi',
      'Catatan',
    ],
  },
  cashLedger: {
    id: 'cashLedger',
    name: 'Buku_Kas',
    color: '#0284c7',
    headers: [
      'ID Transaksi',
      'Tanggal (WIB)',
      'Waktu Lengkap',
      'Arus Kas',
      'Kategori / Sumber',
      'Nominal (Rp)',
      'Keterangan',
    ],
  },
  loans: {
    id: 'loans',
    name: 'Pinjaman',
    color: '#7c3aed',
    headers: [
      'ID Pinjaman',
      'Tanggal Pinjam (WIB)',
      'Pemberi Pinjaman / Kreditor',
      'Pokok Utang (Rp)',
      'Sisa Utang (Rp)',
      'Total Terbayar (Rp)',
      'Jatuh Tempo',
      'Status Pinjaman',
      'Catatan',
    ],
  },
  investors: {
    id: 'investors',
    name: 'Investor',
    color: '#4f46e5',
    headers: [
      'ID Investor',
      'Nama Investor',
      'Modal Disetor (Rp)',
      'Porsi Bagi Hasil (%)',
      'Tanggal Bergabung',
      'Status Investor',
      'Catatan',
    ],
  },
  investorPayouts: {
    id: 'investorPayouts',
    name: 'Pembayaran_Investor',
    color: '#6366f1',
    headers: [
      'ID Pembayaran',
      'ID Investor',
      'Nama Investor',
      'Waktu Pembayaran (WIB)',
      'Nominal Dividen (Rp)',
      'Catatan Periode',
    ],
  },
  personalUsages: {
    id: 'personalUsages',
    name: 'Pemakaian_Pribadi',
    color: '#e11d48',
    headers: [
      'ID Prive',
      'Waktu Pengambilan (WIB)',
      'Robux Diambil (R$)',
      'Nilai Modal HPP (Rp)',
      'Modal per Robux (Rp)',
      'Keperluan / Catatan',
    ],
  },
  categories: {
    id: 'categories',
    name: 'Kategori',
    color: '#64748b',
    headers: [
      'ID Kategori',
      'Nama Kategori',
      'Jenis Kategori',
      'Waktu Dibuat (WIB)',
    ],
  },
};

export const CHUNK_SIZE = 400;

// ============================================================================
// 2. HELPER FORMATTER & KRIPTOGRAFI
// ============================================================================

/**
 * Format tanggal zona waktu Jakarta (WIB): yyyy-mm-dd hh:mm
 */
export function formatJakartaYmdHm(dateStr: string | Date | undefined): string {
  if (!dateStr) return '-';
  try {
    const d = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
    if (isNaN(d.getTime())) return '-';
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    return formatter.format(d).replace(',', '');
  } catch {
    return '-';
  }
}

/**
 * Hitung hash SHA-256 string (64 karakter hex) dari baris data yang telah diurutkan stabil
 */
export async function computeTableHash(rows: any[][]): Promise<string> {
  const jsonStr = JSON.stringify(rows);
  const enc = new TextEncoder();
  const data = enc.encode(jsonStr);

  if (typeof crypto !== 'undefined' && crypto.subtle && crypto.subtle.digest) {
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  // Fallback sederhana deterministik jika subtle crypto tidak tersedia
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < jsonStr.length; i++) {
    const ch = jsonStr.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0');
}

/**
 * Hitung HMAC-SHA256 signature secara aman dengan crypto.subtle
 */
export async function computeHmacSha256Hex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret.trim()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Buat nonce unik acak berukuran 16 byte (32 karakter hex)
 */
export function generateRandomNonce(): string {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const arr = new Uint8Array(16);
    crypto.getRandomValues(arr);
    return Array.from(arr).map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

/**
 * Algoritma exponential backoff kegagalan (2^retryCount * 15 detik, batas 30 menit)
 */
export function calculateSheetsBackoffSeconds(retryCount: number): number {
  return Math.min(1800, Math.pow(2, Math.min(retryCount, 10)) * 15);
}

// ============================================================================
// 3. PENGIRIMAN HTTP TANDATANGAN DIGITAL (CAPACITOR NATIVE & WEB)
// ============================================================================

export interface SignedRequestResponse {
  ok: boolean;
  data?: any;
  error?: string;
}

export async function sendSignedSheetsRequest(
  url: string,
  secret: string,
  bodyObj: any
): Promise<SignedRequestResponse> {
  const cleanUrl = url.trim();
  const cleanSecret = secret.trim();

  if (!cleanUrl) {
    return { ok: false, error: 'URL Web App Google Apps Script belum diisi.' };
  }
  if (!cleanSecret) {
    return { ok: false, error: 'Kode Rahasia (Secret) Google Apps Script belum diisi.' };
  }

  const timestamp = Date.now();
  const nonce = generateRandomNonce();
  const bodyString = JSON.stringify(bodyObj);

  let signature: string;
  try {
    signature = await computeHmacSha256Hex(cleanSecret, `${timestamp}.${nonce}.${bodyString}`);
  } catch (sigErr: unknown) {
    const msg = sigErr instanceof Error ? sigErr.message : 'Gagal menghasilkan tanda tangan HMAC';
    return { ok: false, error: `Kriptografi gagal: ${msg}` };
  }

  const payloadWrapper = {
    timestamp,
    nonce,
    signature,
    body: bodyString,
  };

  const payloadJson = JSON.stringify(payloadWrapper);

  try {
    let responseText = '';
    let status = 0;

    // A. DI ANDROID NATIVE: Gunakan CapacitorHttp (Bebas CORS, otomatis ikuti redirect 302 Apps Script)
    if (Capacitor.isNativePlatform()) {
      const capRes = await CapacitorHttp.request({
        method: 'POST',
        url: cleanUrl,
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        data: payloadJson,
        connectTimeout: 20000,
        readTimeout: 45000,
      });
      status = capRes.status;
      responseText = typeof capRes.data === 'string' ? capRes.data : JSON.stringify(capRes.data);
    } else {
      // B. DI BROWSER / WEB: Gunakan fetch dengan redirect 'follow'
      const res = await fetch(cleanUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: payloadJson,
        redirect: 'follow',
      });
      status = res.status;
      responseText = await res.text();
    }

    // Deteksi halaman HTML (biasanya halaman login Google Accounts jika akses deployment bukan 'Anyone', atau 404/500)
    const trimmed = responseText.trim();
    if (trimmed.startsWith('<!DOCTYPE html') || trimmed.startsWith('<html') || trimmed.includes('<body')) {
      return {
        ok: false,
        error:
          'Akses ditolak oleh Google. Pastikan Web App di-deploy dengan pengaturan "Who has access: Anyone" (Siapa saja) dan jalankan fungsi setup() terlebih dahulu.',
      };
    }

    let json: any = null;
    try {
      json = JSON.parse(trimmed);
    } catch {
      return {
        ok: false,
        error: `Format balasan dari server Google tidak valid (Status HTTP ${status}).`,
      };
    }

    if (json && json.ok === true) {
      return { ok: true, data: json };
    }

    return {
      ok: false,
      error: json?.error || 'Permintaan ditolak oleh Apps Script.',
    };
  } catch (netErr: unknown) {
    const msg = netErr instanceof Error ? netErr.message : 'Koneksi gagal';
    return { ok: false, error: `Gagal menghubungi server Google: ${msg}` };
  }
}

// ============================================================================
// 4. PEMETAAN BARIS DATA DARI DEXIE KE ARRAY SPREADSHEET
// ============================================================================

export async function extractTableRows(tableId: string): Promise<any[][]> {
  switch (tableId) {
    case 'penjualan': {
      const sales = await db.sales.orderBy('createdAt').toArray();
      return sales.map((s) => {
        const marginStr =
          s.totalRevenueRupiah > 0
            ? `${((s.grossProfitRupiah / s.totalRevenueRupiah) * 100).toFixed(1)}%`
            : 'Tidak tersedia';
        return [
          formatJakartaYmdHm(s.createdAt),
          s.invoiceNumber,
          s.customerName || '-',
          s.robuxSold,
          s.rateUsed,
          s.totalRevenueRupiah,
          s.totalCogsRupiah,
          s.grossProfitRupiah,
          marginStr,
          s.status === 'ACTIVE' ? 'Selesai' : 'Dibatalkan (VOID)',
          s.notes || '-',
        ];
      });
    }

    case 'stockBatches': {
      const batches = await db.stockBatches.orderBy('createdAt').toArray();
      return batches.map((b) => {
        const sumberDana =
          b.fundingSource === 'COMBINED'
            ? 'Gabungan'
            : b.fundingSource === 'LOAN'
            ? 'Pinjaman Modal'
            : 'Dana Sendiri (Kas)';
        return [
          b.id,
          formatJakartaYmdHm(b.createdAt),
          b.sourceType === 'RESTOCK' ? 'Restock Kulakan' : 'Sisa Akun Roblox',
          sumberDana,
          b.initialRobux,
          b.remainingRobux,
          b.totalCostRupiah,
          b.unitCostDisplay,
          b.remainingCostRupiah,
          b.remainingRobux <= 0 ? 'Habis Terjual' : 'Aktif (Tersedia)',
          b.notes || '-',
        ];
      });
    }

    case 'stockMovements': {
      const movements = await db.stockMovements.orderBy('createdAt').toArray();
      return movements.map((m) => [
        m.id,
        m.batchId,
        formatJakartaYmdHm(m.createdAt),
        m.type,
        m.robuxAmount,
        m.costAllocatedRupiah,
        m.balanceAfter ?? 0,
        m.referenceId || '-',
        m.notes || '-',
      ]);
    }

    case 'cashLedger': {
      const cash = await db.cashLedger.orderBy('createdAt').toArray();
      return cash.map((c) => [
        c.id,
        c.dateKey,
        formatJakartaYmdHm(c.createdAt),
        c.type === 'IN' ? 'Kas Masuk (+)' : 'Kas Keluar (-)',
        c.sourceType,
        c.amountRupiah,
        c.notes || '-',
      ]);
    }

    case 'loans': {
      const loans = await db.loans.orderBy('createdAt').toArray();
      return loans.map((l) => {
        const totalPaid = l.payments.reduce((acc, p) => acc + (p.amountRupiah || 0), 0);
        return [
          l.id,
          formatJakartaYmdHm(l.createdAt),
          l.borrowerOrLender,
          l.loanAmountRupiah,
          l.remainingLoanRupiah,
          totalPaid,
          l.dueDate || '-',
          l.status === 'PAID' ? 'Lunas' : 'Belum Lunas',
          l.notes || '-',
        ];
      });
    }

    case 'investors': {
      const invs = await db.investors.orderBy('createdAt').toArray();
      return invs.map((i) => [
        i.id,
        i.name,
        i.capitalAmountRupiah,
        i.sharePercentage,
        i.joinDate,
        i.status === 'ACTIVE' ? 'Aktif' : 'Nonaktif',
        i.notes || '-',
      ]);
    }

    case 'investorPayouts': {
      const pays = await db.investorPayouts.orderBy('createdAt').toArray();
      return pays.map((p) => [
        p.id,
        p.investorId,
        p.investorName,
        formatJakartaYmdHm(p.createdAt),
        p.amountRupiah,
        p.periodNotes || '-',
      ]);
    }

    case 'personalUsages': {
      const usages = await db.personalUsages.orderBy('createdAt').toArray();
      return usages.map((u) => {
        const unitCost = u.robuxUsed > 0 ? Math.round(u.totalCostRupiah / u.robuxUsed) : 0;
        return [
          u.id,
          formatJakartaYmdHm(u.createdAt),
          u.robuxUsed,
          u.totalCostRupiah,
          unitCost,
          u.notes || '-',
        ];
      });
    }

    case 'categories': {
      const cats = await db.categories.orderBy('createdAt').toArray();
      return cats.map((c) => [
        c.id,
        c.name,
        c.type === 'EXPENSE' ? 'Pengeluaran' : c.type === 'INCOME' ? 'Pemasukan' : 'Pribadi',
        formatJakartaYmdHm(c.createdAt),
      ]);
    }

    default:
      return [];
  }
}

// ============================================================================
// 5. STATUS & EVENT EMITTER (REAKTIF UNTUK UI)
// ============================================================================

export interface TableSyncStatus {
  id: string;
  name: string;
  rowCount: number;
  status: 'SYNCED' | 'PENDING' | 'ERROR';
  lastError?: string;
}

export interface SheetsSyncState {
  isSyncing: boolean;
  status: 'IDLE' | 'SYNCING' | 'SUCCESS' | 'ERROR';
  lastSyncAt?: string;
  lastError?: string;
  tables: Record<string, TableSyncStatus>;
  pendingTableCount: number;
}

const stateListeners = new Set<(state: SheetsSyncState) => void>();
let isSyncInProgress = false;
let retryFailureCount = 0;
let debounceTimer: NodeJS.Timeout | null = null;
let periodicTimer: NodeJS.Timeout | null = null;

export function subscribeSheetsSyncState(listener: (state: SheetsSyncState) => void): () => void {
  stateListeners.add(listener);
  broadcastState();
  return () => {
    stateListeners.delete(listener);
  };
}

async function broadcastState(customError?: string) {
  try {
    const s = await repository.getSettings();
    const tableKeys = [
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

    const tablesStatus: Record<string, TableSyncStatus> = {};
    let pendingCount = 0;

    for (const key of tableKeys) {
      const def = SHEETS_TABLES[key];
      let count = 0;
      try {
        count = await (db as any)[key]?.count() || 0;
      } catch {}

      // Cek apakah tabel ini berubah dibanding hash tersimpan
      const storedHash = s.tableHashes?.[key];
      const isPending = !storedHash; // Jika belum pernah terkirim, tandai pending

      if (isPending) pendingCount++;

      tablesStatus[key] = {
        id: key,
        name: def.name,
        rowCount: count,
        status: isPending ? 'PENDING' : 'SYNCED',
      };
    }

    const state: SheetsSyncState = {
      isSyncing: isSyncInProgress,
      status: isSyncInProgress ? 'SYNCING' : s.lastSheetsSyncStatus || 'IDLE',
      lastSyncAt: s.lastSheetsSyncAt,
      lastError: customError !== undefined ? customError : s.lastSheetsSyncError,
      tables: tablesStatus,
      pendingTableCount: pendingCount,
    };

    for (const listener of stateListeners) {
      try {
        listener(state);
      } catch {}
    }
  } catch {}
}

// ============================================================================
// 6. LOGIKA SINKRONISASI CERMIN PER TABEL & CHUNK
// ============================================================================

/**
 * Sinkronisasi satu tabel spesifik ke Google Sheets
 */
export async function syncSingleTable(
  url: string,
  secret: string,
  tableId: string,
  force = false
): Promise<{ success: boolean; skipped?: boolean; error?: string }> {
  const def = SHEETS_TABLES[tableId];
  if (!def) return { success: false, error: 'Tabel tidak dikenali.' };

  const rows = await extractTableRows(tableId);
  const currentHash = await computeTableHash(rows);

  const s = await repository.getSettings();
  const storedHash = s.tableHashes?.[tableId];

  // 1. Cek Sidik Jari: Jika hash sama persis dan bukan force sync, lewati
  if (!force && storedHash && storedHash === currentHash) {
    return { success: true, skipped: true };
  }

  const totalRows = rows.length;

  // 2. Kasus tabel kosong: kirim 1 chunk kosong
  if (totalRows === 0) {
    const payload = {
      action: 'replace-chunk',
      table: tableId,
      schemaVersion: 1,
      headers: def.headers,
      startRow: 0,
      totalRows: 0,
      rows: [],
    };
    const res = await sendSignedSheetsRequest(url, secret, payload);
    if (!res.ok) {
      return { success: false, error: res.error };
    }
  } else {
    // 3. Kirim data dalam chunk ~400 baris
    for (let startRow = 0; startRow < totalRows; startRow += CHUNK_SIZE) {
      const chunkRows = rows.slice(startRow, startRow + CHUNK_SIZE);
      const payload = {
        action: 'replace-chunk',
        table: tableId,
        schemaVersion: 1,
        headers: def.headers,
        startRow,
        totalRows,
        rows: chunkRows,
      };

      const res = await sendSignedSheetsRequest(url, secret, payload);
      if (!res.ok) {
        return { success: false, error: res.error };
      }
    }
  }

  // 4. HANYA SETELAH SEMUA chunk berhasil, simpan hash terbaru di settings
  const currentHashes = s.tableHashes || {};
  const updatedHashes = { ...currentHashes, [tableId]: currentHash };
  await repository.updateSettings({ tableHashes: updatedHashes });

  return { success: true, skipped: false };
}

/**
 * Perbarui Sheet Ringkasan Dasbor (KPI & Tren Bulanan)
 */
export async function syncSummarySheet(url: string, secret: string): Promise<boolean> {
  try {
    const [summary, s] = await Promise.all([
      repository.getDashboardSummary(),
      repository.getSettings(),
    ]);

    const activeSales = await repository.getSales('ACTIVE');
    const monthMap: Record<string, { omzet: number; laba: number }> = {};

    for (const sale of activeSales) {
      const mKey = sale.createdAt.substring(0, 7); // YYYY-MM
      if (!monthMap[mKey]) monthMap[mKey] = { omzet: 0, laba: 0 };
      monthMap[mKey].omzet += sale.totalRevenueRupiah;
      monthMap[mKey].laba += sale.grossProfitRupiah;
    }

    const sortedMonths = Object.keys(monthMap).sort().slice(-12);
    const monthlyTrends = sortedMonths.map((m) => ({
      month: m,
      omzet: monthMap[m].omzet,
      laba: monthMap[m].laba,
    }));

    const payload = {
      action: 'update-summary',
      appVersion: 'JufaStore v2.1.28',
      syncTime: formatJakartaYmdHm(new Date()),
      kpi: {
        saldoKas: summary.totalOmzet - summary.totalManualExpense,
        sisaModalStok: summary.sisaNilaiModalStok,
        sisaStokRobux: summary.currentStockRobux,
        totalOmzet: summary.totalOmzet,
        totalLabaKotor: summary.totalGrossProfit,
        totalLabaBersih: summary.netProfit,
      },
      monthlyTrends,
    };

    const res = await sendSignedSheetsRequest(url, secret, payload);
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Sinkronisasi Cermin Seluruh Tabel (Bekerja di latar belakang)
 */
export async function executeMirrorSync(force = false): Promise<{ success: boolean; message: string }> {
  if (isSyncInProgress) {
    return { success: false, message: 'Sinkronisasi sedang berlangsung di latar belakang.' };
  }

  const s = await repository.getSettings();
  const url = s.sheetsWebhookUrl?.trim() || '';
  const secret = s.sheetsSecret?.trim() || '';

  if (!s.sheetsSyncEnabled) {
    return { success: false, message: 'Sinkronisasi Google Sheets dinonaktifkan di pengaturan.' };
  }
  if (!url || !secret) {
    return { success: false, message: 'URL Web App atau Kode Rahasia belum diisi.' };
  }

  isSyncInProgress = true;
  await repository.updateSettings({ lastSheetsSyncStatus: 'SYNCING' });
  broadcastState(undefined);

  try {
    const tableKeys = [
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

    let syncedCount = 0;
    let skippedCount = 0;

    for (const tableId of tableKeys) {
      const res = await syncSingleTable(url, secret, tableId, force);
      if (!res.success) {
        throw new Error(`Gagal mengirim tabel ${SHEETS_TABLES[tableId].name}: ${res.error}`);
      }
      if (res.skipped) {
        skippedCount++;
      } else {
        syncedCount++;
      }
    }

    // Perbarui Dasbor Ringkasan
    await syncSummarySheet(url, secret);

    const nowIso = new Date().toISOString();
    await repository.updateSettings({
      lastSheetsSyncAt: nowIso,
      lastSheetsSyncStatus: 'SUCCESS',
      lastSheetsSyncError: undefined,
    });

    retryFailureCount = 0;
    broadcastState();

    const infoMsg = force
      ? 'Seluruh 9 tabel & ringkasan berhasil dicerminkan ke Google Spreadsheet.'
      : syncedCount === 0
      ? 'Semua data Google Spreadsheet sudah sesuai dan terkini.'
      : `${syncedCount} tabel berhasil diperbarui di Google Spreadsheet.`;

    return { success: true, message: infoMsg };
  } catch (err: unknown) {
    retryFailureCount++;
    const errMsg = err instanceof Error ? err.message : 'Terjadi kesalahan sinkronisasi';

    await repository.updateSettings({
      lastSheetsSyncStatus: 'ERROR',
      lastSheetsSyncError: errMsg,
    });

    broadcastState(errMsg);

    // Jadwalkan retry otomatis dengan backoff jika kegagalan jaringan
    const backoffSec = calculateSheetsBackoffSeconds(retryFailureCount);
    scheduleSync(backoffSec * 1000);

    return { success: false, message: errMsg };
  } finally {
    isSyncInProgress = false;
    broadcastState();
  }
}

/**
 * Jadwalkan sinkronisasi ter-debounce (~5 detik pasca-mutasi lokal)
 */
export function scheduleSync(delayMs = 5000): void {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }
  debounceTimer = setTimeout(() => {
    executeMirrorSync(false).catch(() => {});
  }, delayMs);
}

/**
 * Pemicu Sinkron Sekarang (Manual)
 */
export async function triggerSyncNow(): Promise<{ success: boolean; message: string }> {
  return executeMirrorSync(false);
}

/**
 * Pemicu Sinkron Penuh (Manual, kirim semua tabel tanpa cek hash)
 */
export async function triggerFullSheetsSync(): Promise<{ success: boolean; message: string }> {
  return executeMirrorSync(true);
}

/**
 * Tes Koneksi ke Web App Google Apps Script dengan aksi "ping"
 */
export async function testSheetsConnection(
  url: string,
  secret: string
): Promise<{ ok: boolean; message: string }> {
  const res = await sendSignedSheetsRequest(url, secret, { action: 'ping' });
  if (res.ok) {
    return { ok: true, message: res.data?.message || 'Koneksi ke Google Apps Script berhasil terverifikasi!' };
  }
  return { ok: false, message: res.error || 'Koneksi ditolak oleh Web App' };
}

/**
 * Minta Web App merapikan dan membuat seluruh sheet otomatis
 */
export async function requestSetupSheets(
  url: string,
  secret: string
): Promise<{ ok: boolean; message: string }> {
  const res = await sendSignedSheetsRequest(url, secret, { action: 'setup-sheets' });
  if (res.ok) {
    return { ok: true, message: res.data?.message || 'Seluruh struktur 10 sheet berhasil dirapikan di spreadsheet.' };
  }
  return { ok: false, message: res.error || 'Gagal merapikan sheet di spreadsheet' };
}

/**
 * Hapus seluruh konfigurasi Sheets dari pengaturan lokal (Reset)
 */
export async function resetSheetsSettings(): Promise<void> {
  await repository.updateSettings({
    sheetsWebhookUrl: '',
    sheetsSecret: '',
    sheetsSyncEnabled: false,
    lastSheetsSyncAt: undefined,
    lastSheetsSyncStatus: undefined,
    lastSheetsSyncError: undefined,
    tableHashes: {},
  });
  broadcastState();
}

// ============================================================================
// 7. INISIALISASI SERVICE LENGKAP & DEXIE HOOKS
// ============================================================================

export function initSheetsSyncService(): () => void {
  // A. Daftarkan Dexie Hooks untuk mendeteksi perubahan data pada 9 tabel
  const tables = [
    db.sales,
    db.stockBatches,
    db.stockMovements,
    db.cashLedger,
    db.loans,
    db.investors,
    db.investorPayouts,
    db.personalUsages,
    db.categories,
  ];

  const onMutated = () => {
    scheduleSync(5000);
  };

  for (const table of tables) {
    try {
      table.hook('creating', onMutated);
      table.hook('updating', onMutated);
      table.hook('deleting', onMutated);
    } catch {}
  }

  // B. Sinkronisasi saat kembali online
  const unsubOnline = subscribeOnBackOnline(() => {
    scheduleSync(2000);
  });

  // C. Sinkronisasi awal saat aplikasi dibuka
  setTimeout(() => {
    executeMirrorSync(false).catch(() => {});
  }, 4000);

  // D. Polling berkala tiap 10 menit saat online
  periodicTimer = setInterval(() => {
    executeMirrorSync(false).catch(() => {});
  }, 10 * 60 * 1000);

  return () => {
    unsubOnline();
    if (debounceTimer) clearTimeout(debounceTimer);
    if (periodicTimer) clearInterval(periodicTimer);
  };
}

// ============================================================================
// 8. TEMPLATE RESMI CODE.GS UNTUK DISALIN DARI UI
// ============================================================================

export const SHEETS_CODE_GS_TEMPLATE = `// ==============================================================
// JUFASTORE — GOOGLE APPS SCRIPT WEBHOOK & SHEET MIRROR (V2 RESMI)
// Dokumen: docs/google-apps-script/Code.gs
// Lisensi: Hak Cipta JufaStore (Offline-First Robux Business App)
// ==============================================================

var JUFASTORE_SCHEMA_VERSION = 1;

// 1. DAFTAR RESMI DEFINISI TABEL & KOLOM
function dapatkanDefinisiTabel() {
  return {
    ringkasan: {
      name: "Ringkasan",
      color: "#059669",
      headers: ["Metrik KPI", "Nilai", "Keterangan", "Waktu Pembaruan"]
    },
    penjualan: {
      name: "Penjualan",
      color: "#10b981",
      headers: [
        "Waktu (WIB)",
        "No Invoice",
        "Nama Pembeli",
        "Jumlah Robux (R$)",
        "Rate Jual (Rp)",
        "Total Omzet (Rp)",
        "Modal HPP (Rp)",
        "Laba Kotor (Rp)",
        "Margin",
        "Status Transaksi",
        "Catatan"
      ]
    },
    stockBatches: {
      name: "Batch_Stok",
      color: "#d97706",
      headers: [
        "ID Batch",
        "Waktu Masuk (WIB)",
        "Sumber Stok",
        "Sumber Dana",
        "Robux Awal (R$)",
        "Sisa Robux (R$)",
        "Total Modal Beli (Rp)",
        "Modal per Robux (Rp)",
        "Sisa Nilai Modal (Rp)",
        "Status Batch",
        "Catatan"
      ]
    },
    stockMovements: {
      name: "Mutasi_Stok",
      color: "#f59e0b",
      headers: [
        "ID Mutasi",
        "ID Batch",
        "Waktu (WIB)",
        "Jenis Mutasi",
        "Jumlah Robux (R$)",
        "Alokasi Modal (Rp)",
        "Sisa Robux Setelah Mutasi",
        "Referensi Transaksi",
        "Catatan"
      ]
    },
    cashLedger: {
      name: "Buku_Kas",
      color: "#0284c7",
      headers: [
        "ID Transaksi",
        "Tanggal (WIB)",
        "Waktu Lengkap",
        "Arus Kas",
        "Kategori / Sumber",
        "Nominal (Rp)",
        "Keterangan"
      ]
    },
    loans: {
      name: "Pinjaman",
      color: "#7c3aed",
      headers: [
        "ID Pinjaman",
        "Tanggal Pinjam (WIB)",
        "Pemberi Pinjaman / Kreditor",
        "Pokok Utang (Rp)",
        "Sisa Utang (Rp)",
        "Total Terbayar (Rp)",
        "Jatuh Tempo",
        "Status Pinjaman",
        "Catatan"
      ]
    },
    investors: {
      name: "Investor",
      color: "#4f46e5",
      headers: [
        "ID Investor",
        "Nama Investor",
        "Modal Disetor (Rp)",
        "Porsi Bagi Hasil (%)",
        "Tanggal Bergabung",
        "Status Investor",
        "Catatan"
      ]
    },
    investorPayouts: {
      name: "Pembayaran_Investor",
      color: "#6366f1",
      headers: [
        "ID Pembayaran",
        "ID Investor",
        "Nama Investor",
        "Waktu Pembayaran (WIB)",
        "Nominal Dividen (Rp)",
        "Catatan Periode"
      ]
    },
    personalUsages: {
      name: "Pemakaian_Pribadi",
      color: "#e11d48",
      headers: [
        "ID Prive",
        "Waktu Pengambilan (WIB)",
        "Robux Diambil (R$)",
        "Nilai Modal HPP (Rp)",
        "Modal per Robux (Rp)",
        "Keperluan / Catatan"
      ]
    },
    categories: {
      name: "Kategori",
      color: "#64748b",
      headers: [
        "ID Kategori",
        "Nama Kategori",
        "Jenis Kategori",
        "Waktu Dibuat (WIB)"
      ]
    }
  };
}

// 2. FUNGSI SETUP UTAMA (Dijalankan manual 1 kali oleh pengguna)
function setup() {
  var props = PropertiesService.getScriptProperties();
  var secret = props.getProperty("JUFASTORE_SYNC_SECRET");

  if (!secret) {
    // Sumber acak aman menggunakan Utilities.getUuid() dua kali (64 karakter heksadesimal)
    var uuid1 = Utilities.getUuid().replace(/-/g, "").toLowerCase();
    var uuid2 = Utilities.getUuid().replace(/-/g, "").toLowerCase();
    secret = uuid1 + uuid2;
    props.setProperty("JUFASTORE_SYNC_SECRET", secret);
  }

  setupSemuaSheet();

  Logger.log("==================================================================");
  Logger.log("JUFASTORE SYNC BERHASIL DIKONFIGURASI!");
  Logger.log("Salin KODE RAHASIA (SECRET) berikut ke Pengaturan Google Sheets di aplikasi:");
  Logger.log(secret);
  Logger.log("==================================================================");
}

// 3. FUNGSI RESET SECRET (Jika secret pernah bocor atau ingin diganti)
function resetSecret() {
  var props = PropertiesService.getScriptProperties();
  props.deleteProperty("JUFASTORE_SYNC_SECRET");
  setup();
}

// 4. FORMAT TAMPILAN SHEET LENGKAP & RAPI (Hanya dijalankan di setup / setup-sheets)
function setupSemuaSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var defs = dapatkanDefinisiTabel();

  // 1. Format Sheet Ringkasan
  setupSheetRingkasan(ss, defs.ringkasan);

  // 2. Format 9 Sheet Data
  var sheetKeys = [
    "penjualan",
    "stockBatches",
    "stockMovements",
    "cashLedger",
    "loans",
    "investors",
    "investorPayouts",
    "personalUsages",
    "categories"
  ];

  for (var k = 0; k < sheetKeys.length; k++) {
    var def = defs[sheetKeys[k]];
    var s = ss.getSheetByName(def.name);
    if (!s) {
      s = ss.insertSheet(def.name);
    }
    s.setTabColor(def.color);
    formatHeaderDataSheet(s, def.headers, def.color);
    terapkanFormatKolomKhusus(s, sheetKeys[k]);
  }

  // Hapus Sheet1 kosong bawaan jika ada
  hapusSheet1Bawaan(ss);
}

function setupSheetRingkasan(ss, def) {
  var s = ss.getSheetByName(def.name);
  if (!s) {
    s = ss.insertSheet(def.name, 0);
  }
  s.setTabColor(def.color);
  s.setHiddenGridlines(true);

  // Buat Header Ringkasan
  if (s.getLastRow() === 0) {
    s.appendRow(["JUFASTORE — DASBOR RINGKASAN BISNIS", "", "", ""]);
    s.getRange("A1:D1").merge()
      .setBackground("#064e3b")
      .setFontColor("#ffffff")
      .setFontWeight("bold")
      .setFontSize(13)
      .setVerticalAlignment("middle");
    s.setRowHeight(1, 40);

    s.appendRow(["Metrik", "Nilai", "Keterangan", "Waktu Diperbarui"]);
    var headerRange = s.getRange("A2:D2");
    headerRange.setBackground("#059669")
      .setFontColor("#ffffff")
      .setFontWeight("bold")
      .setFontSize(10)
      .setHorizontalAlignment("center")
      .setVerticalAlignment("middle");
    s.setRowHeight(2, 28);
    s.setFrozenRows(2);

    var rowsKpi = [
      ["Saldo Kas Toko Saat Ini", 0, "Uang kas riil tersedia di buku kas", "-"],
      ["Sisa Modal Stok FIFO", 0, "Nilai modal Robux yang belum terjual", "-"],
      ["Sisa Stok Robux Toko", 0, "Jumlah stok Robux saat ini (R$)", "-"],
      ["Total Omzet Penjualan", 0, "Total penjualan Robux terbayar", "-"],
      ["Total Laba Kotor", 0, "Omzet riil dikurangi modal HPP FIFO", "-"],
      ["Total Laba Bersih", 0, "Laba kotor dikurangi biaya operasional kas", "-"],
      ["Versi Aplikasi Terhubung", "JufaStore v2.1.28", "Aplikasi pencatatan internal Robux", "-"]
    ];

    s.getRange(3, 1, rowsKpi.length, 4).setValues(rowsKpi);
    s.getRange("B3:B4").setNumberFormat('"Rp " #,##0');
    s.getRange("B5:B5").setNumberFormat('#,##0 " R$"');
    s.getRange("B6:B8").setNumberFormat('"Rp " #,##0');

    // Desain blok tren bulanan di bawah KPI
    var startTren = 12;
    s.getRange(startTren, 1, 1, 3).merge()
      .setValue("TREN KINERJA PENJUALAN BULANAN (12 BULAN TERAKHIR)")
      .setBackground("#0f766e")
      .setFontColor("#ffffff")
      .setFontWeight("bold")
      .setFontSize(10)
      .setVerticalAlignment("middle");
    s.setRowHeight(startTren, 30);

    s.getRange(startTren + 1, 1, 1, 3).setValues([["Bulan (YYYY-MM)", "Omzet (Rp)", "Laba Kotor (Rp)"]])
      .setBackground("#115e59")
      .setFontColor("#ffffff")
      .setFontWeight("bold")
      .setFontSize(9)
      .setHorizontalAlignment("center");
    s.setRowHeight(startTren + 1, 26);

    // Otomatisasi lebar kolom ringkasan
    s.setColumnWidth(1, 240);
    s.setColumnWidth(2, 170);
    s.setColumnWidth(3, 280);
    s.setColumnWidth(4, 160);
  }

  // Buat Grafik Garis Tren Omzet vs Laba Kotor SEKALI di setup (jangan duplikat jika dijalankan ulang)
  var charts = s.getCharts();
  if (!charts || charts.length === 0) {
    try {
      var startTren = 12;
      var chartRange = s.getRange(startTren + 1, 1, 13, 3); // Header baris 13 + 12 baris data
      var chart = s.newChart()
        .setChartType(Charts.ChartType.LINE)
        .addRange(chartRange)
        .setPosition(3, 5, 15, 10) // Kolom E, Baris 3 di samping tabel KPI
        .setOption("title", "Tren Omzet vs Laba Kotor (12 Bulan)")
        .setOption("legend", { position: "bottom" })
        .setOption("colors", ["#059669", "#d97706"])
        .setOption("width", 540)
        .setOption("height", 300)
        .build();
      s.insertChart(chart);
    } catch (eChart) {}
  }

  pasangProteksiPeringatan(s);
}

function formatHeaderDataSheet(sheet, headers, color) {
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
  } else {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }

  var headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setFontWeight("bold")
    .setFontSize(10)
    .setBackground(color || "#10b981")
    .setFontColor("#ffffff")
    .setHorizontalAlignment("center")
    .setVerticalAlignment("middle");
  try { sheet.setRowHeight(1, 34); } catch (e) {}
  sheet.setFrozenRows(1);

  // Atur lebar awal lapang
  for (var col = 1; col <= headers.length; col++) {
    try {
      sheet.autoResizeColumn(col);
      var w = sheet.getColumnWidth(col);
      sheet.setColumnWidth(col, Math.max(w + 35, 125));
    } catch (e2) {}
  }

  // Terapkan baris selang-seling (banding) di sheet data SEKALI di setup
  try {
    var bandings = sheet.getBandings();
    if (!bandings || bandings.length === 0) {
      var bandingRange = sheet.getRange(1, 1, Math.max(sheet.getMaxRows(), 500), headers.length);
      bandingRange.applyRowBanding(SpreadsheetApp.BandingTheme.LIGHT_GREY, true, false);
    }
  } catch (eBanding) {}

  pasangProteksiPeringatan(sheet);
}

function terapkanFormatKolomKhusus(sheet, key) {
  var maxRows = Math.max(sheet.getMaxRows(), 500);

  // Format kolom angka rupiah, robux, dan tanggal berlaku sampai baris akhir kolom
  if (key === "penjualan") {
    sheet.getRange(2, 4, maxRows - 1, 1).setNumberFormat('#,##0'); // Robux
    sheet.getRange(2, 5, maxRows - 1, 4).setNumberFormat('"Rp " #,##0'); // Rate, Omzet, HPP, Laba
    // Pewarnaan bersyarat kolom 10 (Status Transaksi)
    pasangPewarnaanStatus(sheet, 10, [
      { text: "Selesai", bg: "#d1fae5", fg: "#065f46" },
      { text: "Dibatalkan (VOID)", bg: "#fee2e2", fg: "#991b1b" }
    ]);
  } else if (key === "stockBatches") {
    sheet.getRange(2, 5, maxRows - 1, 2).setNumberFormat('#,##0'); // Robux awal & sisa
    sheet.getRange(2, 7, maxRows - 1, 3).setNumberFormat('"Rp " #,##0'); // Modal beli, unit cost, sisa modal
    // Pewarnaan bersyarat kolom 10 (Status Batch)
    pasangPewarnaanStatus(sheet, 10, [
      { text: "Aktif (Tersedia)", bg: "#d1fae5", fg: "#065f46" },
      { text: "Habis Terjual", bg: "#f3f4f6", fg: "#6b7280" }
    ]);
  } else if (key === "stockMovements") {
    sheet.getRange(2, 5, maxRows - 1, 1).setNumberFormat('#,##0'); // Robux
    sheet.getRange(2, 6, maxRows - 1, 1).setNumberFormat('"Rp " #,##0'); // Alokasi modal
    sheet.getRange(2, 7, maxRows - 1, 1).setNumberFormat('#,##0'); // Sisa robux
  } else if (key === "cashLedger") {
    sheet.getRange(2, 6, maxRows - 1, 1).setNumberFormat('"Rp " #,##0'); // Nominal kas
  } else if (key === "loans") {
    sheet.getRange(2, 4, maxRows - 1, 3).setNumberFormat('"Rp " #,##0'); // Pokok, Sisa, Terbayar
    // Pewarnaan bersyarat kolom 8 (Status Pinjaman)
    pasangPewarnaanStatus(sheet, 8, [
      { text: "Lunas", bg: "#d1fae5", fg: "#065f46" },
      { text: "Belum Lunas", bg: "#fef3c7", fg: "#92400e" }
    ]);
  } else if (key === "investors") {
    sheet.getRange(2, 3, maxRows - 1, 1).setNumberFormat('"Rp " #,##0'); // Modal disetor
    sheet.getRange(2, 4, maxRows - 1, 1).setNumberFormat('0"%"'); // Porsi bagi hasil
    // Pewarnaan bersyarat kolom 6 (Status Investor)
    pasangPewarnaanStatus(sheet, 6, [
      { text: "Aktif", bg: "#d1fae5", fg: "#065f46" },
      { text: "Nonaktif", bg: "#f3f4f6", fg: "#6b7280" }
    ]);
  } else if (key === "investorPayouts") {
    sheet.getRange(2, 5, maxRows - 1, 1).setNumberFormat('"Rp " #,##0'); // Dividen
  } else if (key === "personalUsages") {
    sheet.getRange(2, 3, maxRows - 1, 1).setNumberFormat('#,##0'); // Robux prive
    sheet.getRange(2, 4, maxRows - 1, 2).setNumberFormat('"Rp " #,##0'); // Modal total & per Robux
  }
}

// HELPER: Pasang Pewarnaan Bersyarat pada Kolom Status Tertentu
function pasangPewarnaanStatus(sheet, colIndex, aturanList) {
  try {
    var maxRows = Math.max(sheet.getMaxRows(), 500);
    var range = sheet.getRange(2, colIndex, maxRows - 1, 1);
    var currentRules = sheet.getConditionalFormatRules();

    var filteredRules = [];
    for (var i = 0; i < currentRules.length; i++) {
      var r = currentRules[i];
      var rRanges = r.getRanges();
      var isSameCol = false;
      for (var j = 0; j < rRanges.length; j++) {
        if (rRanges[j].getColumn() === colIndex) {
          isSameCol = true;
          break;
        }
      }
      if (!isSameCol) filteredRules.push(r);
    }

    for (var k = 0; k < aturanList.length; k++) {
      var a = aturanList[k];
      var rule = SpreadsheetApp.newConditionalFormatRule()
        .whenTextEqualTo(a.text)
        .setBackground(a.bg)
        .setFontColor(a.fg)
        .setRanges([range])
        .build();
      filteredRules.push(rule);
    }

    sheet.setConditionalFormatRules(filteredRules);
  } catch (eRule) {}
}

function pasangProteksiPeringatan(sheet) {
  try {
    var protections = sheet.getProtections(SpreadsheetApp.ProtectionType.SHEET);
    if (!protections || protections.length === 0) {
      var p = sheet.protect().setDescription("Sheet ini dicerminkan otomatis oleh JufaStore. Jangan mengedit struktur kolom manual.");
      p.setWarningOnly(true);
    }
  } catch (e) {}
}

function hapusSheet1Bawaan(ss) {
  try {
    var sheets = ss.getSheets();
    if (sheets.length > 1) {
      for (var i = 0; i < sheets.length; i++) {
        var s = sheets[i];
        var sName = s.getName();
        if ((sName === "Sheet1" || sName === "Sheet 1") && s.getLastRow() === 0) {
          ss.deleteSheet(s);
          break;
        }
      }
    }
  } catch (err) {}
}

// 5. PENERIMA WEBHOOK (doPost)
function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
  } catch (lockErr) {
    return createJsonResponse({
      ok: false,
      error: "Server Spreadsheet sedang sibuk memproses data lain. Silakan coba sesaat lagi."
    });
  }

  try {
    var rawText = e && e.postData && e.postData.contents;
    if (!rawText) {
      return createJsonResponse({ ok: false, error: "Isi payload permintaan kosong." });
    }

    // Batasi ukuran payload body (maksimal 2 MB)
    if (rawText.length > 2 * 1024 * 1024) {
      return createJsonResponse({ ok: false, error: "Ukuran payload melebihi batas maksimal (2 MB)." });
    }

    var packet;
    try {
      packet = JSON.parse(rawText);
    } catch (parseErr) {
      return createJsonResponse({ ok: false, error: "Format JSON tidak valid." });
    }

    // 1. Validasi Keberadaan Secret di Script Properties
    var props = PropertiesService.getScriptProperties();
    var secret = props.getProperty("JUFASTORE_SYNC_SECRET");
    if (!secret) {
      return createJsonResponse({
        ok: false,
        error: "Script belum diatur. Buka Extensions > Apps Script, lalu jalankan fungsi setup() terlebih dahulu."
      });
    }

    // 2. Validasi Timestamp (Maksimal selisih 5 menit dari waktu server Google)
    var nowMs = Date.now();
    var reqTime = packet.timestamp || 0;
    if (Math.abs(nowMs - reqTime) > 5 * 60 * 1000) {
      return createJsonResponse({
        ok: false,
        error: "Waktu permintaan kedaluwarsa atau jam perangkat tidak sinkron (maksimal selisih 5 menit)."
      });
    }

    // 3. Validasi Nonce (Wajib string 8-64 karakter)
    var nonce = packet.nonce;
    if (!nonce || typeof nonce !== "string" || nonce.length < 8 || nonce.length > 64) {
      return createJsonResponse({ ok: false, error: "Nonce acak tidak valid (wajib 8-64 karakter)." });
    }

    var cache = CacheService.getScriptCache();
    var nonceKey = "JUFA_NONCE_" + nonce;
    if (cache.get(nonceKey)) {
      return createJsonResponse({ ok: false, error: "Permintaan ditolak: nonce sudah pernah digunakan." });
    }
    // Simpan nonce selama 10 menit untuk mencegah replay attack
    cache.put(nonceKey, "1", 600);

    // 4. Validasi Tanda Tangan Digital HMAC-SHA256
    var bodyString = typeof packet.body === "string" ? packet.body : JSON.stringify(packet.body || {});
    var expectedMessage = reqTime + "." + nonce + "." + bodyString;
    var expectedSigBytes = Utilities.computeHmacSha256Signature(expectedMessage, secret);
    var expectedSig = expectedSigBytes.map(function(b) {
      var v = (b < 0 ? b + 256 : b).toString(16);
      return v.length === 1 ? "0" + v : v;
    }).join("");

    if (!constantTimeCompare(packet.signature, expectedSig)) {
      return createJsonResponse({
        ok: false,
        error: "Autentikasi tanda tangan digital gagal. Pastikan Kode Rahasia (Secret) di aplikasi cocok."
      });
    }

    // 5. Eksekusi Aksi yang Diminta
    var body = typeof packet.body === "string" ? JSON.parse(packet.body) : packet.body;
    var action = body.action;

    if (action === "ping") {
      return createJsonResponse({
        ok: true,
        message: "Koneksi ke JufaStore Web App berhasil terverifikasi!",
        serverTime: nowMs,
        version: JUFASTORE_SCHEMA_VERSION
      });
    }

    if (action === "setup-sheets") {
      setupSemuaSheet();
      return createJsonResponse({
        ok: true,
        message: "Seluruh struktur 10 sheet berhasil dirapikan.",
        serverTime: nowMs
      });
    }

    if (action === "replace-chunk") {
      var resChunk = eksekusiReplaceChunk(body);
      return createJsonResponse(resChunk);
    }

    if (action === "update-summary") {
      var resSummary = eksekusiUpdateSummary(body);
      return createJsonResponse(resSummary);
    }

    return createJsonResponse({
      ok: false,
      error: "Aksi tidak dikenali atau tidak didukung."
    });

  } catch (err) {
    return createJsonResponse({
      ok: false,
      error: "Terjadi kesalahan internal saat memproses data di spreadsheet."
    });
  } finally {
    try {
      lock.releaseLock();
    } catch (eLock) {}
  }
}

// 6. PROSES EKSEKUSI REPLACE-CHUNK PER TABEL (Idempoten, Cepat, & Anti-Rumus)
function eksekusiReplaceChunk(payload) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var tableName = payload.table;
  var defs = dapatkanDefinisiTabel();

  // Validasi nama tabel terhadap daftar putih
  var def = defs[tableName];
  if (!def) {
    return { ok: false, error: "Nama tabel tidak terdaftar dalam skema resmi JufaStore." };
  }

  var sheet = ss.getSheetByName(def.name);
  if (!sheet) {
    sheet = ss.insertSheet(def.name);
    sheet.setTabColor(def.color);
    formatHeaderDataSheet(sheet, def.headers, def.color);
  }

  var headers = payload.headers || def.headers;
  var startRow = Number(payload.startRow) || 0;
  var totalRows = Number(payload.totalRows) || 0;
  var rows = payload.rows || [];

  var firstDataRowIndex = 2; // Baris 1 adalah header tetap
  var targetRow = firstDataRowIndex + startRow;

  // Kasus tabel kosong murni
  if (totalRows === 0) {
    var lastRowNow = sheet.getLastRow();
    if (lastRowNow >= firstDataRowIndex) {
      sheet.getRange(firstDataRowIndex, 1, lastRowNow - firstDataRowIndex + 1, headers.length).clearContent();
    }
    return { ok: true, table: tableName, written: 0, totalRows: 0, isComplete: true };
  }

  // Tulis potongan baris data dengan sanitasi anti-formula injection
  if (rows.length > 0) {
    for (var r = 0; r < rows.length; r++) {
      var row = rows[r];
      for (var c = 0; c < row.length; c++) {
        var val = row[c];
        if (typeof val === "string" && val.length > 0) {
          var firstChar = val.charAt(0);
          if (firstChar === "=" || firstChar === "+" || firstChar === "-" || firstChar === "@") {
            row[c] = "'" + val;
          }
        }
      }
    }

    var neededRows = targetRow + rows.length - 1;
    if (neededRows > sheet.getMaxRows()) {
      sheet.insertRowsAfter(sheet.getMaxRows(), neededRows - sheet.getMaxRows() + 50);
    }

    // Hanya menulis nilai tanpa operasi formatting agar performa cepat
    var range = sheet.getRange(targetRow, 1, rows.length, headers.length);
    range.setValues(rows);
    range.setVerticalAlignment("middle");
  }

  // Jika potongan terakhir: pangkas sisa baris lama yang ada di bawah totalRows
  var isLastChunk = (startRow + rows.length) >= totalRows;
  if (isLastChunk) {
    var finalDataRow = firstDataRowIndex + totalRows - 1;
    var currentLastRow = sheet.getLastRow();
    if (currentLastRow > finalDataRow) {
      var rowsToClear = currentLastRow - finalDataRow;
      sheet.getRange(finalDataRow + 1, 1, rowsToClear, headers.length).clearContent();
    }
  }

  return {
    ok: true,
    table: tableName,
    startRow: startRow,
    written: rows.length,
    totalRows: totalRows,
    isComplete: isLastChunk
  };
}

// 7. PROSES PEMBARUAN SHEET DASBOR RINGKASAN
function eksekusiUpdateSummary(payload) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Ringkasan");
  if (!sheet) {
    setupSheetRingkasan(ss, dapatkanDefinisiTabel().ringkasan);
    sheet = ss.getSheetByName("Ringkasan");
  }

  var kpi = payload.kpi || {};
  var syncTime = payload.syncTime || "-";
  var appVersion = payload.appVersion || "JufaStore v2.1.28";

  var rowsValues = [
    [kpi.saldoKas || 0, "Uang kas riil tersedia di buku kas", syncTime],
    [kpi.sisaModalStok || 0, "Nilai modal Robux yang belum terjual", syncTime],
    [kpi.sisaStokRobux || 0, "Jumlah stok Robux saat ini (R$)", syncTime],
    [kpi.totalOmzet || 0, "Total omzet penjualan Robux lunas", syncTime],
    [kpi.totalLabaKotor || 0, "Omzet riil dikurangi modal HPP FIFO", syncTime],
    [kpi.totalLabaBersih || 0, "Laba kotor dikurangi biaya operasional kas", syncTime],
    [appVersion, "Aplikasi pencatatan internal Robux", syncTime]
  ];

  sheet.getRange(3, 2, rowsValues.length, 3).setValues(rowsValues);

  // Perbarui blok tren bulanan jika disediakan
  var monthlyTrends = payload.monthlyTrends || [];
  if (monthlyTrends.length > 0) {
    var startTren = 14;
    var trendRows = [];
    for (var m = 0; m < monthlyTrends.length; m++) {
      var item = monthlyTrends[m];
      trendRows.push([item.month, item.omzet || 0, item.laba || 0]);
    }
    // Bersihkan rentang tren bulanan lama sebelum menulis data baru
    sheet.getRange(startTren, 1, 12, 3).clearContent();
    sheet.getRange(startTren, 1, trendRows.length, 3).setValues(trendRows);
    sheet.getRange(startTren, 2, trendRows.length, 2).setNumberFormat('"Rp " #,##0');
  }

  return { ok: true, message: "Dasbor ringkasan berhasil diperbarui." };
}

// 8. FUNGSI GET (Respons status ramah)
function doGet(e) {
  return ContentService.createTextOutput("JufaStore Google Sheets Mirror Sync V2 aktif & siap melayani.")
    .setMimeType(ContentService.MimeType.TEXT);
}

// HELPER: Perbandingan String Timing-Safe (Cegah Timing Attack)
function constantTimeCompare(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length !== b.length) return false;
  var mismatch = 0;
  for (var i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

// HELPER: Format Output JSON
function createJsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
`;
