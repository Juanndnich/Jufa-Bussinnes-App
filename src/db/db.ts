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
