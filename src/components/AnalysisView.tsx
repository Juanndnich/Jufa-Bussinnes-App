import React, { useMemo, useState } from 'react';
import {
  BarChart3,
  Info,
} from 'lucide-react';
import { AppSettings, Transaction } from '../types';
import { calculateDailyAverage, calculateWeightedAverageRate, safeDivide } from '../utils/calculations';
import { formatDecimal, formatNumber, formatRupiah } from '../utils/formatters';

interface AnalysisViewProps {
  transactions: Transaction[];
  settings: AppSettings;
}

export const AnalysisView: React.FC<AnalysisViewProps> = ({ transactions, settings }) => {
  const [dailyMode, setDailyMode] = useState<'CALENDAR_DAYS' | 'ACTIVE_DAYS'>('ACTIVE_DAYS');
  const [periodDays] = useState<number>(30);

  const activeTrxs = useMemo(() => {
    return transactions.filter(t => t.status === 'ACTIVE');
  }, [transactions]);

  // Analysis Calculations
  const analysis = useMemo(() => {
    const totalTrxCount = activeTrxs.length;
    const totalRobux = activeTrxs.reduce((sum, t) => sum + t.quantity, 0);
    const totalRevenue = activeTrxs.reduce((sum, t) => sum + t.net_revenue, 0);
    const totalCogs = activeTrxs.reduce((sum, t) => sum + t.cogs, 0);
    const totalGrossProfit = totalRevenue - totalCogs;
    const totalNetProfit = activeTrxs.reduce((sum, t) => sum + t.net_profit, 0);

    const netMarginPercent =
      totalRevenue > 0 ? (totalNetProfit / totalRevenue) * 100 : 0;

    const weightedAvgRate = calculateWeightedAverageRate(totalRevenue, totalRobux);
    const avgOrderValue = safeDivide(totalRevenue, totalTrxCount, 0);
    const avgRobuxPerOrder = safeDivide(totalRobux, totalTrxCount, 0);
    const avgProfitPerOrder = safeDivide(totalNetProfit, totalTrxCount, 0);

    const salesByDay: { [dateStr: string]: { robux: number; revenue: number; profit: number; count: number } } = {};

    activeTrxs.forEach(t => {
      const d = t.date.slice(0, 10);
      if (!salesByDay[d]) {
        salesByDay[d] = { robux: 0, revenue: 0, profit: 0, count: 0 };
      }
      salesByDay[d].robux += t.quantity;
      salesByDay[d].revenue += t.net_revenue;
      salesByDay[d].profit += t.net_profit;
      salesByDay[d].count += 1;
    });

    const activeDaysCount = Object.keys(salesByDay).length;

    let highestDay = { date: '-', revenue: 0, robux: 0 };
    let lowestDay = { date: '-', revenue: Infinity, robux: 0 };

    Object.entries(salesByDay).forEach(([day, data]) => {
      if (data.revenue > highestDay.revenue) {
        highestDay = { date: day, revenue: data.revenue, robux: data.robux };
      }
      if (data.revenue < lowestDay.revenue) {
        lowestDay = { date: day, revenue: data.revenue, robux: data.robux };
      }
    });

    if (lowestDay.revenue === Infinity) {
      lowestDay = { date: '-', revenue: 0, robux: 0 };
    }

    const avgDailyRobux = calculateDailyAverage(totalRobux, periodDays, activeDaysCount, dailyMode);
    const avgDailyRevenue = calculateDailyAverage(totalRevenue, periodDays, activeDaysCount, dailyMode);
    const avgDailyProfit = calculateDailyAverage(totalNetProfit, periodDays, activeDaysCount, dailyMode);

    const smallPackThreshold = settings.small_pack_threshold || 100;
    const smallPacks = activeTrxs.filter(t => t.quantity <= smallPackThreshold);
    const largePacks = activeTrxs.filter(t => t.quantity > smallPackThreshold);

    const smallPacksStats = {
      count: smallPacks.length,
      robux: smallPacks.reduce((sum, t) => sum + t.quantity, 0),
      revenue: smallPacks.reduce((sum, t) => sum + t.net_revenue, 0),
      profit: smallPacks.reduce((sum, t) => sum + t.net_profit, 0),
      avgRate: calculateWeightedAverageRate(
        smallPacks.reduce((sum, t) => sum + t.net_revenue, 0),
        smallPacks.reduce((sum, t) => sum + t.quantity, 0)
      ),
    };

    const largePacksStats = {
      count: largePacks.length,
      robux: largePacks.reduce((sum, t) => sum + t.quantity, 0),
      revenue: largePacks.reduce((sum, t) => sum + t.net_revenue, 0),
      profit: largePacks.reduce((sum, t) => sum + t.net_profit, 0),
      avgRate: calculateWeightedAverageRate(
        largePacks.reduce((sum, t) => sum + t.net_revenue, 0),
        largePacks.reduce((sum, t) => sum + t.quantity, 0)
      ),
    };

    const sourceStats: { [src: string]: { count: number; revenue: number; profit: number } } = {};
    activeTrxs.forEach(t => {
      const src = t.source || 'Lainnya';
      if (!sourceStats[src]) sourceStats[src] = { count: 0, revenue: 0, profit: 0 };
      sourceStats[src].count += 1;
      sourceStats[src].revenue += t.net_revenue;
      sourceStats[src].profit += t.net_profit;
    });

    return {
      totalTrxCount,
      totalRobux,
      totalRevenue,
      totalGrossProfit,
      totalNetProfit,
      netMarginPercent,
      weightedAvgRate,
      avgOrderValue,
      avgRobuxPerOrder,
      avgProfitPerOrder,
      activeDaysCount,
      highestDay,
      lowestDay,
      avgDailyRobux,
      avgDailyRevenue,
      avgDailyProfit,
      smallPacksStats,
      largePacksStats,
      sourceStats,
    };
  }, [activeTrxs, periodDays, dailyMode, settings]);

  return (
    <div className="space-y-6">
      {/* Top Banner & Mode Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#09090b] p-5 rounded-2xl border border-white/10">
        <div>
          <h2 className="text-lg font-heading font-bold text-white flex items-center gap-2">
            <BarChart3 className="text-white" size={20} />
            <span>Analisis Performa Penjualan & Rata-rata</span>
          </h2>
          <p className="text-xs text-zinc-400 mt-1">
            Statistik pembobotan akurat, perbandingan paket tier, dan performa kanal penjualan.
          </p>
        </div>

        {/* Daily Calculation Mode Switch */}
        <div className="flex items-center gap-2 bg-[#111114] p-1 rounded-xl border border-white/10">
          <span className="text-[11px] text-zinc-400 font-medium px-2">Metode Rata-rata:</span>
          <button
            onClick={() => setDailyMode('ACTIVE_DAYS')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
              dailyMode === 'ACTIVE_DAYS'
                ? 'bg-white text-black shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Hari Ada Penjualan ({analysis.activeDaysCount} hari)
          </button>
          <button
            onClick={() => setDailyMode('CALENDAR_DAYS')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
              dailyMode === 'CALENDAR_DAYS'
                ? 'bg-white text-black shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Semua Hari Kalender
          </button>
        </div>
      </div>

      <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-zinc-300 text-xs flex items-center gap-2">
        <Info size={15} className="shrink-0 text-white" />
        <span>
          Metode aktif:{' '}
          <strong className="text-white">
            {dailyMode === 'ACTIVE_DAYS'
              ? 'Membagi metrik hanya dengan hari yang memiliki transaksi aktif (menghilangkan bias hari libur/kosong)'
              : 'Membagi metrik dengan seluruh hari kalender dalam rentang (30 hari)'}
          </strong>
        </span>
      </div>

      {/* Daily Average Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-[#09090b] p-5 rounded-2xl border border-white/10">
          <span className="text-[11px] text-zinc-400 block mb-1">Rata-rata Robux / Hari</span>
          <div className="text-3xl font-bold font-mono text-white flex items-baseline gap-1">
            {formatNumber(analysis.avgDailyRobux)}
            <span className="text-xs font-normal text-zinc-500 font-sans">R$ / hari</span>
          </div>
          <span className="text-[10px] text-zinc-500 mt-2 block">
            Volume Robux terjual harian
          </span>
        </div>

        <div className="bg-[#09090b] p-5 rounded-2xl border border-white/10">
          <span className="text-[11px] text-zinc-400 block mb-1">Rata-rata Omzet / Hari</span>
          <div className="text-3xl font-bold font-mono text-white">
            {formatRupiah(analysis.avgDailyRevenue)}
          </div>
          <span className="text-[10px] text-zinc-500 mt-2 block">
            Rata-rata omzet harian
          </span>
        </div>

        <div className="bg-[#09090b] p-5 rounded-2xl border border-white/10">
          <span className="text-[11px] text-zinc-400 block mb-1">Rata-rata Laba Bersih / Hari</span>
          <div className="text-3xl font-bold font-mono text-emerald-400">
            {formatRupiah(analysis.avgDailyProfit)}
          </div>
          <span className="text-[10px] text-zinc-500 mt-2 block">
            Laba bersih riil setelah HPP dan fee
          </span>
        </div>
      </div>

      {/* Order Size & Weighted Averages */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-[#09090b] p-4 rounded-xl border border-white/10">
          <span className="text-[11px] text-zinc-400 block mb-1">Rate Tertimbang Riil</span>
          <div className="text-lg font-bold font-mono text-white">
            Rp{analysis.weightedAvgRate} / R$
          </div>
          <span className="text-[10px] text-zinc-500">Total omzet ÷ Total Robux</span>
        </div>

        <div className="bg-[#09090b] p-4 rounded-xl border border-white/10">
          <span className="text-[11px] text-zinc-400 block mb-1">Rata-rata Nilai Pesanan</span>
          <div className="text-lg font-bold font-mono text-white">
            {formatRupiah(analysis.avgOrderValue)}
          </div>
          <span className="text-[10px] text-zinc-500">Nilai transaksi per pelanggan</span>
        </div>

        <div className="bg-[#09090b] p-4 rounded-xl border border-white/10">
          <span className="text-[11px] text-zinc-400 block mb-1">Rata-rata Robux / Order</span>
          <div className="text-lg font-bold font-mono text-white">
            {formatNumber(analysis.avgRobuxPerOrder)} R$
          </div>
          <span className="text-[10px] text-zinc-500">Kuantitas Robux per checkout</span>
        </div>

        <div className="bg-[#09090b] p-4 rounded-xl border border-white/10">
          <span className="text-[11px] text-zinc-400 block mb-1">Margin Bersih Bisnis</span>
          <div className="text-lg font-bold font-mono text-emerald-400">
            {formatDecimal(analysis.netMarginPercent, 2)}%
          </div>
          <span className="text-[10px] text-zinc-500">Laba bersih ÷ Pendapatan</span>
        </div>
      </div>

      {/* Small Pack vs Large Pack Analysis */}
      <div className="bg-[#09090b] p-6 rounded-2xl border border-white/10 space-y-4">
        <h3 className="font-heading font-bold text-white text-sm flex items-center justify-between">
          <span>Perbandingan Paket Kecil vs Paket Besar</span>
          <span className="text-xs font-normal text-zinc-400 font-mono">
            Batas: ≤ {settings.small_pack_threshold || 100} R$ vs &gt; {settings.small_pack_threshold || 100} R$
          </span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl bg-[#111114] border border-white/10 space-y-3 font-mono">
            <div className="flex items-center justify-between font-sans">
              <span className="font-heading font-bold text-white text-xs">Paket Kecil (Eceran)</span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-white/10 text-white font-bold">
                {analysis.smallPacksStats.count} Transaksi
              </span>
            </div>
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between text-zinc-400">
                <span className="font-sans">Total Robux:</span>
                <span className="font-bold text-white">
                  {formatNumber(analysis.smallPacksStats.robux)} R$
                </span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span className="font-sans">Total Omzet:</span>
                <span className="text-white">
                  {formatRupiah(analysis.smallPacksStats.revenue)}
                </span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span className="font-sans">Total Laba Bersih:</span>
                <span className="font-bold text-emerald-400">
                  {formatRupiah(analysis.smallPacksStats.profit)}
                </span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span className="font-sans">Rate Rata-rata:</span>
                <span className="text-white">
                  Rp{analysis.smallPacksStats.avgRate} / R$
                </span>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[#111114] border border-white/10 space-y-3 font-mono">
            <div className="flex items-center justify-between font-sans">
              <span className="font-heading font-bold text-white text-xs">Paket Besar (Grosir)</span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-white/10 text-white font-bold">
                {analysis.largePacksStats.count} Transaksi
              </span>
            </div>
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between text-zinc-400">
                <span className="font-sans">Total Robux:</span>
                <span className="font-bold text-white">
                  {formatNumber(analysis.largePacksStats.robux)} R$
                </span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span className="font-sans">Total Omzet:</span>
                <span className="text-white">
                  {formatRupiah(analysis.largePacksStats.revenue)}
                </span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span className="font-sans">Total Laba Bersih:</span>
                <span className="font-bold text-emerald-400">
                  {formatRupiah(analysis.largePacksStats.profit)}
                </span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span className="font-sans">Rate Rata-rata:</span>
                <span className="text-white">
                  Rp{analysis.largePacksStats.avgRate} / R$
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Best & Lowest Day / Channel Performance */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-[#09090b] p-5 rounded-2xl border border-white/10 space-y-4">
          <h3 className="font-heading font-bold text-white text-xs">Hari Penjualan Tertinggi & Terendah</h3>
          <div className="space-y-3 font-mono">
            <div className="p-3.5 rounded-xl bg-[#111114] border border-white/10 text-xs flex justify-between items-center">
              <div>
                <span className="font-bold text-white block font-sans">Hari Tertinggi</span>
                <span className="text-zinc-500 text-[11px]">{analysis.highestDay.date}</span>
              </div>
              <div className="text-right">
                <span className="font-bold text-white text-sm block">
                  {formatRupiah(analysis.highestDay.revenue)}
                </span>
                <span className="text-[11px] text-zinc-400">
                  {formatNumber(analysis.highestDay.robux)} R$
                </span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-[#111114] border border-white/10 text-xs flex justify-between items-center">
              <div>
                <span className="font-medium text-zinc-400 block font-sans">Hari Terendah</span>
                <span className="text-zinc-500 text-[11px]">{analysis.lowestDay.date}</span>
              </div>
              <div className="text-right">
                <span className="font-bold text-zinc-300 text-sm block">
                  {formatRupiah(analysis.lowestDay.revenue)}
                </span>
                <span className="text-[11px] text-zinc-500">
                  {formatNumber(analysis.lowestDay.robux)} R$
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Channel / Source Distribution */}
        <div className="bg-[#09090b] p-5 rounded-2xl border border-white/10 space-y-4">
          <h3 className="font-heading font-bold text-white text-xs">Kanal / Sumber Penjualan</h3>
          <div className="space-y-2">
            {Object.keys(analysis.sourceStats).length === 0 ? (
              <p className="text-zinc-500 text-xs py-4 text-center">Belum ada transaksi</p>
            ) : (
              Object.entries(analysis.sourceStats).map(([src, stat]) => (
                <div
                  key={src}
                  className="p-3 rounded-xl bg-[#111114] border border-white/10 flex items-center justify-between text-xs"
                >
                  <div>
                    <span className="font-bold text-white">{src}</span>
                    <span className="text-[11px] text-zinc-500 block">{stat.count} transaksi</span>
                  </div>
                  <div className="text-right font-mono">
                    <span className="font-bold text-white">
                      {formatRupiah(stat.revenue)}
                    </span>
                    <span className="text-[11px] text-emerald-400 block">
                      Laba: {formatRupiah(stat.profit)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
