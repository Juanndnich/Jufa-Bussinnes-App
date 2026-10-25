export interface AppSettings {
  id: string; // 'current'
  storeName: string;
  theme: 'system' | 'light' | 'dark';
  accentColor: string;
  textSize: 'sm' | 'base' | 'lg';
  customLogoUrl: string | null;
  schemaVersion: number;
  lastBackupAt?: string;
}

export interface RatePreset {
  id: string;
  rate: number;
  label?: string;
  createdAt: string;
}

export type StockSourceType = 'RESTOCK' | 'ACCOUNT_REMAINDER';

export interface StockBatch {
  id: string;
  createdAt: string;
  sourceType: StockSourceType;
  initialRobux: number;
  remainingRobux: number;
  totalCostRupiah: number;
  remainingCostRupiah: number;
  unitCostDisplay: number;
  notes?: string;
}

export type StockMovementType = 
  | 'RESTOCK' 
  | 'SALE' 
  | 'PERSONAL_USE' 
  | 'RECONCILE_ADD' 
  | 'VOID_RESTORE';

export interface StockMovement {
  id: string;
  batchId: string;
  type: StockMovementType;
  robuxAmount: number;
  costAllocatedRupiah: number;
  referenceId: string;
  createdAt: string;
}

export interface SaleAllocationItem {
  batchId: string;
  robuxTaken: number;
  costAllocatedRupiah: number;
}

export type SaleStatus = 'ACTIVE' | 'VOID';

export interface Sale {
  id: string;
  invoiceNumber: string;
  createdAt: string;
  customerName?: string;
  robuxSold: number;
  rateUsed: number;
  totalRevenueRupiah: number;
  totalCogsRupiah: number;
  grossProfitRupiah: number;
  notes?: string;
  status: SaleStatus;
  allocations: SaleAllocationItem[];
}

export interface PersonalUsage {
  id: string;
  createdAt: string;
  robuxUsed: number;
  totalCostRupiah: number;
  categoryId?: string;
  notes?: string;
  allocations: SaleAllocationItem[];
}

export type CashLedgerType = 'IN' | 'OUT';
export type CashLedgerSourceType = 'SALE' | 'RESTOCK' | 'MANUAL';

export interface CashLedgerEntry {
  id: string;
  dateKey: string; // YYYY-MM-DD
  createdAt: string;
  type: CashLedgerType;
  amountRupiah: number;
  categoryId?: string;
  tags?: string[];
  sourceType: CashLedgerSourceType;
  sourceId?: string;
  notes?: string;
}

export interface Category {
  id: string;
  name: string;
  color: string;
  type: 'EXPENSE' | 'INCOME' | 'PERSONAL';
  createdAt: string;
}

export interface AuditLog {
  id: string;
  action: string;
  entity: string;
  entityId: string;
  details: string;
  createdAt: string;
}
