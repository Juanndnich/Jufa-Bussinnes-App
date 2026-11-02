import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Coins,
  DollarSign,
  TrendingUp,
  Package,
  Calendar,
  ArrowRight,
  Calculator,
  Plus,
  Layers,
  Database,
  RefreshCw,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { repository } from '../../db/repository';
import { Sale } from '../../db/schema';
import { formatRupiah, formatNumber, formatDecimal } from '../../utils/formatters';
import { playTapSound } from '../../utils/sound';
import { subscribeSyncStatus, SyncStatusInfo } from '../../services/syncService';

interface DashboardViewProps {
  onNavigateTab: (tab: any) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onNavigateTab }) => {
  const [summary, setSummary] = useState({
    currentStockRobux: 0,
    sisaNilaiModalStok: 0,
    totalModalDikeluarkan: 0,
    totalOmzet: 0,
    totalGrossProfit: 0,
    totalManualExpense: 0,
    netProfit: 0,
    totalRobuxSold: 0,
    todayRobuxSold: 0,
    todayOmzet: 0,
    todayProfit: 0,
    monthRobuxSold: 0,
    monthOmzet: 0,
    monthProfit: 0,
  });

  const [sales, setSales] = useState<Sale[]>([]);
  const [syncInfo, setSyncInfo] = useState<SyncStatusInfo | null>(null);

  const loadData = async () => {
    try {
      const [sum, activeSales] = await Promise.all([
        repository.getDashboardSummary(),
        repository.getSales('ACTIVE'),
      ]);
      setSummary(sum);
      setSales(activeSales);
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    }
  };

  useEffect(() => {
    loadData();
    const unsub = subscribeSyncStatus(setSyncInfo);
    return () => unsub();
  }, []);

  // Data grafik 7 hari terakhir
  const chartData = React.useMemo(() => {
    const days: Record<string, { date: string; omzet: number; profit: number }> = {};
    const now = new Date();

    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().substring(0, 10);
      const label = `${d.getDate()}/${d.getMonth() + 1}`;
      days[key] = { date: label, omzet: 0, profit: 0 };
    }

    for (const s of sales) {
      const key = s.createdAt.substring(0, 10);
      if (days[key]) {
        days[key].omzet += s.totalRevenueRupiah;
        days[key].profit += s.grossProfitRupiah;
      }
    }

    return Object.values(days);
  }, [sales]);

  const avgCostPerRobux =
    summary.currentStockRobux > 0
      ? summary.sisaNilaiModalStok / summary.currentStockRobux
      : 0;

  return (
    <div className="space-y-5 max-w-4xl mx-auto pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b theme-border">
        <div className="flex items-center gap-2.5">
          <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
            <LayoutDashboard size={20} />
          </div>
          <div>
            <h1 className="text-lg font-bold theme-text-primary tracking-tight">
              Dashboard Hasil & Ringkasan
            </h1>
            <p className="text-xs theme-text-secondary">
              Pantau perkembangan stok Robux, modal, omzet, dan laba bersih riil
            </p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          {syncInfo && syncInfo.pendingCount > 0 && (
            <button
              type="button"
              onClick={() => {
                playTapSound();
                onNavigateTab('settings');
              }}
              className="px-2.5 py-1.5 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20 text-xs font-medium flex items-center gap-1.5 transition hover:bg-amber-500/20 shadow-sm"
              title="Data dalam antrean sinkronisasi Google Sheets"
            >
              <RefreshCw size={12} className={syncInfo.isSyncing ? 'animate-spin' : ''} />
              <span>{syncInfo.pendingCount} menunggu sinkron</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              playTapSound();
              onNavigateTab('calculator');
            }}
            className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 transition active:scale-98 shadow-sm"
          >
            <Calculator size={14} />
            <span>Kalkulator</span>
          </button>
          <button
            type="button"
            onClick={() => {
              playTapSound();
              onNavigateTab('stock');
            }}
            className="px-3.5 py-2 rounded-xl theme-bg-card border theme-border hover:theme-bg-card-hover theme-text-primary text-xs font-semibold flex items-center gap-1.5 transition active:scale-98"
          >
            <Plus size={14} />
            <span>Restock</span>
          </button>
        </div>
      </div>

      {/* 4 Kartu Metrik Utama */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Kartu 1: Sisa Stok Robux */}
        <div className="p-4 rounded-2xl theme-bg-card border theme-border flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs theme-text-muted">Sisa Stok Robux</span>
              <span className="p-1 rounded-lg bg-amber-500/10 text-amber-400">
                <Coins size={14} />
              </span>
            </div>
            <span className="text-xl font-mono font-extrabold text-amber-400 block mt-2">
              {formatNumber(summary.currentStockRobux)}{' '}
              <span className="text-xs font-sans font-normal theme-text-muted">R$</span>
            </span>
          </div>
          <span className="text-[10px] theme-text-muted mt-2 block">
            Aset persediaan saat ini
          </span>
        </div>

        {/* Kartu 2: Total Modal Dikeluarkan */}
        <div className="p-4 rounded-2xl theme-bg-card border theme-border flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs theme-text-muted">Total Modal Beli</span>
              <span className="p-1 rounded-lg bg-blue-500/10 text-blue-400">
                <Package size={14} />
              </span>
            </div>
            <span className="text-xl font-mono font-extrabold theme-text-primary block mt-2">
              {formatRupiah(summary.totalModalDikeluarkan)}
            </span>
          </div>
          <span className="text-[10px] theme-text-muted mt-2 block">
            Uang ril beli stok kulakan
          </span>
        </div>

        {/* Kartu 3: Total Omzet Penjualan */}
        <div className="p-4 rounded-2xl theme-bg-card border theme-border flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs theme-text-muted">Total Hasil Jual (Omzet)</span>
              <span className="p-1 rounded-lg bg-emerald-500/10 text-emerald-400">
                <TrendingUp size={14} />
              </span>
            </div>
            <span className="text-xl font-mono font-extrabold text-emerald-400 block mt-2">
              {formatRupiah(summary.totalOmzet)}
            </span>
          </div>
          <span className="text-[10px] theme-text-muted mt-2 block">
            Uang ril penjualan diterima
          </span>
        </div>

        {/* Kartu 4: Total Keuntungan Bersih */}
        <div className="p-4 rounded-2xl theme-bg-card border theme-border flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs theme-text-muted">Total Laba Bersih</span>
              <span className="p-1 rounded-lg bg-emerald-500/10 text-emerald-400">
                <DollarSign size={14} />
              </span>
            </div>
            <span
              className={`text-xl font-mono font-extrabold block mt-2 ${
                summary.netProfit >= 0 ? 'text-emerald-400' : 'text-red-400'
              }`}
            >
              {formatRupiah(summary.netProfit)}
            </span>
          </div>
          <span className="text-[10px] theme-text-muted mt-2 block">
            Laba kotor dikurangi biaya operasional
          </span>
        </div>
      </div>

      {/* Rincian Valuasi Stok & Hari Ini / Bulan Ini */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Valuasi Stok */}
        <div className="p-4 rounded-2xl theme-bg-card border theme-border space-y-3">
          <div className="flex items-center justify-between pb-2 border-b theme-border">
            <h3 className="text-xs font-bold theme-text-primary flex items-center gap-1.5">
              <Layers size={14} className="text-amber-400" />
              <span>Valuasi Persediaan FIFO</span>
            </h3>
            <button
              type="button"
              onClick={() => onNavigateTab('stock')}
              className="text-[11px] text-emerald-400 hover:underline flex items-center gap-1"
            >
              <span>Lihat Batch</span>
              <ArrowRight size={11} />
            </button>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="theme-text-muted">Sisa Nilai Modal Stok:</span>
              <span className="font-mono font-bold theme-text-primary">
                {formatRupiah(summary.sisaNilaiModalStok)}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="theme-text-muted">Rata-rata Modal Saat Ini:</span>
              <span className="font-mono font-bold text-amber-400">
                Rp{formatDecimal(avgCostPerRobux, 2)} / R$
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="theme-text-muted">Total Robux Pernah Terjual:</span>
              <span className="font-mono font-bold text-emerald-400">
                {formatNumber(summary.totalRobuxSold)} R$
              </span>
            </div>
          </div>
        </div>

        {/* Ringkasan Periode (Hari Ini & Bulan Ini) */}
        <div className="p-4 rounded-2xl theme-bg-card border theme-border space-y-3">
          <div className="flex items-center justify-between pb-2 border-b theme-border">
            <h3 className="text-xs font-bold theme-text-primary flex items-center gap-1.5">
              <Calendar size={14} className="text-emerald-400" />
              <span>Kinerja Hari Ini & Bulan Ini</span>
            </h3>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2.5 rounded-xl theme-bg-surface border theme-border-subtle">
              <span className="text-[10px] theme-text-muted block">Hari Ini</span>
              <span className="font-mono font-bold text-amber-400 block mt-1">
                {formatNumber(summary.todayRobuxSold)} R$
              </span>
              <span className="font-mono font-bold text-emerald-400 block text-[11px] mt-0.5">
                Profit: {formatRupiah(summary.todayProfit)}
              </span>
            </div>

            <div className="p-2.5 rounded-xl theme-bg-surface border theme-border-subtle">
              <span className="text-[10px] theme-text-muted block">Bulan Ini</span>
              <span className="font-mono font-bold text-amber-400 block mt-1">
                {formatNumber(summary.monthRobuxSold)} R$
              </span>
              <span className="font-mono font-bold text-emerald-400 block text-[11px] mt-0.5">
                Profit: {formatRupiah(summary.monthProfit)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Tren Penjualan 7 Hari (Recharts) */}
      <div className="p-5 rounded-2xl theme-bg-card border theme-border space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold theme-text-primary flex items-center gap-1.5">
            <TrendingUp size={14} className="text-emerald-400" />
            <span>Tren Omzet & Laba (7 Hari Terakhir)</span>
          </h3>
          <span className="text-[10px] theme-text-muted">Rupiah (Rp)</span>
        </div>

        <div className="h-56 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-zinc-200 dark:text-zinc-800" opacity={0.6} />
              <XAxis dataKey="date" stroke="currentColor" className="text-zinc-500 dark:text-zinc-400" fontSize={11} tickLine={false} />
              <YAxis
                stroke="currentColor"
                className="text-zinc-500 dark:text-zinc-400"
                fontSize={10}
                tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : v)}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--bg-card)',
                  borderColor: 'var(--border-color)',
                  color: 'var(--text-primary)',
                  borderRadius: '12px',
                  fontSize: '11px',
                  boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                }}
                formatter={(val: any) => [formatRupiah(Number(val) || 0)]}
              />
              <Bar dataKey="omzet" fill="#10b981" name="Omzet (Rp)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="profit" fill="#f59e0b" name="Laba (Rp)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Kartu Pintasan Pengaturan & Cadangan Database */}
      <div className="p-4 rounded-2xl theme-bg-card border theme-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
            <Database size={18} />
          </div>
          <div>
            <h3 className="text-xs font-bold theme-text-primary">
              Pengaturan & Cadangan Database
            </h3>
            <p className="text-[11px] theme-text-muted">
              Pencadangan JSON, pulihkan data, ekspor laporan ke Excel (CSV), & preferensi sistem
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            playTapSound();
            onNavigateTab('settings');
          }}
          className="px-3.5 py-2 rounded-xl theme-bg-surface border theme-border hover:theme-bg-card-hover theme-text-primary text-xs font-semibold flex items-center gap-1.5 transition active:scale-98 self-start sm:self-auto shrink-0"
        >
          <span>Buka Pengaturan</span>
          <ArrowRight size={13} />
        </button>
      </div>
    </div>
  );
};
