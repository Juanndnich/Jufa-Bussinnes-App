import React, { useMemo, useState } from 'react';
import {
  TrendingUp,
  AlertTriangle,
  Sliders,
  Save,
  CheckCircle2,
  DollarSign,
  Package,
  HelpCircle,
  Sparkles,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import { showToast, showAlert, cleanupSwalLocks } from '../utils/alert';
import { AppSettings, StockBatch } from '../types';
import { formatNumber, formatRupiah } from '../utils/formatters';

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
  // Pilihan model penetapan harga: 'flat' (satu rate rata) atau 'tiered' (paket kecil vs besar)
  const [pricingModel, setPricingModel] = useState<'flat' | 'tiered'>('flat');

  // Pengaturan Harga Toko
  const [defaultRate, setDefaultRate] = useState<number>(settings?.default_rate || 165);
  const [smallPackThreshold, setSmallPackThreshold] = useState<number>(settings?.small_pack_threshold || 500);
  const [smallPackRate, setSmallPackRate] = useState<number>(settings?.small_pack_rate || 170);
  const [largePackRate, setLargePackRate] = useState<number>(settings?.large_pack_rate || 160);
  const [minStockAlert, setMinStockAlert] = useState<number>(settings?.min_stock_alert || 500);

  // State Simulator Interaktif
  const [testRobuxQty, setTestRobuxQty] = useState<number>(500);
  const [customRateTest, setCustomRateTest] = useState<number>(settings?.default_rate || 165);

  // 1. Hitung Modal Riil Saat Ini dari Batch Aktif
  const totalStockAvailable = useMemo(() => {
    return batches.reduce((sum, b) => sum + (b.remaining_quantity || 0), 0);
  }, [batches]);

  const activeCostPerUnit = useMemo(() => {
    const activeBatches = batches.filter(b => b.remaining_quantity > 0);
    if (activeBatches.length === 0) return 160; // default jika belum ada stok
    // Rata-rata modal per Robux yang tersisa
    const totalAsset = activeBatches.reduce((sum, b) => sum + b.remaining_quantity * b.cost_per_unit, 0);
    const totalQty = activeBatches.reduce((sum, b) => sum + b.remaining_quantity, 0);
    return totalQty > 0 ? Math.round(totalAsset / totalQty) : 160;
  }, [batches]);

  // Simpan Aturan Harga ke Pengaturan Toko
  const handleSavePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings || !onUpdateSettings) return;

    try {
      const updated: AppSettings = {
        ...settings,
        default_rate: Number(defaultRate),
        small_pack_threshold: Number(smallPackThreshold),
        small_pack_rate: Number(smallPackRate),
        large_pack_rate: Number(largePackRate),
        min_stock_alert: Number(minStockAlert),
      };

      await onUpdateSettings(updated);
      showToast('Aturan Harga Jual Toko Berhasil Disimpan!');
    } catch (err: any) {
      showAlert('Gagal Menyimpan', err.message, 'error');
    } finally {
      cleanupSwalLocks();
    }
  };

  // 2. Kalkulasi Simulasi Cek Keuntungan
  const simResult = useMemo(() => {
    const qty = Math.max(1, Number(testRobuxQty) || 1);
    const rate = Number(customRateTest) || 165;
    const costPerRbx = activeCostPerUnit;

    const totalMoneyReceived = qty * rate;
    const totalOriginalCost = Math.round(qty * costPerRbx);
    const netProfit = totalMoneyReceived - totalOriginalCost;
    const isLoss = rate < costPerRbx;

    return {
      qty,
      rate,
      costPerRbx,
      totalMoneyReceived,
      totalOriginalCost,
      netProfit,
      isLoss,
    };
  }, [testRobuxQty, customRateTest, activeCostPerUnit]);

  return (
    <div className="space-y-6">
      {/* Header Utama */}
      <div className="theme-bg-surface p-4 sm:p-5 rounded-2xl border theme-border">
        <h2 className="text-base sm:text-lg font-heading font-bold theme-text-primary flex items-center gap-2">
          <TrendingUp size={20} />
          <span>Pengaturan Harga Jual & Simulasi Keuntungan</span>
        </h2>
        <p className="text-xs theme-text-secondary mt-1">
          Tentukan harga jual toko Anda dan langsung uji berapa keuntungan bersih yang masuk ke kantong Anda tanpa rumus yang membingungkan.
        </p>
      </div>

      {/* Ringkasan Modal Beli & Stok Anda Saat Ini */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <div className="theme-bg-surface p-4 rounded-2xl border theme-border">
          <span className="text-[11px] theme-text-muted block mb-1">Rata-rata Modal Beli Anda</span>
          <div className="text-xl sm:text-2xl font-bold font-mono theme-text-primary">
            Rp{activeCostPerUnit} <span className="text-xs font-normal theme-text-muted">/ Robux</span>
          </div>
          <span className="text-[10px] theme-text-secondary mt-1 block">
            Dihitung otomatis dari harga beli stok Anda
          </span>
        </div>

        <div className="theme-bg-surface p-4 rounded-2xl border theme-border">
          <span className="text-[11px] theme-text-muted block mb-1">Sisa Stok Siap Dijual</span>
          <div className="text-xl sm:text-2xl font-bold font-mono text-emerald-400">
            {formatNumber(totalStockAvailable)} <span className="text-xs font-normal">R$</span>
          </div>
          <span className="text-[10px] theme-text-secondary mt-1 block">
            Stok Robux yang belum laku terjual
          </span>
        </div>

        <div className="theme-bg-surface p-4 rounded-2xl border theme-border">
          <span className="text-[11px] theme-text-muted block mb-1">Harga Jual Standar Toko</span>
          <div className="text-xl sm:text-2xl font-bold font-mono text-sky-400">
            Rp{defaultRate} <span className="text-xs font-normal">/ Robux</span>
          </div>
          <span className="text-[10px] text-emerald-400 font-medium mt-1 block">
            Untung: +Rp{defaultRate - activeCostPerUnit} / Robux
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Kolom Kiri: Aturan Harga Jual Toko */}
        <div className="theme-bg-surface p-5 sm:p-6 rounded-2xl border theme-border space-y-5">
          <div className="border-b theme-border pb-3">
            <h3 className="font-heading font-bold theme-text-primary text-sm flex items-center gap-2">
              <Sliders size={16} /> 1. Atur Cara Jual Toko Anda
            </h3>
            <p className="text-xs theme-text-secondary mt-1">
              Pilih apakah semua pembeli dapat harga sama rata, atau dipisah (beli banyak dapat diskon murah).
            </p>
          </div>

          {/* Selector Model Harga */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setPricingModel('flat')}
              className={`p-3 rounded-xl border text-left transition ${
                pricingModel === 'flat'
                  ? 'theme-bg-card theme-border border-white/30 ring-1 ring-white/20'
                  : 'theme-bg-input theme-border-subtle opacity-70 hover:opacity-100'
              }`}
            >
              <div className="text-xs font-bold theme-text-primary">Satu Harga (Sama Rata)</div>
              <div className="text-[10.5px] theme-text-muted mt-1 leading-tight">
                Semua pembeli bayar di harga rate yang sama, tidak peduli beli sedikit atau banyak.
              </div>
            </button>

            <button
              type="button"
              onClick={() => setPricingModel('tiered')}
              className={`p-3 rounded-xl border text-left transition ${
                pricingModel === 'tiered'
                  ? 'theme-bg-card theme-border border-white/30 ring-1 ring-white/20'
                  : 'theme-bg-input theme-border-subtle opacity-70 hover:opacity-100'
              }`}
            >
              <div className="text-xs font-bold theme-text-primary">Paket Kecil vs Besar</div>
              <div className="text-[10.5px] theme-text-muted mt-1 leading-tight">
                Beli eceran sedikit lebih mahal, beli borongan banyak dapat harga lebih murah.
              </div>
            </button>
          </div>

          <form onSubmit={handleSavePolicy} className="space-y-4 pt-1">
            {pricingModel === 'flat' ? (
              <div className="p-4 rounded-xl theme-bg-card border theme-border space-y-3">
                <label className="text-xs font-bold theme-text-primary block">
                  Harga Jual Rata untuk Semua Pembeli (Rp per Robux)
                </label>
                <div className="flex items-center gap-3">
                  <span className="text-xs theme-text-secondary">Rp</span>
                  <input
                    type="number"
                    value={defaultRate}
                    onChange={e => {
                      setDefaultRate(Number(e.target.value));
                      setCustomRateTest(Number(e.target.value));
                    }}
                    className="w-full theme-bg-input border theme-border rounded-xl px-3 py-2 text-sm theme-text-primary font-mono font-bold focus:outline-none"
                    placeholder="165"
                    min="1"
                    required
                  />
                  <span className="text-xs theme-text-muted whitespace-nowrap">/ Robux</span>
                </div>
                <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] leading-relaxed">
                  Contoh: Jika Anda set <strong>Rp{defaultRate}</strong>, pembeli 100 R$ bayar {formatRupiah(100 * defaultRate)}, dan pembeli 1.000 R$ bayar {formatRupiah(1000 * defaultRate)}.
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-xl theme-bg-card border theme-border space-y-4">
                <div>
                  <label className="text-xs font-bold theme-text-primary block mb-1">
                    Batas Jumlah Robux (Ambang Batas Paket)
                  </label>
                  <input
                    type="number"
                    value={smallPackThreshold}
                    onChange={e => setSmallPackThreshold(Number(e.target.value))}
                    className="w-full theme-bg-input border theme-border rounded-xl px-3 py-2 text-xs theme-text-primary font-mono font-bold focus:outline-none"
                    placeholder="500"
                    min="10"
                    required
                  />
                  <span className="text-[10px] theme-text-muted mt-1 block">
                    Pesanan di bawah jumlah ini masuk Paket Kecil, di atasnya masuk Paket Besar.
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div className="p-3 rounded-lg theme-bg-input border theme-border space-y-1">
                    <span className="text-[11px] font-bold text-amber-400 block">
                      Paket Kecil (&lt; {smallPackThreshold} R$)
                    </span>
                    <span className="text-[10px] theme-text-muted block">Harga Eceran:</span>
                    <div className="flex items-center gap-1 font-mono text-xs">
                      <span>Rp</span>
                      <input
                        type="number"
                        value={smallPackRate}
                        onChange={e => setSmallPackRate(Number(e.target.value))}
                        className="w-20 bg-black/40 border theme-border rounded px-2 py-1 font-bold text-white text-xs"
                      />
                      <span>/ R$</span>
                    </div>
                  </div>

                  <div className="p-3 rounded-lg theme-bg-input border theme-border space-y-1">
                    <span className="text-[11px] font-bold text-emerald-400 block">
                      Paket Besar (&gt;= {smallPackThreshold} R$)
                    </span>
                    <span className="text-[10px] theme-text-muted block">Harga Hemat / Grosir:</span>
                    <div className="flex items-center gap-1 font-mono text-xs">
                      <span>Rp</span>
                      <input
                        type="number"
                        value={largePackRate}
                        onChange={e => setLargePackRate(Number(e.target.value))}
                        className="w-20 bg-black/40 border theme-border rounded px-2 py-1 font-bold text-white text-xs"
                      />
                      <span>/ R$</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div>
              <label className="text-xs font-medium theme-text-secondary block mb-1">
                Peringatan Batas Minimum Stok Menipis
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={minStockAlert}
                  onChange={e => setMinStockAlert(Number(e.target.value))}
                  className="w-full theme-bg-input border theme-border rounded-xl px-3 py-2 text-xs theme-text-primary font-mono font-bold focus:outline-none"
                  placeholder="500"
                  min="0"
                />
                <span className="text-xs theme-text-muted whitespace-nowrap">Robux</span>
              </div>
              <span className="text-[10.5px] theme-text-muted mt-1 block">
                Jika sisa Robux Anda kurang dari ini, sistem memberi tanda merah "Stok Menipis".
              </span>
            </div>

            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white hover:bg-neutral-200 text-black text-xs font-bold transition shadow-sm active:scale-95"
            >
              <Save size={14} /> Simpan Aturan Harga Toko
            </button>
          </form>
        </div>

        {/* Kolom Kanan: Kalkulator Tes Keuntungan Instan */}
        <div className="theme-bg-surface p-5 sm:p-6 rounded-2xl border theme-border space-y-5">
          <div className="border-b theme-border pb-3">
            <h3 className="font-heading font-bold theme-text-primary text-sm flex items-center gap-2">
              <Sparkles size={16} className="text-amber-400" /> 2. Coba Tes Keuntungan Penjualan
            </h3>
            <p className="text-xs theme-text-secondary mt-0.5">
              Masukkan rencana pesanan pembeli untuk melihat berapa uang yang didapat dan berapa untung bersihnya.
            </p>
          </div>

          {/* Input Uji Coba */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium theme-text-secondary block mb-1">
                Pembeli Mau Beli Berapa Robux?
              </label>
              <input
                type="number"
                value={testRobuxQty}
                onChange={e => setTestRobuxQty(Number(e.target.value))}
                className="w-full theme-bg-input border theme-border rounded-xl px-3 py-2 text-sm theme-text-primary font-mono font-bold focus:outline-none"
                placeholder="500"
                min="1"
              />
            </div>

            <div>
              <label className="text-xs font-medium theme-text-secondary block mb-1">
                Dijual di Harga Rate Berapa?
              </label>
              <div className="flex items-center gap-2">
                <span className="text-xs theme-text-muted">Rp</span>
                <input
                  type="number"
                  value={customRateTest}
                  onChange={e => setCustomRateTest(Number(e.target.value))}
                  className="w-full theme-bg-input border theme-border rounded-xl px-3 py-2 text-sm theme-text-primary font-mono font-bold focus:outline-none"
                  placeholder="165"
                  min="1"
                />
              </div>
            </div>
          </div>

          {/* Kartu Hasil Simulasi Transparan */}
          <div className="p-4 sm:p-5 rounded-xl theme-bg-card border theme-border space-y-3">
            <div className="flex items-center justify-between text-xs border-b theme-border-subtle pb-2">
              <span className="theme-text-secondary">Uang yang Dibayar Pembeli:</span>
              <strong className="font-mono text-sm theme-text-primary">
                {formatRupiah(simResult.totalMoneyReceived)}
              </strong>
            </div>

            <div className="flex items-center justify-between text-xs border-b theme-border-subtle pb-2">
              <span className="theme-text-secondary">Modal Asli Robux yang Keluar:</span>
              <span className="font-mono text-xs text-rose-400">
                -{formatRupiah(simResult.totalOriginalCost)} (Rp{activeCostPerUnit}/R$)
              </span>
            </div>

            <div className="flex items-center justify-between text-xs pt-1">
              <span className="font-bold theme-text-primary text-sm">Untung Bersih Masuk Kantong:</span>
              <span
                className={`font-mono text-base font-bold ${
                  simResult.isLoss ? 'text-rose-500' : 'text-emerald-400'
                }`}
              >
                {simResult.netProfit >= 0 ? '+' : ''}
                {formatRupiah(simResult.netProfit)}
              </span>
            </div>

            {simResult.isLoss ? (
              <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[11px] flex items-center gap-2">
                <AlertTriangle size={15} className="shrink-0" />
                <span>
                  <strong>Hati-hati Rugi!</strong> Anda menjual di rate Rp{simResult.rate}, padahal modal beli Anda adalah Rp{simResult.costPerRbx}.
                </span>
              </div>
            ) : (
              <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] flex items-center gap-2">
                <CheckCircle2 size={15} className="shrink-0" />
                <span>
                  <strong>Menguntungkan!</strong> Setiap 1 Robux yang terjual di harga ini menghasilkan keuntungan bersih <strong>+Rp{simResult.rate - simResult.costPerRbx}</strong>.
                </span>
              </div>
            )}
          </div>

          {/* Quick Rate Comparison Table */}
          <div>
            <span className="text-[11px] font-bold theme-text-secondary block mb-2">
              Tabel Perbandingan Untung Cepat ({formatNumber(simResult.qty)} Robux):
            </span>
            <div className="grid grid-cols-4 gap-2 text-center text-xs">
              {[160, 165, 170, 175].map(r => {
                const untung = (r - activeCostPerUnit) * simResult.qty;
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setCustomRateTest(r)}
                    className={`p-2 rounded-xl border transition ${
                      customRateTest === r
                        ? 'bg-white text-black font-bold shadow-sm'
                        : 'theme-bg-input theme-border theme-text-secondary hover:theme-text-primary'
                    }`}
                  >
                    <div className="text-[11px] font-mono">Rate {r}</div>
                    <div className={`text-[10px] font-bold ${customRateTest === r ? 'text-black' : untung >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {untung >= 0 ? `+Rp${untung.toLocaleString('id-ID')}` : `-Rp${Math.abs(untung).toLocaleString('id-ID')}`}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
