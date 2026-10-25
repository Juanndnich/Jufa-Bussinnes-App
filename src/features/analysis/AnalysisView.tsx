import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  TrendingUp,
  Percent,
  Download,
  FileSpreadsheet,
  Coins,
  ShieldAlert,
  ArrowRight,
  Sliders,
  DollarSign,
} from 'lucide-react';
import { repository } from '../../db/repository';
import {
  calculateBreakEvenRate,
  simulateProfitScenario,
} from '../../domain/calculations';
import { formatRupiah, formatNumber, formatDecimal, formatDateJakarta } from '../../utils/formatters';
import { showSuccessAlert, showErrorAlert, showWarningAlert } from '../../utils/alert';
import { playTapSound, playSuccessSound } from '../../utils/sound';

export const AnalysisView: React.FC = () => {
  const [totalRemainingRobux, setTotalRemainingRobux] = useState(0);
  const [totalRemainingCostRupiah, setTotalRemainingCostRupiah] = useState(0);
  const [targetRateInput, setTargetRateInput] = useState('');

  const loadStock = async () => {
    try {
      const summary = await repository.getTotalStockSummary();
      setTotalRemainingRobux(summary.totalRemainingRobux);
      setTotalRemainingCostRupiah(summary.totalRemainingCostRupiah);
    } catch (err) {
      console.error('Failed to load stock summary for analysis:', err);
    }
  };

  useEffect(() => {
    loadStock();
  }, []);

  const breakEvenRate = calculateBreakEvenRate(totalRemainingCostRupiah, totalRemainingRobux);

  const targetRateNum = parseFloat(targetRateInput) || 0;
  const scenarios = simulateProfitScenario(
    totalRemainingRobux,
    totalRemainingCostRupiah,
    targetRateNum,
    [100, 75, 50, 25]
  );

  // Handler: Ekspor CSV Penjualan
  const handleExportSalesCsv = async () => {
    try {
      const sales = await repository.getSales();
      if (sales.length === 0) {
        await showWarningAlert('Data Kosong', 'Belum ada transaksi penjualan untuk diekspor.');
        return;
      }

      const headers = [
        'Invoice',
        'Tanggal (WIB)',
        'Status',
        'Nama Pembeli',
        'Robux Terjual',
        'Rate Digunakan',
        'Total Omzet (Rp)',
        'Total HPP FIFO (Rp)',
        'Laba Kotor (Rp)',
        'Catatan',
      ];

      const rows = sales.map((s) => [
        `"${s.invoiceNumber}"`,
        `"${formatDateJakarta(s.createdAt)}"`,
        `"${s.status}"`,
        `"${(s.customerName || '-').replace(/"/g, '""')}"`,
        s.robuxSold,
        s.rateUsed,
        s.totalRevenueRupiah,
        s.totalCogsRupiah,
        s.grossProfitRupiah,
        `"${(s.notes || '-').replace(/"/g, '""')}"`,
      ]);

      // UTF-8 BOM agar rapi di Microsoft Excel
      const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `JufaStore_Penjualan_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      playSuccessSound();
      await showSuccessAlert('Ekspor Berhasil', 'File laporan CSV penjualan telah berhasil diunduh.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal mengekspor laporan';
      await showErrorAlert('Gagal Ekspor', msg);
    }
  };

  // Handler: Ekspor CSV Buku Kas
  const handleExportCashCsv = async () => {
    try {
      const ledger = await repository.getCashLedger();
      if (ledger.length === 0) {
        await showWarningAlert('Data Kosong', 'Belum ada catatan buku kas untuk diekspor.');
        return;
      }

      const headers = [
        'ID',
        'Tanggal (WIB)',
        'Tipe',
        'Nominal (Rp)',
        'Sumber',
        'Keterangan',
      ];

      const rows = ledger.map((c) => [
        `"${c.id}"`,
        `"${formatDateJakarta(c.createdAt)}"`,
        `"${c.type === 'IN' ? 'Kas Masuk' : 'Kas Keluar'}"`,
        c.amountRupiah,
        `"${c.sourceType}"`,
        `"${(c.notes || '-').replace(/"/g, '""')}"`,
      ]);

      const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `JufaStore_BukuKas_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      playSuccessSound();
      await showSuccessAlert('Ekspor Berhasil', 'File laporan CSV buku kas telah berhasil diunduh.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal mengekspor buku kas';
      await showErrorAlert('Gagal Ekspor', msg);
    }
  };

  return (
    <div className="space-y-5 max-w-4xl mx-auto pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b theme-border">
        <div className="flex items-center gap-2.5">
          <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-500 border border-indigo-500/20">
            <BarChart3 size={20} />
          </div>
          <div>
            <h1 className="text-lg font-bold theme-text-primary tracking-tight">
              Analisis & Laporan Bisnis
            </h1>
            <p className="text-xs theme-text-secondary">
              Kalkulasi titik impas modal (BEP), simulasi skenario profit, & ekspor CSV
            </p>
          </div>
        </div>

        {/* Tombol Ekspor CSV */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={handleExportSalesCsv}
            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 transition active:scale-98 shadow-sm"
          >
            <Download size={13} />
            <span>CSV Penjualan</span>
          </button>
          <button
            type="button"
            onClick={handleExportCashCsv}
            className="px-3 py-1.5 rounded-xl theme-bg-card border theme-border hover:theme-bg-card-hover text-xs font-semibold theme-text-primary flex items-center gap-1.5 transition active:scale-98"
          >
            <FileSpreadsheet size={13} />
            <span>CSV Buku Kas</span>
          </button>
        </div>
      </div>

      {/* Break-Even Rate (Titik Impas) */}
      <div className="p-5 rounded-2xl theme-bg-card border theme-border space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert size={18} className="text-amber-400" />
            <h2 className="text-sm font-bold theme-text-primary">
              Break-Even Rate (Titik Impas Modal Persediaan)
            </h2>
          </div>
          <span className="text-xs font-mono font-bold text-amber-400">
            {formatNumber(totalRemainingRobux)} R$ Tersedia
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
          <div className="p-4 rounded-xl theme-bg-surface border theme-border">
            <span className="text-xs theme-text-muted block">Rate Impas Minimal (BEP)</span>
            <span className="text-2xl font-mono font-extrabold text-amber-400 block mt-1">
              {breakEvenRate !== null ? `Rp${formatDecimal(breakEvenRate, 2)}` : 'Tidak tersedia'}
            </span>
            <span className="text-[11px] theme-text-muted mt-1 block">
              per 1 Robux (Total modal persediaan ÷ sisa stok Robux)
            </span>
          </div>

          <div className="p-4 rounded-xl theme-bg-surface border theme-border flex flex-col justify-between">
            <div className="space-y-1">
              <span className="text-xs font-semibold theme-text-primary block">
                Petunjuk Harga Jual:
              </span>
              <p className="text-xs theme-text-secondary leading-relaxed">
                {breakEvenRate !== null ? (
                  <>
                    Jual di atas <strong>Rp{formatDecimal(breakEvenRate, 2)}</strong> per Robux untuk menghasilkan keuntungan bersih. Penjualan di bawah angka ini akan menyebabkan kerugian modal.
                  </>
                ) : (
                  'Belum ada persediaan Robux aktif untuk menghitung titik impas.'
                )}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Simulator Skenario Keuntungan */}
      <div className="p-5 rounded-2xl theme-bg-card border theme-border space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sliders size={18} className="text-emerald-400" />
            <h2 className="text-sm font-bold theme-text-primary">
              Simulasi Target Skenario Keuntungan
            </h2>
          </div>

          {/* Input Target Rate */}
          <div className="flex items-center gap-2">
            <span className="text-xs theme-text-muted">Target Rate:</span>
            <div className="relative w-36">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold theme-text-muted">
                Rp
              </span>
              <input
                type="number"
                step="any"
                placeholder="0"
                value={targetRateInput}
                onChange={(e) => setTargetRateInput(e.target.value)}
                className="w-full pl-8 pr-2.5 py-1.5 rounded-xl theme-bg-input border theme-border text-xs theme-text-primary focus:outline-none focus:border-emerald-500 font-mono font-bold"
              />
            </div>
          </div>
        </div>

        {targetRateNum <= 0 ? (
          <div className="p-6 rounded-xl theme-bg-surface border theme-border-subtle text-center text-xs theme-text-muted">
            Ketikkan target rate jual pada kolom di atas untuk melihat potensi laba skenario 100%, 75%, 50%, dan 25% dari sisa stok persediaan.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {scenarios.map((sc) => (
              <div
                key={sc.percentage}
                className="p-3.5 rounded-xl theme-bg-surface border theme-border space-y-2"
              >
                <div className="flex items-center justify-between pb-1 border-b theme-border-subtle">
                  <span className="text-xs font-bold text-amber-400">
                    Skenario {sc.percentage}%
                  </span>
                  <span className="text-[11px] font-mono theme-text-muted">
                    {formatNumber(sc.robuxSold)} R$
                  </span>
                </div>

                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="theme-text-muted">Potensi Omzet:</span>
                    <span className="font-mono font-bold theme-text-primary">
                      {formatRupiah(sc.revenue)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="theme-text-muted">Estimasi HPP:</span>
                    <span className="font-mono theme-text-secondary">
                      {formatRupiah(sc.cogs)}
                    </span>
                  </div>
                  <div className="flex justify-between pt-1 border-t theme-border-subtle">
                    <span className="theme-text-muted">Potensi Laba:</span>
                    <span
                      className={`font-mono font-bold ${
                        sc.grossProfit >= 0 ? 'text-emerald-400' : 'text-red-400'
                      }`}
                    >
                      {formatRupiah(sc.grossProfit)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="theme-text-muted">Margin:</span>
                    <span className="font-mono theme-text-secondary">
                      {sc.margin !== null ? `${formatDecimal(sc.margin, 1)}%` : '-'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
