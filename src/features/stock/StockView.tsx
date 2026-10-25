import React, { useState, useEffect } from 'react';
import {
  Package,
  Plus,
  Coins,
  History,
  AlertTriangle,
  CheckCircle2,
  Sliders,
  UserCheck,
  Calendar,
  Layers,
  Info,
} from 'lucide-react';
import { repository } from '../../db/repository';
import { StockBatch } from '../../db/schema';
import { formatRupiah, formatNumber, formatDecimal, formatDateJakarta } from '../../utils/formatters';
import { showSuccessAlert, showErrorAlert, showWarningAlert, showConfirmDialog } from '../../utils/alert';
import { playTapSound, playSuccessSound } from '../../utils/sound';

export const StockView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'batches' | 'restock' | 'reconcile' | 'personal'>('batches');

  // Batches state
  const [batches, setBatches] = useState<StockBatch[]>([]);
  const [allBatches, setAllBatches] = useState<StockBatch[]>([]);
  const [summary, setSummary] = useState({
    totalRemainingRobux: 0,
    totalRemainingCostRupiah: 0,
    activeBatchCount: 0,
    averageCostPerRobux: 0,
  });

  // Form: Restock Baru (Strict Zero-Default)
  const [restockRobux, setRestockRobux] = useState('');
  const [restockCost, setRestockCost] = useState('');
  const [restockNotes, setRestockNotes] = useState('');
  const [isSubmittingRestock, setIsSubmittingRestock] = useState(false);

  // Form: Sisa Robux Akun / Cocokkan Stok
  const [reconcileType, setReconcileType] = useState<'batch' | 'adjust'>('batch');
  const [accountRobux, setAccountRobux] = useState('');
  const [accountModalPerRobux, setAccountModalPerRobux] = useState('');
  const [accountNotes, setAccountNotes] = useState('');
  const [isSubmittingReconcile, setIsSubmittingReconcile] = useState(false);

  // Form: Pemakaian Pribadi (Prive)
  const [priveRobux, setPriveRobux] = useState('');
  const [priveNotes, setPriveNotes] = useState('');
  const [isSubmittingPrive, setIsSubmittingPrive] = useState(false);

  const loadData = async () => {
    try {
      const [available, all, sum] = await Promise.all([
        repository.getAvailableBatches(),
        repository.getAllBatches(),
        repository.getTotalStockSummary(),
      ]);
      setBatches(available);
      setAllBatches(all);
      setSummary(sum);
    } catch (err) {
      console.error('Failed to load stock data:', err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Handler: Restock Baru
  const handleRestockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const robuxVal = Math.floor(parseFloat(restockRobux) || 0);
    const costVal = Math.floor(parseFloat(restockCost) || 0);

    if (robuxVal <= 0) {
      await showWarningAlert('Jumlah Robux Kosong', 'Masukkan jumlah Robux yang dibeli lebih dari 0.');
      return;
    }
    if (costVal <= 0) {
      await showWarningAlert('Biaya Beli Kosong', 'Masukkan total uang ril yang dibayar lebih dari 0.');
      return;
    }

    setIsSubmittingRestock(true);
    try {
      await repository.createRestockBatch({
        robux: robuxVal,
        totalCostRupiah: costVal,
        notes: restockNotes.trim() || undefined,
      });

      setRestockRobux('');
      setRestockCost('');
      setRestockNotes('');
      playSuccessSound();
      await loadData();
      setActiveTab('batches');
      await showSuccessAlert(
        'Restock Berhasil Dicatat',
        `Batch baru ${formatNumber(robuxVal)} R$ berhasil ditambahkan ke antrean FIFO.`
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal mencatat restock';
      await showErrorAlert('Gagal Menyimpan', msg);
    } finally {
      setIsSubmittingRestock(false);
    }
  };

  // Handler: Sisa Robux Akun (Batch Tambahan di luar pencatatan)
  const handleAccountRemainderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const robuxVal = Math.floor(parseFloat(accountRobux) || 0);
    const modalVal = parseFloat(accountModalPerRobux) || 0;

    if (robuxVal <= 0) {
      await showWarningAlert('Jumlah Robux Kosong', 'Masukkan jumlah Robux yang ada di akun lebih dari 0.');
      return;
    }

    if (modalVal === 0) {
      const ok = await showConfirmDialog({
        title: 'Modal Rp0 per Robux?',
        text: 'Anda memasukkan modal Rp0. Seluruh penjualan dari batch ini nantinya akan dihitung memiliki margin keuntungan 100%. Lanjutkan?',
        confirmButtonText: 'Ya, Lanjutkan',
      });
      if (!ok) return;
    }

    setIsSubmittingReconcile(true);
    try {
      await repository.createAccountRemainderBatch({
        robux: robuxVal,
        modalPerRobux: modalVal,
        notes: accountNotes.trim() || 'Sisa Robux Akun',
      });

      setAccountRobux('');
      setAccountModalPerRobux('');
      setAccountNotes('');
      playSuccessSound();
      await loadData();
      setActiveTab('batches');
      await showSuccessAlert(
        'Sisa Robux Ditambahkan',
        `${formatNumber(robuxVal)} R$ berhasil ditambahkan ke inventaris tanpa mengubah kas.`
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal mencatat sisa robux';
      await showErrorAlert('Gagal Menyimpan', msg);
    } finally {
      setIsSubmittingReconcile(false);
    }
  };

  // Handler: Pemakaian Pribadi (Prive)
  const handlePersonalUsageSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const robuxVal = Math.floor(parseFloat(priveRobux) || 0);

    if (robuxVal <= 0) {
      await showWarningAlert('Jumlah Robux Kosong', 'Masukkan jumlah Robux yang diambil untuk keperluan pribadi.');
      return;
    }

    if (robuxVal > summary.totalRemainingRobux) {
      await showErrorAlert(
        'Stok Tidak Cukup',
        `Stok tersedia hanya ${formatNumber(summary.totalRemainingRobux)} R$, tidak cukup untuk ${formatNumber(robuxVal)} R$.`
      );
      return;
    }

    const ok = await showConfirmDialog({
      title: 'Catat Pemakaian Pribadi?',
      text: `${formatNumber(robuxVal)} R$ akan dipotong dari antrean FIFO sebagai Prive (tidak mengurangi laba bersih toko dan tidak mengubah kas).`,
      confirmButtonText: 'Ya, Potong Stok',
    });
    if (!ok) return;

    setIsSubmittingPrive(true);
    try {
      const usage = await repository.recordPersonalUsage({
        robuxUsed: robuxVal,
        notes: priveNotes.trim() || undefined,
      });

      setPriveRobux('');
      setPriveNotes('');
      await loadData();
      setActiveTab('batches');
      await showSuccessAlert(
        'Pemakaian Pribadi Dicatat',
        `${formatNumber(robuxVal)} R$ (nilai modal ${formatRupiah(usage.totalCostRupiah)}) berhasil dicatat sebagai Prive.`
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal mencatat pemakaian pribadi';
      await showErrorAlert('Gagal Menyimpan', msg);
    } finally {
      setIsSubmittingPrive(false);
    }
  };

  const calculatedRestockAvg = 
    parseFloat(restockRobux) > 0 && parseFloat(restockCost) > 0
      ? parseFloat(restockCost) / parseFloat(restockRobux)
      : 0;

  return (
    <div className="space-y-5 max-w-4xl mx-auto pb-10">
      {/* Header View */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b theme-border">
        <div className="flex items-center gap-2.5">
          <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
            <Package size={20} />
          </div>
          <div>
            <h1 className="text-lg font-bold theme-text-primary tracking-tight">
              Manajemen Stok & Batch FIFO
            </h1>
            <p className="text-xs theme-text-secondary">
              Kelola antrean modal persediaan, restock kulakan, sisa akun, & prive pribadi
            </p>
          </div>
        </div>
      </div>

      {/* Metric Cards Ringkasan Stok */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-4 rounded-2xl theme-bg-card border theme-border">
          <span className="text-xs theme-text-muted block">Sisa Stok Robux Toko</span>
          <span className="text-2xl font-mono font-extrabold text-amber-400 block mt-1">
            {formatNumber(summary.totalRemainingRobux)}{' '}
            <span className="text-xs font-sans font-normal theme-text-muted">R$</span>
          </span>
          <span className="text-[11px] theme-text-muted mt-1 block">
            {summary.activeBatchCount} Batch Aktif di Antrean
          </span>
        </div>

        <div className="p-4 rounded-2xl theme-bg-card border theme-border">
          <span className="text-xs theme-text-muted block">Sisa Nilai Modal Persediaan</span>
          <span className="text-2xl font-mono font-extrabold theme-text-primary block mt-1">
            {formatRupiah(summary.totalRemainingCostRupiah)}
          </span>
          <span className="text-[11px] theme-text-muted mt-1 block">
            Aset modal persediaan saat ini
          </span>
        </div>

        <div className="p-4 rounded-2xl theme-bg-card border theme-border">
          <span className="text-xs theme-text-muted block">Rata-rata Modal Saat Ini</span>
          <span className="text-2xl font-mono font-extrabold text-emerald-400 block mt-1">
            Rp{formatDecimal(summary.averageCostPerRobux, 2)}
          </span>
          <span className="text-[11px] theme-text-muted mt-1 block">
            per 1 Robux (semua batch aktif)
          </span>
        </div>
      </div>

      {/* Sub Tabs Navigation */}
      <div className="flex items-center gap-1.5 p-1 rounded-2xl theme-bg-surface border theme-border overflow-x-auto text-xs font-semibold">
        <button
          type="button"
          onClick={() => {
            playTapSound();
            setActiveTab('batches');
          }}
          className={`px-3.5 py-2 rounded-xl transition whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'batches'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'theme-text-secondary hover:theme-text-primary'
          }`}
        >
          <Layers size={14} />
          <span>Antrean Batch FIFO</span>
        </button>

        <button
          type="button"
          onClick={() => {
            playTapSound();
            setActiveTab('restock');
          }}
          className={`px-3.5 py-2 rounded-xl transition whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'restock'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'theme-text-secondary hover:theme-text-primary'
          }`}
        >
          <Plus size={14} />
          <span>Restock Baru</span>
        </button>

        <button
          type="button"
          onClick={() => {
            playTapSound();
            setActiveTab('reconcile');
          }}
          className={`px-3.5 py-2 rounded-xl transition whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'reconcile'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'theme-text-secondary hover:theme-text-primary'
          }`}
        >
          <Sliders size={14} />
          <span>Sisa Robux Akun</span>
        </button>

        <button
          type="button"
          onClick={() => {
            playTapSound();
            setActiveTab('personal');
          }}
          className={`px-3.5 py-2 rounded-xl transition whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'personal'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'theme-text-secondary hover:theme-text-primary'
          }`}
        >
          <UserCheck size={14} />
          <span>Pakai Pribadi (Prive)</span>
        </button>
      </div>

      {/* TAB 1: Antrean Batch FIFO Aktif */}
      {activeTab === 'batches' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold theme-text-primary flex items-center gap-2">
              <span>Daftar Batch Persediaan</span>
              <span className="text-[11px] theme-text-muted font-normal">
                (Dihabiskan urut dari yang paling lama)
              </span>
            </h2>
          </div>

          {batches.length === 0 ? (
            <div className="p-8 rounded-2xl theme-bg-card border theme-border text-center space-y-2">
              <Package size={32} className="mx-auto theme-text-muted opacity-40" />
              <p className="text-sm font-medium theme-text-primary">Belum Ada Stok Robux</p>
              <p className="text-xs theme-text-muted max-w-sm mx-auto">
                Persediaan masih kosong (0 R$). Klik tombol "Restock Baru" di atas untuk mencatat pembelian stok pertama Anda.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {batches.map((batch, idx) => {
                const percentLeft = batch.initialRobux > 0 
                  ? Math.round((batch.remainingRobux / batch.initialRobux) * 100) 
                  : 0;

                return (
                  <div
                    key={batch.id}
                    className="p-4 rounded-2xl theme-bg-card border theme-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:theme-bg-card-hover transition"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold theme-bg-surface theme-text-secondary border theme-border">
                          #{idx + 1}
                        </span>
                        <span className="font-mono text-xs font-bold theme-text-primary">
                          {batch.id}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            batch.sourceType === 'RESTOCK'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                          }`}
                        >
                          {batch.sourceType === 'RESTOCK' ? 'Restock Kulakan' : 'Sisa Robux Akun'}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-xs theme-text-muted">
                        <span className="flex items-center gap-1">
                          <Calendar size={12} />
                          <span>{formatDateJakarta(batch.createdAt)}</span>
                        </span>
                        {batch.notes && <span>• {batch.notes}</span>}
                      </div>
                    </div>

                    <div className="flex items-center gap-5 justify-between sm:justify-end border-t sm:border-t-0 pt-2 sm:pt-0 theme-border-subtle">
                      {/* Sisa Robux */}
                      <div className="text-left sm:text-right">
                        <span className="text-[10px] theme-text-muted block">Sisa Robux</span>
                        <span className="font-mono text-sm font-bold text-amber-400">
                          {formatNumber(batch.remainingRobux)}{' '}
                          <span className="text-[10px] font-normal theme-text-muted">
                            / {formatNumber(batch.initialRobux)} R$
                          </span>
                        </span>
                        <div className="w-24 bg-zinc-200 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden mt-1">
                          <div
                            className="bg-amber-400 h-full rounded-full transition-all"
                            style={{ width: `${percentLeft}%` }}
                          />
                        </div>
                      </div>

                      {/* Modal */}
                      <div className="text-right">
                        <span className="text-[10px] theme-text-muted block">Sisa Modal</span>
                        <span className="font-mono text-sm font-bold theme-text-primary block">
                          {formatRupiah(batch.remainingCostRupiah)}
                        </span>
                        <span className="text-[10px] font-mono theme-text-secondary block">
                          Rp{formatDecimal(batch.unitCostDisplay, 2)} / R$
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Restock Robux Baru */}
      {activeTab === 'restock' && (
        <form
          onSubmit={handleRestockSubmit}
          className="p-5 rounded-2xl theme-bg-card border theme-border space-y-4 max-w-xl mx-auto"
        >
          <div className="flex items-center gap-2 pb-2 border-b theme-border">
            <Plus size={18} className="text-emerald-500" />
            <h2 className="text-sm font-bold theme-text-primary">
              Catat Pembelian Stok Baru (Restock)
            </h2>
          </div>

          <p className="text-xs theme-text-secondary leading-relaxed">
            Catat uang ril yang Anda keluarkan untuk membeli Robux. Uang ini otomatis tercatat sebagai 
            <strong> Pengeluaran Kas (Buku Kas)</strong> dan menambah persediaan batch FIFO Anda.
          </p>

          <div className="space-y-1.5">
            <label className="text-xs font-medium theme-text-secondary">
              Jumlah Robux yang Dibeli (R$)
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-amber-400">
                R$
              </span>
              <input
                type="number"
                inputMode="numeric"
                placeholder="0"
                value={restockRobux}
                onChange={(e) => setRestockRobux(e.target.value)}
                className="w-full pl-11 pr-3 py-2.5 rounded-xl theme-bg-input border theme-border text-sm theme-text-primary focus:outline-none focus:border-emerald-500 font-mono font-bold"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium theme-text-secondary">
              Total Uang Ril Dikeluarkan (Rp)
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold theme-text-muted">
                Rp
              </span>
              <input
                type="number"
                inputMode="numeric"
                placeholder="0"
                value={restockCost}
                onChange={(e) => setRestockCost(e.target.value)}
                className="w-full pl-10 pr-3 py-2.5 rounded-xl theme-bg-input border theme-border text-sm theme-text-primary focus:outline-none focus:border-emerald-500 font-mono font-bold"
                required
              />
            </div>
          </div>

          {/* Kalkulasi Otomatis Modal Per Robux */}
          <div className="p-3 rounded-xl theme-bg-surface border theme-border-subtle flex items-center justify-between text-xs">
            <span className="theme-text-muted">Rata-rata Modal per Robux:</span>
            <span className="font-mono font-bold text-emerald-400">
              Rp{formatDecimal(calculatedRestockAvg, 2)} / R$
            </span>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium theme-text-secondary">
              Catatan (Opsional)
            </label>
            <input
              type="text"
              placeholder="Keterangan singkat restock..."
              value={restockNotes}
              onChange={(e) => setRestockNotes(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl theme-bg-input border theme-border text-xs theme-text-primary focus:outline-none focus:border-emerald-500"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmittingRestock}
            className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition active:scale-98 shadow-md"
          >
            <CheckCircle2 size={17} />
            <span>{isSubmittingRestock ? 'Menyimpan...' : 'Simpan Restock ke FIFO'}</span>
          </button>
        </form>
      )}

      {/* TAB 3: Sisa Robux Akun */}
      {activeTab === 'reconcile' && (
        <form
          onSubmit={handleAccountRemainderSubmit}
          className="p-5 rounded-2xl theme-bg-card border theme-border space-y-4 max-w-xl mx-auto"
        >
          <div className="flex items-center gap-2 pb-2 border-b theme-border">
            <Sliders size={18} className="text-indigo-400" />
            <h2 className="text-sm font-bold theme-text-primary">
              Catat Sisa Robux Akun Roblox
            </h2>
          </div>

          <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs flex items-start gap-2">
            <Info size={16} className="shrink-0 mt-0.5" />
            <p>
              Gunakan fitur ini jika ada sisa Robux di akun Roblox di luar pencatatan.
              Fitur ini <strong>TIDAK mengubah saldo kas</strong> dan <strong>BUKAN pendapatan</strong>.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium theme-text-secondary">
              Jumlah Sisa Robux (R$)
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-amber-400">
                R$
              </span>
              <input
                type="number"
                inputMode="numeric"
                placeholder="0"
                value={accountRobux}
                onChange={(e) => setAccountRobux(e.target.value)}
                className="w-full pl-11 pr-3 py-2.5 rounded-xl theme-bg-input border theme-border text-sm theme-text-primary focus:outline-none focus:border-emerald-500 font-mono font-bold"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium theme-text-secondary">
              Modal Dasar per Robux (Rp)
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold theme-text-muted">
                Rp
              </span>
              <input
                type="number"
                step="any"
                inputMode="decimal"
                placeholder="0 (boleh Rp0)"
                value={accountModalPerRobux}
                onChange={(e) => setAccountModalPerRobux(e.target.value)}
                className="w-full pl-10 pr-3 py-2.5 rounded-xl theme-bg-input border theme-border text-sm theme-text-primary focus:outline-none focus:border-emerald-500 font-mono font-bold"
              />
            </div>
            <p className="text-[11px] theme-text-muted">
              Boleh diisi Rp0 jika dianggap tanpa modal.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium theme-text-secondary">
              Catatan
            </label>
            <input
              type="text"
              placeholder="Contoh: Sisa akun utama"
              value={accountNotes}
              onChange={(e) => setAccountNotes(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl theme-bg-input border theme-border text-xs theme-text-primary focus:outline-none focus:border-emerald-500"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmittingReconcile}
            className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition active:scale-98 shadow-md"
          >
            <CheckCircle2 size={17} />
            <span>{isSubmittingReconcile ? 'Menyimpan...' : 'Tambahkan Sisa Akun'}</span>
          </button>
        </form>
      )}

      {/* TAB 4: Pemakaian Robux Pribadi */}
      {activeTab === 'personal' && (
        <form
          onSubmit={handlePersonalUsageSubmit}
          className="p-5 rounded-2xl theme-bg-card border theme-border space-y-4 max-w-xl mx-auto"
        >
          <div className="flex items-center gap-2 pb-2 border-b theme-border">
            <UserCheck size={18} className="text-amber-500" />
            <h2 className="text-sm font-bold theme-text-primary">
              Catat Pengambilan Pribadi (Prive Non-Kas)
            </h2>
          </div>

          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs flex items-start gap-2">
            <Info size={16} className="shrink-0 mt-0.5" />
            <p>
              Robux yang diambil pemilik dipotong dari antrean FIFO sebesar nilai modal batch.
              Pencatatan ini <strong>TIDAK mengurangi laba bersih toko</strong> dan <strong>TIDAK mengubah saldo kas</strong> (Rule 6.5).
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium theme-text-secondary">
              Jumlah Robux yang Diambil (R$)
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-amber-400">
                R$
              </span>
              <input
                type="number"
                inputMode="numeric"
                placeholder="0"
                value={priveRobux}
                onChange={(e) => setPriveRobux(e.target.value)}
                className="w-full pl-11 pr-3 py-2.5 rounded-xl theme-bg-input border theme-border text-sm theme-text-primary focus:outline-none focus:border-emerald-500 font-mono font-bold"
                required
              />
            </div>
            <p className="text-[11px] theme-text-muted">
              Maksimal tersedia: {formatNumber(summary.totalRemainingRobux)} R$
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium theme-text-secondary">
              Keperluan / Catatan
            </label>
            <input
              type="text"
              placeholder="Contoh: Beli gamepass pribadi, hadiah teman..."
              value={priveNotes}
              onChange={(e) => setPriveNotes(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl theme-bg-input border theme-border text-xs theme-text-primary focus:outline-none focus:border-emerald-500"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmittingPrive}
            className="w-full py-3 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition active:scale-98 shadow-md"
          >
            <CheckCircle2 size={17} />
            <span>{isSubmittingPrive ? 'Memproses...' : 'Potong Stok Pribadi (Prive)'}</span>
          </button>
        </form>
      )}
    </div>
  );
};
