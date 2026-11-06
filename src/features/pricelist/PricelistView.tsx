import React, { useState, useEffect, useMemo } from 'react';
import {
  Tag,
  Copy,
  Plus,
  Trash2,
  RotateCcw,
  Check,
  Sparkles,
  Calculator,
  ArrowRight,
  ListOrdered,
  Layers,
  Coins,
} from 'lucide-react';
import { repository } from '../../db/repository';
import { RatePreset } from '../../db/schema';
import { NumberInput } from '../../components/NumberInput';
import { formatRupiah, formatNumber, formatDecimal } from '../../utils/formatters';
import { showSuccessAlert, showWarningAlert } from '../../utils/alert';
import { playTapSound, playSuccessSound } from '../../utils/sound';

const POPULAR_PACKS = [50, 100, 200, 500, 1000, 2000, 5000, 10000];
const SMALL_PACKS = [25, 50, 75, 100, 150, 200, 300, 500];
const LARGE_PACKS = [1000, 2500, 5000, 10000, 20000, 50000];

export const PricelistView: React.FC = () => {
  const [rate, setRate] = useState<string>('');
  const [robuxItems, setRobuxItems] = useState<number[]>([]);
  const [newRobuxInput, setNewRobuxInput] = useState<string>('');
  const [ratePresets, setRatePresets] = useState<RatePreset[]>([]);
  const [storeAvgCost, setStoreAvgCost] = useState<number>(0);
  const [copied, setCopied] = useState(false);

  // Load saved rate presets & store stock summary
  useEffect(() => {
    repository.getRatePresets().then(setRatePresets).catch(() => {});
    repository.getTotalStockSummary().then((s) => setStoreAvgCost(s.averageCostPerRobux)).catch(() => {});
    
    // Load last saved pricelist preferences if any
    try {
      const savedRate = localStorage.getItem('jufastore_pricelist_rate');
      const savedItems = localStorage.getItem('jufastore_pricelist_items');
      if (savedRate) setRate(savedRate);
      if (savedItems) {
        const parsed = JSON.parse(savedItems);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setRobuxItems(parsed);
        }
      }
    } catch {}
  }, []);

  // Persist preferences
  useEffect(() => {
    try {
      if (rate) localStorage.setItem('jufastore_pricelist_rate', rate);
      if (robuxItems.length > 0) {
        localStorage.setItem('jufastore_pricelist_items', JSON.stringify(robuxItems));
      }
    } catch {}
  }, [rate, robuxItems]);

  const numRate = parseFloat(rate) || 0;

  // Calculated items with matching price & estimated profit
  const pricelistData = useMemo(() => {
    return robuxItems.map((robux) => {
      const totalPrice = Math.round(robux * numRate);
      const estimatedCost = storeAvgCost > 0 ? Math.round(robux * storeAvgCost) : 0;
      const estimatedProfit = storeAvgCost > 0 ? totalPrice - estimatedCost : 0;
      const margin = totalPrice > 0 && storeAvgCost > 0 ? (estimatedProfit / totalPrice) * 100 : null;
      return {
        robux,
        rate: numRate,
        price: totalPrice,
        estimatedCost,
        estimatedProfit,
        margin,
        isLoss: storeAvgCost > 0 && estimatedProfit < 0,
      };
    });
  }, [robuxItems, numRate, storeAvgCost]);

  // Handlers
  const handleAddCustomRobux = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseInt(newRobuxInput, 10);
    if (!val || val <= 0) {
      showWarningAlert('Nominal Tidak Valid', 'Masukkan jumlah Robux lebih dari 0.');
      return;
    }
    if (robuxItems.includes(val)) {
      showWarningAlert('Nominal Sudah Ada', `Nominal ${formatNumber(val)} R$ sudah terdaftar dalam pricelist.`);
      return;
    }
    playTapSound();
    const updated = [...robuxItems, val].sort((a, b) => a - b);
    setRobuxItems(updated);
    setNewRobuxInput('');
  };

  const handleRemoveItem = (val: number) => {
    playTapSound();
    setRobuxItems(robuxItems.filter((item) => item !== val));
  };

  const handleApplyPresetTemplate = (template: number[]) => {
    playTapSound();
    setRobuxItems([...template]);
  };

  const handleClearAll = () => {
    playTapSound();
    setRobuxItems([]);
  };

  // Copy clean text representation for messaging
  const handleCopyText = async () => {
    if (pricelistData.length === 0 || numRate <= 0) {
      await showWarningAlert('Pricelist Belum Lengkap', 'Tentukan rate jual dan minimal 1 nominal Robux.');
      return;
    }

    const lines: string[] = [];
    lines.push('DAFTAR HARGA ROBUX JUFASTORE');
    lines.push(`Rate: Rp${formatNumber(numRate)} / R$`);
    lines.push('──────────────────────────────');

    for (const item of pricelistData) {
      const robuxLabel = `${formatNumber(item.robux)} R$`.padEnd(10, ' ');
      lines.push(`• ${robuxLabel} : ${formatRupiah(item.price)}`);
    }

    lines.push('──────────────────────────────');
    lines.push('Pembukuan Resmi: JufaStore');

    const fullText = lines.join('\n');

    try {
      await navigator.clipboard.writeText(fullText);
      playSuccessSound();
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
      await showSuccessAlert('Teks Disalin!', 'Daftar harga berhasil disalin ke clipboard dan siap dikirim atau dibagikan.');
    } catch {
      // Fallback prompt
      window.prompt('Salin teks daftar harga:', fullText);
    }
  };

  return (
    <div className="space-y-5 max-w-4xl mx-auto pb-10">
      {/* Header View */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b theme-border">
        <div className="flex items-center gap-2.5">
          <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
            <Tag size={20} />
          </div>
          <div>
            <h1 className="text-lg font-bold theme-text-primary tracking-tight">
              Generator Pricelist Robux
            </h1>
            <p className="text-xs theme-text-secondary">
              Buat daftar harga jual Robux otomatis dengan rate pilihan & kalkulasi instan
            </p>
          </div>
        </div>

        {pricelistData.length > 0 && numRate > 0 && (
          <button
            type="button"
            onClick={handleCopyText}
            className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-2 transition active:scale-98 shadow-sm self-start sm:self-auto"
          >
            {copied ? <Check size={15} /> : <Copy size={15} />}
            <span>{copied ? 'Tersalin ke Clipboard' : 'Salin Teks Pricelist'}</span>
          </button>
        )}
      </div>

      {/* Konfigurasi Rate Jual */}
      <div className="p-4 rounded-2xl theme-bg-card border theme-border space-y-3">
        <div className="flex items-center gap-2 pb-2 border-b theme-border">
          <Coins size={16} className="text-emerald-400" />
          <h2 className="text-xs font-bold uppercase tracking-wider theme-text-primary">
            1. Tentukan Rate Jual (Rp / R$)
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
          <NumberInput
            label="Rate Jual per 1 Robux (Rp)"
            prefix="Rp"
            suffix="/R$"
            allowDecimals={true}
            maxDecimals={2}
            placeholder="Contoh: 150 atau 160"
            value={rate === '' ? '' : parseFloat(rate)}
            onChange={(val) => setRate(val === '' ? '' : String(val))}
          />

          {/* Preset Rate Tersimpan */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium theme-text-secondary">
              Pilihan Preset Rate Tersimpan:
            </label>
            {ratePresets.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {ratePresets.map((rp) => (
                  <button
                    key={rp.id}
                    type="button"
                    onClick={() => {
                      playTapSound();
                      setRate(String(rp.rate));
                    }}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-mono font-semibold border transition ${
                      numRate === rp.rate
                        ? 'bg-emerald-500 text-zinc-950 font-bold border-emerald-400 shadow-sm'
                        : 'theme-bg-surface border-theme theme-text-secondary hover:theme-text-primary hover:border-emerald-500/40'
                    }`}
                  >
                    {rp.label ? `${rp.label} (${rp.rate})` : `Rate ${rp.rate}`}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs theme-text-muted leading-relaxed">
                Belum ada preset tersimpan. Anda dapat menyimpan rate favorit Anda langsung di menu Kalkulator.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Konfigurasi Nominal Robux */}
      <div className="p-4 rounded-2xl theme-bg-card border theme-border space-y-3">
        <div className="flex items-center justify-between pb-2 border-b theme-border">
          <div className="flex items-center gap-2">
            <ListOrdered size={16} className="text-emerald-400" />
            <h2 className="text-xs font-bold uppercase tracking-wider theme-text-primary">
              2. Daftar Nominal Robux yang Dijual
            </h2>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => handleApplyPresetTemplate(POPULAR_PACKS)}
              className="px-2.5 py-1 rounded-lg text-[11px] font-semibold theme-bg-surface border theme-border theme-text-secondary hover:theme-text-primary transition"
            >
              Paket Populer
            </button>
            <button
              type="button"
              onClick={() => handleApplyPresetTemplate(SMALL_PACKS)}
              className="px-2.5 py-1 rounded-lg text-[11px] font-semibold theme-bg-surface border theme-border theme-text-secondary hover:theme-text-primary transition"
            >
              Retail Kecil
            </button>
            <button
              type="button"
              onClick={() => handleApplyPresetTemplate(LARGE_PACKS)}
              className="px-2.5 py-1 rounded-lg text-[11px] font-semibold theme-bg-surface border theme-border theme-text-secondary hover:theme-text-primary transition"
            >
              Grosir
            </button>
            {robuxItems.length > 0 && (
              <button
                type="button"
                onClick={handleClearAll}
                className="px-2 py-1 rounded-lg text-[11px] font-semibold bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition"
                title="Hapus Semua"
              >
                Kosongkan
              </button>
            )}
          </div>
        </div>

        {/* Input Tambah Baris Custom */}
        <form onSubmit={handleAddCustomRobux} className="flex items-end gap-2">
          <div className="flex-1">
            <NumberInput
              suffix="R$"
              placeholder="Ketik nominal Robux custom (contoh: 250, 750, 1500...)"
              value={newRobuxInput === '' ? '' : parseInt(newRobuxInput, 10)}
              onChange={(val) => setNewRobuxInput(val === '' ? '' : String(val))}
            />
          </div>
          <button
            type="submit"
            className="h-[42px] px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 transition shrink-0 active:scale-98"
          >
            <Plus size={14} />
            <span>Tambah</span>
          </button>
        </form>

        {/* Tag chips of selected items */}
        {robuxItems.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {robuxItems.map((val) => (
              <span
                key={val}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-mono font-semibold theme-bg-surface border theme-border theme-text-primary"
              >
                <span>{formatNumber(val)} R$</span>
                <button
                  type="button"
                  onClick={() => handleRemoveItem(val)}
                  className="text-red-400 hover:text-red-300 p-0.5 rounded transition"
                  title="Hapus nominal ini"
                >
                  <Trash2 size={12} />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Tabel Hasil Pricelist Otomatis */}
      <div className="p-4 rounded-2xl theme-bg-card border theme-border space-y-3">
        <div className="flex items-center justify-between pb-2 border-b theme-border">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-emerald-400" />
            <h2 className="text-xs font-bold uppercase tracking-wider theme-text-primary">
              3. Hasil Tabel Pricelist & Harga yang Cocok
            </h2>
          </div>
          {numRate > 0 && (
            <span className="text-xs font-mono font-semibold text-emerald-400">
              Rate: Rp{formatNumber(numRate)} / R$
            </span>
          )}
        </div>

        {pricelistData.length === 0 || numRate <= 0 ? (
          <div className="p-8 rounded-xl theme-bg-surface border theme-border text-center space-y-2">
            <div className="w-10 h-10 mx-auto rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <Calculator size={20} />
            </div>
            <h3 className="text-sm font-bold theme-text-primary">
              Pricelist Siap Dikalkulasikan
            </h3>
            <p className="text-xs theme-text-muted max-w-sm mx-auto">
              {numRate <= 0
                ? 'Masukkan nominal Rate Jual terlebih dahulu di atas (misal 150 atau 160).'
                : 'Pilih salah satu template paket (Populer, Retail, Grosir) atau ketik nominal Robux untuk memunculkan harga yang cocok.'}
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {/* Desktop Table / Grid Card */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
              {pricelistData.map((item) => (
                <div
                  key={item.robux}
                  className={`p-3.5 rounded-xl theme-bg-surface border transition flex flex-col justify-between space-y-2 ${
                    item.isLoss
                      ? 'border-red-500/50 bg-red-500/5 shadow-sm'
                      : 'theme-border hover:border-emerald-500/40'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-base font-mono font-extrabold text-amber-400">
                      {formatNumber(item.robux)}{' '}
                      <span className="text-xs font-sans font-normal theme-text-muted">R$</span>
                    </span>
                    <span className="text-[10px] font-mono theme-text-muted">
                      @{numRate}
                    </span>
                  </div>

                  <div className="pt-1 border-t theme-border">
                    <span className="text-[10px] uppercase font-bold theme-text-muted block">
                      Harga Jual Cocok:
                    </span>
                    <span className="text-base font-mono font-extrabold text-emerald-400 block">
                      {formatRupiah(item.price)}
                    </span>
                  </div>

                  {storeAvgCost > 0 && (
                    <div className="pt-1.5 border-t theme-border-subtle flex items-center justify-between text-[11px]">
                      <span className="theme-text-muted">Est. Untung:</span>
                      <span
                        className={`font-mono font-bold ${
                          item.estimatedProfit > 0
                            ? 'text-emerald-400'
                            : item.isLoss
                            ? 'text-red-400 font-extrabold'
                            : 'theme-text-muted'
                        }`}
                      >
                        {item.estimatedProfit > 0 ? '+' : ''}
                        {formatRupiah(item.estimatedProfit)}
                        {item.margin !== null && ` (${formatDecimal(item.margin, 1)}%)`}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Quick Action Footer */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs theme-text-secondary border-t theme-border">
              <span>
                Total {pricelistData.length} baris paket terhitung otomatis.
              </span>
              <button
                type="button"
                onClick={handleCopyText}
                className="px-3 py-1.5 rounded-xl theme-bg-surface border theme-border text-xs font-semibold theme-text-primary hover:border-emerald-500 flex items-center gap-1.5 transition"
              >
                <Copy size={13} className="text-emerald-400" />
                <span>Salin Seluruh Pricelist</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
