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
} from 'lucide-react';
import { AppSettings, Cashflow, StockBatch, Transaction } from '../types';
import { formatDecimal, formatNumber, formatRupiah } from '../utils/formatters';
import { calculateWeightedAverageRate, safeDivide } from '../utils/calculations';

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
  const [filterPeriod, setFilterPeriod] = useState<DateFilterOption>('30days');

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

    const packageFreq: { [key: number]: number } = {};
    trxs.forEach(t => {
      packageFreq[t.quantity] = (packageFreq[t.quantity] || 0) + 1;
    });
    let topPackage = 0;
    let maxFreq = 0;
    Object.entries(packageFreq).forEach(([qty, count]) => {
      if (count > maxFreq) {
        maxFreq = count;
        topPackage = Number(qty);
      }
    });

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
      topPackage,
      topPackageFreq: maxFreq,
    };
  }, [filteredData]);

  const isStockLow = totalStockAvailable <= (settings.min_stock_alert ?? settings.minStockAlert ?? 500);

  return (
    <div className="space-y-6">
      {/* Top Banner / Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#09090b] p-5 rounded-2xl border border-white/10">
        <div>
          <h2 className="text-lg font-heading font-bold text-white">Ringkasan Bisnis & Performa</h2>
          <p className="text-xs text-zinc-400">
            Perhitungan akuntansi otomatis berbasis batch FIFO dan arus kas riil.
          </p>
        </div>

        {/* Filter Buttons */}
        <div className="flex flex-wrap items-center gap-1 bg-[#111114] p-1 rounded-xl border border-white/10">
          {(
            [
              ['today', 'Hari Ini'],
              ['yesterday', 'Kemarin'],
              ['7days', '7 Hari'],
              ['30days', '30 Hari'],
              ['thisMonth', 'Bulan Ini'],
              ['thisYear', 'Tahun Ini'],
              ['all', 'Semua'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilterPeriod(key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                filterPeriod === key
                  ? 'bg-white text-black shadow-sm'
                  : 'text-zinc-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Critical Warnings */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {isStockLow && totalStockAvailable > 0 && (
          <div className="p-4 rounded-2xl bg-amber-950/20 border border-amber-500/30 flex items-start gap-3 text-amber-300">
            <AlertCircle size={18} className="shrink-0 text-amber-400 mt-0.5" />
            <div className="text-xs">
              <span className="font-bold block text-sm">Peringatan: Stok Robux Menipis!</span>
              Stok tersisa{' '}
              <strong className="text-white font-mono">{formatNumber(totalStockAvailable)} R$</strong>{' '}
              (Ambang minimum: {formatNumber(settings.min_stock_alert ?? 500)} R$).
            </div>
          </div>
        )}

        {metrics.lossTransactions.length > 0 && (
          <div className="p-4 rounded-2xl bg-rose-950/20 border border-rose-500/30 flex items-start gap-3 text-rose-300">
            <AlertCircle size={18} className="shrink-0 text-rose-400 mt-0.5" />
            <div className="text-xs">
              <span className="font-bold block text-sm">Peringatan: Transaksi Minus!</span>
              Terdapat{' '}
              <strong className="text-white">{metrics.lossTransactions.length} transaksi</strong> pada
              periode ini dengan margin minus / merugi.
            </div>
          </div>
        )}
      </div>

      {/* Key Financial Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Net Revenue */}
        <div className="bg-[#09090b] p-5 rounded-2xl border border-white/10 hover:border-white/20 transition">
          <div className="flex items-center justify-between text-zinc-400 text-xs mb-2">
            <span className="font-medium uppercase tracking-wider text-[11px]">Pendapatan Bersih</span>
            <span className="p-2 rounded-xl bg-white/5 border border-white/10 text-white">
              <DollarSign size={15} />
            </span>
          </div>
          <div className="text-2xl font-bold font-mono text-white">
            {formatRupiah(metrics.netRevenue)}
          </div>
          <div className="text-[11px] text-zinc-400 mt-2 flex items-center justify-between font-mono">
            <span>Kotor: {formatRupiah(metrics.grossRevenue)}</span>
            {metrics.discounts > 0 && (
              <span className="text-amber-300">
                Diskon -{formatRupiah(metrics.discounts)}
              </span>
            )}
          </div>
        </div>

        {/* COGS (Modal Barang Terjual) */}
        <div className="bg-[#09090b] p-5 rounded-2xl border border-white/10 hover:border-white/20 transition">
          <div className="flex items-center justify-between text-zinc-400 text-xs mb-2">
            <span className="font-medium uppercase tracking-wider text-[11px]">Modal HPP (FIFO)</span>
            <span className="p-2 rounded-xl bg-white/5 border border-white/10 text-zinc-300">
              <Layers size={15} />
            </span>
          </div>
          <div className="text-2xl font-bold font-mono text-zinc-300">
            {formatRupiah(metrics.cogs)}
          </div>
          <div className="text-[11px] text-zinc-500 mt-2">
            Biaya perolehan stok yang terjual
          </div>
        </div>

        {/* Gross Profit */}
        <div className="bg-[#09090b] p-5 rounded-2xl border border-white/10 hover:border-white/20 transition">
          <div className="flex items-center justify-between text-zinc-400 text-xs mb-2">
            <span className="font-medium uppercase tracking-wider text-[11px]">Laba Kotor</span>
            <span
              className={`p-2 rounded-xl border ${
                metrics.grossProfit >= 0
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
              }`}
            >
              {metrics.grossProfit >= 0 ? <TrendingUp size={15} /> : <TrendingDown size={15} />}
            </span>
          </div>
          <div
            className={`text-2xl font-bold font-mono ${
              metrics.grossProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {formatRupiah(metrics.grossProfit)}
          </div>
          <div className="text-[11px] text-zinc-400 mt-2 font-mono">
            Margin: {metrics.netRevenue > 0 ? formatDecimal((metrics.grossProfit / metrics.netRevenue) * 100, 1) + '%' : '-'}
          </div>
        </div>

        {/* Net Profit */}
        <div className="bg-[#09090b] p-5 rounded-2xl border border-white/10 hover:border-white/20 transition">
          <div className="flex items-center justify-between text-zinc-400 text-xs mb-2">
            <span className="font-medium uppercase tracking-wider text-[11px]">Laba Bersih</span>
            <span className="p-2 rounded-xl bg-white/5 border border-white/10 text-white">
              <Award size={15} />
            </span>
          </div>
          <div
            className={`text-2xl font-bold font-mono ${
              metrics.netProfit >= 0 ? 'text-white' : 'text-rose-400'
            }`}
          >
            {formatRupiah(metrics.netProfit)}
          </div>
          <div className="text-[11px] text-zinc-400 mt-2 font-mono">
            Fee ({formatRupiah(metrics.txFees)}) & Ops ({formatRupiah(metrics.opExpenses)})
          </div>
        </div>
      </div>

      {/* Second Row: Stock & Cash Health */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Robux Stock Card */}
        <div className="bg-[#09090b] p-5 rounded-2xl border border-white/10">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-white/5 border border-white/10 text-white">
                <Coins size={17} />
              </span>
              <div>
                <h4 className="text-xs font-heading font-bold text-white">Stok Robux Tersedia</h4>
                <p className="text-[11px] text-zinc-500">Persediaan saat ini</p>
              </div>
            </div>
            <button
              onClick={() => onNavigate('stock')}
              className="text-xs text-zinc-300 hover:text-white flex items-center gap-0.5 underline font-medium"
            >
              Lihat Batch <ArrowUpRight size={13} />
            </button>
          </div>
          <div className="text-3xl font-bold font-mono text-white mb-2">
            {formatNumber(totalStockAvailable)}{' '}
            <span className="text-sm font-normal text-zinc-400 font-sans">R$</span>
          </div>
          <div className="p-3 rounded-xl bg-[#111114] border border-white/10 flex justify-between items-center text-xs">
            <span className="text-zinc-400">Nilai Persediaan:</span>
            <span className="font-bold text-white font-mono">
              {formatRupiah(stockAssetValue)}
            </span>
          </div>
        </div>

        {/* Real Cash Balance */}
        <div className="bg-[#09090b] p-5 rounded-2xl border border-white/10">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-white/5 border border-white/10 text-white">
                <Wallet size={17} />
              </span>
              <div>
                <h4 className="text-xs font-heading font-bold text-white">Saldo Kas Riil</h4>
                <p className="text-[11px] text-zinc-500">Uang masuk − keluar</p>
              </div>
            </div>
            <button
              onClick={() => onNavigate('finance')}
              className="text-xs text-zinc-300 hover:text-white flex items-center gap-0.5 underline font-medium"
            >
              Buku Kas <ArrowUpRight size={13} />
            </button>
          </div>
          <div className="text-3xl font-bold font-mono text-white mb-2">
            {formatRupiah(cashBalance)}
          </div>
          <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
            <div className="p-2 rounded-lg bg-[#111114] border border-white/10 text-emerald-400">
              <span className="text-zinc-500 block text-[10px]">Masuk:</span> <strong>{formatRupiah(totalCashIn)}</strong>
            </div>
            <div className="p-2 rounded-lg bg-[#111114] border border-white/10 text-rose-400">
              <span className="text-zinc-500 block text-[10px]">Keluar:</span> <strong>{formatRupiah(totalCashOut)}</strong>
            </div>
          </div>
        </div>

        {/* Total Estimated Asset */}
        <div className="bg-[#09090b] p-5 rounded-2xl border border-white/10">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-white/5 border border-white/10 text-white">
                <Package size={17} />
              </span>
              <div>
                <h4 className="text-xs font-heading font-bold text-white">Total Estimasi Aset</h4>
                <p className="text-[11px] text-zinc-500">Kas + Nilai Stok</p>
              </div>
            </div>
          </div>
          <div className="text-3xl font-bold font-mono text-white mb-2">
            {formatRupiah(cashBalance + stockAssetValue)}
          </div>
          <div className="p-3 rounded-xl bg-[#111114] border border-white/10 text-xs space-y-1 text-zinc-400 font-mono">
            <div className="flex justify-between">
              <span>Robux Terjual:</span>
              <span className="text-white font-semibold">
                {formatNumber(metrics.totalRobuxSold)} R$
              </span>
            </div>
            <div className="flex justify-between">
              <span>Transaksi:</span>
              <span className="text-white font-semibold">
                {metrics.transactionCount} pesanan
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Third Row: Analytics */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-[#09090b] p-4 rounded-xl border border-white/10">
          <span className="text-[11px] text-zinc-400 block mb-1">Rate Tertimbang Riil</span>
          <div className="text-lg font-bold font-mono text-white">
            Rp{metrics.weightedAvgSellRate}
            <span className="text-xs text-zinc-500 font-normal"> / R$</span>
          </div>
          <span className="text-[10px] text-zinc-500">Total omzet ÷ Total Robux</span>
        </div>

        <div className="bg-[#09090b] p-4 rounded-xl border border-white/10">
          <span className="text-[11px] text-zinc-400 block mb-1">Rata-rata Nilai Order</span>
          <div className="text-lg font-bold font-mono text-white">
            {formatRupiah(metrics.avgTransactionValue)}
          </div>
          <span className="text-[10px] text-zinc-500">Per transaksi pembeli</span>
        </div>

        <div className="bg-[#09090b] p-4 rounded-xl border border-white/10">
          <span className="text-[11px] text-zinc-400 block mb-1">Rata-rata Robux / Order</span>
          <div className="text-lg font-bold font-mono text-white">
            {formatNumber(metrics.avgRobuxPerTransaction)}
            <span className="text-xs text-zinc-500 font-normal"> R$</span>
          </div>
          <span className="text-[10px] text-zinc-500">Ukuran order rata-rata</span>
        </div>

        <div className="bg-[#09090b] p-4 rounded-xl border border-white/10">
          <span className="text-[11px] text-zinc-400 block mb-1">Paket Paling Sering Dibeli</span>
          <div className="text-lg font-bold font-mono text-white">
            {metrics.topPackage > 0 ? `${formatNumber(metrics.topPackage)} R$` : '-'}
          </div>
          <span className="text-[10px] text-zinc-500">
            {metrics.topPackageFreq > 0 ? `${metrics.topPackageFreq} kali dipesan` : 'Belum ada data'}
          </span>
        </div>
      </div>

      {/* Recent Activity / Clean Empty State */}
      <div className="bg-[#09090b] p-6 rounded-2xl border border-white/10">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-heading font-bold text-white text-sm">Transaksi Penjualan Terkini</h3>
          <button
            onClick={() => onNavigate('sales')}
            className="text-xs text-zinc-300 hover:text-white flex items-center gap-1 underline font-medium"
          >
            Lihat Semua Penjualan <ArrowUpRight size={13} />
          </button>
        </div>

        {filteredData.validTrxs.length === 0 ? (
          <div className="py-12 text-center text-zinc-500 text-xs border border-dashed border-white/10 rounded-xl">
            <ShoppingCart size={28} className="mx-auto mb-2 text-zinc-600" />
            <p className="font-semibold text-zinc-300">Belum Ada Transaksi Tercatat</p>
            <p className="mt-1 text-zinc-500">
              Database bersih. Catat penjualan baru satu per satu atau massal di tab Penjualan.
            </p>
            <button
              onClick={() => onNavigate('sales')}
              className="mt-3 px-3 py-1.5 rounded-lg bg-white text-black font-semibold text-xs hover:bg-zinc-200 transition"
            >
              + Catat Penjualan Baru
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/10 text-zinc-400">
                  <th className="pb-2.5">Kode</th>
                  <th className="pb-2.5">Tanggal</th>
                  <th className="pb-2.5">Pelanggan</th>
                  <th className="pb-2.5 text-right">Robux</th>
                  <th className="pb-2.5 text-right">Rate</th>
                  <th className="pb-2.5 text-right">Total</th>
                  <th className="pb-2.5 text-right">Laba Bersih</th>
                  <th className="pb-2.5 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredData.validTrxs.slice(0, 5).map(trx => (
                  <tr key={trx.id} className="hover:bg-white/5 transition">
                    <td className="py-2.5 font-mono text-zinc-300">{trx.transaction_code}</td>
                    <td className="py-2.5 text-zinc-400">{trx.date.slice(0, 10)}</td>
                    <td className="py-2.5 font-medium text-white">{trx.customer_name}</td>
                    <td className="py-2.5 text-right font-mono font-bold text-white">
                      {formatNumber(trx.quantity)} R$
                    </td>
                    <td className="py-2.5 text-right font-mono text-zinc-300">
                      Rp{trx.sell_rate}
                    </td>
                    <td className="py-2.5 text-right font-mono font-bold text-white">
                      {formatRupiah(trx.net_revenue)}
                    </td>
                    <td
                      className={`py-2.5 text-right font-mono font-bold ${
                        trx.net_profit >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {formatRupiah(trx.net_profit)}
                    </td>
                    <td className="py-2.5 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          trx.payment_status === 'LUNAS'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        }`}
                      >
                        {trx.payment_status}
                      </span>
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
