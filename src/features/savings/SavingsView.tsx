import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  PiggyBank,
  Plus,
  Minus,
  ArrowUpRight,
  ArrowDownLeft,
  Wallet,
  FolderPlus,
  Folder,
  Trash2,
  Search,
  Filter,
  Calendar,
  FileText,
  X,
  Check,
  ChevronDown,
  AlertCircle,
  Tag,
  Sparkles,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { repository, getTodayKey } from '../../db/repository';
import { SavingsEntry, SavingsCategory } from '../../db/schema';
import { formatRupiah, formatDateJakarta } from '../../utils/formatters';
import { playTapSound } from '../../utils/sound';
import { showConfirmDialog, showErrorAlert, showToast } from '../../utils/alert';
import { NumberInput } from '../../components/NumberInput';

interface SavingsSummaryData {
  totalBalance: number;
  totalIn: number;
  totalOut: number;
  unallocatedBalance: number;
  categories: Array<{
    name: string;
    balance: number;
    totalIn: number;
    totalOut: number;
  }>;
}

export const SavingsView: React.FC = () => {
  const [summary, setSummary] = useState<SavingsSummaryData>({
    totalBalance: 0,
    totalIn: 0,
    totalOut: 0,
    unallocatedBalance: 0,
    categories: [],
  });
  const [entries, setEntries] = useState<SavingsEntry[]>([]);
  const [categories, setCategories] = useState<SavingsCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [filterType, setFilterType] = useState<'ALL' | 'IN' | 'OUT'>('ALL');
  const [selectedFilterCategory, setSelectedFilterCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);

  // Deposit Form State
  const [depositAmount, setDepositAmount] = useState<number | ''>('');
  const [depositCategoryMode, setDepositCategoryMode] = useState<'UNALLOCATED' | 'EXISTING' | 'NEW'>('UNALLOCATED');
  const [depositSelectedCat, setDepositSelectedCat] = useState('');
  const [depositNewCatName, setDepositNewCatName] = useState('');
  const [depositNotes, setDepositNotes] = useState('');
  const [depositDateKey, setDepositDateKey] = useState(getTodayKey());

  // Withdraw Form State
  const [withdrawAmount, setWithdrawAmount] = useState<number | ''>('');
  const [withdrawSource, setWithdrawSource] = useState<string>('UNALLOCATED'); // 'UNALLOCATED' or category name
  const [withdrawNotes, setWithdrawNotes] = useState('');
  const [withdrawDateKey, setWithdrawDateKey] = useState(getTodayKey());

  // New Category Modal State
  const [newCategoryName, setNewCategoryName] = useState('');

  // Load Data
  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [sum, list, cats] = await Promise.all([
        repository.getSavingsSummary(),
        repository.getSavingsEntries(),
        repository.getSavingsCategories(),
      ]);
      setSummary(sum);
      setEntries(list);
      setCategories(cats);
    } catch (err: any) {
      showErrorAlert('Gagal Memuat Data', err?.message || 'Terjadi kesalahan saat memuat data tabungan.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filtered entries
  const filteredEntries = useMemo(() => {
    return entries.filter((item) => {
      if (filterType !== 'ALL' && item.type !== filterType) {
        return false;
      }
      if (selectedFilterCategory !== 'ALL') {
        const itemCat = (item.category || '').trim();
        if (selectedFilterCategory === 'UNALLOCATED') {
          if (itemCat !== '' && itemCat.toUpperCase() !== 'UMUM' && itemCat.toLowerCase() !== 'tanpa kategori') {
            return false;
          }
        } else {
          if (itemCat.toLowerCase() !== selectedFilterCategory.toLowerCase()) {
            return false;
          }
        }
      }
      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase();
        const inNotes = (item.notes || '').toLowerCase().includes(query);
        const inCat = (item.category || '').toLowerCase().includes(query);
        const inAmt = item.amountRupiah.toString().includes(query);
        if (!inNotes && !inCat && !inAmt) return false;
      }
      return true;
    });
  }, [entries, filterType, selectedFilterCategory, searchQuery]);

  // Current balance of selected withdraw source
  const availableWithdrawBalance = useMemo(() => {
    if (withdrawSource === 'UNALLOCATED') {
      return summary.unallocatedBalance;
    }
    const found = summary.categories.find(
      (c) => c.name.toLowerCase() === withdrawSource.toLowerCase()
    );
    return found ? found.balance : 0;
  }, [withdrawSource, summary]);

  // Quick Amount helper
  const addDepositQuickAmount = (val: number) => {
    playTapSound();
    const current = typeof depositAmount === 'number' ? depositAmount : 0;
    setDepositAmount(current + val);
  };

  // Submit Deposit
  const handleDepositSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = typeof depositAmount === 'number' ? depositAmount : 0;
    if (num <= 0) {
      showErrorAlert('Nominal Tidak Valid', 'Masukkan nominal setor tabungan yang lebih dari Rp0.');
      return;
    }

    let finalCategory = '';
    if (depositCategoryMode === 'EXISTING') {
      finalCategory = depositSelectedCat.trim();
    } else if (depositCategoryMode === 'NEW') {
      finalCategory = depositNewCatName.trim();
      if (!finalCategory) {
        showErrorAlert('Kategori Wajib Diisi', 'Ketikkan nama kategori baru atau pilih Tanpa Kategori.');
        return;
      }
    }

    try {
      playTapSound();
      await repository.addSavingsEntry({
        type: 'IN',
        amountRupiah: num,
        category: finalCategory,
        notes: depositNotes.trim() || undefined,
        dateKey: depositDateKey,
      });

      setIsDepositModalOpen(false);
      setDepositAmount('');
      setDepositNotes('');
      setDepositCategoryMode('UNALLOCATED');
      setDepositSelectedCat('');
      setDepositNewCatName('');
      await loadData();
      showToast('Tabungan berhasil disimpan', 'success');
    } catch (err: any) {
      showErrorAlert('Gagal Menyimpan', err?.message || 'Terjadi kesalahan sistem.');
    }
  };

  // Submit Withdraw
  const handleWithdrawSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = typeof withdrawAmount === 'number' ? withdrawAmount : 0;
    if (num <= 0) {
      showErrorAlert('Nominal Tidak Valid', 'Masukkan nominal uang tabungan yang terpakai.');
      return;
    }

    if (num > availableWithdrawBalance) {
      const sourceName = withdrawSource === 'UNALLOCATED' ? 'Uang Biasa / Tanpa Kategori' : `Kategori "${withdrawSource}"`;
      showErrorAlert(
        'Saldo Tidak Mencukupi',
        `Saldo ${sourceName} saat ini hanya Rp${Math.max(0, availableWithdrawBalance).toLocaleString('id-ID')}. Anda memasukkan Rp${num.toLocaleString('id-ID')}.`
      );
      return;
    }

    try {
      playTapSound();
      await repository.addSavingsEntry({
        type: 'OUT',
        amountRupiah: num,
        category: withdrawSource === 'UNALLOCATED' ? '' : withdrawSource,
        notes: withdrawNotes.trim() || undefined,
        dateKey: withdrawDateKey,
      });

      setIsWithdrawModalOpen(false);
      setWithdrawAmount('');
      setWithdrawNotes('');
      setWithdrawSource('UNALLOCATED');
      await loadData();
      showToast('Pengeluaran tabungan tercatat', 'success');
    } catch (err: any) {
      showErrorAlert('Gagal Mencatat', err?.message || 'Terjadi kesalahan sistem.');
    }
  };

  // Delete Entry
  const handleDeleteEntry = async (entry: SavingsEntry) => {
    playTapSound();
    const isConfirmed = await showConfirmDialog({
      title: 'Hapus Catatan Tabungan?',
      text: `Yakin ingin menghapus mutasi ${entry.type === 'IN' ? 'Setor' : 'Tarik'} sebesar ${formatRupiah(entry.amountRupiah)}? Tindakan ini tidak dapat dibatalkan.`,
      confirmButtonText: 'Ya, Hapus',
      cancelButtonText: 'Batal',
      isDanger: true,
    });

    if (!isConfirmed) return;

    try {
      await repository.deleteSavingsEntry(entry.id);
      await loadData();
      showToast('Catatan mutasi berhasil dihapus', 'success');
    } catch (err: any) {
      showErrorAlert('Gagal Menghapus', err?.message || 'Terjadi kesalahan sistem.');
    }
  };

  // Create Category
  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newCategoryName.trim();
    if (!clean) {
      showErrorAlert('Nama Kategori Kosong', 'Silakan ketikkan nama kategori.');
      return;
    }

    try {
      playTapSound();
      await repository.addSavingsCategory(clean);
      setNewCategoryName('');
      setIsCategoryModalOpen(false);
      await loadData();
      showToast('Kategori tabungan ditambahkan', 'success');
    } catch (err: any) {
      showErrorAlert('Gagal Menambah Kategori', err?.message || 'Terjadi kesalahan.');
    }
  };

  // Quick Open Withdraw for a specific category
  const openWithdrawForCategory = (catName: string) => {
    playTapSound();
    setWithdrawSource(catName);
    setWithdrawAmount('');
    setWithdrawNotes('');
    setWithdrawDateKey(getTodayKey());
    setIsWithdrawModalOpen(true);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header & Quick Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500 dark:bg-emerald-500/20 border border-emerald-500/30">
              <PiggyBank size={22} />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight theme-text-primary">
              Buku Tabungan Pribadi
            </h1>
          </div>
          <p className="text-xs sm:text-sm theme-text-muted mt-1">
            Pencatatan tabungan, alokasi pos dana mandiri, dan pengeluaran terpakai tanpa mempengaruhi stok &amp; kas toko
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => {
              playTapSound();
              setIsCategoryModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold theme-bg-card theme-border border theme-text-secondary hover:theme-text-primary transition shadow-sm active:scale-95"
          >
            <FolderPlus size={15} className="text-emerald-500" />
            <span>Kategori Baru</span>
          </button>
          <button
            type="button"
            onClick={() => {
              playTapSound();
              setWithdrawSource('UNALLOCATED');
              setWithdrawAmount('');
              setWithdrawNotes('');
              setWithdrawDateKey(getTodayKey());
              setIsWithdrawModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30 transition shadow-sm active:scale-95"
          >
            <Minus size={15} />
            <span>Pakai Tabungan</span>
          </button>
          <button
            type="button"
            onClick={() => {
              playTapSound();
              setDepositAmount('');
              setDepositNotes('');
              setDepositCategoryMode('UNALLOCATED');
              setDepositSelectedCat('');
              setDepositNewCatName('');
              setDepositDateKey(getTodayKey());
              setIsDepositModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20 transition active:scale-95"
          >
            <Plus size={15} />
            <span>Setor Tabungan</span>
          </button>
        </div>
      </div>

      {/* Ringkasan Saldo (Summary Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Saldo Tabungan */}
        <div className="p-4 rounded-2xl theme-bg-card border border-emerald-500/30 bg-gradient-to-br from-emerald-500/5 via-transparent to-transparent shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium theme-text-muted">Total Tabungan</span>
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-500">
              <PiggyBank size={16} />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-xl sm:text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
              {formatRupiah(summary.totalBalance)}
            </div>
            <p className="text-[11px] theme-text-muted mt-0.5">Saldo keseluruhan tabungan</p>
          </div>
        </div>

        {/* Uang Biasa / Tanpa Kategori */}
        <div className="p-4 rounded-2xl theme-bg-card border theme-border shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium theme-text-muted">Uang Biasa (Umum)</span>
            <div className="p-1.5 rounded-lg bg-zinc-500/10 text-zinc-400">
              <Wallet size={16} />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-xl sm:text-2xl font-bold tracking-tight theme-text-primary">
              {formatRupiah(summary.unallocatedBalance)}
            </div>
            <p className="text-[11px] theme-text-muted mt-0.5">Dana bebas tanpa alokasi khusus</p>
          </div>
        </div>

        {/* Total Uang Masuk */}
        <div className="p-4 rounded-2xl theme-bg-card border theme-border shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium theme-text-muted">Total Uang Disimpan</span>
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-500">
              <ArrowDownLeft size={16} />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-xl sm:text-2xl font-bold tracking-tight text-emerald-500">
              +{formatRupiah(summary.totalIn)}
            </div>
            <p className="text-[11px] theme-text-muted mt-0.5">Akumulasi uang yang ditabung</p>
          </div>
        </div>

        {/* Total Uang Terpakai */}
        <div className="p-4 rounded-2xl theme-bg-card border theme-border shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium theme-text-muted">Total Uang Terpakai</span>
            <div className="p-1.5 rounded-lg bg-rose-500/10 text-rose-500">
              <ArrowUpRight size={16} />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-xl sm:text-2xl font-bold tracking-tight text-rose-500">
              -{formatRupiah(summary.totalOut)}
            </div>
            <p className="text-[11px] theme-text-muted mt-0.5">Akumulasi uang yang dikeluarkan</p>
          </div>
        </div>
      </div>

      {/* Pos Kategori Tabungan (Kategori Bebas) */}
      <div className="p-4 sm:p-5 rounded-2xl theme-bg-card border theme-border shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Folder size={18} className="text-emerald-500" />
            <h2 className="text-sm font-bold theme-text-primary">Pos Kategori Tabungan</h2>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 font-medium">
              {summary.categories.length + 1} Pos
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              playTapSound();
              setIsCategoryModalOpen(true);
            }}
            className="text-xs font-semibold text-emerald-500 hover:text-emerald-400 flex items-center gap-1"
          >
            <Plus size={14} />
            <span>Tambah Pos</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 pt-1">
          {/* Pos Uang Biasa */}
          <div className="p-3.5 rounded-xl border border-zinc-500/20 bg-zinc-500/5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold theme-text-primary flex items-center gap-1.5">
                  <Wallet size={14} className="text-zinc-400" />
                  Uang Biasa / Umum
                </span>
                <span className="text-[10px] theme-text-muted">Bebas</span>
              </div>
              <div className="mt-2 text-base font-bold text-emerald-600 dark:text-emerald-400">
                {formatRupiah(summary.unallocatedBalance)}
              </div>
            </div>
            <button
              type="button"
              disabled={summary.unallocatedBalance <= 0}
              onClick={() => openWithdrawForCategory('UNALLOCATED')}
              className="mt-3 w-full py-1.5 rounded-lg text-[11px] font-semibold bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              Pakai Dana Biasa
            </button>
          </div>

          {/* Pos-pos Kategori Khusus */}
          {summary.categories.map((cat) => (
            <div
              key={cat.name}
              className="p-3.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold theme-text-primary flex items-center gap-1.5 truncate">
                    <Tag size={13} className="text-emerald-500 shrink-0" />
                    <span className="truncate">{cat.name}</span>
                  </span>
                  <span className="text-[10px] text-emerald-500 font-medium">Khusus</span>
                </div>
                <div className="mt-2 text-base font-bold text-emerald-600 dark:text-emerald-400">
                  {formatRupiah(cat.balance)}
                </div>
                <div className="flex items-center gap-2 text-[10px] theme-text-muted mt-1">
                  <span>Masuk: {formatRupiah(cat.totalIn)}</span>
                  <span>•</span>
                  <span>Keluar: {formatRupiah(cat.totalOut)}</span>
                </div>
              </div>
              <button
                type="button"
                disabled={cat.balance <= 0}
                onClick={() => openWithdrawForCategory(cat.name)}
                className="mt-3 w-full py-1.5 rounded-lg text-[11px] font-semibold bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                Pakai dari Pos Ini
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Riwayat Mutasi Tabungan */}
      <div className="p-4 sm:p-5 rounded-2xl theme-bg-card border theme-border shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Calendar size={18} className="text-emerald-500" />
            <h2 className="text-sm font-bold theme-text-primary">Riwayat Mutasi Tabungan</h2>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-zinc-500/10 theme-text-muted">
              {filteredEntries.length} Data
            </span>
          </div>

          {/* Filter Bar */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Filter Jenis */}
            <div className="flex rounded-xl p-0.5 bg-zinc-100 dark:bg-zinc-800/80 border theme-border">
              {(['ALL', 'IN', 'OUT'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    playTapSound();
                    setFilterType(t);
                  }}
                  className={`px-2.5 py-1 text-[11px] rounded-lg font-medium transition ${
                    filterType === t
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'theme-text-muted hover:theme-text-primary'
                  }`}
                >
                  {t === 'ALL' ? 'Semua' : t === 'IN' ? 'Setor (+)' : 'Tarik (-)'}
                </button>
              ))}
            </div>

            {/* Filter Pos Kategori */}
            <select
              value={selectedFilterCategory}
              onChange={(e) => {
                playTapSound();
                setSelectedFilterCategory(e.target.value);
              }}
              className="px-2.5 py-1 text-[11px] rounded-xl theme-bg-card theme-border border theme-text-primary focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="ALL">Semua Pos</option>
              <option value="UNALLOCATED">Uang Biasa (Umum)</option>
              {summary.categories.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>

            {/* Search Input */}
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 theme-text-muted" />
              <input
                type="text"
                placeholder="Cari catatan..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-7 pr-3 py-1 text-[11px] rounded-xl theme-bg-card theme-border border theme-text-primary placeholder:theme-text-muted focus:outline-none focus:ring-1 focus:ring-emerald-500 w-36 sm:w-44"
              />
            </div>
          </div>
        </div>

        {/* Daftar Mutasi */}
        {isLoading ? (
          <div className="py-12 text-center text-xs theme-text-muted">Memuat data tabungan...</div>
        ) : filteredEntries.length === 0 ? (
          <div className="py-12 px-4 text-center rounded-xl border border-dashed theme-border">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto mb-3">
              <PiggyBank size={24} />
            </div>
            <h3 className="text-sm font-semibold theme-text-primary">Belum Ada Catatan Tabungan</h3>
            <p className="text-xs theme-text-muted mt-1 max-w-sm mx-auto">
              Mulai tabungan pertama Anda dengan menekan tombol Setor Tabungan di atas.
            </p>
          </div>
        ) : (
          <div className="divide-y theme-border">
            {filteredEntries.map((entry) => {
              const isDeposit = entry.type === 'IN';
              const catName = entry.category?.trim();
              return (
                <div
                  key={entry.id}
                  className="py-3 flex items-center justify-between gap-3 hover:bg-zinc-500/5 transition px-2 rounded-xl"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`p-2 rounded-xl shrink-0 ${
                        isDeposit
                          ? 'bg-emerald-500/10 text-emerald-500 dark:bg-emerald-500/20'
                          : 'bg-rose-500/10 text-rose-500 dark:bg-rose-500/20'
                      }`}
                    >
                      {isDeposit ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-semibold theme-text-primary">
                          {isDeposit ? 'Setor Tabungan' : 'Pakai Tabungan'}
                        </span>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-md font-medium ${
                            catName
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                              : 'bg-zinc-500/10 theme-text-muted border theme-border'
                          }`}
                        >
                          {catName || 'Uang Biasa / Umum'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] theme-text-muted mt-0.5">
                        <span>{formatDateJakarta(entry.createdAt, true)}</span>
                        {entry.notes && (
                          <>
                            <span>•</span>
                            <span className="truncate italic">"{entry.notes}"</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span
                      className={`text-sm sm:text-base font-bold ${
                        isDeposit ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {isDeposit ? '+' : '-'}
                      {formatRupiah(entry.amountRupiah)}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDeleteEntry(entry)}
                      title="Hapus mutasi"
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-500 hover:bg-rose-500/10 transition"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ===================== MODAL SETOR TABUNGAN ===================== */}
      <AnimatePresence>
        {isDepositModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md rounded-2xl theme-bg-card border theme-border p-5 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between pb-2 border-b theme-border">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-xl bg-emerald-500/10 text-emerald-500">
                    <Plus size={18} />
                  </div>
                  <h3 className="text-base font-bold theme-text-primary">Setor Uang Tabungan</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsDepositModalOpen(false)}
                  className="p-1 rounded-lg text-zinc-400 hover:text-zinc-200"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleDepositSubmit} className="space-y-4">
                {/* Nominal Input */}
                <div>
                  <label className="text-xs font-semibold theme-text-secondary block mb-1">
                    Nominal Disimpan
                  </label>
                  <NumberInput
                    value={depositAmount}
                    onChange={(v) => setDepositAmount(v)}
                    placeholder="0"
                    isCurrency={true}
                    allowDecimals={false}
                    autoFocus={true}
                    className="w-full"
                    inputClassName="text-lg font-bold text-emerald-500"
                  />
                  {/* Quick Amount Chips */}
                  <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                    {[50000, 100000, 200000, 500000, 1000000].map((chip) => (
                      <button
                        key={chip}
                        type="button"
                        onClick={() => addDepositQuickAmount(chip)}
                        className="px-2 py-1 rounded-lg text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition active:scale-95"
                      >
                        +{formatRupiah(chip)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Pos / Kategori Pilihan */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold theme-text-secondary block">
                    Alokasi Pos Tabungan
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        playTapSound();
                        setDepositCategoryMode('UNALLOCATED');
                      }}
                      className={`p-2 rounded-xl text-xs font-medium border transition text-center ${
                        depositCategoryMode === 'UNALLOCATED'
                          ? 'border-emerald-500 bg-emerald-500/10 text-emerald-500 font-bold'
                          : 'theme-border theme-text-muted hover:theme-text-primary'
                      }`}
                    >
                      Uang Biasa
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        playTapSound();
                        setDepositCategoryMode('EXISTING');
                        if (!depositSelectedCat && categories.length > 0) {
                          setDepositSelectedCat(categories[0].name);
                        }
                      }}
                      className={`p-2 rounded-xl text-xs font-medium border transition text-center ${
                        depositCategoryMode === 'EXISTING'
                          ? 'border-emerald-500 bg-emerald-500/10 text-emerald-500 font-bold'
                          : 'theme-border theme-text-muted hover:theme-text-primary'
                      }`}
                    >
                      Pilih Pos
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        playTapSound();
                        setDepositCategoryMode('NEW');
                      }}
                      className={`p-2 rounded-xl text-xs font-medium border transition text-center ${
                        depositCategoryMode === 'NEW'
                          ? 'border-emerald-500 bg-emerald-500/10 text-emerald-500 font-bold'
                          : 'theme-border theme-text-muted hover:theme-text-primary'
                      }`}
                    >
                      Pos Baru
                    </button>
                  </div>

                  {depositCategoryMode === 'EXISTING' && (
                    <div className="pt-1">
                      {categories.length === 0 ? (
                        <p className="text-xs text-amber-500 italic">
                          Belum ada pos kategori tersimpan. Silakan pilih "Pos Baru" untuk membuat kategori pertama.
                        </p>
                      ) : (
                        <select
                          value={depositSelectedCat}
                          onChange={(e) => setDepositSelectedCat(e.target.value)}
                          className="w-full px-3 py-2 text-xs rounded-xl theme-bg-card theme-border border theme-text-primary focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        >
                          {categories.map((c) => (
                            <option key={c.id} value={c.name}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  )}

                  {depositCategoryMode === 'NEW' && (
                    <div className="pt-1">
                      <input
                        type="text"
                        placeholder="Contoh: Makan, Mainan, Liburan, Kendaraan..."
                        value={depositNewCatName}
                        onChange={(e) => setDepositNewCatName(e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-xl theme-bg-card theme-border border theme-text-primary focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>
                  )}
                </div>

                {/* Catatan / Keterangan */}
                <div>
                  <label className="text-xs font-semibold theme-text-secondary block mb-1">
                    Catatan (Opsional)
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: Sisihan keuntungan minggu ini..."
                    value={depositNotes}
                    onChange={(e) => setDepositNotes(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl theme-bg-card theme-border border theme-text-primary focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                {/* Tombol Simpan */}
                <div className="flex items-center justify-end gap-2 pt-2 border-t theme-border">
                  <button
                    type="button"
                    onClick={() => setIsDepositModalOpen(false)}
                    className="px-4 py-2 text-xs font-semibold rounded-xl theme-border border theme-text-secondary hover:theme-text-primary"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20 active:scale-95 transition"
                  >
                    Simpan Tabungan
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ===================== MODAL PAKAI TABUNGAN (UANG KELUAR) ===================== */}
      <AnimatePresence>
        {isWithdrawModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md rounded-2xl theme-bg-card border theme-border p-5 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between pb-2 border-b theme-border">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-xl bg-rose-500/10 text-rose-500">
                    <Minus size={18} />
                  </div>
                  <h3 className="text-base font-bold theme-text-primary">Pakai Uang Tabungan</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsWithdrawModalOpen(false)}
                  className="p-1 rounded-lg text-zinc-400 hover:text-zinc-200"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleWithdrawSubmit} className="space-y-4">
                {/* Pilihan Sumber Pos Tabungan */}
                <div>
                  <label className="text-xs font-semibold theme-text-secondary block mb-1">
                    Pilih Pos Sumber Dana
                  </label>
                  <select
                    value={withdrawSource}
                    onChange={(e) => {
                      playTapSound();
                      setWithdrawSource(e.target.value);
                    }}
                    className="w-full px-3 py-2 text-xs rounded-xl theme-bg-card theme-border border theme-text-primary focus:outline-none focus:ring-1 focus:ring-rose-500"
                  >
                    <option value="UNALLOCATED">
                      Uang Biasa / Umum (Saldo: {formatRupiah(summary.unallocatedBalance)})
                    </option>
                    {summary.categories.map((c) => (
                      <option key={c.name} value={c.name}>
                        Pos "{c.name}" (Saldo: {formatRupiah(c.balance)})
                      </option>
                    ))}
                  </select>
                  <div className="mt-1 flex items-center justify-between text-[11px]">
                    <span className="theme-text-muted">Saldo Tersedia di Pos Ini:</span>
                    <span className="font-bold text-emerald-500">
                      {formatRupiah(availableWithdrawBalance)}
                    </span>
                  </div>
                </div>

                {/* Nominal Input */}
                <div>
                  <label className="text-xs font-semibold theme-text-secondary block mb-1">
                    Nominal Digunakan
                  </label>
                  <NumberInput
                    value={withdrawAmount}
                    onChange={(v) => setWithdrawAmount(v)}
                    placeholder="0"
                    isCurrency={true}
                    allowDecimals={false}
                    autoFocus={true}
                    className="w-full"
                    inputClassName="text-lg font-bold text-rose-500"
                  />
                  {/* Quick percentage buttons */}
                  {availableWithdrawBalance > 0 && (
                    <div className="flex items-center gap-1.5 mt-2">
                      <button
                        type="button"
                        onClick={() => {
                          playTapSound();
                          setWithdrawAmount(Math.round(availableWithdrawBalance * 0.25));
                        }}
                        className="px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-zinc-500/10 theme-text-secondary hover:theme-text-primary"
                      >
                        25%
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          playTapSound();
                          setWithdrawAmount(Math.round(availableWithdrawBalance * 0.5));
                        }}
                        className="px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-zinc-500/10 theme-text-secondary hover:theme-text-primary"
                      >
                        50%
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          playTapSound();
                          setWithdrawAmount(availableWithdrawBalance);
                        }}
                        className="px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-rose-500/10 text-rose-500 hover:bg-rose-500/20"
                      >
                        Semua ({formatRupiah(availableWithdrawBalance)})
                      </button>
                    </div>
                  )}
                </div>

                {/* Catatan Keperluan */}
                <div>
                  <label className="text-xs font-semibold theme-text-secondary block mb-1">
                    Keperluan Pengeluaran (Opsional)
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: Beli makan siang, bayar tagihan..."
                    value={withdrawNotes}
                    onChange={(e) => setWithdrawNotes(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl theme-bg-card theme-border border theme-text-primary focus:outline-none focus:ring-1 focus:ring-rose-500"
                  />
                </div>

                {/* Tombol Simpan */}
                <div className="flex items-center justify-end gap-2 pt-2 border-t theme-border">
                  <button
                    type="button"
                    onClick={() => setIsWithdrawModalOpen(false)}
                    className="px-4 py-2 text-xs font-semibold rounded-xl theme-border border theme-text-secondary hover:theme-text-primary"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 text-xs font-semibold rounded-xl bg-rose-600 hover:bg-rose-500 text-white shadow-md shadow-rose-600/20 active:scale-95 transition"
                  >
                    Konfirmasi Pengeluaran
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ===================== MODAL TAMBAH KATEGORI BARU ===================== */}
      <AnimatePresence>
        {isCategoryModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-sm rounded-2xl theme-bg-card border theme-border p-5 shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between pb-2 border-b theme-border">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-xl bg-emerald-500/10 text-emerald-500">
                    <FolderPlus size={18} />
                  </div>
                  <h3 className="text-base font-bold theme-text-primary">Buat Pos Kategori Baru</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCategoryModalOpen(false)}
                  className="p-1 rounded-lg text-zinc-400 hover:text-zinc-200"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleCreateCategory} className="space-y-4">
                <div>
                  <label className="text-xs font-semibold theme-text-secondary block mb-1">
                    Nama Pos Kategori
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: Makan, Mainan, Liburan, Servis..."
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    autoFocus={true}
                    className="w-full px-3 py-2 text-xs rounded-xl theme-bg-card theme-border border theme-text-primary focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                  <p className="text-[11px] theme-text-muted mt-1">
                    Anda bebas membuat nama kategori pos tabungan apa saja sesuai kebutuhan pribadi.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t theme-border">
                  <button
                    type="button"
                    onClick={() => setIsCategoryModalOpen(false)}
                    className="px-4 py-2 text-xs font-semibold rounded-xl theme-border border theme-text-secondary hover:theme-text-primary"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20 active:scale-95 transition"
                  >
                    Buat Kategori
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
