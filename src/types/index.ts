export interface StockBatch {
  id: string;
  batch_code: string;
  date: string;
  supplier: string;
  initial_quantity: number;
  remaining_quantity: number;
  purchase_cost: number;
  extra_cost: number;
  discount: number;
  total_cost: number;
  cost_per_unit: number;
  payment_method: string;
  payment_status: 'LUNAS' | 'BELUM_LUNAS';
  notes: string;
  created_at: string;
}

export interface BatchAllocation {
  batch_id: string;
  batch_code: string;
  quantity: number;
  cost_per_unit: number;
  subtotal_cost: number;
}

export type PaymentStatus = 'LUNAS' | 'BELUM_LUNAS' | 'SEBAGIAN';
export type DeliveryStatus = 'SELESAI' | 'SEBAGIAN' | 'BELUM_DIKIRIM';
export type TransactionStatus = 'ACTIVE' | 'CANCELLED' | 'REFUNDED';

export interface Transaction {
  id: string;
  transaction_code: string;
  date: string;
  customer_name: string;
  quantity: number;
  sell_rate: number;
  gross_revenue: number;
  discount: number;
  net_revenue: number;
  cogs: number;
  fee: number;
  gross_profit: number;
  net_profit: number;
  margin_percentage: number;
  payment_method: string;
  payment_status: PaymentStatus;
  amount_paid: number;
  accounts_receivable: number;
  delivery_status: DeliveryStatus;
  notes: string;
  source: string;
  batch_allocations: BatchAllocation[];
  status: TransactionStatus;
  created_at: string;
  updated_at: string;
}

export type StockMovementType =
  | 'PURCHASE'
  | 'SALE'
  | 'ADJUSTMENT_ADD'
  | 'ADJUSTMENT_SUB'
  | 'REFUND_RESTORE'
  | 'CANCELLATION_RESTORE';

export interface StockMovement {
  id: string;
  date: string;
  type: StockMovementType;
  quantity: number;
  batch_id?: string;
  batch_code?: string;
  reference_id: string;
  notes: string;
  created_at: string;
}

export type CashflowType = 'IN' | 'OUT';

export type CashflowCategory =
  | 'MODAL_AWAL'
  | 'PENDAPATAN_PENJUALAN'
  | 'PEMBELIAN_STOK'
  | 'BIAYA_TRANSAKSI'
  | 'BIAYA_OPERASIONAL'
  | 'PENGEMBALIAN_DANA'
  | 'PENAMBAHAN_MODAL'
  | 'PRIVE_PEMILIK'
  | 'PENERIMAAN_PIUTANG'
  | 'PEMBAYARAN_UTANG'
  | 'PENYESUAIAN_KAS'
  | string;

export interface Cashflow {
  id: string;
  date: string;
  type: CashflowType;
  category: CashflowCategory;
  amount: number;
  payment_method: string;
  reference_id: string;
  notes: string;
  created_at: string;
}

export interface AppSettings {
  store_name: string;
  currency: string;
  default_rate: number;
  small_pack_threshold: number;
  small_pack_rate: number;
  large_pack_rate: number;
  min_stock_alert: number;
  minStockAlert?: number;
  payment_methods: string[];
  expense_categories: string[];
  suppliers: string[];
  sales_sources: string[];
  stock_method: 'FIFO';
  // Customization & Themes
  custom_logo?: string;
  theme_mode?: 'dark' | 'light' | 'system';
  theme_preset?: string;
  custom_accent_color?: string;
}

export interface DailyBreakdown {
  date: string; // YYYY-MM-DD
  dayLabel: string;
  robuxSold: number;
  grossRevenue: number;
  discount: number;
  netRevenue: number;
  cogs: number;
  grossProfit: number;
  transactionCount: number;

  // Detail Dana Keluar / Terpakai
  restockExpense: number;
  operationalExpense: number;
  transactionFees: number;
  priveWithdrawal: number;
  refundExpense: number;
  otherExpense: number;
  totalExpensesOut: number;

  // Dana Masuk & Saldo Bersih
  totalCashIn: number;
  netCashFlow: number;
  netDailyProfit: number;
}

export interface SalesCalculatorInput {
  quantity: number;
  sell_rate: number;
  cost_per_unit: number;
  discount_nominal: number;
  discount_percent: number;
  fee_nominal: number;
  fee_percent: number;
}

export interface SalesCalculatorResult {
  normal_price: number;
  normalPrice: number;
  discount: number;
  final_price: number;
  finalPrice: number;
  total_cogs: number;
  totalCogs: number;
  fee: number;
  gross_profit: number;
  grossProfit: number;
  net_profit: number;
  netProfit: number;
  margin_percentage: number | null;
  marginPercentage: number | null;
  break_even_price: number;
  breakEvenPrice: number;
  status: 'UNTUNG' | 'IMPAS' | 'RUGI';
}
