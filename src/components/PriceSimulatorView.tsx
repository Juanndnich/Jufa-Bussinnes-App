import React, { useMemo, useState } from 'react';
import {
  TrendingUp,
  AlertTriangle,
  Sliders,
  Layers,
  Save,
  CheckCircle2,
  DollarSign,
  Package,
} from 'lucide-react';
import Swal from 'sweetalert2';
import { showToast, showAlert, cleanupSwalLocks } from '../utils/alert';
import { AppSettings, StockBatch } from '../types';
import { formatDecimal, formatNumber, formatRupiah } from '../utils/formatters';

interface PriceSimulatorViewProps {
  batches: StockBatch[];
  settings?: AppSettings;
  onUpdateSettings?: (newSettings: AppSettings) => Promise<void>;
}

export const PriceSimulatorView: React.FC<PriceSimulatorViewProps> = ({
  batches,
  settings,
  onUpdateSettings,
}) => {
  const [activeTab, setActiveTab] = useState<'simulator' | 'tier_policy'>('simulator');

  // Simulator State
  const [selectedBatchId, setSelectedBatchId] = useState<string>('');
  const [customUnitCost, setCustomUnitCost] = useState<number>(160);
  const [targetRobuxOrder, setTargetRobuxOrder] = useState<number>(100);
  const [desiredRate, setDesiredRate] = useState<number>(166);
  const [fixedFee, setFixedFee] = useState<number>(0);
  const [variableFeePercent, setVariableFeePercent] = useState<number>(0);
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [targetMarginPercent, setTargetMarginPercent] = useState<number>(10);

  const [compareRates, setCompareRates] = useState<number[]>([150, 155, 160, 165, 170, 171]);
  const [newRateInput, setNewRateInput] = useState<number>(175);

  // Policy Settings State
  const [policyForm, setPolicyForm] = useState({
    default_rate: settings?.default_rate || 165,
    small_pack_threshold: settings?.small_pack_threshold || 100,
    small_pack_rate: settings?.small_pack_rate || 170,
    large_pack_rate: settings?.large_pack_rate || 160,
    min_stock_alert: settings?.min_stock_alert || 500,
  });

  const handleSavePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings || !onUpdateSettings) return;

    try {
      const updated: AppSettings = {
        ...settings,
        default_rate: policyForm.default_rate,
        small_pack_threshold: policyForm.small_pack_threshold,
        small_pack_rate: policyForm.small_pack_rate,
        large_pack_rate: policyForm.large_pack_rate,
        min_stock_alert: policyForm.min_stock_alert,
      };
      await onUpdateSettings(updated);
      showToast('Kebijakan Harga Berhasil Disimpan!');
    } catch (err: any) {
      showAlert('Gagal Menyimpan', err.message, 'error');
    } finally {
      cleanupSwalLocks();
    }
  };

  const activeCostPerUnit = useMemo(() => {
    if (selectedBatchId) {
      const b = batches.find(x => x.id === selectedBatchId);
      if (b) return b.cost_per_unit;
    }
    return customUnitCost;
  }, [selectedBatchId, batches, customUnitCost]);

  const totalStockAvailable = useMemo(() => {
    return batches.reduce((sum, b) => sum + b.remaining_quantity, 0);
  }, [batches]);

  const sim = useMemo(() => {
    const qty = targetRobuxOrder;
    const rate = desiredRate;
    const cost = activeCostPerUnit;

    const normalGross = qty * rate;
    const disc = Math.round((normalGross * discountPercent) / 100);
    const netRevenue = Math.max(0, normalGross - disc);
    const cogs = Math.round(qty * cost);

    const fee = Math.round(fixedFee + (netRevenue * variableFeePercent) / 100);
    const grossProfit = netRevenue - cogs;
    const netProfit = grossProfit - fee;
    const margin = netRevenue > 0 ? (netProfit / netRevenue) * 100 : 0;

    const denom = qty * (1 - discountPercent / 100) * (1 - variableFeePercent / 100);
    const breakEvenRate = denom > 0 ? Number((((qty * cost) + fixedFee) / denom).toFixed(2)) : 0;

    const targetMarginFactor = 1 - (targetMarginPercent / 100) - (variableFeePercent / 100);
    const rateForTargetMargin =
      targetMarginFactor > 0 && qty * (1 - discountPercent / 100) > 0
        ? Number(
            (((qty * cost) + fixedFee) / (qty * (1 - discountPercent / 100) * targetMarginFactor)).toFixed(2)
          )
        : 0;

    let status: 'UNTUNG' | 'IMPAS' | 'RUGI' = 'IMPAS';
    if (netProfit > 0) status = 'UNTUNG';
    else if (netProfit < 0) status = 'RUGI';

    return {
      normalGross,
      disc,
      netRevenue,
      cogs,
      fee,
      grossProfit,
      netProfit,
      margin,
      breakEvenRate,
      rateForTargetMargin,
      status,
      isBelowCost: rate < cost,
    };
  }, [
    targetRobuxOrder,
    desiredRate,
    activeCostPerUnit,
    fixedFee,
    variableFeePercent,
    discountPercent,
    targetMarginPercent,
  ]);

  return (
    <div className="space-y-6">
      {/* Top Banner & Tab Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b theme-border pb-4">
        <div>
          <h2 className="text-base sm:text-lg font-heading font-bold theme-text-primary flex items-center gap-2">
            <TrendingUp size={20} /> Kebijakan & Simulasi Harga Jual
          </h2>
          <p className="text-xs theme-text-secondary">
            Atur tier rate harga toko dan uji sensitivitas keuntungan agar bisnis tidak menjual rugi.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:flex sm:items-center gap-1.5 theme-bg-card p-1 rounded-xl border theme-border w-full sm:w-auto">
          <button
            onClick={() => setActiveTab('simulator')}
            className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition text-center ${
              activeTab === 'simulator'
                ? 'theme-bg-surface theme-text-primary shadow-sm border theme-border'
                : 'theme-text-muted hover:theme-text-primary'
            }`}
          >
            <Sliders size={14} className="shrink-0" />
            <span className="truncate">Simulator Margin</span>
          </button>
          <button
            onClick={() => setActiveTab('tier_policy')}
            className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition text-center ${
              activeTab === 'tier_policy'
                ? 'theme-bg-surface theme-text-primary shadow-sm border theme-border'
                : 'theme-text-muted hover:theme-text-primary'
            }`}
          >
            <Layers size={14} className="shrink-0" />
            <span className="truncate">Kebijakan & Tier Rate</span>
          </button>
        </div>
      </div>

      {/* TAB 1: Simulator Margin */}
      {activeTab === 'simulator' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Simulator Control Inputs */}
          <div className="theme-bg-surface p-5 sm:p-6 rounded-2xl border theme-border space-y-4">
            <h3 className="font-heading font-bold theme-text-primary text-sm border-b theme-border pb-3 flex items-center gap-2">
              <Sliders size={15} />
              <span>Parameter Uji Simulasi</span>
            </h3>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium theme-text-secondary block mb-1">
                  Pilih Batch Stok Acuan
                </label>
                <select
                  value={selectedBatchId}
                  onChange={e => setSelectedBatchId(e.target.value)}
                  className="w-full theme-bg-input border theme-border rounded-xl px-3 py-2 text-xs theme-text-primary focus:outline-none"
                >
                  <option value="">Manual / Kustom (Ketik di bawah)</option>
                  {batches.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.batch_code} (Modal: Rp{b.cost_per_unit}/R$ - Sisa {formatNumber(b.remaining_quantity)} R$)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium theme-text-secondary block mb-1">
                  Modal per Robux (HPP) (Rp)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={activeCostPerUnit}
                  onChange={e => {
                    setSelectedBatchId('');
                    setCustomUnitCost(Number(e.target.value));
                  }}
                  className="w-full theme-bg-input border theme-border rounded-xl px-3 py-2 text-xs font-mono font-bold theme-text-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-medium theme-text-secondary block mb-1">
                  Rate Jual yang Diuji (Rp / R$)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={desiredRate}
                  onChange={e => setDesiredRate(Number(e.target.value))}
                  className="w-full theme-bg-input border theme-border rounded-xl px-3 py-2 text-xs font-mono font-bold theme-text-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-medium theme-text-secondary block mb-1">
                  Jumlah Robux Pesanan (R$)
                </label>
                <input
                  type="number"
                  min="1"
                  value={targetRobuxOrder}
                  onChange={e => setTargetRobuxOrder(Number(e.target.value))}
                  className="w-full theme-bg-input border theme-border rounded-xl px-3 py-2 text-xs font-mono font-bold theme-text-primary focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Simulator Results */}
          <div className="lg:col-span-2 theme-bg-surface p-5 sm:p-6 rounded-2xl border theme-border space-y-5">
            <div className="flex items-center justify-between border-b theme-border pb-3">
              <h3 className="font-heading font-bold theme-text-primary text-sm">
                Hasil Kalkulasi Keuntungan
              </h3>
              <span
                className={`text-xs font-bold px-3 py-1 rounded-full ${
                  sim.status === 'UNTUNG'
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'bg-rose-500/20 text-rose-400'
                }`}
              >
                {sim.status === 'UNTUNG' ? 'STATUS: AMAN / UNTUNG' : 'STATUS: POTENSI RUGI'}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div className="p-3.5 rounded-xl theme-bg-card border theme-border">
                <span className="text-[11px] theme-text-muted block">Pendapatan Kotor</span>
                <strong className="text-sm font-mono theme-text-primary block mt-0.5">
                  {formatRupiah(sim.normalGross)}
                </strong>
              </div>

              <div className="p-3.5 rounded-xl theme-bg-card border theme-border">
                <span className="text-[11px] theme-text-muted block">Modal HPP (Robux)</span>
                <strong className="text-sm font-mono text-rose-400 block mt-0.5">
                  -{formatRupiah(sim.cogs)}
                </strong>
              </div>

              <div className="p-3.5 rounded-xl theme-bg-card border theme-border">
                <span className="text-[11px] theme-text-muted block">Laba Bersih</span>
                <strong
                  className={`text-sm font-mono font-bold block mt-0.5 ${
                    sim.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {formatRupiah(sim.netProfit)}
                </strong>
              </div>

              <div className="p-3.5 rounded-xl theme-bg-card border theme-border">
                <span className="text-[11px] theme-text-muted block">Margin Keuntungan</span>
                <strong className="text-sm font-mono theme-text-primary block mt-0.5">
                  {sim.margin.toFixed(2)}%
                </strong>
              </div>

              <div className="p-3.5 rounded-xl theme-bg-card border theme-border">
                <span className="text-[11px] theme-text-muted block">Titik Impas (BEP)</span>
                <strong className="text-sm font-mono text-amber-400 block mt-0.5">
                  Rp{sim.breakEvenRate}/R$
                </strong>
              </div>

              <div className="p-3.5 rounded-xl theme-bg-card border theme-border">
                <span className="text-[11px] theme-text-muted block">Rekomendasi Rate Aman</span>
                <strong className="text-sm font-mono text-cyan-400 block mt-0.5">
                  Rp{sim.rateForTargetMargin}/R$
                </strong>
              </div>
            </div>

            {sim.isBelowCost && (
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
                <AlertTriangle size={16} className="shrink-0" />
                <span>
                  <strong>Peringatan Rugi:</strong> Rate jual yang Anda uji (Rp{desiredRate}) berada di bawah harga modal Robux (Rp{activeCostPerUnit}). Anda akan merugi sebesar Rp{(activeCostPerUnit - desiredRate) * targetRobuxOrder}!
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: Kebijakan & Tier Rate Toko */}
      {activeTab === 'tier_policy' && (
        <form
          onSubmit={handleSavePolicy}
          className="theme-bg-surface p-5 sm:p-6 rounded-2xl border theme-border space-y-6"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b theme-border pb-3">
            <div>
              <h3 className="font-heading font-bold theme-text-primary text-base">
                Kebijakan & Tier Harga Toko
              </h3>
              <p className="text-xs theme-text-secondary mt-0.5">
                Pengaturan harga jual otomatis per kategori kuantitas untuk mempercepat pencatatan transaksi kasir.
              </p>
            </div>
            <button
              type="submit"
              className="flex items-center justify-center gap-2 px-5 py-2 rounded-xl bg-white text-black font-bold text-xs hover:bg-neutral-200 transition"
            >
              <Save size={14} /> Simpan Kebijakan
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="p-4 rounded-xl theme-bg-card border theme-border space-y-2">
              <label className="text-xs font-bold theme-text-primary block">
                Rate Jual Standar (Rp / R$)
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={policyForm.default_rate}
                onChange={e =>
                  setPolicyForm({ ...policyForm, default_rate: Number(e.target.value) })
                }
                className="w-full theme-bg-input border theme-border rounded-xl px-3 py-2 text-xs font-mono font-bold theme-text-primary focus:outline-none"
                required
              />
              <span className="text-[11px] theme-text-muted block">
                Rate patokan utama saat mencatat transaksi penjualan baru.
              </span>
            </div>

            <div className="p-4 rounded-xl theme-bg-card border theme-border space-y-2">
              <label className="text-xs font-bold theme-text-primary block">
                Batas Kuantitas Paket Kecil (R$)
              </label>
              <input
                type="number"
                min="0"
                value={policyForm.small_pack_threshold}
                onChange={e =>
                  setPolicyForm({
                    ...policyForm,
                    small_pack_threshold: Number(e.target.value),
                  })
                }
                className="w-full theme-bg-input border theme-border rounded-xl px-3 py-2 text-xs font-mono font-bold theme-text-primary focus:outline-none"
              />
              <span className="text-[11px] theme-text-muted block">
                Batas maksimal jumlah Robux untuk kategori paket eceran kecil (contoh: 100 R$).
              </span>
            </div>

            <div className="p-4 rounded-xl theme-bg-card border theme-border space-y-2">
              <label className="text-xs font-bold theme-text-primary block">
                Rate Paket Kecil (Rp / R$)
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={policyForm.small_pack_rate}
                onChange={e =>
                  setPolicyForm({ ...policyForm, small_pack_rate: Number(e.target.value) })
                }
                className="w-full theme-bg-input border theme-border rounded-xl px-3 py-2 text-xs font-mono font-bold theme-text-primary focus:outline-none"
              />
              <span className="text-[11px] theme-text-muted block">
                Rate khusus untuk pesanan eceran di bawah atau sama dengan batas paket kecil.
              </span>
            </div>

            <div className="p-4 rounded-xl theme-bg-card border theme-border space-y-2">
              <label className="text-xs font-bold theme-text-primary block">
                Rate Paket Besar / Grosir (Rp / R$)
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={policyForm.large_pack_rate}
                onChange={e =>
                  setPolicyForm({ ...policyForm, large_pack_rate: Number(e.target.value) })
                }
                className="w-full theme-bg-input border theme-border rounded-xl px-3 py-2 text-xs font-mono font-bold theme-text-primary focus:outline-none"
              />
              <span className="text-[11px] theme-text-muted block">
                Rate diskon volume untuk pembelian grosir di atas batas paket kecil.
              </span>
            </div>

            <div className="p-4 rounded-xl theme-bg-card border theme-border space-y-2 sm:col-span-2">
              <label className="text-xs font-bold theme-text-primary block">
                Batas Peringatan Stok Menipis (R$)
              </label>
              <input
                type="number"
                min="0"
                value={policyForm.min_stock_alert}
                onChange={e =>
                  setPolicyForm({ ...policyForm, min_stock_alert: Number(e.target.value) })
                }
                className="w-full theme-bg-input border theme-border rounded-xl px-3 py-2 text-xs font-mono font-bold theme-text-primary focus:outline-none"
              />
              <span className="text-[11px] theme-text-muted block">
                Sistem akan menampilkan badge peringatan kuning "Menipis" ketika total sisa stok Robux mencapai angka ini atau lebih rendah.
              </span>
            </div>
          </div>
        </form>
      )}
    </div>
  );
};
