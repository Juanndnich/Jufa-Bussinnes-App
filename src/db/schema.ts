export interface AppSettings {
  id: string; // 'current'
  storeName: string;
  theme: 'system' | 'light' | 'dark';
  accentColor: string;
  textSize: 'sm' | 'base' | 'lg';
  customLogoUrl: string | null;
  schemaVersion: number;
  defaultSellRate?: number;
  lastBackupAt?: string;
  googleSheetsUrl?: string;
  googleSpreadsheetDocUrl?: string;
  autoSyncFrequency?: 'REALTIME' | 'DAILY' | 'MONTHLY' | 'MANUAL';
  lastSyncAt?: string;
  googleSheetsToken?: string;
  lastSyncStatus?: 'SUCCESS' | 'ERROR' | 'SYNCING';
  lastSyncError?: string;
  autoSyncEnabled?: boolean;
  sheetsWebhookUrl?: string;
  sheetsSecret?: string;
  sheetsSyncEnabled?: boolean;
  lastSheetsSyncAt?: string;
  lastSheetsSyncStatus?: 'IDLE' | 'SYNCING' | 'SUCCESS' | 'ERROR';
  lastSheetsSyncError?: string;
  tableHashes?: Record<string, string>;
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
  fundingSource?: 'OWN_FUNDS' | 'LOAN' | 'COMBINED';
  ownFundsRupiah?: number;
  loanFundsRupiah?: number;
  loanId?: string;
  notes?: string;
}

export type StockMovementType = 
  | 'RESTOCK' 
  | 'SALE' 
  | 'PERSONAL_USE' 
  | 'RECONCILE_ADD' 
  | 'VOID_RESTORE'
  | 'EDIT';

export interface StockMovement {
  id: string;
  batchId: string;
  type: StockMovementType;
  robuxAmount: number;
  costAllocatedRupiah: number;
  referenceId: string;
  createdAt: string;
  notes?: string;
  balanceAfter?: number;
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

export interface Investor {
  id: string;
  name: string;
  capitalAmountRupiah: number;
  sharePercentage: number; // Persentase bagi hasil (misal: 30 untuk 30%)
  joinDate: string; // YYYY-MM-DD
  status: 'ACTIVE' | 'INACTIVE';
  notes?: string;
  createdAt: string;
}

export interface InvestorPayout {
  id: string;
  investorId: string;
  investorName: string;
  amountRupiah: number;
  periodNotes?: string;
  createdAt: string;
}

export interface LoanPayment {
  id: string;
  amountRupiah: number;
  date: string;
  source: 'AUTO_SALE' | 'MANUAL';
  notes?: string;
}

export interface Loan {
  id: string;
  batchId?: string;
  borrowerOrLender: string; // Pemberi pinjaman / kreditor
  loanAmountRupiah: number; // Pokok utang
  remainingLoanRupiah: number; // Sisa pokok utang
  dueDate: string; // YYYY-MM-DD
  status: 'ACTIVE' | 'PAID';
  notes?: string;
  createdAt: string;
  payments: LoanPayment[];
}

export type SyncOperation = 'upsert' | 'delete';

export interface SyncQueueItem {
  seq?: number;
  tableName: string;
  recordId: string;
  operation: SyncOperation;
  createdAt: string;
  retryCount: number;
  lastError?: string;
  nextRetryAt?: string;
}
