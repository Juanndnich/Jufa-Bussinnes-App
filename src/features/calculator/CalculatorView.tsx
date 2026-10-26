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
  Edit3,
  RotateCcw,
  Search,
  Copy,
  Sparkles,
  Check,
  HelpCircle,
  Info,
} from 'lucide-react';
import { repository } from '../../db/repository';
import { RatePreset, StockBatch } from '../../db/schema';
import {
  calculateMoneyToRobux,
  calculateRobuxToMoney,
  allocateFifoCost,
  calculateProfit,
  parseRobuxOrMoneyShorthand,
  calculateRateFromRobuxAndPrice,
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
  const [calcMode, setCalcMode] = useState<'moneyToRobux' | 'robuxToMoney' | 'findRate'>('moneyToRobux');
  
  // Input fields (Strict Zero/Empty Default)
  const [inputMoney, setInputMoney] = useState<string>('');
  const [inputRobux, setInputRobux] = useState<string>('');
  const [inputRate, setInputRate] = useState<string>('');
  const [customRevenue, setCustomRevenue] = useState<string>('');

  // Mode 3: Cari / Cek Rate Orang Lain (Rate Finder / Detector)
  const [rateFinderRobuxInput, setRateFinderRobuxInput] = useState<string>('');
  const [rateFinderPriceInput, setRateFinderPriceInput] = useState<string>('');
  const [resellTargetRate, setResellTargetRate] = useState<string>('');
  const [rateFinderCopied, setRateFinderCopied] = useState(false);

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

  // Edit Preset State
  const [editingPreset, setEditingPreset] = useState<RatePreset | null>(null);
  const [editPresetRate, setEditPresetRate] = useState('');
  const [editPresetLabel, setEditPresetLabel] = useState('');

  // Parsed Rate Finder values
  const parsedFinderRobux = useMemo(() => {
    return parseRobuxOrMoneyShorthand(rateFinderRobuxInput);
  }, [rateFinderRobuxInput]);

  const parsedFinderPrice = useMemo(() => {
    return parseRobuxOrMoneyShorthand(rateFinderPriceInput);
  }, [rateFinderPriceInput]);

  const competitorRateResult = useMemo(() => {
    return calculateRateFromRobuxAndPrice(parsedFinderRobux, parsedFinderPrice);
  }, [parsedFinderRobux, parsedFinderPrice]);

  const parsedResellTargetRate = parseFloat(resellTargetRate) || 0;
  const resellSimulation = useMemo(() => {
    if (competitorRateResult.ratePerRobux <= 0 || parsedResellTargetRate <= 0) {
      return null;
    }
    const buyPrice = parsedFinderPrice;
    const sellRevenue = Math.round(parsedFinderRobux * parsedResellTargetRate);
    const profit = sellRevenue - buyPrice;
    const profitPerRobux = parsedResellTargetRate - competitorRateResult.ratePerRobux;
    const margin = sellRevenue > 0 ? (profit / sellRevenue) * 100 : 0;

    return {
      buyPrice,
      sellRevenue,
      profit,
      profitPerRobux,
      margin,
      isProfit: profit > 0,
      isLoss: profit < 0,
      isBreakEven: profit === 0,
    };
  }, [competitorRateResult.ratePerRobux, parsedFinderPrice, parsedFinderRobux, parsedResellTargetRate]);

  // Average modal per Robux from store's current stock
  const storeAverageCostPerRobux = useMemo(() => {
    let totalCost = 0;
    let totalRobux = 0;
    for (const b of batches) {
      totalCost += b.remainingCostRupiah;
      totalRobux += b.remainingRobux;
    }
    return totalRobux > 0 ? totalCost / totalRobux : 0;
  }, [batches]);

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

  // Target Robux yang dijual
  const targetRobux = useMemo(() => {
    if (calcMode === 'moneyToRobux') {
      return moneyToRobuxCalc.robuxDidapat;
    }
    return Math.floor(parseFloat(inputRobux) || 0);
  }, [calcMode, moneyToRobuxCalc.robuxDidapat, inputRobux]);

  // Total bayar otomatis dari perhitungan formula rate
  const autoRevenue = useMemo(() => {
    if (calcMode === 'moneyToRobux') {
      return moneyToRobuxCalc.uangTerpakai;
    }
    return robuxToMoneyCalc.totalHarga;
  }, [calcMode, moneyToRobuxCalc.uangTerpakai, robuxToMoneyCalc.totalHarga]);

  // Total uang ril bayar (mengakomodasi input ketik sendiri / jual nego / jual bebas)
  const parsedCustomRevenue = Math.floor(parseFloat(customRevenue) || 0);
  const isCustomRevenue = customRevenue.trim() !== '' && parsedCustomRevenue > 0;
  const targetRevenue = isCustomRevenue ? parsedCustomRevenue : autoRevenue;

  // Rate efektif yang digunakan
  const enteredRate = parseFloat(inputRate) || 0;
  const effectiveRate = useMemo(() => {
    if (targetRobux > 0 && targetRevenue > 0) {
      if (isCustomRevenue || enteredRate <= 0) {
        return targetRevenue / targetRobux;
      }
    }
    return enteredRate;
  }, [targetRobux, targetRevenue, isCustomRevenue, enteredRate]);

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

  const handleStartEditPreset = (p: RatePreset) => {
    playTapSound();
    setEditingPreset(p);
    setEditPresetRate(String(p.rate));
    setEditPresetLabel(p.label || '');
  };

  const handleSaveEditPreset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPreset) return;
    const r = parseFloat(editPresetRate);
    if (!r || r <= 0) {
      await showWarningAlert('Rate Tidak Valid', 'Masukkan nominal rate lebih dari 0.');
      return;
    }

    try {
      await repository.updateRatePreset(editingPreset.id, {
        rate: r,
        label: editPresetLabel,
      });
      playTapSound();
      const p = await repository.getRatePresets();
      setRatePresets(p);
      setEditingPreset(null);
      await showSuccessAlert('Preset Diperbarui', 'Preset rate berhasil diubah.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal mengubah preset';
      await showErrorAlert('Gagal', msg);
    }
  };

  // Handlers: Mode 3 Rate Finder
  const handleApplyFinderRateToCalc = () => {
    if (competitorRateResult.ratePerRobux <= 0) return;
    playTapSound();
    const formattedRate = Number(competitorRateResult.ratePerRobux.toFixed(2));
    setInputRate(String(formattedRate));
    if (parsedFinderRobux > 0) {
      setInputRobux(String(parsedFinderRobux));
    }
    setCalcMode('robuxToMoney');
    showSuccessAlert(
      'Rate Diterapkan',
      `Rate Rp${formattedRate} / R$ berhasil diterapkan ke Kalkulator Penjualan.`
    );
  };

  const handleSaveFinderRateAsPreset = async () => {
    if (competitorRateResult.ratePerRobux <= 0) return;
    const roundedRate = Number(competitorRateResult.ratePerRobux.toFixed(2));
    const label = `Pasar ${formatNumber(parsedFinderRobux)} R$`;
    try {
      await repository.addRatePreset(roundedRate, label);
      playSuccessSound();
      const p = await repository.getRatePresets();
      setRatePresets(p);
      await showSuccessAlert(
        'Preset Disimpan',
        `Rate Rp${roundedRate} (${label}) berhasil ditambahkan ke daftar preset favorit.`
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal menyimpan preset';
      await showErrorAlert('Gagal', msg);
    }
  };

  const handleCopyFinderResult = async () => {
    if (competitorRateResult.ratePerRobux <= 0) return;
    const lines = [
      'ANALISIS RATE ROBUX (JUFASTORE)',
      `• Jumlah Robux    : ${formatNumber(parsedFinderRobux)} R$`,
      `• Total Uang Bayar: ${formatRupiah(parsedFinderPrice)}`,
      '──────────────────────────────',
      `• Rate Penjualan  : Rate ${formatDecimal(competitorRateResult.ratePerRobux, 2)}`,
      `• Harga 1 Robux   : Rp${formatDecimal(competitorRateResult.ratePerRobux, 2)}`,
      `• Harga 100 Robux : ${formatRupiah(Math.round(competitorRateResult.ratePer100))}`,
      `• Harga 1.000 R$  : ${formatRupiah(Math.round(competitorRateResult.ratePer1k))}`,
      '──────────────────────────────',
      'Dihitung via JufaStore',
    ];
    const text = lines.join('\n');
    try {
      await navigator.clipboard.writeText(text);
      playSuccessSound();
      setRateFinderCopied(true);
      setTimeout(() => setRateFinderCopied(false), 2500);
      await showSuccessAlert('Tersalin!', 'Rincian analisis rate berhasil disalin ke clipboard.');
    } catch {
      window.prompt('Salin rincian rate:', text);
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
      const finalRate = Math.round(effectiveRate * 100) / 100;
      await repository.recordSale({
        robuxSold: targetRobux,
        rateUsed: finalRate,
        totalRevenueRupiah: targetRevenue,
        customerName: customerName.trim() || undefined,
        notes: saleNotes.trim()
          ? `${saleNotes.trim()}${isCustomRevenue ? ' (Harga Nego Manual)' : ''}`
          : isCustomRevenue
          ? 'Harga Nego Manual'
          : undefined,
      });

      setShowSaleModal(false);
      setCustomerName('');
      setSaleNotes('');
      setInputMoney('');
      setInputRobux('');
      setCustomRevenue('');
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
              Kalkulator Robux & Cek Rate
            </h1>
            <p className="text-xs theme-text-secondary">
              Hitung transaksi jual-beli, simulasi laba FIFO, & cek rate pasaran orang lain
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
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-1 p-1 rounded-2xl theme-bg-surface border theme-border">
        <button
          type="button"
          onClick={() => {
            playTapSound();
            setCalcMode('moneyToRobux');
          }}
          className={`py-2 px-3 rounded-xl text-xs sm:text-sm font-semibold transition active:scale-98 ${
            calcMode === 'moneyToRobux'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'theme-text-secondary hover:theme-text-primary'
          }`}
        >
          Mode 1: Uang ke Robux
        </button>
        <button
          type="button"
          onClick={() => {
            playTapSound();
            setCalcMode('robuxToMoney');
          }}
          className={`py-2 px-3 rounded-xl text-xs sm:text-sm font-semibold transition active:scale-98 ${
            calcMode === 'robuxToMoney'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'theme-text-secondary hover:theme-text-primary'
          }`}
        >
          Mode 2: Robux ke Uang
        </button>
        <button
          type="button"
          onClick={() => {
            playTapSound();
            setCalcMode('findRate');
          }}
          className={`py-2 px-3 rounded-xl text-xs sm:text-sm font-semibold transition active:scale-98 flex items-center justify-center gap-1.5 ${
            calcMode === 'findRate'
              ? 'bg-cyan-600 text-white shadow-sm'
              : 'theme-text-secondary hover:theme-text-primary'
          }`}
        >
          <Search size={14} />
          <span>Mode 3: Cari Rate Pasar</span>
        </button>
      </div>

      {/* Content View: Mode 3 Rate Finder ATAU Mode 1/2 Calculator */}
      {calcMode === 'findRate' ? (
        <div className="space-y-4">
          {/* Header Banner Mode 3 */}
          <div className="p-4 rounded-2xl theme-bg-card border theme-border flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shrink-0 mt-0.5">
              <Search size={18} />
            </div>
            <div className="space-y-1">
              <h2 className="text-sm font-bold theme-text-primary">
                Kalkulator Deteksi & Cek Rate Pasaran / Kompetitor
              </h2>
              <p className="text-xs theme-text-secondary leading-relaxed">
                Ketahui rate jual orang lain secara instan dengan memasukkan jumlah Robux dan harga total yang mereka tawarkan (contoh: <strong>1k Robux seharga Rp13k</strong>, maka ratenya adalah <strong>Rp13 / R$</strong>).
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Left Card: Input Form */}
            <div className="p-5 rounded-2xl theme-bg-card border theme-border space-y-4">
              <div className="flex items-center justify-between pb-2 border-b theme-border">
                <span className="text-xs font-bold uppercase tracking-wider theme-text-primary">
                  1. Masukkan Penawaran Orang Lain
                </span>
                <span className="text-[10px] theme-text-muted">Bisa ketik 1k, 13k, dsb.</span>
              </div>

              {/* Input 1: Jumlah Robux */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium theme-text-secondary">
                    Jumlah Robux yang Dijual (R$)
                  </label>
                  {parsedFinderRobux > 0 && (
                    <span className="text-[11px] font-mono font-bold text-amber-400">
                      = {formatNumber(parsedFinderRobux)} R$
                    </span>
                  )}
                </div>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-amber-400 font-mono">
                    R$
                  </span>
                  <input
                    type="text"
                    placeholder="Contoh: 1k, 1000, 500, 2.5k"
                    value={rateFinderRobuxInput}
                    onChange={(e) => setRateFinderRobuxInput(e.target.value)}
                    className="w-full pl-11 pr-3 py-2.5 rounded-xl theme-bg-input border theme-border text-sm theme-text-primary focus:outline-none focus:border-cyan-500 font-mono font-bold"
                  />
                </div>
              </div>

              {/* Input 2: Total Harga Jual */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium theme-text-secondary">
                    Total Harga yang Dijual Orang Lain (Rp)
                  </label>
                  {parsedFinderPrice > 0 && (
                    <span className="text-[11px] font-mono font-bold text-emerald-400">
                      = {formatRupiah(parsedFinderPrice)}
                    </span>
                  )}
                </div>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold theme-text-muted font-mono">
                    Rp
                  </span>
                  <input
                    type="text"
                    placeholder="Contoh: 13k, 13000, 150k, 80k"
                    value={rateFinderPriceInput}
                    onChange={(e) => setRateFinderPriceInput(e.target.value)}
                    className="w-full pl-10 pr-3 py-2.5 rounded-xl theme-bg-input border theme-border text-sm theme-text-primary focus:outline-none focus:border-cyan-500 font-mono font-bold"
                  />
                </div>
              </div>

              <p className="text-[11px] theme-text-muted leading-relaxed pt-1">
                Ketik jumlah Robux dan harga yang ditawarkan orang lain. Mendukung format angka langsung atau notasi cepat seperti <span className="font-mono text-cyan-400 font-semibold">1k</span>, <span className="font-mono text-cyan-400 font-semibold">130k</span>, atau <span className="font-mono text-cyan-400 font-semibold">130 ribu</span>.
              </p>

              {(rateFinderRobuxInput || rateFinderPriceInput) && (
                <button
                  type="button"
                  onClick={() => {
                    playTapSound();
                    setRateFinderRobuxInput('');
                    setRateFinderPriceInput('');
                  }}
                  className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1 pt-1"
                >
                  <RotateCcw size={12} />
                  <span>Kosongkan Input</span>
                </button>
              )}
            </div>

            {/* Right Card: Hasil Kalkulasi & Analisis Komparasi */}
            <div className="p-5 rounded-2xl theme-bg-card border theme-border flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center justify-between pb-3 border-b theme-border">
                  <span className="text-xs font-bold uppercase tracking-wider theme-text-primary flex items-center gap-1.5">
                    <Sparkles size={14} className="text-cyan-400" />
                    <span>2. Hasil Rate Pasaran & Analisis</span>
                  </span>
                  {competitorRateResult.ratePerRobux > 0 && (
                    <button
                      type="button"
                      onClick={handleCopyFinderResult}
                      className="text-xs text-cyan-400 hover:text-cyan-300 font-medium flex items-center gap-1"
                    >
                      {rateFinderCopied ? <Check size={13} /> : <Copy size={13} />}
                      <span>{rateFinderCopied ? 'Tersalin' : 'Salin Hasil'}</span>
                    </button>
                  )}
                </div>

                {competitorRateResult.ratePerRobux <= 0 ? (
                  <div className="p-8 text-center space-y-2">
                    <div className="w-12 h-12 mx-auto rounded-2xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center">
                      <Search size={22} />
                    </div>
                    <p className="text-sm font-semibold theme-text-primary">
                      Menunggu Input Robux & Harga
                    </p>
                    <p className="text-xs theme-text-muted max-w-xs mx-auto">
                      Ketik berapa Robux yang dijual dan berapa total harganya di sebelah kiri untuk melihat berapa ratenya.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4 pt-1">
                    {/* Hasil Rate Utama */}
                    <div className="p-4 rounded-xl theme-bg-surface border border-cyan-500/30 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                          <Sparkles size={13} />
                          <span>Hasil Rate Penjualan:</span>
                        </span>
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">
                          Rate {formatDecimal(competitorRateResult.ratePerRobux, 2)}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-cyan-500/5 border border-cyan-500/20">
                        <div>
                          <span className="text-[10px] uppercase tracking-wider theme-text-muted font-semibold block">
                            Harga 1 Robux
                          </span>
                          <span className="text-2xl sm:text-3xl font-mono font-extrabold text-cyan-400 block mt-0.5">
                            Rp{formatDecimal(competitorRateResult.ratePerRobux, 2)}
                          </span>
                          <span className="text-[10px] theme-text-secondary block">
                            per 1 Robux
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase tracking-wider theme-text-muted font-semibold block">
                            Rate Jual
                          </span>
                          <span className="text-2xl sm:text-3xl font-mono font-extrabold theme-text-primary block mt-0.5">
                            {formatDecimal(competitorRateResult.ratePerRobux, 2)}
                          </span>
                          <span className="text-[10px] theme-text-secondary block">
                            (Harga ÷ Robux)
                          </span>
                        </div>
                      </div>

                      <div className="p-2.5 rounded-lg bg-cyan-500/10 text-xs theme-text-secondary flex items-start gap-2">
                        <Info size={14} className="text-cyan-400 shrink-0 mt-0.5" />
                        <p className="text-[11px] leading-relaxed">
                          Penjual ini menjual dengan <strong>Rate {formatDecimal(competitorRateResult.ratePerRobux, 2)}</strong>, artinya setiap <strong>1 Robux dihargai sebesar Rp{formatDecimal(competitorRateResult.ratePerRobux, 2)}</strong>.
                        </p>
                      </div>
                    </div>

                    {/* Breakdown Tabel: 1 Robux, 100 Robux, dan 1.000 Robux */}
                    <div className="space-y-1.5">
                      <span className="text-[11px] font-bold uppercase tracking-wider theme-text-secondary block">
                        Rincian Nominal Robux Sesuai Rate:
                      </span>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        {/* 1 Robux */}
                        <div className="p-3 rounded-xl theme-bg-surface border border-cyan-500/40 bg-cyan-500/5">
                          <span className="text-[10px] font-bold text-cyan-400 block uppercase">1 Robux</span>
                          <span className="text-sm sm:text-base font-mono font-bold text-cyan-400 block mt-1">
                            Rp{formatDecimal(competitorRateResult.ratePerRobux, 2)}
                          </span>
                          <span className="text-[10px] theme-text-muted block mt-0.5">
                            Rate {formatDecimal(competitorRateResult.ratePerRobux, 2)}
                          </span>
                        </div>
                        {/* 100 Robux */}
                        <div className="p-3 rounded-xl theme-bg-surface border border-amber-500/30 bg-amber-500/5">
                          <span className="text-[10px] font-bold text-amber-400 block uppercase">100 Robux</span>
                          <span className="text-sm sm:text-base font-mono font-bold text-amber-400 block mt-1">
                            {formatRupiah(Math.round(competitorRateResult.ratePer100))}
                          </span>
                          <span className="text-[10px] theme-text-muted block mt-0.5">
                            100 R$
                          </span>
                        </div>
                        {/* 1.000 Robux */}
                        <div className="p-3 rounded-xl theme-bg-surface border border-emerald-500/30 bg-emerald-500/5">
                          <span className="text-[10px] font-bold text-emerald-400 block uppercase">1.000 Robux</span>
                          <span className="text-sm sm:text-base font-mono font-bold text-emerald-400 block mt-1">
                            {formatRupiah(Math.round(competitorRateResult.ratePer1k))}
                          </span>
                          <span className="text-[10px] theme-text-muted block mt-0.5">
                            1.000 R$ (1k)
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Komparasi dengan Modal Toko Sendiri (Jika ada stok) */}
                    {storeAverageCostPerRobux > 0 && (
                      <div className="p-3.5 rounded-xl border text-xs space-y-1.5 transition">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold uppercase tracking-wider theme-text-secondary">
                            Komparasi Modal Kulakan JufaStore
                          </span>
                          <span className="font-mono text-[11px] text-zinc-400">
                            Modal: Rp{formatDecimal(storeAverageCostPerRobux, 1)}/R$
                          </span>
                        </div>

                        {competitorRateResult.ratePerRobux > storeAverageCostPerRobux ? (
                          <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-start gap-2">
                            <TrendingUp size={15} className="shrink-0 mt-0.5" />
                            <div>
                              <span className="font-bold block">Harga Kompetitor Untung!</span>
                              <span className="text-[11px] opacity-90 leading-relaxed block">
                                Rate ini lebih tinggi Rp{formatDecimal(competitorRateResult.ratePerRobux - storeAverageCostPerRobux, 1)}/R$ dari modal toko Anda. Jika Anda menjual dengan rate ini, Anda untung margin sekitar{' '}
                                <strong>
                                  {formatDecimal(
                                    ((competitorRateResult.ratePerRobux - storeAverageCostPerRobux) /
                                      competitorRateResult.ratePerRobux) *
                                      100,
                                    1
                                  )}
                                  %
                                </strong>.
                              </span>
                            </div>
                          </div>
                        ) : competitorRateResult.ratePerRobux < storeAverageCostPerRobux ? (
                          <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-start gap-2">
                            <TrendingDown size={15} className="shrink-0 mt-0.5" />
                            <div>
                              <span className="font-bold block">Harga Kompetitor di Bawah Modal Toko Anda!</span>
                              <span className="text-[11px] opacity-90 leading-relaxed block">
                                Rate ini lebih murah Rp{formatDecimal(storeAverageCostPerRobux - competitorRateResult.ratePerRobux, 1)}/R$ dibandingkan modal stok Anda. Hati-hati jangan meniru harga ini kecuali Anda sudah mendapatkan supplier kulakan yang lebih murah.
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs">
                            Harga sama persis dengan modal kulakan Anda (Break-even Rp0 laba).
                          </div>
                        )}
                      </div>
                    )}

                    {/* Simulasi Jual Kembali / Reseller Arbitrase */}
                    <div className="p-3.5 rounded-xl theme-bg-surface border theme-border space-y-2.5">
                      <div className="flex items-center gap-1.5">
                        <Sparkles size={14} className="text-cyan-400" />
                        <span className="text-xs font-bold uppercase tracking-wider theme-text-primary">
                          Simulasi Jika Beli Dari Orang Ini Lalu Dijual Kembali:
                        </span>
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-medium theme-text-secondary">
                          Target Rate Jual Kembali (Rp / R$)
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold theme-text-muted">
                            Rp
                          </span>
                          <input
                            type="number"
                            step="any"
                            inputMode="decimal"
                            placeholder="Ketik rate jual kembali..."
                            value={resellTargetRate}
                            onChange={(e) => setResellTargetRate(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 rounded-xl theme-bg-input border theme-border text-xs theme-text-primary focus:outline-none focus:border-cyan-500 font-mono font-bold"
                          />
                        </div>
                      </div>

                      {resellSimulation && (
                        <div className="space-y-2 pt-1">
                          {resellSimulation.isProfit && (
                            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs space-y-1.5">
                              <div className="flex items-center justify-between text-emerald-400 font-bold">
                                <span className="flex items-center gap-1">
                                  <TrendingUp size={15} />
                                  <span>Potensi Keuntungan Reseller:</span>
                                </span>
                                <span className="text-sm font-mono font-extrabold">
                                  +{formatRupiah(resellSimulation.profit)}
                                </span>
                              </div>
                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 border-t border-emerald-500/20 text-[11px]">
                                <div>
                                  <span className="theme-text-muted block">Omzet Jual:</span>
                                  <span className="font-mono font-bold theme-text-primary">
                                    {formatRupiah(resellSimulation.sellRevenue)}
                                  </span>
                                </div>
                                <div>
                                  <span className="theme-text-muted block">Untung per 1 R$:</span>
                                  <span className="font-mono font-bold text-emerald-400">
                                    +Rp{formatDecimal(resellSimulation.profitPerRobux, 2)}
                                  </span>
                                </div>
                                <div>
                                  <span className="theme-text-muted block">Margin:</span>
                                  <span className="font-mono font-bold text-emerald-400">
                                    +{formatDecimal(resellSimulation.margin, 1)}%
                                  </span>
                                </div>
                              </div>
                            </div>
                          )}

                          {resellSimulation.isBreakEven && (
                            <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-400">
                              Target rate sama dengan harga beli orang ini (Rp0 laba).
                            </div>
                          )}

                          {resellSimulation.isLoss && (
                            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-400 space-y-1">
                              <div className="flex items-center gap-1.5 font-bold">
                                <TrendingDown size={15} />
                                <span>Peringatan Rugi!</span>
                              </div>
                              <p className="text-[11px] leading-relaxed">
                                Rate jual kembali (Rate {resellTargetRate}) lebih murah dari harga beli orang ini (Rate {formatDecimal(competitorRateResult.ratePerRobux, 2)}).
                                Anda akan <strong>RUGI -{formatRupiah(Math.abs(resellSimulation.profit))}</strong> (-Rp{formatDecimal(Math.abs(resellSimulation.profitPerRobux), 2)}/R$).
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              {competitorRateResult.ratePerRobux > 0 && (
                <div className="space-y-2 pt-2 border-t theme-border">
                  <button
                    type="button"
                    onClick={handleApplyFinderRateToCalc}
                    className="w-full py-2.5 px-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm active:scale-98"
                  >
                    <ArrowRight size={14} />
                    <span>Terapkan Rate Ini ke Kalkulator Jual JufaStore</span>
                  </button>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleSaveFinderRateAsPreset}
                      className="flex-1 py-2 px-3 rounded-xl theme-bg-surface border theme-border hover:border-cyan-500/50 text-xs font-semibold theme-text-primary transition flex items-center justify-center gap-1.5"
                    >
                      <Plus size={13} className="text-cyan-400" />
                      <span>Simpan Jadi Preset</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleCopyFinderResult}
                      className="flex-1 py-2 px-3 rounded-xl theme-bg-surface border theme-border hover:border-cyan-500/50 text-xs font-semibold theme-text-primary transition flex items-center justify-center gap-1.5"
                    >
                      <Copy size={13} className="text-cyan-400" />
                      <span>Salin Rincian</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Calculator Body Cards (Mode 1 & Mode 2) */
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
                      onClick={() => handleStartEditPreset(p)}
                      className="px-1.5 py-1 text-zinc-500 hover:text-emerald-400 hover:bg-emerald-500/10 transition"
                      title="Edit Preset"
                    >
                      <Edit3 size={11} />
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

          {/* Form Edit Preset */}
          {editingPreset && (
            <form
              onSubmit={handleSaveEditPreset}
              className="p-3 rounded-xl theme-bg-surface border border-emerald-500/30 space-y-2 mt-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-emerald-400">Edit Preset Rate</span>
                <button
                  type="button"
                  onClick={() => setEditingPreset(null)}
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
                  value={editPresetRate}
                  onChange={(e) => setEditPresetRate(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg theme-bg-input border theme-border text-xs theme-text-primary focus:outline-none focus:border-emerald-500 font-mono"
                  required
                />
                <input
                  type="text"
                  placeholder="Label (opsional)"
                  value={editPresetLabel}
                  onChange={(e) => setEditPresetLabel(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg theme-bg-input border theme-border text-xs theme-text-primary focus:outline-none focus:border-emerald-500"
                />
              </div>
              <button
                type="submit"
                className="w-full py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition"
              >
                Simpan Perubahan Rate
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
            <div className="grid grid-cols-2 gap-3 my-3">
              <div className="p-3 rounded-xl theme-bg-surface border theme-border">
                <span className="text-[11px] theme-text-muted block">Robux Terjual</span>
                <span className="text-xl font-mono font-extrabold text-amber-400 block mt-0.5">
                  {formatNumber(targetRobux)} <span className="text-xs font-sans font-normal theme-text-muted">R$</span>
                </span>
              </div>
              <div className="p-3 rounded-xl theme-bg-surface border theme-border">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] theme-text-muted">Total Bayar</span>
                  {isCustomRevenue && (
                    <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-500/15 text-amber-500 dark:text-amber-400 border border-amber-500/30">
                      Nego
                    </span>
                  )}
                </div>
                <span className="text-xl font-mono font-extrabold theme-text-primary block mt-0.5">
                  {formatRupiah(targetRevenue)}
                </span>
              </div>
            </div>

            {/* Input Total Uang Bayar Ketik Sendiri (Nego / Jual Ngasal Bebas) */}
            <div className="p-3 rounded-xl theme-bg-surface border theme-border space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold theme-text-primary flex items-center gap-1.5">
                  <Edit3 size={13} className="text-emerald-500" />
                  <span>Ketik Total Bayar Sendiri (Nego / Bebas)</span>
                </label>
                {customRevenue && (
                  <button
                    type="button"
                    onClick={() => {
                      playTapSound();
                      setCustomRevenue('');
                    }}
                    className="text-[10px] text-red-500 hover:underline flex items-center gap-0.5 font-medium"
                  >
                    <RotateCcw size={10} />
                    <span>Reset ke Rate</span>
                  </button>
                )}
              </div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold theme-text-muted">
                  Rp
                </span>
                <input
                  type="number"
                  inputMode="numeric"
                  placeholder={autoRevenue > 0 ? `Otomatis: ${autoRevenue}` : 'Ketik uang bayar langsung...'}
                  value={customRevenue}
                  onChange={(e) => setCustomRevenue(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-lg theme-bg-input border theme-border text-xs theme-text-primary focus:outline-none focus:border-emerald-500 font-mono font-bold"
                />
              </div>
              <p className="text-[10px] theme-text-muted">
                {isCustomRevenue
                  ? `Menggunakan harga ketik sendiri ${formatRupiah(targetRevenue)}. Rate dihitung Rp${formatDecimal(effectiveRate, 2)}/R$.`
                  : 'Kosongkan jika ingin total uang bayar dihitung otomatis dari rate.'}
              </p>
            </div>

            {/* Detail Kembalian atau Rate Efektif */}
            {calcMode === 'moneyToRobux' && !isCustomRevenue ? (
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
                  Rp{formatDecimal(effectiveRate, 2)} / R${' '}
                  {isCustomRevenue && (
                    <span className="text-[10px] text-amber-500 font-sans font-medium">
                      (Nego Manual)
                    </span>
                  )}
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
      )}

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
                  Rp{formatDecimal(effectiveRate, 2)} / R${' '}
                  {isCustomRevenue && (
                    <span className="text-[10px] text-amber-500 font-sans font-medium">
                      (Nego Manual)
                    </span>
                  )}
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
                <span
                  className={`font-mono font-bold ${
                    fifoPreview.grossProfit >= 0 ? 'theme-text-primary' : 'text-red-400'
                  }`}
                >
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
