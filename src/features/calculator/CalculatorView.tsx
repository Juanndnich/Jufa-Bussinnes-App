import React, { useState, useEffect, useMemo } from 'react';
import {
  Calculator,
  Coins,
  ArrowRight,
  Plus,
  Trash2,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Minus,
  CheckCircle2,
  DollarSign,
  User,
  FileText,
} from 'lucide-react';
import { repository } from '../../db/repository';
import { RatePreset, StockBatch } from '../../db/schema';
import {
  calculateMoneyToRobux,
  calculateRobuxToMoney,
  allocateFifoCost,
  calculateProfit,
} from '../../domain/calculations';
import { formatRupiah, formatNumber, formatDecimal } from '../../utils/formatters';
import { showSuccessAlert, showErrorAlert, showWarningAlert, showConfirmDialog } from '../../utils/alert';
import { playTapSound, playSuccessSound, playDeleteSound } from '../../utils/sound';

interface CalculatorViewProps {
  onSaleSaved?: () => void;
  onNavigateToStock?: () => void;
}

export const CalculatorView: React.FC<CalculatorViewProps> = ({
  onSaleSaved,
  onNavigateToStock,
}) => {
  const [calcMode, setCalcMode] = useState<'moneyToRobux' | 'robuxToMoney'>('moneyToRobux');
  
  // Input fields (Strict Zero/Empty Default)
  const [inputMoney, setInputMoney] = useState<string>('');
  const [inputRobux, setInputRobux] = useState<string>('');
  const [inputRate, setInputRate] = useState<string>('');

  // Rate presets from IndexedDB
  const [ratePresets, setRatePresets] = useState<RatePreset[]>([]);
  const [newPresetRate, setNewPresetRate] = useState<string>('');
  const [newPresetLabel, setNewPresetLabel] = useState<string>('');
  const [showAddPreset, setShowAddPreset] = useState(false);

  // Available stock batches for FIFO preview
  const [batches, setBatches] = useState<StockBatch[]>([]);
  const [totalAvailableRobux, setTotalAvailableRobux] = useState(0);

  // Modal catat jual
  const [showSaleModal, setShowSaleModal] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [saleNotes, setSaleNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadData = async () => {
    try {
      const [p, b, summary] = await Promise.all([
        repository.getRatePresets(),
        repository.getAvailableBatches(),
        repository.getTotalStockSummary(),
      ]);
      setRatePresets(p);
      setBatches(b);
      setTotalAvailableRobux(summary.totalRemainingRobux);
    } catch (err) {
      console.error('Failed to load calculator data:', err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Mode 1: Uang -> Robux
  const moneyToRobuxCalc = useMemo(() => {
    const moneyNum = parseFloat(inputMoney) || 0;
    const rateNum = parseFloat(inputRate) || 0;
    return calculateMoneyToRobux(moneyNum, rateNum);
  }, [inputMoney, inputRate]);

  // Mode 2: Robux -> Uang
  const robuxToMoneyCalc = useMemo(() => {
    const robuxNum = parseFloat(inputRobux) || 0;
    const rateNum = parseFloat(inputRate) || 0;
    return calculateRobuxToMoney(robuxNum, rateNum);
  }, [inputRobux, inputRate]);

  // Nominal hasil untuk penjualan
  const targetRobux = calcMode === 'moneyToRobux' ? moneyToRobuxCalc.robuxDidapat : robuxToMoneyCalc.jumlahRobux;
  const targetRevenue = calcMode === 'moneyToRobux' ? moneyToRobuxCalc.uangTerpakai : robuxToMoneyCalc.totalHarga;
  const currentRate = parseFloat(inputRate) || 0;

  // Real-time FIFO simulation preview
  const fifoPreview = useMemo(() => {
    if (targetRobux <= 0 || batches.length === 0) {
      return {
        available: true,
        shortage: 0,
        totalCogs: 0,
        grossProfit: 0,
        margin: null,
        isLoss: false,
        isZeroCost: false,
      };
    }

    const batchInputs = batches.map(b => ({
      id: b.id,
      remainingRobux: b.remainingRobux,
      remainingCostRupiah: b.remainingCostRupiah,
    }));

    const alloc = allocateFifoCost(batchInputs, targetRobux);
    const profit = calculateProfit(targetRevenue, alloc.totalCogsRupiah);

    return {
      available: alloc.success,
      shortage: alloc.shortageRobux,
      totalCogs: alloc.totalCogsRupiah,
      grossProfit: profit.grossProfit,
      margin: profit.marginPercentage,
      isLoss: profit.grossProfit < 0,
      isZeroCost: alloc.totalCogsRupiah === 0 && targetRobux > 0,
    };
  }, [targetRobux, targetRevenue, batches]);

  // Handler: Tambah Preset Rate
  const handleAddPreset = async (e: React.FormEvent) => {
    e.preventDefault();
    const rateVal = parseFloat(newPresetRate);
    if (!rateVal || rateVal <= 0) {
      await showWarningAlert('Rate tidak valid', 'Masukkan angka rate yang lebih dari 0.');
      return;
    }
    await repository.addRatePreset(rateVal, newPresetLabel);
    playSuccessSound();
    setNewPresetRate('');
    setNewPresetLabel('');
    setShowAddPreset(false);
    await loadData();
    await showSuccessAlert('Rate Tersimpan', `Rate Rp${rateVal} berhasil ditambahkan ke daftar favorit.`);
  };

  // Handler: Hapus Preset Rate
  const handleDeletePreset = async (id: string, rate: number) => {
    const ok = await showConfirmDialog({
      title: 'Hapus Preset Rate?',
      text: `Rate Rp${rate} akan dihapus dari daftar favorit.`,
      confirmButtonText: 'Ya, Hapus',
      isDanger: true,
    });
    if (ok) {
      playDeleteSound();
      await repository.deleteRatePreset(id);
      await loadData();
    }
  };

  // Handler: Simpan Penjualan
  const handleConfirmSale = async () => {
    if (targetRobux <= 0) {
      await showWarningAlert('Jumlah Kosong', 'Jumlah Robux yang akan dijual harus lebih dari 0.');
      return;
    }
    if (targetRevenue <= 0) {
      await showWarningAlert('Uang Kosong', 'Total uang yang diterima harus lebih dari 0.');
      return;
    }
    if (!fifoPreview.available) {
      await showErrorAlert(
        'Stok Tidak Cukup',
        `Stok Robux tidak mencukupi untuk transaksi ini! Kurang ${formatNumber(fifoPreview.shortage)} R$.`
      );
      return;
    }

    setIsSubmitting(true);
    try {
      await repository.recordSale({
        robuxSold: targetRobux,
        rateUsed: currentRate,
        totalRevenueRupiah: targetRevenue,
        customerName: customerName.trim() || undefined,
        notes: saleNotes.trim() || undefined,
      });

      setShowSaleModal(false);
      setCustomerName('');
      setSaleNotes('');
      setInputMoney('');
      setInputRobux('');
      playSuccessSound();
      await loadData();
      if (onSaleSaved) onSaleSaved();
      await showSuccessAlert(
        'Penjualan Berhasil Dicatat',
        `${formatNumber(targetRobux)} R$ berhasil dicatat dengan omzet ${formatRupiah(targetRevenue)}.`
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Terjadi kesalahan saat mencatat penjualan';
      await showErrorAlert('Gagal Mencatat', msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-5 max-w-4xl mx-auto pb-10">
      {/* Top Banner / Tab Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b theme-border">
        <div className="flex items-center gap-2.5">
          <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
            <Calculator size={20} />
          </div>
          <div>
            <h1 className="text-lg font-bold theme-text-primary tracking-tight">
              Kalkulator Robux 2 Arah
            </h1>
            <p className="text-xs theme-text-secondary">
              Hitung nominal uang ril & simulasi laba FIFO sebelum mencatat penjualan
            </p>
          </div>
        </div>

        {/* Stok Tersedia Pill */}
        <div className="flex items-center gap-2 self-start sm:self-auto px-3 py-1.5 rounded-xl theme-bg-card border theme-border">
          <Coins size={14} className="text-amber-400" />
          <span className="text-xs theme-text-secondary">Stok Tersedia:</span>
          <span className="text-xs font-mono font-bold text-amber-400">
            {formatNumber(totalAvailableRobux)} R$
          </span>
        </div>
      </div>

      {/* Mode Switcher */}
      <div className="grid grid-cols-2 p-1 rounded-2xl theme-bg-surface border theme-border">
        <button
          type="button"
          onClick={() => {
            playTapSound();
            setCalcMode('moneyToRobux');
          }}
          className={`py-2.5 px-3 rounded-xl text-xs sm:text-sm font-semibold transition active:scale-98 ${
            calcMode === 'moneyToRobux'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'theme-text-secondary hover:theme-text-primary'
          }`}
        >
          Mode 1: Uang (Rp) ke Robux
        </button>
        <button
          type="button"
          onClick={() => {
            playTapSound();
            setCalcMode('robuxToMoney');
          }}
          className={`py-2.5 px-3 rounded-xl text-xs sm:text-sm font-semibold transition active:scale-98 ${
            calcMode === 'robuxToMoney'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'theme-text-secondary hover:theme-text-primary'
          }`}
        >
          Mode 2: Robux ke Uang (Rp)
        </button>
      </div>

      {/* Calculator Body Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Left Card: Input Form */}
        <div className="p-5 rounded-2xl theme-bg-card border theme-border space-y-4">
          <h2 className="text-sm font-semibold theme-text-primary flex items-center gap-2">
            <span>Input Transaksi</span>
            <span className="text-[11px] font-normal theme-text-muted">
              {calcMode === 'moneyToRobux' ? '(Budget Pembeli)' : '(Jumlah Robux Dipesan)'}
            </span>
          </h2>

          {/* Input 1: Nominal Uang (Mode 1) atau Jumlah Robux (Mode 2) */}
          {calcMode === 'moneyToRobux' ? (
            <div className="space-y-1.5">
              <label className="text-xs font-medium theme-text-secondary">
                Budget Pembeli (Nominal Uang Rp)
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold theme-text-muted">
                  Rp
                </span>
                <input
                  type="number"
                  inputMode="numeric"
                  placeholder="0"
                  value={inputMoney}
                  onChange={(e) => setInputMoney(e.target.value)}
                  className="w-full pl-10 pr-3 py-2.5 rounded-xl theme-bg-input border theme-border text-sm theme-text-primary focus:outline-none focus:border-emerald-500 font-mono font-bold"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              <label className="text-xs font-medium theme-text-secondary">
                Jumlah Robux (R$)
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-amber-400">
                  R$
                </span>
                <input
                  type="number"
                  inputMode="numeric"
                  placeholder="0"
                  value={inputRobux}
                  onChange={(e) => setInputRobux(e.target.value)}
                  className="w-full pl-11 pr-3 py-2.5 rounded-xl theme-bg-input border theme-border text-sm theme-text-primary focus:outline-none focus:border-emerald-500 font-mono font-bold"
                />
              </div>
            </div>
          )}

          {/* Input 2: Rate Jual */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium theme-text-secondary">
                Rate Jual (Rp per 1 Robux)
              </label>
              <button
                type="button"
                onClick={() => setShowAddPreset(!showAddPreset)}
                className="text-[11px] text-emerald-500 hover:text-emerald-400 font-medium flex items-center gap-1"
              >
                <Plus size={12} />
                <span>Preset Favorit</span>
              </button>
            </div>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold theme-text-muted">
                Rp
              </span>
              <input
                type="number"
                step="any"
                inputMode="decimal"
                placeholder="0"
                value={inputRate}
                onChange={(e) => setInputRate(e.target.value)}
                className="w-full pl-10 pr-3 py-2.5 rounded-xl theme-bg-input border theme-border text-sm theme-text-primary focus:outline-none focus:border-emerald-500 font-mono font-bold"
              />
            </div>
          </div>

          {/* Quick Rate Presets List */}
          <div className="space-y-2 pt-1">
            <span className="text-[11px] theme-text-muted block">Rate Favorit Pengguna:</span>
            {ratePresets.length === 0 ? (
              <p className="text-[11px] theme-text-muted italic">
                Belum ada preset rate. Klik tombol "+ Preset Favorit" di atas untuk menambah.
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {ratePresets.map((p) => (
                  <div
                    key={p.id}
                    className="group inline-flex items-center rounded-lg theme-bg-surface border theme-border overflow-hidden"
                  >
                    <button
                      type="button"
                      onClick={() => setInputRate(String(p.rate))}
                      className="px-2.5 py-1 text-xs font-mono font-semibold theme-text-primary hover:bg-emerald-500/10 hover:text-emerald-400 transition"
                    >
                      Rp{p.rate} {p.label && <span className="font-sans text-[10px] opacity-75">({p.label})</span>}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeletePreset(p.id, p.rate)}
                      className="px-1.5 py-1 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition"
                      title="Hapus Preset"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Modal Form Tambah Preset */}
          {showAddPreset && (
            <form
              onSubmit={handleAddPreset}
              className="p-3 rounded-xl theme-bg-surface border theme-border space-y-2 mt-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold theme-text-primary">Tambah Preset Rate Baru</span>
                <button
                  type="button"
                  onClick={() => setShowAddPreset(false)}
                  className="text-xs theme-text-muted hover:theme-text-primary"
                >
                  Batal
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  step="any"
                  placeholder="Rate (cth: 170)"
                  value={newPresetRate}
                  onChange={(e) => setNewPresetRate(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg theme-bg-input border theme-border text-xs theme-text-primary focus:outline-none focus:border-emerald-500 font-mono"
                  required
                />
                <input
                  type="text"
                  placeholder="Label (opsional)"
                  value={newPresetLabel}
                  onChange={(e) => setNewPresetLabel(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg theme-bg-input border theme-border text-xs theme-text-primary focus:outline-none focus:border-emerald-500"
                />
              </div>
              <button
                type="submit"
                className="w-full py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition"
              >
                Simpan ke Favorit
              </button>
            </form>
          )}
        </div>

        {/* Right Card: Hasil Hitung & Simulasi Laba FIFO */}
        <div className="p-5 rounded-2xl theme-bg-card border theme-border flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between pb-3 border-b theme-border">
              <h2 className="text-sm font-semibold theme-text-primary">
                Hasil Perhitungan
              </h2>
              {/* Badge Status Margin */}
              {targetRobux > 0 && (
                <div
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold flex items-center gap-1 ${
                    fifoPreview.isLoss
                      ? 'bg-red-500/15 text-red-400 border border-red-500/30'
                      : fifoPreview.grossProfit > 0
                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                      : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                  }`}
                >
                  {fifoPreview.isLoss ? (
                    <>
                      <TrendingDown size={12} />
                      <span>RUGI</span>
                    </>
                  ) : fifoPreview.grossProfit > 0 ? (
                    <>
                      <TrendingUp size={12} />
                      <span>UNTUNG</span>
                    </>
                  ) : (
                    <>
                      <Minus size={12} />
                      <span>IMPAS</span>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Display Hasil Utama */}
            <div className="grid grid-cols-2 gap-3 my-4">
              <div className="p-3 rounded-xl theme-bg-surface border theme-border">
                <span className="text-[11px] theme-text-muted block">Robux Didapat</span>
                <span className="text-xl font-mono font-extrabold text-amber-400 block mt-0.5">
                  {formatNumber(targetRobux)} <span className="text-xs font-sans font-normal theme-text-muted">R$</span>
                </span>
              </div>
              <div className="p-3 rounded-xl theme-bg-surface border theme-border">
                <span className="text-[11px] theme-text-muted block">Total Uang Bayar</span>
                <span className="text-xl font-mono font-extrabold theme-text-primary block mt-0.5">
                  {formatRupiah(targetRevenue)}
                </span>
              </div>
            </div>

            {/* Detail Kembalian atau Rate Efektif */}
            {calcMode === 'moneyToRobux' ? (
              <div className="flex items-center justify-between text-xs py-2 px-3 rounded-xl theme-bg-surface border theme-border-subtle">
                <span className="theme-text-muted">Sisa Uang Kembalian:</span>
                <span className="font-mono font-semibold text-emerald-400">
                  {formatRupiah(moneyToRobuxCalc.kembalianUang)}
                </span>
              </div>
            ) : (
              <div className="flex items-center justify-between text-xs py-2 px-3 rounded-xl theme-bg-surface border theme-border-subtle">
                <span className="theme-text-muted">Rate Efektif:</span>
                <span className="font-mono font-semibold theme-text-primary">
                  Rp{formatDecimal(robuxToMoneyCalc.rateEfektif, 2)} / R$
                </span>
              </div>
            )}

            {/* Rincian Finansial FIFO */}
            <div className="mt-4 pt-3 border-t theme-border space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="theme-text-muted">Estimasi Modal (HPP FIFO):</span>
                <span className="font-mono font-medium theme-text-primary">
                  {formatRupiah(fifoPreview.totalCogs)}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="theme-text-muted">Estimasi Laba Kotor:</span>
                <span
                  className={`font-mono font-bold ${
                    fifoPreview.grossProfit >= 0 ? 'text-emerald-400' : 'text-red-400'
                  }`}
                >
                  {formatRupiah(fifoPreview.grossProfit)}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="theme-text-muted">Margin Keuntungan:</span>
                <span className="font-mono font-medium theme-text-secondary">
                  {fifoPreview.margin !== null ? `${formatDecimal(fifoPreview.margin, 1)}%` : 'Tidak tersedia'}
                </span>
              </div>
            </div>

            {/* Peringatan Stok Kurang */}
            {!fifoPreview.available && targetRobux > 0 && (
              <div className="mt-3 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle size={16} className="shrink-0" />
                  <span>Stok kurang {formatNumber(fifoPreview.shortage)} R$!</span>
                </div>
                {onNavigateToStock && (
                  <button
                    type="button"
                    onClick={onNavigateToStock}
                    className="underline text-[11px] font-semibold text-red-300 hover:text-white"
                  >
                    Restock
                  </button>
                )}
              </div>
            )}

            {/* Peringatan Jual Rugi */}
            {fifoPreview.isLoss && fifoPreview.available && (
              <div className="mt-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs flex items-center gap-2">
                <AlertTriangle size={16} className="shrink-0" />
                <span>Harga jual berada di bawah modal batch persediaan (Rugi).</span>
              </div>
            )}
          </div>

          {/* Tombol Eksekusi Penjualan */}
          <button
            type="button"
            disabled={targetRobux <= 0 || targetRevenue <= 0 || !fifoPreview.available}
            onClick={() => setShowSaleModal(true)}
            className="w-full mt-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition active:scale-98 shadow-lg shadow-emerald-950/20"
          >
            <CheckCircle2 size={17} />
            <span>Catat Penjualan Langsung</span>
          </button>
        </div>
      </div>

      {/* Modal / Bottom Sheet Konfirmasi Penjualan */}
      {showSaleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-2xl theme-bg-card border theme-border p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b theme-border">
              <h3 className="font-bold theme-text-primary text-base flex items-center gap-2">
                <CheckCircle2 size={18} className="text-emerald-500" />
                <span>Konfirmasi Catat Penjualan</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowSaleModal(false)}
                className="text-xs theme-text-muted hover:theme-text-primary"
              >
                Tutup
              </button>
            </div>

            {/* Ringkasan Jual */}
            <div className="p-3.5 rounded-xl theme-bg-surface border theme-border space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="theme-text-muted">Robux Terjual:</span>
                <span className="font-mono font-bold text-amber-400">
                  {formatNumber(targetRobux)} R$
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="theme-text-muted">Rate Jual:</span>
                <span className="font-mono font-medium theme-text-primary">
                  Rp{inputRate} / R$
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="theme-text-muted">Total Uang Diterima:</span>
                <span className="font-mono font-bold text-emerald-400">
                  {formatRupiah(targetRevenue)}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs pt-2 border-t theme-border-subtle">
                <span className="theme-text-muted">Laba Kotor Ril:</span>
                <span className="font-mono font-bold theme-text-primary">
                  {formatRupiah(fifoPreview.grossProfit)}
                </span>
              </div>
            </div>

            {/* Input Nama Pembeli & Catatan Opsional */}
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-medium theme-text-secondary flex items-center gap-1.5">
                  <User size={13} />
                  <span>Nama Pembeli (Opsional)</span>
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Budi, Customer #12"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl theme-bg-input border theme-border text-xs theme-text-primary focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium theme-text-secondary flex items-center gap-1.5">
                  <FileText size={13} />
                  <span>Catatan Transaksi (Opsional)</span>
                </label>
                <input
                  type="text"
                  placeholder="Keterangan singkat..."
                  value={saleNotes}
                  onChange={(e) => setSaleNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl theme-bg-input border theme-border text-xs theme-text-primary focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t theme-border">
              <button
                type="button"
                onClick={() => setShowSaleModal(false)}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl text-xs font-medium theme-text-secondary hover:theme-text-primary transition"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmSale}
                disabled={isSubmitting}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold transition flex items-center gap-1.5"
              >
                {isSubmitting ? 'Menyimpan...' : 'Simpan Transaksi'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
