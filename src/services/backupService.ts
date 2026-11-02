import { z } from 'zod';
import { db } from '../db/db';
import { repository } from '../db/repository';
import { triggerFullSheetsSync } from './sheetsSync';

export const StockMovementBackupSchema = z.object({
  id: z.string(),
  batchId: z.string(),
  type: z.enum(['RESTOCK', 'SALE', 'PERSONAL_USE', 'RECONCILE_ADD', 'VOID_RESTORE', 'EDIT']),
  robuxAmount: z.number(),
  costAllocatedRupiah: z.number(),
  referenceId: z.string(),
  createdAt: z.string(),
  notes: z.string().optional(),
  balanceAfter: z.number().optional(),
}).passthrough();

export const BackupSchema = z.object({
  version: z.number().optional(),
  exportedAt: z.string().optional(),
  settings: z.array(z.any()).optional(),
  ratePresets: z.array(z.any()).optional(),
  stockBatches: z.array(z.any()).optional(),
  stockMovements: z.array(z.any()).optional(),
  sales: z.array(z.any()).optional(),
  personalUsages: z.array(z.any()).optional(),
  cashLedger: z.array(z.any()).optional(),
  categories: z.array(z.any()).optional(),
  auditLogs: z.array(z.any()).optional(),
  investors: z.array(z.any()).optional(),
  investorPayouts: z.array(z.any()).optional(),
  loans: z.array(z.any()).optional(),
});

export type BackupData = z.infer<typeof BackupSchema>;

/**
 * Sanitasi pengaturan: hapus token Google Sheets dari objek cadangan
 */
export function sanitizeSettingsForBackup(settings: any[]): any[] {
  return settings.map((setting) => {
    const { googleSheetsToken, sheetsSecret, ...rest } = setting;
    return rest;
  });
}

/**
 * Mengambil seluruh data lokal dan membuat objek cadangan JSON.
 * Token sinkronisasi (googleSheetsToken) dikecualikan demi keamanan kredensial.
 */
export async function createBackupData(): Promise<BackupData> {
  const [
    s,
    presets,
    batches,
    movements,
    sales,
    usages,
    ledger,
    cats,
    logs,
    invs,
    pays,
    allLoans,
  ] = await Promise.all([
    db.settings.toArray(),
    db.ratePresets.toArray(),
    db.stockBatches.toArray(),
    db.stockMovements.toArray(),
    db.sales.toArray(),
    db.personalUsages.toArray(),
    db.cashLedger.toArray(),
    db.categories.toArray(),
    db.auditLogs.toArray(),
    db.investors.toArray(),
    db.investorPayouts.toArray(),
    db.loans.toArray(),
  ]);

  // Hapus token Google Sheets dari file ekspor cadangan
  const sanitizedSettings = sanitizeSettingsForBackup(s);

  return {
    version: 3,
    exportedAt: new Date().toISOString(),
    settings: sanitizedSettings,
    ratePresets: presets,
    stockBatches: batches,
    stockMovements: movements,
    sales,
    personalUsages: usages,
    cashLedger: ledger,
    categories: cats,
    auditLogs: logs,
    investors: invs,
    investorPayouts: pays,
    loans: allLoans,
  };
}

/**
 * Ekspor cadangan sebagai file unduhan JSON dan perbarui lastBackupAt.
 */
export async function exportBackupToFile(): Promise<string> {
  const backupData = await createBackupData();
  const jsonStr = JSON.stringify(backupData, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `JufaStore_Backup_${Date.now()}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  const nowIso = new Date().toISOString();
  await repository.updateSettings({ lastBackupAt: nowIso });
  return nowIso;
}

/**
 * Ambil teks cadangan JSON untuk disalin ke papan klip dan perbarui lastBackupAt.
 */
export async function getBackupJsonString(): Promise<{ jsonStr: string; timestamp: string }> {
  const backupData = await createBackupData();
  const jsonStr = JSON.stringify(backupData, null, 2);
  const nowIso = new Date().toISOString();
  await repository.updateSettings({ lastBackupAt: nowIso });
  return { jsonStr, timestamp: nowIso };
}

/**
 * Memulihkan data dari struktur BackupData ke IndexedDB.
 * Setelah restore selesai, memicu full re-sync antrean Google Sheets.
 */
export async function restoreFromBackupData(data: BackupData): Promise<void> {
  // Ambil token Google Sheets lokal yang ada agar tidak hilang jika cadangan tidak memilikinya
  const currentSettings = await db.settings.toCollection().first();
  const existingToken = currentSettings?.googleSheetsToken;
  const existingSecret = currentSettings?.sheetsSecret;
  const existingUrl = currentSettings?.sheetsWebhookUrl || currentSettings?.googleSheetsUrl;

  await db.transaction(
    'rw',
    [
      db.settings,
      db.ratePresets,
      db.stockBatches,
      db.stockMovements,
      db.sales,
      db.personalUsages,
      db.cashLedger,
      db.categories,
      db.auditLogs,
      db.investors,
      db.investorPayouts,
      db.loans,
    ],
    async () => {
      if (data.settings) {
        await db.settings.clear();
        const settingsToPut = data.settings.map((st: any) => ({
          ...st,
          googleSheetsToken: st.googleSheetsToken || existingToken,
          sheetsSecret: st.sheetsSecret || existingSecret,
          sheetsWebhookUrl: st.sheetsWebhookUrl || existingUrl,
        }));
        await db.settings.bulkPut(settingsToPut);
      }
      if (data.ratePresets) {
        await db.ratePresets.clear();
        await db.ratePresets.bulkPut(data.ratePresets);
      }
      if (data.stockBatches) {
        await db.stockBatches.clear();
        await db.stockBatches.bulkPut(data.stockBatches);
      }
      if (data.stockMovements) {
        await db.stockMovements.clear();
        await db.stockMovements.bulkPut(data.stockMovements);
      }
      if (data.sales) {
        await db.sales.clear();
        await db.sales.bulkPut(data.sales);
      }
      if (data.personalUsages) {
        await db.personalUsages.clear();
        await db.personalUsages.bulkPut(data.personalUsages);
      }
      if (data.cashLedger) {
        await db.cashLedger.clear();
        await db.cashLedger.bulkPut(data.cashLedger);
      }
      if (data.categories) {
        await db.categories.clear();
        await db.categories.bulkPut(data.categories);
      }
      if (data.auditLogs) {
        await db.auditLogs.clear();
        await db.auditLogs.bulkPut(data.auditLogs);
      }
      if (data.investors) {
        await db.investors.clear();
        await db.investors.bulkPut(data.investors);
      }
      if (data.investorPayouts) {
        await db.investorPayouts.clear();
        await db.investorPayouts.bulkPut(data.investorPayouts);
      }
      if (data.loans) {
        await db.loans.clear();
        await db.loans.bulkPut(data.loans);
      }
    }
  );

  const nowIso = new Date().toISOString();
  await repository.updateSettings({ lastBackupAt: nowIso });

  // Sesuai requirement: Backup restore triggers full re-sync (queue all records)
  triggerFullSheetsSync().catch(() => {});
}

/**
 * Validasi dan pulihkan dari file JSON
 */
export async function restoreFromFile(file: File): Promise<void> {
  const text = await file.text();
  const rawJson = JSON.parse(text);
  const parsed = BackupSchema.safeParse(rawJson);
  if (!parsed.success) {
    throw new Error('Format file JSON tidak valid atau rusak!');
  }
  await restoreFromBackupData(parsed.data);
}

/**
 * Validasi dan pulihkan dari string JSON
 */
export async function restoreFromJsonText(jsonText: string): Promise<void> {
  const rawJson = JSON.parse(jsonText.trim());
  const parsed = BackupSchema.safeParse(rawJson);
  if (!parsed.success) {
    throw new Error('Teks JSON tidak sesuai dengan skema backup JufaStore!');
  }
  await restoreFromBackupData(parsed.data);
}
