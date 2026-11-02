/**
 * JufaStore - Queue-Based Google Sheets Sync Service (One-way: App -> Google Sheets)
 * Fitur:
 * - Sinkronisasi inkremental berbasis antrean (syncQueue)
 * - Batching maksimal 50 entri per pengiriman
 * - Lock anti-ganda (mutex)
 * - Exponential backoff retry jika terjadi kegagalan jaringan
 * - Deteksi offline-aware: tidak mengirim saat offline
 * - Trigger: onBackOnline, startup, tiap 5 menit, debounce 3 detik setelah perubahan data, tombol manual
 */

import { db } from '../db/db';
import { repository, setOnDataMutatedListener } from '../db/repository';
import { SyncQueueItem } from '../db/schema';
import { formatDateJakarta, formatRupiah } from '../utils/formatters';
import { subscribeOnBackOnline, verifyRealInternet } from '../hooks/useNetworkStatus';
import { GOOGLE_SHEETS_TABLES } from '../utils/googleSheets';

/**
 * Menghitung jeda retry dengan algoritma exponential backoff (2^retryCount * 10 detik, maks 1 jam)
 */
export function calculateBackoffSeconds(retryCount: number): number {
  return Math.min(3600, Math.pow(2, retryCount) * 10);
}

/**
 * Logika pemadatan operasi antrean sinkronisasi
 */
export function compactQueueOperation(
  existingOp: 'upsert' | 'delete' | undefined,
  newOp: 'upsert' | 'delete'
): 'upsert' | 'delete' {
  if (existingOp === 'upsert' && newOp === 'delete') {
    return 'delete';
  }
  return newOp;
}

let isSyncInProgress = false;
let debouncedSyncTimer: NodeJS.Timeout | null = null;
let periodicSyncTimer: NodeJS.Timeout | null = null;

export interface SyncStatusInfo {
  isSyncing: boolean;
  pendingCount: number;
  lastSyncAt?: string;
  lastSyncStatus?: 'SUCCESS' | 'ERROR' | 'SYNCING';
  lastSyncError?: string;
}

const syncStatusListeners = new Set<(status: SyncStatusInfo) => void>();

export function subscribeSyncStatus(listener: (status: SyncStatusInfo) => void): () => void {
  syncStatusListeners.add(listener);
  broadcastSyncStatus();
  return () => {
    syncStatusListeners.delete(listener);
  };
}

async function broadcastSyncStatus(customError?: string, isSyncingOverride?: boolean) {
  try {
    const [settings, count] = await Promise.all([
      repository.getSettings(),
      repository.getPendingSyncCount(),
    ]);

    const info: SyncStatusInfo = {
      isSyncing: isSyncingOverride !== undefined ? isSyncingOverride : isSyncInProgress,
      pendingCount: count,
      lastSyncAt: settings.lastSyncAt,
      lastSyncStatus: isSyncInProgress ? 'SYNCING' : settings.lastSyncStatus,
      lastSyncError: customError !== undefined ? customError : settings.lastSyncError,
    };

    for (const listener of syncStatusListeners) {
      try {
        listener(info);
      } catch {}
    }
  } catch {}
}

/**
 * Pemetaan record data Dexie aktual ke format baris Google Sheets
 */
async function formatRecordToSheetRow(tableName: string, recordId: string): Promise<any[] | null> {
  switch (tableName) {
    case 'sales': {
      const s = await db.sales.get(recordId);
      if (!s) return null;
      const marginStr =
        s.totalRevenueRupiah > 0
          ? `${((s.grossProfitRupiah / s.totalRevenueRupiah) * 100).toFixed(1)}%`
          : '0%';
      return [
        formatDateJakarta(s.createdAt),
        s.invoiceNumber,
        s.customerName || '-',
        s.robuxSold,
        s.rateUsed,
        s.totalRevenueRupiah,
        s.totalCogsRupiah,
        s.grossProfitRupiah,
        marginStr,
        s.status === 'ACTIVE' ? 'Selesai / Lunas' : 'DIBATALKAN (VOID)',
        s.notes || '-',
      ];
    }

    case 'stockBatches': {
      const b = await db.stockBatches.get(recordId);
      if (!b) return null;
      const fundingStr =
        b.fundingSource === 'COMBINED'
          ? `Gabungan (Kas: ${formatRupiah(b.ownFundsRupiah || 0)} + Pinjaman: ${formatRupiah(b.loanFundsRupiah || 0)})`
          : b.fundingSource === 'LOAN'
          ? 'Pinjaman (Utang Modal)'
          : 'Dana Sendiri (Kas)';
      return [
        b.id,
        formatDateJakarta(b.createdAt),
        b.sourceType === 'RESTOCK' ? 'Restock Kulakan' : 'Sisa Akun Roblox',
        fundingStr,
        b.initialRobux,
        b.remainingRobux,
        b.totalCostRupiah,
        b.unitCostDisplay,
        b.remainingCostRupiah,
        b.remainingRobux <= 0 ? 'Habis Terjual' : 'Aktif (Tersedia)',
        b.notes || '-',
      ];
    }

    case 'cashLedger': {
      const c = await db.cashLedger.get(recordId);
      if (!c) return null;
      return [
        c.id,
        formatDateJakarta(c.createdAt),
        c.type === 'IN' ? 'Kas Masuk (+)' : 'Kas Keluar (-)',
        c.sourceType || '-',
        c.amountRupiah,
        c.notes || '-',
      ];
    }

    case 'loans': {
      const l = await db.loans.get(recordId);
      if (!l) return null;
      return [
        l.id,
        formatDateJakarta(l.createdAt),
        l.borrowerOrLender,
        l.loanAmountRupiah,
        l.remainingLoanRupiah,
        Math.max(0, l.loanAmountRupiah - l.remainingLoanRupiah),
        l.dueDate || '-',
        l.status === 'PAID' ? 'LUNAS (100%)' : 'BELUM LUNAS',
        l.notes || '-',
      ];
    }

    case 'investors': {
      const inv = await db.investors.get(recordId);
      if (!inv) return null;
      return [
        inv.id,
        inv.name,
        inv.capitalAmountRupiah,
        `${inv.sharePercentage}%`,
        formatDateJakarta(inv.joinDate),
        inv.status === 'ACTIVE' ? 'Aktif' : 'Nonaktif',
        inv.notes || '-',
      ];
    }

    case 'personalUsages': {
      const u = await db.personalUsages.get(recordId);
      if (!u) return null;
      return [
        u.id,
        formatDateJakarta(u.createdAt),
        u.robuxUsed,
        u.totalCostRupiah,
        u.robuxUsed > 0 ? (u.totalCostRupiah / u.robuxUsed).toFixed(2) : '0',
        u.notes || '-',
      ];
    }

    default:
      return null;
  }
}

/**
 * Eksekusi pengiriman antrean pending (Maks 50 items)
 */
export async function syncPendingBatch(): Promise<{
  success: boolean;
  processedCount: number;
  remainingCount: number;
  message?: string;
}> {
  if (isSyncInProgress) {
    return { success: false, processedCount: 0, remainingCount: await repository.getPendingSyncCount(), message: 'Sinkronisasi sedang berjalan' };
  }

  const settings = await repository.getSettings();
  if (!settings.googleSheetsUrl || settings.autoSyncEnabled === false) {
    return { success: false, processedCount: 0, remainingCount: await repository.getPendingSyncCount(), message: 'Sinkronisasi tidak aktif atau URL belum diatur' };
  }

  // Cek koneksi nyata terlebih dahulu
  const isOnline = await verifyRealInternet(3000);
  if (!isOnline) {
    return { success: false, processedCount: 0, remainingCount: await repository.getPendingSyncCount(), message: 'Perangkat sedang offline' };
  }

  isSyncInProgress = true;
  broadcastSyncStatus(undefined, true);

  try {
    const batchItems = await repository.getPendingSyncQueue(50);
    if (batchItems.length === 0) {
      isSyncInProgress = false;
      broadcastSyncStatus();
      return { success: true, processedCount: 0, remainingCount: 0 };
    }

    // Bangun payload item dengan data aktual terbaru dari Dexie
    const payloadItems: Array<{
      seq: number;
      tableName: string;
      sheetName: string;
      operation: 'upsert' | 'delete';
      id: string;
      row?: any[];
    }> = [];

    for (const item of batchItems) {
      if (item.seq === undefined) continue;

      const sheetDef = GOOGLE_SHEETS_TABLES[item.tableName];
      const sheetName = sheetDef ? sheetDef.name : item.tableName;

      if (item.operation === 'delete') {
        payloadItems.push({
          seq: item.seq,
          tableName: item.tableName,
          sheetName,
          operation: 'delete',
          id: item.recordId,
        });
      } else {
        const rowData = await formatRecordToSheetRow(item.tableName, item.recordId);
        if (rowData) {
          payloadItems.push({
            seq: item.seq,
            tableName: item.tableName,
            sheetName,
            operation: 'upsert',
            id: item.recordId,
            row: rowData,
          });
        } else {
          // Record sudah tidak ada di Dexie: ubah menjadi operasi delete
          payloadItems.push({
            seq: item.seq,
            tableName: item.tableName,
            sheetName,
            operation: 'delete',
            id: item.recordId,
          });
        }
      }
    }

    const payload = {
      app: 'JufaStore',
      action: 'SYNC_BATCH',
      token: settings.googleSheetsToken || '',
      items: payloadItems,
      timestamp: new Date().toISOString(),
    };

    // Kirim POST dengan Content-Type text/plain agar tidak terkena preflight OPTIONS CORS di Google Apps Script
    const response = await fetch(settings.googleSheetsUrl.trim(), {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(payload),
    });

    let resJson: any = null;
    try {
      resJson = await response.json();
    } catch {
      // Jika mode redirect atau text response
    }

    if (!response.ok || (resJson && resJson.ok === false)) {
      const errMsg = resJson?.message || `HTTP ${response.status}: ${response.statusText}`;
      throw new Error(errMsg);
    }

    // Sukses: Hapus item yang berhasil diproses dari syncQueue
    const seqsToRemove = payloadItems.map((i) => i.seq);
    await repository.removeSyncQueueItems(seqsToRemove);

    const nowIso = new Date().toISOString();
    await repository.updateSettings({
      lastSyncAt: nowIso,
      lastSyncStatus: 'SUCCESS',
      lastSyncError: undefined,
    });

    const remaining = await repository.getPendingSyncCount();

    // Jika masih ada item antrean yang tersisa, jadwalkan batch berikutnya
    if (remaining > 0) {
      setTimeout(() => {
        syncPendingBatch().catch(() => {});
      }, 800);
    }

    return {
      success: true,
      processedCount: payloadItems.length,
      remainingCount: remaining,
      message: `${payloadItems.length} data berhasil disinkronkan ke Google Sheets.`,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Terjadi kegagalan sinkronisasi';

    // Terapkan exponential backoff retry untuk item yang gagal
    const failedItems = await repository.getPendingSyncQueue(50);
    const nowMs = Date.now();

    for (const item of failedItems) {
      if (item.seq !== undefined) {
        const nextRetryCount = (item.retryCount || 0) + 1;
        // Exponential backoff: 2^retryCount * 10 detik (maksimal 1 jam)
        const backoffSeconds = calculateBackoffSeconds(nextRetryCount);
        const nextRetryIso = new Date(nowMs + backoffSeconds * 1000).toISOString();

        await repository.updateSyncQueueItemFailure(
          item.seq,
          errorMsg,
          nextRetryCount,
          nextRetryIso
        );
      }
    }

    await repository.updateSettings({
      lastSyncStatus: 'ERROR',
      lastSyncError: errorMsg,
    });

    return {
      success: false,
      processedCount: 0,
      remainingCount: await repository.getPendingSyncCount(),
      message: errorMsg,
    };
  } finally {
    isSyncInProgress = false;
    broadcastSyncStatus();
  }
}

/**
 * Pemicu Sinkronisasi Ter-debounce (dipanggil setelah perubahan data lokal)
 */
export function scheduleDebouncedSync(delayMs: number = 3000): void {
  if (debouncedSyncTimer) {
    clearTimeout(debouncedSyncTimer);
  }
  debouncedSyncTimer = setTimeout(() => {
    syncPendingBatch().catch(() => {});
  }, delayMs);
}

/**
 * Pemicu Sinkronisasi Manual Seketika
 */
export async function triggerManualSync(): Promise<{ success: boolean; message: string }> {
  const res = await syncPendingBatch();
  return {
    success: res.success,
    message: res.message || (res.success ? 'Sinkronisasi berhasil!' : 'Gagal melakukan sinkronisasi'),
  };
}

/**
 * Pemicu Sinkronisasi Penuh Ulang (Re-queue all data)
 */
export async function triggerFullSync(): Promise<{ success: boolean; message: string }> {
  try {
    const count = await repository.queueFullSync();
    broadcastSyncStatus();
    scheduleDebouncedSync(500);
    return {
      success: true,
      message: `${count} seluruh catatan lokal berhasil dimasukkan ke antrean sinkron penuh.`,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Gagal membuat antrean sinkron penuh';
    return { success: false, message: msg };
  }
}

/**
 * Tes koneksi ke Web App Google Apps Script dengan aksi "ping"
 */
export async function testAppsScriptConnection(
  url: string,
  token?: string
): Promise<{ ok: boolean; message: string }> {
  const cleanUrl = url.trim();
  if (!cleanUrl) {
    return { ok: false, message: 'URL Google Apps Script belum diisi.' };
  }
  if (!cleanUrl.startsWith('https://')) {
    return { ok: false, message: 'URL harus diawali dengan https://' };
  }

  try {
    const payload = {
      app: 'JufaStore',
      action: 'PING',
      token: token?.trim() || '',
      timestamp: new Date().toISOString(),
    };

    const res = await fetch(cleanUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(payload),
    });

    let json: any = null;
    try {
      json = await res.json();
    } catch {}

    if (json && json.ok === true) {
      return { ok: true, message: json.message || 'Koneksi ke Google Apps Script berhasil terverifikasi!' };
    }

    if (json && json.ok === false) {
      return { ok: false, message: json.message || 'Koneksi ditolak oleh Apps Script' };
    }

    if (res.ok || res.type === 'opaque') {
      return { ok: true, message: 'Koneksi berhasil terhubung ke server Google Apps Script.' };
    }

    return { ok: false, message: `Server merespons dengan status: ${res.status}` };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Koneksi gagal';
    return { ok: false, message: `Gagal terhubung: ${msg}` };
  }
}

/**
 * Inisialisasi Service Sinkronisasi Latar Belakang
 */
export function initSyncService(): () => void {
  // 1. Sinkronisasi saat ada mutasi data lokal (debounce 3 detik)
  setOnDataMutatedListener(() => {
    scheduleDebouncedSync(3000);
  });

  // 2. Sinkronisasi saat kembali online
  const unsubOnline = subscribeOnBackOnline(() => {
    scheduleDebouncedSync(1000);
  });

  // 3. Sinkronisasi awal saat aplikasi dibuka
  setTimeout(() => {
    syncPendingBatch().catch(() => {});
  }, 4000);

  // 4. Polling tiap 5 menit saat online
  periodicSyncTimer = setInterval(() => {
    syncPendingBatch().catch(() => {});
  }, 5 * 60 * 1000);

  return () => {
    setOnDataMutatedListener(null);
    unsubOnline();
    if (debouncedSyncTimer) clearTimeout(debouncedSyncTimer);
    if (periodicSyncTimer) clearInterval(periodicSyncTimer);
  };
}
