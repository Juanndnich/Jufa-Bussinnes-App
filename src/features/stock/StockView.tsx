import React, { useState, useEffect, useMemo } from 'react';
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
  Search,
  Download,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Receipt,
  FileSpreadsheet,
  Pencil,
  Trash2,
} from 'lucide-react';
import { repository } from '../../db/repository';
import { StockBatch, PersonalUsage } from '../../db/schema';
import { formatRupiah, formatNumber, formatDecimal, formatDateJakarta } from '../../utils/formatters';
import { showSuccessAlert, showErrorAlert, showWarningAlert, showConfirmDialog } from '../../utils/alert';
import { playTapSound, playSuccessSound, playDeleteSound } from '../../utils/sound';
import { exportPersonalUsagesToCsv } from '../../utils/exportCsv';

export const StockView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'batches' | 'restock' | 'reconcile' | 'personal' | 'personal-history'>('batches');

  // Batches state
  const [batches, setBatches] = useState<StockBatch[]>([]);
  const [allBatches, setAllBatches] = useState<StockBatch[]>([]);
  const [summary, setSummary] = useState({
    totalRemainingRobux: 0,
    totalRemainingCostRupiah: 0,
    activeBatchCount: 0,
    averageCostPerRobux: 0,
  });

  // Edit Batch State
  const [editingBatch, setEditingBatch] = useState<StockBatch | null>(null);
  const [editBatchNotes, setEditBatchNotes] = useState('');

  // Personal Usages (Prive) state
  const [personalUsages, setPersonalUsages] = useState<PersonalUsage[]>([]);
  const [priveSearch, setPriveSearch] = useState('');
  const [priveStartDate, setPriveStartDate] = useState('');
  const [priveEndDate, setPriveEndDate] = useState('');
  const [expandedUsageId, setExpandedUsageId] = useState<string | null>(null);

  // Edit Prive State
  const [editingPrive, setEditingPrive] = useState<PersonalUsage | null>(null);
  const [editPriveNotes, setEditPriveNotes] = useState('');

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
      const [available, all, sum, usages] = await Promise.all([
        repository.getAvailableBatches(),
        repository.getAllBatches(),
        repository.getTotalStockSummary(),
        repository.getPersonalUsages(),
      ]);
      setBatches(available);
      setAllBatches(all);
      setSummary(sum);
      setPersonalUsages(usages);
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

  // Handler: Hapus Batch (Hanya jika belum terpakai)
  const handleDeleteBatch = async (batch: StockBatch) => {
    if (batch.remainingRobux !== batch.initialRobux) {
      await showWarningAlert(
        'Batch Sudah Terpakai',
        `Batch ${batch.id} sudah terjual sebagian (${formatNumber(batch.initialRobux - batch.remainingRobux)} R$ terpakai). Batch yang sudah terpakai tidak dapat dihapus demi integritas akuntansi FIFO.`
      );
      return;
    }

    const ok = await showConfirmDialog({
      title: 'Hapus Batch Ini?',
      text: `Batch ${batch.id} (${formatNumber(batch.initialRobux)} R$) akan dihapus. Jika ini hasil restock, pengeluaran uang terkait di Buku Kas akan otomatis dibatalkan/dihapus.`,
      confirmButtonText: 'Ya, Hapus Batch',
      isDanger: true,
    });

    if (ok) {
      try {
        playDeleteSound();
        await repository.deleteStockBatch(batch.id);
        await loadData();
        await showSuccessAlert('Batch Dihapus', `Batch ${batch.id} berhasil dihapus dari persediaan.`);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Gagal menghapus batch';
        await showErrorAlert('Gagal', msg);
      }
    }
  };

  // Handler: Simpan Edit Catatan Batch
  const handleSaveEditBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBatch) return;

    try {
      await repository.updateStockBatchNotes(editingBatch.id, editBatchNotes);
      playTapSound();
      await loadData();
      setEditingBatch(null);
      await showSuccessAlert('Catatan Diperbarui', `Catatan batch ${editingBatch.id} berhasil disimpan.`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal memperbarui catatan';
      await showErrorAlert('Gagal', msg);
    }
  };

  // Handler: Batalkan / Hapus Prive
  const handleCancelPrive = async (usage: PersonalUsage) => {
    const ok = await showConfirmDialog({
      title: 'Batalkan Pemakaian Pribadi Ini?',
      text: `${formatNumber(usage.robuxUsed)} R$ senilai modal ${formatRupiah(usage.totalCostRupiah)} akan dikembalikan secara presisi ke batch FIFO asalnya.`,
      confirmButtonText: 'Ya, Kembalikan ke Stok',
      isDanger: true,
    });

    if (ok) {
      try {
        playDeleteSound();
        await repository.cancelPersonalUsage(usage.id);
        await loadData();
        await showSuccessAlert(
          'Prive Dibatalkan',
          `Stok ${formatNumber(usage.robuxUsed)} R$ telah dikembalikan ke antrean FIFO.`
        );
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Gagal membatalkan prive';
        await showErrorAlert('Gagal', msg);
      }
    }
  };

  // Handler: Simpan Edit Catatan Prive
  const handleSaveEditPrive = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPrive) return;

    try {
      await repository.updatePersonalUsageNotes(editingPrive.id, editPriveNotes);
      playTapSound();
      await loadData();
      setEditingPrive(null);
      await showSuccessAlert('Catatan Diperbarui', 'Catatan keperluan pemakaian pribadi berhasil disimpan.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal memperbarui catatan';
      await showErrorAlert('Gagal', msg);
    }
  };

  const calculatedRestockAvg = 
    parseFloat(restockRobux) > 0 && parseFloat(restockCost) > 0
      ? parseFloat(restockCost) / parseFloat(restockRobux)
      : 0;

  // Filtered Personal Usages
  const filteredUsages = useMemo(() => {
    return personalUsages.filter((u) => {
      if (priveSearch.trim()) {
        const query = priveSearch.toLowerCase();
        const notesMatch = u.notes?.toLowerCase().includes(query) ?? false;
        const idMatch = u.id.toLowerCase().includes(query);
        const robuxMatch = String(u.robuxUsed).includes(query);
        if (!notesMatch && !idMatch && !robuxMatch) return false;
      }
      if (priveStartDate) {
        const uDate = u.createdAt.substring(0, 10);
        if (uDate < priveStartDate) return false;
      }
      if (priveEndDate) {
        const uDate = u.createdAt.substring(0, 10);
        if (uDate > priveEndDate) return false;
      }
      return true;
    });
  }, [personalUsages, priveSearch, priveStartDate, priveEndDate]);

  const totalFilteredPriveRobux = useMemo(() => {
    return filteredUsages.reduce((acc, u) => acc + u.robuxUsed, 0);
  }, [filteredUsages]);

  const totalFilteredPriveCost = useMemo(() => {
    return filteredUsages.reduce((acc, u) => acc + u.totalCostRupiah, 0);
  }, [filteredUsages]);

  const handleResetPriveFilter = () => {
    playTapSound();
    setPriveSearch('');
    setPriveStartDate('');
    setPriveEndDate('');
  };

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

        <button
          type="button"
          onClick={() => {
            playTapSound();
            setActiveTab('personal-history');
          }}
          className={`px-3.5 py-2 rounded-xl transition whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'personal-history'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'theme-text-secondary hover:theme-text-primary'
          }`}
        >
          <History size={14} />
          <span>Histori Pemakaian Pribadi</span>
          {personalUsages.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20 font-mono font-bold">
              {personalUsages.length}
            </span>
          )}
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

                      {/* Tombol Aksi Batch: Edit Catatan & Hapus */}
                      <div className="flex items-center gap-1.5 pl-3 border-l theme-border-subtle shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            playTapSound();
                            setEditingBatch(batch);
                            setEditBatchNotes(batch.notes || '');
                          }}
                          className="p-1.5 rounded-lg theme-bg-surface border theme-border hover:border-emerald-500/40 text-zinc-400 hover:text-emerald-400 transition"
                          title="Edit Catatan Batch"
                        >
                          <Pencil size={13} />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteBatch(batch)}
                          className={`p-1.5 rounded-lg theme-bg-surface border transition ${
                            batch.remainingRobux === batch.initialRobux
                              ? 'border-red-500/30 text-red-400 hover:bg-red-500/10'
                              : 'opacity-30 cursor-not-allowed theme-border theme-text-muted'
                          }`}
                          title={
                            batch.remainingRobux === batch.initialRobux
                              ? 'Hapus Batch Ini (Belum Terpakai)'
                              : 'Batch sudah terpakai sebagian (tidak dapat dihapus)'
                          }
                        >
                          <Trash2 size={13} />
                        </button>
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

      {/* TAB 5: Histori Pemakaian Robux Pribadi (Prive) */}
      {activeTab === 'personal-history' && (
        <div className="space-y-4">
          {/* Header & Filter Controls */}
          <div className="p-4 rounded-2xl theme-bg-card border theme-border space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b theme-border">
              <div className="flex items-center gap-2">
                <History size={18} className="text-amber-500" />
                <h2 className="text-sm font-bold theme-text-primary">
                  Histori Lengkap Pemakaian Pribadi (Prive)
                </h2>
              </div>

              {personalUsages.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    playTapSound();
                    exportPersonalUsagesToCsv(filteredUsages);
                  }}
                  className="px-3 py-1.5 rounded-xl theme-bg-surface border theme-border text-xs font-semibold theme-text-primary hover:border-emerald-500/50 flex items-center gap-1.5 transition self-start sm:self-auto"
                >
                  <FileSpreadsheet size={14} className="text-emerald-400" />
                  <span>Ekspor CSV</span>
                </button>
              )}
            </div>

            {/* Filter Search & Dates */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
              <div className="sm:col-span-5 relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 theme-text-muted" />
                <input
                  type="text"
                  placeholder="Cari catatan keperluan, ID, atau nominal..."
                  value={priveSearch}
                  onChange={(e) => setPriveSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-xl theme-bg-input border theme-border text-xs theme-text-primary focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="sm:col-span-3">
                <input
                  type="date"
                  value={priveStartDate}
                  onChange={(e) => setPriveStartDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl theme-bg-input border theme-border text-xs theme-text-primary focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>

              <div className="sm:col-span-3">
                <input
                  type="date"
                  value={priveEndDate}
                  onChange={(e) => setPriveEndDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl theme-bg-input border theme-border text-xs theme-text-primary focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>

              <div className="sm:col-span-1 flex items-center">
                {(priveSearch || priveStartDate || priveEndDate) && (
                  <button
                    type="button"
                    onClick={handleResetPriveFilter}
                    title="Reset Filter"
                    className="w-full h-full py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 flex items-center justify-center transition"
                  >
                    <RotateCcw size={14} />
                  </button>
                )}
              </div>
            </div>

            {/* Summary Banner for filtered items */}
            {personalUsages.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2">
                <div className="p-2.5 rounded-xl theme-bg-surface border theme-border">
                  <span className="text-[11px] theme-text-muted block">Robux Terpakai</span>
                  <span className="text-base font-mono font-bold text-amber-400 block">
                    {formatNumber(totalFilteredPriveRobux)} R$
                  </span>
                </div>
                <div className="p-2.5 rounded-xl theme-bg-surface border theme-border">
                  <span className="text-[11px] theme-text-muted block">Total Modal FIFO (Prive)</span>
                  <span className="text-base font-mono font-bold theme-text-primary block">
                    {formatRupiah(totalFilteredPriveCost)}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl theme-bg-surface border theme-border">
                  <span className="text-[11px] theme-text-muted block">Rata-rata Modal</span>
                  <span className="text-base font-mono font-bold text-emerald-400 block">
                    Rp{totalFilteredPriveRobux > 0 ? (totalFilteredPriveCost / totalFilteredPriveRobux).toFixed(1) : '0'} / R$
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* List or Empty State */}
          {filteredUsages.length === 0 ? (
            <div className="p-8 rounded-2xl theme-bg-card border theme-border text-center space-y-2">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
                <History size={24} />
              </div>
              <h3 className="text-sm font-bold theme-text-primary">
                {personalUsages.length === 0 ? 'Belum Ada Pemakaian Pribadi' : 'Tidak Ada Data Sesuai Filter'}
              </h3>
              <p className="text-xs theme-text-muted max-w-sm mx-auto">
                {personalUsages.length === 0
                  ? 'Setiap pengambilan Robux untuk keperluan sendiri (Prive) akan dicatat lengkap di sini beserta rincian modal batch yang terpangkas.'
                  : 'Coba ubah kata kunci pencarian atau sesuaikan rentang tanggal filter Anda.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredUsages.map((usage) => {
                const isExpanded = expandedUsageId === usage.id;
                const costPerRobux = usage.robuxUsed > 0 ? Math.round(usage.totalCostRupiah / usage.robuxUsed) : 0;

                return (
                  <div
                    key={usage.id}
                    className="p-4 rounded-2xl theme-bg-card border theme-border space-y-3 transition hover:border-amber-500/30"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b theme-border">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          Prive Non-Kas
                        </span>
                        <span className="text-xs font-mono font-semibold theme-text-secondary">
                          {usage.id}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 self-end sm:self-auto">
                        <span className="text-xs font-mono theme-text-muted">
                          {formatDateJakarta(usage.createdAt)}
                        </span>
                        <div className="flex items-center gap-1 pl-2 border-l theme-border-subtle">
                          <button
                            type="button"
                            onClick={() => {
                              playTapSound();
                              setEditingPrive(usage);
                              setEditPriveNotes(usage.notes || '');
                            }}
                            className="p-1 rounded-md theme-bg-surface border theme-border hover:border-amber-500/40 text-zinc-400 hover:text-amber-400 transition"
                            title="Edit Catatan Keperluan Prive"
                          >
                            <Pencil size={12} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCancelPrive(usage)}
                            className="p-1 rounded-md theme-bg-surface border border-red-500/20 text-red-400 hover:bg-red-500/10 transition"
                            title="Batalkan Prive (Kembalikan Robux ke FIFO)"
                          >
                            <RotateCcw size={12} />
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <span className="text-[11px] theme-text-muted block">Robux Diambil</span>
                        <span className="text-lg font-mono font-bold text-amber-400 block">
                          {formatNumber(usage.robuxUsed)}{' '}
                          <span className="text-xs font-sans font-normal theme-text-muted">R$</span>
                        </span>
                      </div>
                      <div>
                        <span className="text-[11px] theme-text-muted block">Nilai Modal (FIFO)</span>
                        <span className="text-lg font-mono font-bold theme-text-primary block">
                          {formatRupiah(usage.totalCostRupiah)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[11px] theme-text-muted block">Modal Efektif</span>
                        <span className="text-sm font-mono font-semibold theme-text-secondary block mt-1">
                          Rp{formatNumber(costPerRobux)} / R$
                        </span>
                      </div>
                    </div>

                    {usage.notes && (
                      <div className="p-2.5 rounded-xl theme-bg-surface border theme-border text-xs theme-text-secondary flex items-start gap-2">
                        <Receipt size={14} className="text-amber-500 shrink-0 mt-0.5" />
                        <div>
                          <span className="text-[10px] uppercase font-bold theme-text-muted block">Catatan Keperluan:</span>
                          <span className="theme-text-primary">{usage.notes}</span>
                        </div>
                      </div>
                    )}

                    {/* Breakdown Toggle Button */}
                    {usage.allocations && usage.allocations.length > 0 && (
                      <div className="pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            playTapSound();
                            setExpandedUsageId(isExpanded ? null : usage.id);
                          }}
                          className="text-xs font-semibold theme-text-secondary hover:theme-text-primary flex items-center gap-1.5 transition"
                        >
                          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          <span>
                            {isExpanded ? 'Tutup Rincian Batch' : `Lihat Alokasi (${usage.allocations.length} Batch FIFO)`}
                          </span>
                        </button>

                        {/* Detailed batch allocation breakdown */}
                        {isExpanded && (
                          <div className="mt-2.5 p-3 rounded-xl theme-bg-surface border theme-border space-y-2">
                            <span className="text-[11px] font-bold uppercase tracking-wider theme-text-muted block">
                              Rincian Potongan Modal per Batch:
                            </span>
                            <div className="divide-y theme-border text-xs">
                              {usage.allocations.map((alloc, idx) => (
                                <div key={idx} className="py-1.5 flex items-center justify-between font-mono">
                                  <div className="flex items-center gap-2">
                                    <Layers size={13} className="text-emerald-400" />
                                    <span className="theme-text-primary text-[11px]">{alloc.batchId}</span>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <span className="text-amber-400 font-bold">
                                      {formatNumber(alloc.robuxTaken)} R$
                                    </span>
                                    <span className="theme-text-primary">
                                      {formatRupiah(alloc.costAllocatedRupiah)}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Modal Edit Catatan Batch FIFO */}
      {editingBatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
          <form
            onSubmit={handleSaveEditBatch}
            className="w-full max-w-md rounded-2xl theme-bg-card border theme-border p-5 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between pb-3 border-b theme-border">
              <div className="flex items-center gap-2">
                <Pencil size={16} className="text-emerald-500" />
                <h3 className="font-bold theme-text-primary text-sm">
                  Edit Catatan Batch ({editingBatch.id})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingBatch(null)}
                className="text-xs theme-text-muted hover:theme-text-primary"
              >
                Batal
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium theme-text-secondary">
                Keterangan / Catatan Batch
              </label>
              <textarea
                rows={3}
                placeholder="Contoh: Kulakan supplier A, akun cadangan..."
                value={editBatchNotes}
                onChange={(e) => setEditBatchNotes(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl theme-bg-input border theme-border text-xs theme-text-primary focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t theme-border">
              <button
                type="button"
                onClick={() => setEditingBatch(null)}
                className="px-4 py-2 rounded-xl text-xs theme-text-muted hover:theme-text-primary"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-sm"
              >
                Simpan Catatan
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal Edit Catatan Prive */}
      {editingPrive && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
          <form
            onSubmit={handleSaveEditPrive}
            className="w-full max-w-md rounded-2xl theme-bg-card border theme-border p-5 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between pb-3 border-b theme-border">
              <div className="flex items-center gap-2">
                <Pencil size={16} className="text-amber-500" />
                <h3 className="font-bold theme-text-primary text-sm">
                  Edit Catatan Prive ({editingPrive.id})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingPrive(null)}
                className="text-xs theme-text-muted hover:theme-text-primary"
              >
                Batal
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium theme-text-secondary">
                Keperluan / Catatan Pemakaian
              </label>
              <textarea
                rows={3}
                placeholder="Contoh: Beli gamepass pribadi, gift teman..."
                value={editPriveNotes}
                onChange={(e) => setEditPriveNotes(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl theme-bg-input border theme-border text-xs theme-text-primary focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t theme-border">
              <button
                type="button"
                onClick={() => setEditingPrive(null)}
                className="px-4 py-2 rounded-xl text-xs theme-text-muted hover:theme-text-primary"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition shadow-sm"
              >
                Simpan Catatan
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
