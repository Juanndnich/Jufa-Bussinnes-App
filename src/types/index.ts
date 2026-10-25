export type ThemeMode = 'dark' | 'light';

export interface StockEntry {
  id: string;
  date: string; // ISO string
  robux: number;
  total_cost: number;
  cost_per_unit: number; // total_cost / robux
  notes?: string;
}

export interface SaleEntry {
  id: string;
  date: string; // ISO string
  customer_name?: string;
  robux: number;
  sell_price: number; // Rupiah ril diterima
  sell_rate: number; // Rp per 1 Robux
  cost_per_unit: number; // Rata-rata modal saat dijual
  cogs: number; // Modal barang terjual = robux * cost_per_unit
  profit: number; // sell_price - cogs
  notes?: string;
}

export interface JufaStoreData {
  stocks: StockEntry[];
  sales: SaleEntry[];
  theme: ThemeMode;
}

export interface DashboardStats {
  currentStockRobux: number;
  totalModalDikeluarkan: number;
  sisaNilaiModalStok: number;
  avgCostPerRobux: number;
  totalOmzet: number;
  totalProfit: number;
  todayRobuxSold: number;
  todayProfit: number;
  monthRobuxSold: number;
  monthProfit: number;
}
