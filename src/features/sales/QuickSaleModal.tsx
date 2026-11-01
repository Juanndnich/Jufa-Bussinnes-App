import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Receipt,
  User,
  Coins,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Users,
  Copy,
  Sparkles,
  Layers,
} from 'lucide-react';
import { repository } from '../../db/repository';
import { StockBatch, Investor, Sale } from '../../db/schema';
import { NumberInput } from '../../components/NumberInput';
import {
  allocateFifoCost,
  calculateProfit,
  parseRobuxOrMoneyShorthand,
  FifoBatchInput,
} from '../../domain/calculations';
import {
  formatRupiah,
  formatNumber,
  formatDecimal,
  formatDateJakarta,
} from '../../utils/formatters';
import { showSuccessAlert, showErrorAlert, showWarningAlert } from '../../utils/alert';
import { playTapSound, playSuccessSound } from '../../utils/sound';

interface QuickSaleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaleSaved?: (sale: Sale) => void;
}

export const QuickSaleModal: React.FC<QuickSaleModalProps> = ({
  isOpen,
  onClose,
  onSaleSaved,
}) => {
  const [customerName, setCustomerName] = useState('');
  const [robuxInput, setRobuxInput] = useState('');
  const [pricingMode, setPricingMode] = useState<'rate' | 'total'>('rate');
  const [rateInput, setRateInput] = useState('');
  const [totalInput, setTotalInput] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [batches, setBatches] = useState<StockBatch[]>([]);
  const [investors, setInvestors] = useState<Investor[]>([]);

  useEffect(() => {
    if (isOpen) {
      repository.getAvailableBatches().then(setBatches).catch(() => {});
      repository.getInvestors().then((invs) => setInvestors(invs.filter((i) => i.status === 'ACTIVE'))).catch(() => {});
    }
  }, [isOpen]);

  const parsedRobux = useMemo(() => parseRobuxOrMoneyShorthand(robuxInput), [robuxInput]);
  const parsedRate = useMemo(() => parseFloat(rateInput) || 0, [rateInput]);
  const parsedTotal = useMemo(() => parseRobuxOrMoneyShorthand(totalInput), [totalInput]);

  // Total Available Stock
  const totalStockRobux = useMemo(() => {
    return batches.reduce((acc, b) => acc + b.remainingRobux, 0);
  }, [batches]);

  // Total Revenue Calculation
  const finalRevenue = useMemo(() => {
    if (pricingMode === 'total') {
      return parsedTotal;
    }
    return Math.ceil(parsedRobux * parsedRate);
  }, [pricingMode, parsedTotal, parsedRobux, parsedRate]);

  const effectiveRate = useMemo(() => {
    if (parsedRobux <= 0 || finalRevenue <= 0) return 0;
    return finalRevenue / parsedRobux;
  }, [parsedRobux, finalRevenue]);

  // FIFO Allocation Preview
  const fifoPreview = useMemo(() => {
    if (parsedRobux <= 0) {
      return { success: true, totalCogs: 0, shortage: 0, loanPortion: 0 };
    }

    const batchInputs: FifoBatchInput[] = batches.map((b) => ({
      id: b.id,
      remainingRobux: b.remainingRobux,
      remainingCostRupiah: b.remainingCostRupiah,
    }));

    const alloc = allocateFifoCost(batchInputs, parsedRobux);

    // Hitung apakah ada batch yang didanai pinjaman
    let loanPortion = 0;
    for (const a of alloc.allocations) {
      const b = batches.find((item) => item.id === a.batchId);
      if (b && b.fundingSource === 'LOAN') {
        loanPortion += a.costAllocatedRupiah;
      }
    }

    return {
      success: alloc.success,
      totalCogs: alloc.totalCogsRupiah,
      shortage: alloc.shortageRobux,
      loanPortion,
    };
  }, [batches, parsedRobux]);

  // Profit & Sharing Preview
  const profitPreview = useMemo(() => {
    if (finalRevenue <= 0 || parsedRobux <= 0) return null;
    const profit = calculateProfit(finalRevenue, fifoPreview.totalCogs);

    // Bagi hasil investor
    const totalActivePercentage = investors.reduce((sum, inv) => sum + inv.sharePercentage, 0);
    const investorShare = profit.grossProfit > 0
      ? Math.round((profit.grossProfit * totalActivePercentage) / 100)
      : 0;
    const ownerShare = profit.grossProfit - investorShare;

    return {
      grossProfit: profit.grossProfit,
      margin: profit.marginPercentage,
      investorShare,
      ownerShare,
      totalActivePercentage,
      isProfit: profit.grossProfit > 0,
      isLoss: profit.grossProfit < 0,
    };
  }, [finalRevenue, fifoPreview.totalCogs, parsedRobux, investors]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (parsedRobux <= 0) {
      await showWarningAlert('Jumlah Robux Kosong', 'Masukkan nominal Robux yang dijual.');
      return;
    }

    if (finalRevenue <= 0) {
      await showWarningAlert('Total Harga Kosong', 'Masukkan rate jual atau total harga bayar.');
      return;
    }

    if (!fifoPreview.success) {
      await showWarningAlert(
        'Stok Tidak Cukup',
        `Stok tersedia hanya ${formatNumber(totalStockRobux)} R$. Kurang ${formatNumber(fifoPreview.shortage)} R$.`
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const sale = await repository.recordSale({
        robuxSold: parsedRobux,
        rateUsed: effectiveRate,
        totalRevenueRupiah: finalRevenue,
        customerName: customerName.trim() || undefined,
        notes: notes.trim()
          ? `${notes.trim()}${pricingMode === 'total' ? ' (Harga Nego)' : ''}`
          : pricingMode === 'total'
          ? 'Harga Nego Manual'
          : undefined,
      });

      playSuccessSound();
      setCustomerName('');
      setRobuxInput('');
      setRateInput('');
      setTotalInput('');
      setNotes('');
      onClose();

      if (onSaleSaved) {
        onSaleSaved(sale);
      }

      await showSuccessAlert(
        'Penjualan Berhasil',
        `${formatNumber(parsedRobux)} R$ berhasil dicatat ke sistem dengan invoice ${sale.invoiceNumber}.`
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal mencatat penjualan';
      await showErrorAlert('Gagal', msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-lg rounded-2xl theme-bg-card border theme-border shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header Modal */}
        <div className="p-4 sm:p-5 border-b theme-border flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Receipt size={18} />
            </div>
            <div>
              <h2 className="text-sm font-bold theme-text-primary">
                Catat Penjualan Baru
              </h2>
              <p className="text-[11px] theme-text-muted">
                Pencatatan langsung penjualan Robux tanpa lewat kalkulator
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg theme-bg-surface hover:theme-bg-card-hover text-zinc-400 hover:theme-text-primary transition"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">
          {/* Stok Info Badge */}
          <div className="flex items-center justify-between p-2.5 rounded-xl theme-bg-surface border theme-border text-xs">
            <span className="theme-text-secondary flex items-center gap-1.5">
              <Coins size={14} className="text-amber-400" />
              <span>Sisa Stok Persediaan Toko:</span>
            </span>
            <span className="font-mono font-bold text-amber-400">
              {formatNumber(totalStockRobux)} R$
            </span>
          </div>

          {/* Nama Pembeli (Opsional) */}
          <div className="space-y-1">
            <label className="text-xs font-medium theme-text-secondary">
              Nama Pembeli / Pelanggan (Opsional)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs theme-text-muted">
                <User size={14} />
              </span>
              <input
                type="text"
                placeholder="Contoh: Budi, Pelanggan WA, dsb"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl theme-bg-input border theme-border text-xs theme-text-primary focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Jumlah Robux yang Dijual */}
          <NumberInput
            label="Jumlah Robux yang Dijual (R$)"
            suffix="R$"
            value={parsedRobux || ''}
            onChange={(val) => setRobuxInput(val === '' ? '' : String(val))}
            placeholder="Contoh: 1000 atau 1k"
            required
          />

          {/* Pilihan Mode Harga */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium theme-text-secondary">
                Tentukan Harga Penjualan:
              </label>
              <div className="flex items-center gap-1 p-0.5 rounded-lg theme-bg-surface border theme-border text-[11px]">
                <button
                  type="button"
                  onClick={() => setPricingMode('rate')}
                  className={`px-2 py-0.5 rounded-md transition ${
                    pricingMode === 'rate'
                      ? 'bg-emerald-600 text-white font-bold'
                      : 'theme-text-muted hover:theme-text-primary'
                  }`}
                >
                  Rate Jual
                </button>
                <button
                  type="button"
                  onClick={() => setPricingMode('total')}
                  className={`px-2 py-0.5 rounded-md transition ${
                    pricingMode === 'total'
                      ? 'bg-emerald-600 text-white font-bold'
                      : 'theme-text-muted hover:theme-text-primary'
                  }`}
                >
                  Harga Total (Nego)
                </button>
              </div>
            </div>

            {pricingMode === 'rate' ? (
              <div className="space-y-1">
                <NumberInput
                  prefix="Rp"
                  suffix="/R$"
                  allowDecimals={true}
                  maxDecimals={2}
                  value={rateInput === '' ? '' : parseFloat(rateInput)}
                  onChange={(val) => setRateInput(val === '' ? '' : String(val))}
                  placeholder="Contoh: 150 atau 160"
                  required
                />
                {parsedRobux > 0 && parsedRate > 0 && (
                  <span className="text-[11px] theme-text-muted block">
                    Total yang harus dibayar pembeli: <strong className="text-emerald-400 font-mono">{formatRupiah(finalRevenue)}</strong>
                  </span>
                )}
              </div>
            ) : (
              <div className="space-y-1">
                <NumberInput
                  isCurrency={true}
                  value={parsedTotal || ''}
                  onChange={(val) => setTotalInput(val === '' ? '' : String(val))}
                  placeholder="Contoh: 150000 atau 150k"
                  required
                />
                {parsedRobux > 0 && parsedTotal > 0 && (
                  <span className="text-[11px] theme-text-muted block">
                    Rate efektif dihitung: <strong className="text-cyan-400 font-mono">Rate {formatDecimal(effectiveRate, 2)}</strong> (Rp{formatDecimal(effectiveRate, 2)}/R$)
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Preview Analisis FIFO & Pembagian */}
          {parsedRobux > 0 && finalRevenue > 0 && (
            <div className="p-3.5 rounded-xl theme-bg-surface border theme-border space-y-2 text-xs">
              <div className="flex items-center justify-between font-bold">
                <span className="theme-text-secondary flex items-center gap-1.5">
                  <Sparkles size={14} className="text-emerald-400" />
                  <span>Ringkasan Transaksi:</span>
                </span>
                <span className="font-mono text-emerald-400">
                  {formatRupiah(finalRevenue)}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1 border-t theme-border text-[11px]">
                <div>
                  <span className="theme-text-muted block">Modal HPP (FIFO):</span>
                  <span className="font-mono font-bold theme-text-primary">
                    {formatRupiah(fifoPreview.totalCogs)}
                  </span>
                </div>
                <div>
                  <span className="theme-text-muted block">Laba Kotor:</span>
                  <span className={`font-mono font-bold ${profitPreview?.isProfit ? 'text-emerald-400' : 'text-red-400'}`}>
                    {profitPreview?.isProfit ? '+' : ''}{formatRupiah(profitPreview?.grossProfit || 0)}
                    {profitPreview?.margin !== null && ` (${formatDecimal(profitPreview?.margin, 1)}%)`}
                  </span>
                </div>
              </div>

              {/* Info Alokasi Pinjaman jika batch didanai utang */}
              {fifoPreview.loanPortion > 0 && (
                <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[11px] flex items-start gap-1.5">
                  <Layers size={13} className="shrink-0 mt-0.5" />
                  <span>
                    Batch stok ini didanai pinjaman modal. <strong>{formatRupiah(fifoPreview.loanPortion)}</strong> dari hasil penjualan otomatis dialokasikan untuk pelunasan pokok utang.
                  </span>
                </div>
              )}

              {/* Info Bagi Hasil Investor jika ada */}
              {profitPreview && profitPreview.totalActivePercentage > 0 && profitPreview.isProfit && (
                <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-[11px] space-y-0.5">
                  <div className="flex items-center justify-between font-bold">
                    <span className="flex items-center gap-1">
                      <Users size={12} />
                      <span>Bagi Hasil ({profitPreview.totalActivePercentage}% Investor):</span>
                    </span>
                    <span className="font-mono">{formatRupiah(profitPreview.investorShare)}</span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] opacity-90">
                    <span>Bagian Bersih Pemilik Toko:</span>
                    <span className="font-mono font-bold">{formatRupiah(profitPreview.ownerShare)}</span>
                  </div>
                </div>
              )}

              {!fifoPreview.success && (
                <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-[11px] flex items-center gap-1.5">
                  <AlertTriangle size={13} className="shrink-0" />
                  <span>Stok tidak mencukupi untuk transaksi ini!</span>
                </div>
              )}
            </div>
          )}

          {/* Catatan Transaksi */}
          <div className="space-y-1">
            <label className="text-xs font-medium theme-text-secondary">
              Catatan Transaksi (Opsional)
            </label>
            <input
              type="text"
              placeholder="Keterangan tambahan..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 rounded-xl theme-bg-input border theme-border text-xs theme-text-primary focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting || parsedRobux <= 0 || finalRevenue <= 0 || !fifoPreview.success}
            className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition active:scale-98 shadow-md"
          >
            <CheckCircle2 size={16} />
            <span>{isSubmitting ? 'Menyimpan Transaksi...' : 'Simpan & Selesaikan Penjualan'}</span>
          </button>
        </form>
      </div>
    </div>
  );
};
