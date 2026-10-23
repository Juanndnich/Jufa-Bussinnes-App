import React, { useMemo, useState } from 'react';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Package,
  ShoppingCart,
  AlertCircle,
  Coins,
  ArrowUpRight,
  Layers,
  Award,
  Wallet,
  BarChart2,
  Calendar,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { AppSettings, Cashflow, StockBatch, Transaction } from '../types';
import { formatDecimal, formatNumber, formatRupiah } from '../utils/formatters';
import { calculateWeightedAverageRate, safeDivide } from '../utils/calculations';
import { computeDailyBreakdowns } from '../utils/dailyJournal';

interface DashboardViewProps {
  transactions: Transaction[];
  batches: StockBatch[];
  cashflows: Cashflow[];
  settings: AppSettings;
  onNavigate: (tab: any) => void;
}

type DateFilterOption =
  | 'today'
  | 'yesterday'
  | '7days'
  | '30days'
  | 'thisMonth'
  | 'lastMonth'
  | 'thisYear'
  | 'all';

export const DashboardView: React.FC<DashboardViewProps> = ({
  transactions,
  batches,
  cashflows,
  settings,
  onNavigate,
}) => {
  // Default filter period: 'today' (Hari Ini) as requested by user
  const [filterPeriod, setFilterPeriod] = useState<DateFilterOption>('today');
  const [chartType, setChartType] = useState<'revenue_profit' | 'robux_volume'>('revenue_profit');
  const [isDailyRecapOpen, setIsDailyRecapOpen] = useState(false);

  // 1. Calculate Current Global Stock & Value
  const totalStockAvailable = useMemo(() => {
    return batches.reduce((sum, b) => sum + (b.remaining_quantity || 0), 0);
  }, [batches]);

  const stockAssetValue = useMemo(() => {
    return batches.reduce(
      (sum, b) => sum + (b.remaining_quantity || 0) * (b.cost_per_unit || 0),
      0
    );
  }, [batches]);

  // 2. Global Cash Balance
  const totalCashIn = useMemo(() => {
    return cashflows.filter(c => c.type === 'IN').reduce((sum, c) => sum + c.amount, 0);
  }, [cashflows]);

  const totalCashOut = useMemo(() => {
    return cashflows.filter(c => c.type === 'OUT').reduce((sum, c) => sum + c.amount, 0);
  }, [cashflows]);

  const cashBalance = totalCashIn - totalCashOut;

  // Filter Transactions by Date Range
  const filteredData = useMemo(() => {
    const now = new Date();
    let startDate = new Date();
    let endDate = new Date();

    if (filterPeriod === 'today') {
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
    } else if (filterPeriod === 'yesterday') {
      startDate.setDate(now.getDate() - 1);
      startDate.setHours(0, 0, 0, 0);
      endDate.setDate(now.getDate() - 1);
      endDate.setHours(23, 59, 59, 999);
    } else if (filterPeriod === '7days') {
      startDate.setDate(now.getDate() - 7);
      startDate.setHours(0, 0, 0, 0);
    } else if (filterPeriod === '30days') {
      startDate.setDate(now.getDate() - 30);
      startDate.setHours(0, 0, 0, 0);
    } else if (filterPeriod === 'thisMonth') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    } else if (filterPeriod === 'lastMonth') {
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    } else if (filterPeriod === 'thisYear') {
      startDate = new Date(now.getFullYear(), 0, 1);
      endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
    } else if (filterPeriod === 'all') {
      startDate = new Date(1970, 0, 1);
      endDate = new Date(2099, 11, 31);
    }

    const validTrxs = transactions.filter(t => {
      if (t.status === 'CANCELLED') return false;
      const d = new Date(t.date);
      return d >= startDate && d <= endDate;
    });

    const validCfs = cashflows.filter(c => {
      const d = new Date(c.date);
      return d >= startDate && d <= endDate;
    });

    return { validTrxs, validCfs, startDate, endDate };
  }, [transactions, cashflows, filterPeriod]);

  // Aggregate Metrics
  const metrics = useMemo(() => {
    const trxs = filteredData.validTrxs;
    const cfs = filteredData.validCfs;

    const grossRevenue = trxs.reduce((sum, t) => sum + (t.gross_revenue || 0), 0);
    const discounts = trxs.reduce((sum, t) => sum + (t.discount || 0), 0);
    const netRevenue = trxs.reduce((sum, t) => sum + (t.net_revenue || 0), 0);
    const cogs = trxs.reduce((sum, t) => sum + (t.cogs || 0), 0);
    const grossProfit = netRevenue - cogs;
    const txFees = trxs.reduce((sum, t) => sum + (t.fee || 0), 0);

    const opExpenses = cfs
      .filter(c => c.type === 'OUT' && c.category === 'BIAYA_OPERASIONAL')
      .reduce((sum, c) => sum + c.amount, 0);

    const netProfit = grossProfit - txFees - opExpenses;

    const totalRobuxSold = trxs.reduce((sum, t) => sum + (t.quantity || 0), 0);
    const transactionCount = trxs.length;

    const avgTransactionValue = safeDivide(netRevenue, transactionCount, 0);
    const avgRobuxPerTransaction = safeDivide(totalRobuxSold, transactionCount, 0);
    const weightedAvgSellRate = calculateWeightedAverageRate(netRevenue, totalRobuxSold);

    const diffDays = Math.max(
      1,
      Math.round(
        (filteredData.endDate.getTime() - filteredData.startDate.getTime()) /
          (1000 * 60 * 60 * 24)
      )
    );
    const avgDailyRevenue = safeDivide(netRevenue, diffDays, 0);
    const avgDailyProfit = safeDivide(netProfit, diffDays, 0);

    const lossTransactions = trxs.filter(t => t.net_profit < 0);

    return {
      grossRevenue,
      discounts,
      netRevenue,
      cogs,
      grossProfit,
      txFees,
      opExpenses,
      netProfit,
      totalRobuxSold,
      transactionCount,
      avgTransactionValue,
      avgRobuxPerTransaction,
      weightedAvgSellRate,
      avgDailyRevenue,
      avgDailyProfit,
      lossTransactions,
    };
  }, [filteredData]);

  // Compute 7-day chart data points
  const chartData = useMemo(() => {
    const days: { label: string; shortLabel: string; dateStr: string; revenue: number; profit: number; robux: number }[] = [];
    const now = new Date();

    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(now.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const label = d.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric' });
      const shortLabel = d.toLocaleDateString('id-ID', { weekday: 'short' });

      const dayTrxs = transactions.filter(t => t.status !== 'CANCELLED' && t.date.slice(0, 10) === dateStr);
      const rev = dayTrxs.reduce((s, t) => s + (t.net_revenue || 0), 0);
      const prof = dayTrxs.reduce((s, t) => s + (t.net_profit || 0), 0);
      const rbx = dayTrxs.reduce((s, t) => s + (t.quantity || 0), 0);

      days.push({ label, shortLabel, dateStr, revenue: rev, profit: prof, robux: rbx });
    }

    const maxRev = Math.max(1, ...days.map(d => d.revenue));
    const maxRobux = Math.max(1, ...days.map(d => d.robux));

    return { days, maxRev, maxRobux };
  }, [transactions]);

  const dailyBreakdowns = useMemo(() => {
    return computeDailyBreakdowns(transactions, cashflows);
  }, [transactions, cashflows]);

  const isStockLow = totalStockAvailable <= (settings.min_stock_alert ?? settings.minStockAlert ?? 500);

  return (
    <div className="space-y-6">
      {/* Top Header & Filter Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b theme-border pb-4">
        <div>
          <h2 className="text-base sm:text-lg font-heading font-bold theme-text-primary">
            Ringkasan Bisnis JUFA STORE
          </h2>
          <p className="text-xs theme-text-secondary">
            Performa penjualan Robux, perputaran stok FIFO, dan arus kas riil.
          </p>
        </div>

        {/* Period Filter Dropdown / Pills (Default: Hari Ini) */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 theme-bg-card border theme-border px-3 py-1.5 rounded-xl">
            <Calendar size={14} className="theme-text-muted" />
            <select
              value={filterPeriod}
              onChange={e => setFilterPeriod(e.target.value as DateFilterOption)}
              className="theme-bg-card theme-text-primary text-xs font-bold focus:outline-none cursor-pointer"
            >
              <option value="today">Hari Ini</option>
              <option value="yesterday">Kemarin</option>
              <option value="7days">7 Hari Terakhir</option>
              <option value="30days">30 Hari Terakhir</option>
              <option value="thisMonth">Bulan Ini</option>
              <option value="lastMonth">Bulan Lalu</option>
              <option value="thisYear">Tahun Ini</option>
              <option value="all">Semua Waktu</option>
            </select>
          </div>
        </div>
      </div>

      {/* Warnings Banner */}
      {isStockLow && totalStockAvailable > 0 && (
        <div className="p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-500 flex items-start gap-2.5 text-xs">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <div>
            <strong>Peringatan: Stok Robux Anda Menipis!</strong>
            <p className="mt-0.5 opacity-90">
              Sisa stok saat ini <strong className="font-mono">{formatNumber(totalStockAvailable)} R$</strong> (di bawah batas minimum {formatNumber(settings.min_stock_alert || 500)} R$). Disarankan segera melakukan restock.
            </p>
          </div>
        </div>
      )}

      {/* Key Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        {/* Card 1: Pendapatan Bersih */}
        <div className="theme-bg-surface p-3.5 sm:p-5 rounded-2xl border theme-border space-y-1 overflow-hidden">
          <div className="flex items-center justify-between text-xs theme-text-secondary">
            <span className="truncate">Pendapatan</span>
            <DollarSign size={15} className="theme-text-muted shrink-0" />
          </div>
          <div className="text-base sm:text-lg lg:text-xl font-heading font-bold theme-text-primary font-mono tracking-tight whitespace-nowrap overflow-hidden text-ellipsis">
            {formatRupiah(metrics.netRevenue)}
          </div>
          <span className="text-[10px] theme-text-muted block truncate">
            {metrics.transactionCount} transaksi pesanan
          </span>
        </div>

        {/* Card 2: Laba Bersih */}
        <div className="theme-bg-surface p-3.5 sm:p-5 rounded-2xl border theme-border space-y-1 overflow-hidden">
          <div className="flex items-center justify-between text-xs theme-text-secondary">
            <span className="truncate">Laba Bersih</span>
            <TrendingUp size={15} className="text-emerald-400 shrink-0" />
          </div>
          <div
            className={`text-base sm:text-lg lg:text-xl font-heading font-bold font-mono tracking-tight whitespace-nowrap overflow-hidden text-ellipsis ${
              metrics.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {formatRupiah(metrics.netProfit)}
          </div>
          <span className="text-[10px] theme-text-muted block truncate">
            Setelah HPP & operasional
          </span>
        </div>

        {/* Card 3: Robux Terjual */}
        <div className="theme-bg-surface p-3.5 sm:p-5 rounded-2xl border theme-border space-y-1 overflow-hidden">
          <div className="flex items-center justify-between text-xs theme-text-secondary">
            <span className="truncate">Robux Terjual</span>
            <Coins size={15} className="text-amber-400 shrink-0" />
          </div>
          <div className="text-base sm:text-lg lg:text-xl font-heading font-bold theme-text-primary font-mono tracking-tight whitespace-nowrap overflow-hidden text-ellipsis">
            {formatNumber(metrics.totalRobuxSold)} <span className="text-xs font-normal">R$</span>
          </div>
          <span className="text-[10px] theme-text-muted block truncate">
            Rata-rata: Rp{formatDecimal(metrics.weightedAvgSellRate)}/R$
          </span>
        </div>

        {/* Card 4: Sisa Stok Robux */}
        <div className="theme-bg-surface p-3.5 sm:p-5 rounded-2xl border theme-border space-y-1 overflow-hidden">
          <div className="flex items-center justify-between text-xs theme-text-secondary">
            <span className="truncate">Stok Tersisa</span>
            <Package size={15} className="theme-text-muted shrink-0" />
          </div>
          <div className="text-base sm:text-lg lg:text-xl font-heading font-bold theme-text-primary font-mono tracking-tight whitespace-nowrap overflow-hidden text-ellipsis">
            {formatNumber(totalStockAvailable)} <span className="text-xs font-normal">R$</span>
          </div>
          <span className="text-[10px] theme-text-muted block truncate">
            Aset: {formatRupiah(stockAssetValue)}
          </span>
        </div>
      </div>

      {/* Statistical Interactive Chart Section */}
      <div className="theme-bg-surface p-4 sm:p-6 rounded-2xl border theme-border space-y-4 overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b theme-border pb-3">
          <div>
            <h3 className="font-heading font-bold theme-text-primary text-sm flex items-center gap-2">
              <BarChart2 size={16} /> Grafik Statistik Tren 7 Hari Terakhir
            </h3>
            <p className="text-xs theme-text-secondary mt-0.5">
              Visualisasi grafik harian omzet, laba bersih, dan kuantitas Robux.
            </p>
          </div>

          <div className="flex items-center gap-1.5 theme-bg-card p-1 rounded-xl border theme-border self-start sm:self-auto">
            <button
              onClick={() => setChartType('revenue_profit')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                chartType === 'revenue_profit'
                  ? 'theme-bg-surface theme-text-primary shadow-sm border theme-border'
                  : 'theme-text-muted hover:theme-text-primary'
              }`}
            >
              Omzet & Laba
            </button>
            <button
              onClick={() => setChartType('robux_volume')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                chartType === 'robux_volume'
                  ? 'theme-bg-surface theme-text-primary shadow-sm border theme-border'
                  : 'theme-text-muted hover:theme-text-primary'
              }`}
            >
              Volume Robux
            </button>
          </div>
        </div>

        {/* Visual Bar Chart - 100% Contained & Responsive */}
        <div className="w-full overflow-hidden pt-2">
          {/* Chart Bars Drawing Area with background grid */}
          <div className="relative h-44 sm:h-52 w-full flex items-end justify-between gap-1 sm:gap-3 px-1 sm:px-2 pt-6 pb-1 border-b theme-border">
            {/* Horizontal Grid Guidelines */}
            <div className="absolute inset-x-0 top-6 border-b theme-border-subtle opacity-40 pointer-events-none" />
            <div className="absolute inset-x-0 top-1/2 border-b theme-border-subtle opacity-40 pointer-events-none" />

            {chartData.days.map((item, idx) => {
              const revPercent = Math.max(4, Math.min(100, Math.round((item.revenue / chartData.maxRev) * 100)));
              const profPercent = Math.max(3, Math.min(100, Math.round((Math.max(0, item.profit) / chartData.maxRev) * 100)));
              const robuxPercent = Math.max(4, Math.min(100, Math.round((item.robux / chartData.maxRobux) * 100)));

              return (
                <div key={idx} className="flex-1 flex flex-col items-center h-full justify-end group relative z-10 min-w-0">
                  {/* Tooltip on Hover */}
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 absolute bottom-full mb-2 z-30 pointer-events-none theme-bg-card border theme-border rounded-lg p-2 text-[10px] shadow-xl whitespace-nowrap left-1/2 -translate-x-1/2">
                    <div className="font-bold theme-text-primary">{item.dateStr}</div>
                    <div className="theme-text-secondary">Omzet: {formatRupiah(item.revenue)}</div>
                    <div className="text-emerald-400">Laba: {formatRupiah(item.profit)}</div>
                    <div className="text-amber-400">Robux: {formatNumber(item.robux)} R$</div>
                  </div>

                  {/* Bars Container */}
                  <div className="w-full flex items-end justify-center gap-0.5 sm:gap-1.5 h-full">
                    {chartType === 'revenue_profit' ? (
                      <>
                        <div
                          style={{ height: `${revPercent}%` }}
                          className="w-full max-w-[14px] sm:max-w-[22px] rounded-t-sm sm:rounded-t-md bg-zinc-400/80 group-hover:bg-white transition-all duration-200"
                          title={`Omzet: ${formatRupiah(item.revenue)}`}
                        />
                        <div
                          style={{ height: `${profPercent}%` }}
                          className="w-full max-w-[14px] sm:max-w-[22px] rounded-t-sm sm:rounded-t-md bg-emerald-500/85 group-hover:bg-emerald-400 transition-all duration-200"
                          title={`Laba: ${formatRupiah(item.profit)}`}
                        />
                      </>
                    ) : (
                      <div
                        style={{ height: `${robuxPercent}%` }}
                        className="w-full max-w-[22px] sm:max-w-[34px] rounded-t-sm sm:rounded-t-md bg-amber-500/85 group-hover:bg-amber-400 transition-all duration-200"
                        title={`Robux: ${formatNumber(item.robux)} R$`}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* X Axis Date Labels (Guaranteed contained, never stretches parent) */}
          <div className="flex items-center justify-between gap-1 sm:gap-3 px-1 sm:px-2 pt-2">
            {chartData.days.map((item, idx) => (
              <div key={idx} className="flex-1 text-center min-w-0" title={item.label}>
                <span className="text-[9px] sm:text-[10px] theme-text-muted font-mono block truncate">
                  {item.shortLabel}
                </span>
              </div>
            ))}
          </div>

          {/* Chart Legend */}
          <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-6 mt-4 pt-3 border-t theme-border text-xs">
            {chartType === 'revenue_profit' ? (
              <>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded bg-zinc-400 inline-block shrink-0" />
                  <span className="theme-text-secondary text-[11px] sm:text-xs">Omzet Penjualan</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded bg-emerald-500 inline-block shrink-0" />
                  <span className="theme-text-secondary text-[11px] sm:text-xs">Laba Bersih</span>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-amber-500 inline-block shrink-0" />
                <span className="theme-text-secondary text-[11px] sm:text-xs">Volume Robux Terjual (R$)</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Collapsible 24-Hours Recap Journal */}
      <div className="theme-bg-surface p-5 sm:p-6 rounded-2xl border theme-border space-y-4">
        <button
          onClick={() => setIsDailyRecapOpen(!isDailyRecapOpen)}
          className="w-full flex items-center justify-between text-left focus:outline-none"
        >
          <div>
            <h3 className="font-heading font-bold theme-text-primary text-sm">
              Rekapitulasi Harian & Mutasi Kas
            </h3>
            <p className="text-xs theme-text-secondary mt-0.5">
              Rincian pendapatan penjualan vs pengeluaran operasional per hari.
            </p>
          </div>
          <div className="p-2 rounded-xl theme-bg-card border theme-border theme-text-primary">
            {isDailyRecapOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </div>
        </button>

        {isDailyRecapOpen && (
          <div className="overflow-x-auto border theme-border rounded-xl mt-3">
            <table className="w-full text-left text-xs min-w-[700px]">
              <thead className="theme-bg-card theme-text-secondary border-b theme-border">
                <tr>
                  <th className="p-2.5">Tanggal</th>
                  <th className="p-2.5 text-right">Robux Terjual</th>
                  <th className="p-2.5 text-right">Pendapatan</th>
                  <th className="p-2.5 text-right">Dana Keluar</th>
                  <th className="p-2.5 text-right">Laba Harian</th>
                  <th className="p-2.5 text-center">Pesanan</th>
                </tr>
              </thead>
              <tbody className="divide-y theme-border-subtle">
                {dailyBreakdowns.slice(0, 10).map((b, idx) => (
                  <tr key={idx} className="theme-bg-card-hover">
                    <td className="p-2.5 font-medium theme-text-primary whitespace-nowrap">
                      {b.dayLabel} ({b.date})
                    </td>
                    <td className="p-2.5 text-right font-mono theme-text-primary">
                      {formatNumber(b.robuxSold)} R$
                    </td>
                    <td className="p-2.5 text-right font-mono theme-text-primary">
                      {formatRupiah(b.netRevenue)}
                    </td>
                    <td className="p-2.5 text-right font-mono text-rose-400">
                      -{formatRupiah(b.totalExpensesOut)}
                    </td>
                    <td
                      className={`p-2.5 text-right font-mono font-bold ${
                        b.netDailyProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {formatRupiah(b.netDailyProfit)}
                    </td>
                    <td className="p-2.5 text-center theme-text-secondary font-mono">
                      {b.transactionCount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
