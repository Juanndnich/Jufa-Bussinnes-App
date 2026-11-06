import Dexie, { Table } from 'dexie';
import {
  AppSettings,
  RatePreset,
  StockBatch,
  StockMovement,
  Sale,
  PersonalUsage,
  CashLedgerEntry,
  Category,
  AuditLog,
  Investor,
  InvestorPayout,
  Loan,
  SavingsEntry,
  SavingsCategory,
  SyncQueueItem,
} from './schema';

export class JufaStoreDatabase extends Dexie {
  settings!: Table<AppSettings, string>;
  ratePresets!: Table<RatePreset, string>;
  stockBatches!: Table<StockBatch, string>;
  stockMovements!: Table<StockMovement, string>;
  sales!: Table<Sale, string>;
  personalUsages!: Table<PersonalUsage, string>;
  cashLedger!: Table<CashLedgerEntry, string>;
  categories!: Table<Category, string>;
  auditLogs!: Table<AuditLog, string>;
  investors!: Table<Investor, string>;
  investorPayouts!: Table<InvestorPayout, string>;
  loans!: Table<Loan, string>;
  savingsEntries!: Table<SavingsEntry, string>;
  savingsCategories!: Table<SavingsCategory, string>;
  syncQueue?: Table<any, number>;

  constructor() {
    super('JufaStoreDB');

    // Versi 1 Skema Dexie
    this.version(1).stores({
      settings: 'id',
      ratePresets: 'id, rate, createdAt',
      stockBatches: 'id, sourceType, createdAt, remainingRobux',
      stockMovements: 'id, batchId, type, referenceId, createdAt',
      sales: 'id, invoiceNumber, createdAt, status',
      personalUsages: 'id, categoryId, createdAt',
      cashLedger: 'id, dateKey, createdAt, type, sourceType, categoryId',
      categories: 'id, name, type, createdAt',
      auditLogs: 'id, entity, entityId, createdAt',
    });

    // Versi 2: Penambahan Tabel Investor & Riwayat Bagi Hasil
    this.version(2).stores({
      settings: 'id',
      ratePresets: 'id, rate, createdAt',
      stockBatches: 'id, sourceType, createdAt, remainingRobux',
      stockMovements: 'id, batchId, type, referenceId, createdAt',
      sales: 'id, invoiceNumber, createdAt, status',
      personalUsages: 'id, categoryId, createdAt',
      cashLedger: 'id, dateKey, createdAt, type, sourceType, categoryId',
      categories: 'id, name, type, createdAt',
      auditLogs: 'id, entity, entityId, createdAt',
      investors: 'id, name, status, createdAt',
      investorPayouts: 'id, investorId, createdAt',
    });

    // Versi 3: Penambahan Sumber Dana Pinjaman/Utang Modal
    this.version(3).stores({
      settings: 'id',
      ratePresets: 'id, rate, createdAt',
      stockBatches: 'id, sourceType, createdAt, remainingRobux, fundingSource, loanId',
      stockMovements: 'id, batchId, type, referenceId, createdAt',
      sales: 'id, invoiceNumber, createdAt, status',
      personalUsages: 'id, categoryId, createdAt',
      cashLedger: 'id, dateKey, createdAt, type, sourceType, categoryId',
      categories: 'id, name, type, createdAt',
      auditLogs: 'id, entity, entityId, createdAt',
      investors: 'id, name, status, createdAt',
      investorPayouts: 'id, investorId, createdAt',
      loans: 'id, batchId, status, dueDate, createdAt',
    });

    // Versi 4: Index sourceId pada cashLedger untuk relasi transaksi & hapus batch
    this.version(4).stores({
      cashLedger: 'id, dateKey, createdAt, type, sourceType, sourceId, categoryId',
    });
    // Versi 5: Penambahan tabel syncQueue untuk sinkronisasi Google Sheets berbasis antrean
    this.version(5).stores({
      syncQueue: '++seq, tableName, recordId, createdAt, nextRetryAt',
    });

    // Versi 6: Rombak total sinkronisasi Sheets menjadi cermin per tabel; hapus syncQueue
    this.version(6).stores({
      syncQueue: null,
    });

    // Versi 7: Penambahan Buku Tabungan Pribadi & Kategori Tabungan
    this.version(7).stores({
      savingsEntries: 'id, type, category, dateKey, createdAt',
      savingsCategories: 'id, name, createdAt',
    });
  }
}

export const db = new JufaStoreDatabase();

/**
 * Inisialisasi pengaturan default (TIDAK ADA DATA BISNIS / STRICT ZERO STATE)
 */
export async function getOrInitSettings(): Promise<AppSettings> {
  const existing = await db.settings.get('current');
  if (existing) {
    return existing;
  }

  const defaultSettings: AppSettings = {
    id: 'current',
    storeName: 'JufaStore',
    theme: 'dark',
    accentColor: '#10b981', // Emerald modern
    textSize: 'base',
    customLogoUrl: null,
    schemaVersion: 1,
  };

  await db.settings.put(defaultSettings);
  return defaultSettings;
}
