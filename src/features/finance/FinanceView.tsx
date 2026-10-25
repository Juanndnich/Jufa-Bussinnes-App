import React, { useState, useEffect, useMemo } from 'react';
import {
  Wallet,
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  Calendar,
  Lock,
  Trash2,
  ChevronDown,
  ChevronUp,
  Tag,
  CheckCircle2,
  Search,
  FileSpreadsheet,
  X,
} from 'lucide-react';
import { repository, getTodayKey } from '../../db/repository';
import { CashLedgerEntry, Category } from '../../db/schema';
import { formatRupiah, formatNumber, formatDateJakarta } from '../../utils/formatters';
import { showSuccessAlert, showErrorAlert, showWarningAlert, showConfirmDialog } from '../../utils/alert';
import { playTapSound, playSuccessSound, playDeleteSound } from '../../utils/sound';
import { exportCashLedgerToCsv } from '../../utils/exportCsv';

export const FinanceView: React.FC = () => {
  const [entries, setEntries] = useState<CashLedgerEntry[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAddCatModal, setShowAddCatModal] = useState(false);

  // Form input kas manual
  const [entryType, setEntryType] = useState<'IN' | 'OUT'>('OUT');
  const [entryAmount, setEntryAmount] = useState('');
  const [entryCategoryId, setEntryCategoryId] = useState('');
  const [entryNotes, setEntryNotes] = useState('');
  const [entryDate, setEntryDate] = useState(getTodayKey());
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form input kategori baru
  const [newCatName, setNewCatName] = useState('');
  const [newCatColor, setNewCatColor] = useState('#10b981');

  // State accordion tanggal terbuka/tertutup
  const [expandedDates, setExpandedDates] = useState<Record<string, boolean>>({});

  const loadData = async () => {
    try {
      const [ledger, cats] = await Promise.all([
        repository.getCashLedger(),
        repository.getCategories(),
      ]);
      setEntries(ledger);
      setCategories(cats);

      // Default expand tanggal hari ini
      const today = getTodayKey();
      setExpandedDates((prev) => ({ ...prev, [today]: true }));
    } catch (err) {
      console.error('Failed to load finance data:', err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Metrik Kas Keseluruhan
  const metrics = useMemo(() => {
    let totalIn = 0;
    let totalOut = 0;

    for (const item of entries) {
      if (item.type === 'IN') {
        totalIn += item.amountRupiah;
      } else {
        totalOut += item.amountRupiah;
      }
    }

    return {
      totalIn,
      totalOut,
      netBalance: totalIn - totalOut,
    };
  }, [entries]);

  const categoryMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of categories) {
      map.set(c.id, c.name.toLowerCase());
    }
    return map;
  }, [categories]);

  // Filter entri kas berdasarkan teks dan rentang tanggal
  const filteredEntries = useMemo(() => {
    return entries.filter((item) => {
      const key = item.dateKey || item.createdAt.substring(0, 10);
      if (filterStartDate && key < filterStartDate) return false;
      if (filterEndDate && key > filterEndDate) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchNotes = item.notes?.toLowerCase().includes(q) || false;
        const matchAmount = String(item.amountRupiah).includes(q);
        const matchCat = item.categoryId ? categoryMap.get(item.categoryId)?.includes(q) || false : false;
        return matchNotes || matchAmount || matchCat;
      }
      return true;
    });
  }, [entries, filterStartDate, filterEndDate, searchQuery, categoryMap]);

  // Grouping per tanggal (dateKey: YYYY-MM-DD)
  const groupedEntries = useMemo(() => {
    const groups: Record<
      string,
      {
        dateKey: string;
        items: CashLedgerEntry[];
        dayIn: number;
        dayOut: number;
        dayNet: number;
      }
    > = {};

    for (const item of filteredEntries) {
      const key = item.dateKey || item.createdAt.substring(0, 10);
      if (!groups[key]) {
        groups[key] = {
          dateKey: key,
          items: [],
          dayIn: 0,
          dayOut: 0,
          dayNet: 0,
        };
      }
      groups[key].items.push(item);
      if (item.type === 'IN') {
        groups[key].dayIn += item.amountRupiah;
      } else {
        groups[key].dayOut += item.amountRupiah;
      }
      groups[key].dayNet = groups[key].dayIn - groups[key].dayOut;
    }

    // Urutkan tanggal terbaru ke terlama
    return Object.values(groups).sort((a, b) => b.dateKey.localeCompare(a.dateKey));
  }, [filteredEntries]);

  const toggleDate = (dateKey: string) => {
    playTapSound();
    setExpandedDates((prev) => ({
      ...prev,
      [dateKey]: !prev[dateKey],
    }));
  };

  // Handler: Tambah Entri Kas Manual
  const handleAddEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountVal = Math.floor(parseFloat(entryAmount) || 0);

    if (amountVal <= 0) {
      await showWarningAlert('Nominal Kosong', 'Masukkan nominal uang kas lebih dari 0.');
      return;
    }

    setIsSubmitting(true);
    try {
      await repository.addManualCashEntry({
        type: entryType,
        amountRupiah: amountVal,
        categoryId: entryCategoryId || undefined,
        notes: entryNotes.trim() || undefined,
        dateKey: entryDate,
      });

      setEntryAmount('');
      setEntryNotes('');
      setShowAddModal(false);
      playSuccessSound();
      await loadData();
      await showSuccessAlert(
        'Buku Kas Diperbarui',
        `Pencatatan kas sebesar ${formatRupiah(amountVal)} berhasil disimpan.`
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal mencatat kas';
      await showErrorAlert('Gagal', msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handler: Tambah Kategori
  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;

    try {
      const cat = await repository.addCategory(newCatName, newCatColor, 'EXPENSE');
      setNewCatName('');
      setShowAddCatModal(false);
      setEntryCategoryId(cat.id);
      await loadData();
      await showSuccessAlert('Kategori Dibuat', `Kategori "${cat.name}" berhasil ditambahkan.`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal menambah kategori';
      await showErrorAlert('Gagal', msg);
    }
  };

  // Handler: Hapus Entri Manual
  const handleDeleteManual = async (entry: CashLedgerEntry) => {
    const ok = await showConfirmDialog({
      title: 'Hapus Entri Kas?',
      text: `Entri kas sebesar ${formatRupiah(entry.amountRupiah)} akan dihapus dari buku kas.`,
      confirmButtonText: 'Ya, Hapus',
      isDanger: true,
    });

    if (ok) {
      try {
        playDeleteSound();
        await repository.deleteManualCashEntry(entry.id);
        await loadData();
        await showSuccessAlert('Entri Dihapus', 'Pencatatan kas berhasil dihapus.');
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Gagal menghapus entri kas';
        await showErrorAlert('Gagal', msg);
      }
    }
  };

  return (
    <div className="space-y-5 max-w-4xl mx-auto pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b theme-border">
        <div className="flex items-center gap-2.5">
          <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-500 border border-blue-500/20">
            <Wallet size={20} />
          </div>
          <div>
            <h1 className="text-lg font-bold theme-text-primary tracking-tight">
              Buku Kas Harian
            </h1>
            <p className="text-xs theme-text-secondary">
              Pantau arus uang masuk, keluar, dan saldo kas bersih riil toko Anda
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => {
              playTapSound();
              exportCashLedgerToCsv(filteredEntries, categories);
            }}
            disabled={filteredEntries.length === 0}
            className="px-3 py-2 rounded-xl theme-bg-card border theme-border hover:theme-bg-card-hover disabled:opacity-40 disabled:cursor-not-allowed theme-text-primary text-xs font-semibold flex items-center gap-1.5 transition active:scale-98 shadow-sm"
            title="Unduh catatan buku kas ke format CSV / Excel"
          >
            <FileSpreadsheet size={15} className="text-emerald-500" />
            <span>Ekspor CSV ({filteredEntries.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 transition active:scale-98 shadow-sm"
          >
            <Plus size={15} />
            <span>Catat Kas Manual</span>
          </button>
        </div>
      </div>

      {/* Saldo Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-4 rounded-2xl theme-bg-card border theme-border">
          <div className="flex items-center justify-between">
            <span className="text-xs theme-text-muted">Total Kas Masuk</span>
            <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
              <ArrowDownLeft size={14} />
            </span>
          </div>
          <span className="text-xl font-mono font-extrabold text-emerald-400 block mt-2">
            {formatRupiah(metrics.totalIn)}
          </span>
          <span className="text-[11px] theme-text-muted mt-1 block">
            Dari omzet penjualan & input masuk
          </span>
        </div>

        <div className="p-4 rounded-2xl theme-bg-card border theme-border">
          <div className="flex items-center justify-between">
            <span className="text-xs theme-text-muted">Total Kas Keluar</span>
            <span className="p-1.5 rounded-lg bg-red-500/10 text-red-400">
              <ArrowUpRight size={14} />
            </span>
          </div>
          <span className="text-xl font-mono font-extrabold text-red-400 block mt-2">
            {formatRupiah(metrics.totalOut)}
          </span>
          <span className="text-[11px] theme-text-muted mt-1 block">
            Dari restock kulakan & biaya operasional
          </span>
        </div>

        <div className="p-4 rounded-2xl theme-bg-card border theme-border">
          <div className="flex items-center justify-between">
            <span className="text-xs theme-text-muted">Saldo Kas Ril</span>
            <span className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400">
              <Wallet size={14} />
            </span>
          </div>
          <span
            className={`text-xl font-mono font-extrabold block mt-2 ${
              metrics.netBalance >= 0 ? 'theme-text-primary' : 'text-red-400'
            }`}
          >
            {formatRupiah(metrics.netBalance)}
          </span>
          <span className="text-[11px] theme-text-muted mt-1 block">
            Uang kas bersih saat ini
          </span>
        </div>
      </div>

      {/* Accordion List Per Tanggal */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <h2 className="text-sm font-semibold theme-text-primary">
            Catatan Harian (Dikelompokkan per Tanggal)
          </h2>
        </div>

        {/* Search & Date Filter Bar */}
        <div className="space-y-2">
          <div className="relative">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              placeholder="Cari keterangan, nominal kas, atau nama kategori..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-3 py-2 rounded-xl theme-bg-card border theme-border text-xs theme-text-primary focus:outline-none focus:border-blue-500 font-medium"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 p-2 rounded-xl theme-bg-surface border theme-border-subtle text-xs">
            <div className="flex items-center gap-1.5 theme-text-muted">
              <Calendar size={13} />
              <span className="font-medium text-[11px]">Rentang Tanggal:</span>
            </div>

            <div className="flex items-center gap-1.5">
              <input
                type="date"
                value={filterStartDate}
                onChange={(e) => setFilterStartDate(e.target.value)}
                className="px-2.5 py-1 rounded-lg theme-bg-card border theme-border text-[11px] theme-text-primary focus:outline-none focus:border-blue-500 font-mono"
              />
              <span className="theme-text-muted text-[11px]">s/d</span>
              <input
                type="date"
                value={filterEndDate}
                onChange={(e) => setFilterEndDate(e.target.value)}
                className="px-2.5 py-1 rounded-lg theme-bg-card border theme-border text-[11px] theme-text-primary focus:outline-none focus:border-blue-500 font-mono"
              />
            </div>

            {(filterStartDate || filterEndDate || searchQuery) && (
              <button
                type="button"
                onClick={() => {
                  playTapSound();
                  setFilterStartDate('');
                  setFilterEndDate('');
                  setSearchQuery('');
                }}
                className="ml-auto px-2 py-1 rounded-lg theme-bg-card hover:bg-red-500/10 text-red-500 dark:text-red-400 border theme-border text-[11px] font-medium flex items-center gap-1 transition"
              >
                <X size={12} />
                <span>Reset Filter</span>
              </button>
            )}
          </div>
        </div>

        {groupedEntries.length === 0 ? (
          <div className="p-8 rounded-2xl theme-bg-card border theme-border text-center space-y-2">
            <Wallet size={32} className="mx-auto theme-text-muted opacity-40" />
            <p className="text-sm font-medium theme-text-primary">Buku Kas Masih Kosong</p>
            <p className="text-xs theme-text-muted max-w-sm mx-auto">
              Belum ada mutasi uang kas. Mutasi akan tercatat otomatis saat Anda melakukan Restock, Penjualan, atau menambah Catatan Kas Manual.
            </p>
          </div>
        ) : (
          groupedEntries.map((group) => {
            const isExpanded = expandedDates[group.dateKey] !== false;

            return (
              <div
                key={group.dateKey}
                className="rounded-2xl theme-bg-card border theme-border overflow-hidden transition"
              >
                {/* Header Tanggal */}
                <button
                  type="button"
                  onClick={() => toggleDate(group.dateKey)}
                  className="w-full px-4 py-3 theme-bg-surface flex items-center justify-between gap-3 text-left hover:theme-bg-card-hover transition"
                >
                  <div className="flex items-center gap-2">
                    <Calendar size={15} className="text-emerald-400" />
                    <span className="text-xs font-bold theme-text-primary">
                      {formatDateJakarta(group.dateKey, false)}
                    </span>
                    <span className="text-[11px] theme-text-muted">
                      ({group.items.length} mutasi)
                    </span>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right text-xs">
                      <span className="text-emerald-400 font-mono font-bold mr-2">
                        +{formatRupiah(group.dayIn)}
                      </span>
                      <span className="text-red-400 font-mono font-bold">
                        -{formatRupiah(group.dayOut)}
                      </span>
                    </div>

                    <div className="text-zinc-400">
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </div>
                  </div>
                </button>

                {/* Items Mutasi */}
                {isExpanded && (
                  <div className="p-3 space-y-2 border-t theme-border-subtle">
                    {group.items.map((item) => {
                      const isSystem = item.sourceType !== 'MANUAL';
                      const isIncome = item.type === 'IN';
                      const cat = categories.find((c) => c.id === item.categoryId);

                      return (
                        <div
                          key={item.id}
                          className="p-3 rounded-xl theme-bg-surface border theme-border-subtle flex items-center justify-between gap-3 text-xs"
                        >
                          <div className="flex items-center gap-3">
                            <span
                              className={`p-2 rounded-xl shrink-0 ${
                                isIncome
                                  ? 'bg-emerald-500/10 text-emerald-400'
                                  : 'bg-red-500/10 text-red-400'
                              }`}
                            >
                              {isIncome ? <ArrowDownLeft size={14} /> : <ArrowUpRight size={14} />}
                            </span>

                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold theme-text-primary">
                                  {item.notes || (isIncome ? 'Kas Masuk' : 'Kas Keluar')}
                                </span>
                                {isSystem && (
                                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold theme-bg-surface theme-text-muted flex items-center gap-1 border theme-border">
                                    <Lock size={9} />
                                    <span>Sistem</span>
                                  </span>
                                )}
                                {cat && (
                                  <span
                                    className="px-1.5 py-0.5 rounded text-[9px] font-medium"
                                    style={{
                                      backgroundColor: `${cat.color}20`,
                                      color: cat.color,
                                    }}
                                  >
                                    {cat.name}
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] theme-text-muted block">
                                {formatDateJakarta(item.createdAt)}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <span
                              className={`font-mono font-bold text-sm ${
                                isIncome ? 'text-emerald-400' : 'text-red-400'
                              }`}
                            >
                              {isIncome ? '+' : '-'}
                              {formatRupiah(item.amountRupiah)}
                            </span>

                            {!isSystem && (
                              <button
                                type="button"
                                onClick={() => handleDeleteManual(item)}
                                className="p-1 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition"
                                title="Hapus Catatan Manual"
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Modal Catat Kas Manual */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
          <form
            onSubmit={handleAddEntry}
            className="w-full max-w-md rounded-2xl theme-bg-card border theme-border p-5 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between pb-3 border-b theme-border">
              <h3 className="font-bold theme-text-primary text-sm flex items-center gap-2">
                <Wallet size={16} className="text-emerald-500" />
                <span>Catat Arus Kas Manual</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-xs theme-text-muted hover:theme-text-primary"
              >
                Tutup
              </button>
            </div>

            {/* Type selector */}
            <div className="grid grid-cols-2 p-1 rounded-xl theme-bg-surface border theme-border">
              <button
                type="button"
                onClick={() => setEntryType('OUT')}
                className={`py-2 rounded-lg text-xs font-bold transition ${
                  entryType === 'OUT'
                    ? 'bg-red-600 text-white shadow-sm'
                    : 'theme-text-secondary hover:theme-text-primary'
                }`}
              >
                Kas Keluar (Biaya)
              </button>
              <button
                type="button"
                onClick={() => setEntryType('IN')}
                className={`py-2 rounded-lg text-xs font-bold transition ${
                  entryType === 'IN'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'theme-text-secondary hover:theme-text-primary'
                }`}
              >
                Kas Masuk (Lainnya)
              </button>
            </div>

            {/* Nominal */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium theme-text-secondary">
                Nominal Uang (Rp)
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold theme-text-muted">
                  Rp
                </span>
                <input
                  type="number"
                  inputMode="numeric"
                  placeholder="0"
                  value={entryAmount}
                  onChange={(e) => setEntryAmount(e.target.value)}
                  className="w-full pl-10 pr-3 py-2.5 rounded-xl theme-bg-input border theme-border text-sm theme-text-primary focus:outline-none focus:border-emerald-500 font-mono font-bold"
                  required
                />
              </div>
            </div>

            {/* Tanggal */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium theme-text-secondary">
                Tanggal
              </label>
              <input
                type="date"
                value={entryDate}
                onChange={(e) => setEntryDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl theme-bg-input border theme-border text-xs theme-text-primary focus:outline-none focus:border-emerald-500 font-mono"
                required
              />
            </div>

            {/* Kategori */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium theme-text-secondary">
                  Kategori
                </label>
                <button
                  type="button"
                  onClick={() => setShowAddCatModal(true)}
                  className="text-[11px] text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1"
                >
                  <Plus size={12} />
                  <span>Buat Kategori</span>
                </button>
              </div>
              <select
                value={entryCategoryId}
                onChange={(e) => setEntryCategoryId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl theme-bg-input border theme-border text-xs theme-text-primary focus:outline-none focus:border-emerald-500"
              >
                <option value="">-- Tanpa Kategori --</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Keterangan */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium theme-text-secondary">
                Keterangan
              </label>
              <input
                type="text"
                placeholder="Contoh: Beli pulsa, biaya kuota..."
                value={entryNotes}
                onChange={(e) => setEntryNotes(e.target.value)}
                className="w-full px-3 py-2 rounded-xl theme-bg-input border theme-border text-xs theme-text-primary focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t theme-border">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 rounded-xl text-xs theme-text-secondary hover:theme-text-primary transition"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold transition flex items-center gap-1.5"
              >
                <CheckCircle2 size={15} />
                <span>Simpan ke Buku Kas</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal Tambah Kategori */}
      {showAddCatModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <form
            onSubmit={handleAddCategory}
            className="w-full max-w-sm rounded-2xl theme-bg-card border theme-border p-5 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between pb-2 border-b theme-border">
              <h4 className="font-bold theme-text-primary text-xs">Tambah Kategori Buku Kas</h4>
              <button
                type="button"
                onClick={() => setShowAddCatModal(false)}
                className="text-xs theme-text-muted hover:theme-text-primary"
              >
                Batal
              </button>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium theme-text-secondary">Nama Kategori</label>
              <input
                type="text"
                placeholder="Contoh: Operasional, Kuota, Listrik"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl theme-bg-input border theme-border text-xs theme-text-primary focus:outline-none focus:border-emerald-500"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium theme-text-secondary">Warna Tag</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={newCatColor}
                  onChange={(e) => setNewCatColor(e.target.value)}
                  className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0"
                />
                <span className="font-mono text-xs theme-text-muted">{newCatColor}</span>
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition"
            >
              Simpan Kategori
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
