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
  ChevronUp,
  AlertCircle,
  Tag,
  Sparkles,
  BookOpen,
  Info,
  ShieldCheck,
  HelpCircle,
  Layers,
  CheckCircle2,
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
  const [isGuideModalOpen, setIsGuideModalOpen] = useState(false);

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
        showErrorAlert('Nama Pos Wajib Diisi', 'Ketikkan nama pos kategori baru atau pilih opsi Uang Bebas.');
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
      showErrorAlert('Nominal Tidak Valid', 'Masukkan nominal uang tabungan yang digunakan.');
      return;
    }

    if (num > availableWithdrawBalance) {
      const sourceName = withdrawSource === 'UNALLOCATED' ? 'Uang Bebas (Umum)' : `Pos "${withdrawSource}"`;
      showErrorAlert(
        'Saldo Tidak Mencukupi',
        `Saldo pada ${sourceName} saat ini hanya Rp${Math.max(0, availableWithdrawBalance).toLocaleString('id-ID')}. Anda memasukkan Rp${num.toLocaleString('id-ID')}.`
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
      showToast('Pengeluaran tabungan berhasil dicatat', 'success');
    } catch (err: any) {
      showErrorAlert('Gagal Mencatat', err?.message || 'Terjadi kesalahan sistem.');
    }
  };

  // Delete Entry
  const handleDeleteEntry = async (entry: SavingsEntry) => {
    playTapSound();
    const isConfirmed = await showConfirmDialog({
      title: 'Hapus Catatan Mutasi?',
      text: `Mutasi ${entry.type === 'IN' ? 'Setor' : 'Tarik'} sebesar ${formatRupiah(entry.amountRupiah)} akan dihapus. Lanjutkan?`,
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
      showErrorAlert('Nama Pos Kosong', 'Silakan ketikkan nama pos kategori tabungan.');
      return;
    }

    try {
      playTapSound();
      await repository.addSavingsCategory(clean);
      setNewCategoryName('');
      setIsCategoryModalOpen(false);
      await loadData();
      showToast('Pos kategori baru berhasil dibuat', 'success');
    } catch (err: any) {
      showErrorAlert('Gagal Menambah Kategori', err?.message || 'Terjadi kesalahan.');
    }
  };

  // Delete Category
  const handleDeleteCategory = async (catName: string) => {
    playTapSound();
    const targetCat = categories.find((c) => c.name.toLowerCase() === catName.toLowerCase());
    if (!targetCat) return;

    const isConfirmed = await showConfirmDialog({
      title: `Hapus Pos "${catName}"?`,
      text: `Pos kategori ini akan dihapus dari daftar pos aktif. Catatan mutasi terdahulu tetap tersimpan di riwayat.`,
      confirmButtonText: 'Ya, Hapus Pos',
      cancelButtonText: 'Batal',
      isDanger: true,
    });

    if (!isConfirmed) return;

    try {
      await repository.deleteSavingsCategory(targetCat.id);
      await loadData();
      showToast(`Pos "${catName}" berhasil dihapus`, 'success');
    } catch (err: any) {
      showErrorAlert('Gagal Menghapus Pos', err?.message || 'Terjadi kesalahan.');
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
    <div className="space-y-5 pb-16 max-w-7xl mx-auto">
      {/* ===================== HEADER & ACTIONS ===================== */}
      <div className="p-4 sm:p-5 rounded-2xl theme-bg-card border theme-border shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 shrink-0">
              <PiggyBank size={20} />
            </div>
            <h1 className="text-lg sm:text-xl font-bold tracking-tight theme-text-primary truncate">
              Buku Tabungan Pribadi
            </h1>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold border border-emerald-500/20 shrink-0">
              Dana Mandiri
            </span>
          </div>
          <p className="text-xs theme-text-muted leading-relaxed line-clamp-2 md:line-clamp-1">
            Brankas tabungan mandiri pemilik toko. Pencatatan alokasi pos dana pribadi tanpa mempengaruhi stok Robux atau kas toko.
          </p>
        </div>

        {/* Action Button Cluster */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap shrink-0">
          <button
            type="button"
            onClick={() => {
              playTapSound();
              setIsGuideModalOpen(true);
            }}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold theme-bg-card border theme-border theme-text-secondary hover:theme-text-primary transition shadow-sm active:scale-95"
            title="Buka panduan lengkap cara kerja buku tabungan"
          >
            <BookOpen size={14} className="text-emerald-500" />
            <span>Panduan</span>
          </button>

          <button
            type="button"
            onClick={() => {
              playTapSound();
              setIsCategoryModalOpen(true);
            }}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold theme-bg-card border theme-border theme-text-secondary hover:theme-text-primary transition shadow-sm active:scale-95"
          >
            <FolderPlus size={14} className="text-emerald-500" />
            <span>Tambah Pos</span>
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
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/25 transition shadow-sm active:scale-95"
          >
            <ArrowUpRight size={14} />
            <span>Tarik Dana</span>
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
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm shadow-emerald-600/20 transition active:scale-95"
          >
            <ArrowDownLeft size={14} />
            <span>Setor Dana</span>
          </button>
        </div>
      </div>

      {/* ===================== SUMMARY CARDS ===================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Card 1: Total Saldo Keseluruhan */}
        <div className="p-4 rounded-2xl theme-bg-card border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 via-transparent to-transparent shadow-sm flex flex-col justify-between overflow-hidden">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold theme-text-muted truncate">Total Saldo Tabungan</span>
            <span className="p-1.5 rounded-lg bg-emerald-500/15 text-emerald-500 shrink-0">
              <PiggyBank size={15} />
            </span>
          </div>
          <div className="mt-3">
            <div className="text-xl sm:text-2xl font-extrabold font-mono tracking-tight text-emerald-600 dark:text-emerald-400 truncate">
              {formatRupiah(summary.totalBalance)}
            </div>
            <p className="text-[11px] theme-text-muted mt-1 truncate">
              Gabungan seluruh pos tabungan aktif
            </p>
          </div>
        </div>

        {/* Card 2: Saldo Uang Bebas / Umum */}
        <div className="p-4 rounded-2xl theme-bg-card border theme-border shadow-sm flex flex-col justify-between overflow-hidden">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold theme-text-muted truncate">Uang Bebas (Umum)</span>
            <span className="p-1.5 rounded-lg bg-zinc-500/10 text-zinc-400 shrink-0">
              <Wallet size={15} />
            </span>
          </div>
          <div className="mt-3">
            <div className="text-xl sm:text-2xl font-extrabold font-mono tracking-tight theme-text-primary truncate">
              {formatRupiah(summary.unallocatedBalance)}
            </div>
            <p className="text-[11px] theme-text-muted mt-1 truncate">
              Dana tabungan tanpa target pos khusus
            </p>
          </div>
        </div>

        {/* Card 3: Total Akumulasi Masuk */}
        <div className="p-4 rounded-2xl theme-bg-card border theme-border shadow-sm flex flex-col justify-between overflow-hidden">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold theme-text-muted truncate">Total Disimpan (Masuk)</span>
            <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-500 shrink-0">
              <ArrowDownLeft size={15} />
            </span>
          </div>
          <div className="mt-3">
            <div className="text-xl sm:text-2xl font-extrabold font-mono tracking-tight text-emerald-500 truncate">
              +{formatRupiah(summary.totalIn)}
            </div>
            <p className="text-[11px] theme-text-muted mt-1 truncate">
              Akumulasi dana yang disisihkan
            </p>
          </div>
        </div>

        {/* Card 4: Total Akumulasi Keluar */}
        <div className="p-4 rounded-2xl theme-bg-card border theme-border shadow-sm flex flex-col justify-between overflow-hidden">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold theme-text-muted truncate">Total Digunakan (Keluar)</span>
            <span className="p-1.5 rounded-lg bg-rose-500/10 text-rose-500 shrink-0">
              <ArrowUpRight size={15} />
            </span>
          </div>
          <div className="mt-3">
            <div className="text-xl sm:text-2xl font-extrabold font-mono tracking-tight text-rose-500 truncate">
              -{formatRupiah(summary.totalOut)}
            </div>
            <p className="text-[11px] theme-text-muted mt-1 truncate">
              Akumulasi dana yang telah terpakai
            </p>
          </div>
        </div>
      </div>

      {/* ===================== POS KATEGORI TABUNGAN ===================== */}
      <div className="p-4 sm:p-5 rounded-2xl theme-bg-card border theme-border shadow-sm space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Folder size={17} className="text-emerald-500 shrink-0" />
            <h2 className="text-sm font-bold theme-text-primary truncate">
              Daftar Pos Kategori Tabungan
            </h2>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold shrink-0">
              {summary.categories.length + 1} Pos Aktif
            </span>
          </div>

          <button
            type="button"
            onClick={() => {
              playTapSound();
              setIsCategoryModalOpen(true);
            }}
            className="text-xs font-semibold text-emerald-500 hover:text-emerald-400 flex items-center gap-1 shrink-0"
          >
            <Plus size={14} />
            <span>Tambah Pos</span>
          </button>
        </div>

        {/* Grid Pos Kategori (Ultra Clean & Anti-Overflow) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {/* Card: Pos Uang Bebas */}
          <div className="p-4 rounded-xl border border-zinc-500/20 bg-zinc-500/5 flex flex-col justify-between gap-3 overflow-hidden">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold theme-text-primary flex items-center gap-1.5 truncate">
                  <Wallet size={14} className="text-zinc-400 shrink-0" />
                  <span className="truncate">Uang Bebas (Umum)</span>
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-500/10 theme-text-muted font-medium shrink-0">
                  Umum
                </span>
              </div>

              <div>
                <span className="text-[10px] theme-text-muted block">Sisa Saldo Pos</span>
                <div className="text-base sm:text-lg font-extrabold font-mono text-emerald-600 dark:text-emerald-400 truncate">
                  {formatRupiah(summary.unallocatedBalance)}
                </div>
              </div>
            </div>

            <div className="pt-2 border-t theme-border flex items-center gap-2">
              <button
                type="button"
                disabled={summary.unallocatedBalance <= 0}
                onClick={() => openWithdrawForCategory('UNALLOCATED')}
                className="w-full py-1.5 rounded-lg text-xs font-semibold bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center justify-center gap-1"
              >
                <ArrowUpRight size={13} />
                <span>Gunakan Dana</span>
              </button>
            </div>
          </div>

          {/* Card: Pos-Pos Kategori Khusus */}
          {summary.categories.map((cat) => {
            const hasZeroBalance = cat.balance <= 0 && cat.totalIn === 0 && cat.totalOut === 0;
            return (
              <div
                key={cat.name}
                className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 flex flex-col justify-between gap-3 overflow-hidden"
              >
                <div className="space-y-2 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold theme-text-primary flex items-center gap-1.5 truncate min-w-0" title={cat.name}>
                      <Tag size={13} className="text-emerald-500 shrink-0" />
                      <span className="truncate">{cat.name}</span>
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-medium shrink-0">
                      Khusus
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] theme-text-muted block">Sisa Saldo Pos</span>
                    <div className="text-base sm:text-lg font-extrabold font-mono text-emerald-600 dark:text-emerald-400 truncate">
                      {formatRupiah(cat.balance)}
                    </div>
                  </div>

                  {/* Micro Breakdown In & Out (Never Overflows) */}
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t theme-border text-[11px]">
                    <div className="min-w-0">
                      <span className="text-[10px] theme-text-muted block">Masuk</span>
                      <span className="font-semibold text-emerald-500 truncate block">
                        +{formatRupiah(cat.totalIn)}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <span className="text-[10px] theme-text-muted block">Keluar</span>
                      <span className="font-semibold text-rose-500 truncate block">
                        -{formatRupiah(cat.totalOut)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t theme-border flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={cat.balance <= 0}
                    onClick={() => openWithdrawForCategory(cat.name)}
                    className="flex-1 py-1.5 rounded-lg text-xs font-semibold bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center justify-center gap-1 truncate"
                  >
                    <ArrowUpRight size={13} />
                    <span>Gunakan Dana</span>
                  </button>

                  {/* Delete Button for unused/empty custom categories */}
                  {cat.balance <= 0 && (
                    <button
                      type="button"
                      onClick={() => handleDeleteCategory(cat.name)}
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-500 hover:bg-rose-500/10 transition shrink-0"
                      title="Hapus pos kategori ini"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ===================== RIWAYAT MUTASI TABUNGAN ===================== */}
      <div className="p-4 sm:p-5 rounded-2xl theme-bg-card border theme-border shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Calendar size={17} className="text-emerald-500 shrink-0" />
            <h2 className="text-sm font-bold theme-text-primary">
              Riwayat Mutasi Tabungan
            </h2>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-500/10 theme-text-muted font-medium">
              {filteredEntries.length} Transaksi
            </span>
          </div>

          {/* Filter Bar */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Filter Jenis: Segmented Control */}
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
              className="px-2.5 py-1 text-[11px] rounded-xl theme-bg-card theme-border border theme-text-primary focus:outline-none focus:ring-1 focus:ring-emerald-500 max-w-[140px] truncate"
            >
              <option value="ALL">Semua Pos</option>
              <option value="UNALLOCATED">Uang Bebas (Umum)</option>
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
                className="pl-7 pr-6 py-1 text-[11px] rounded-xl theme-bg-card theme-border border theme-text-primary placeholder:theme-text-muted focus:outline-none focus:ring-1 focus:ring-emerald-500 w-32 sm:w-44"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:theme-text-primary"
                >
                  <X size={11} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* List Mutasi */}
        {isLoading ? (
          <div className="py-12 text-center text-xs theme-text-muted">Memuat catatan tabungan...</div>
        ) : filteredEntries.length === 0 ? (
          <div className="py-12 px-4 text-center rounded-xl border border-dashed theme-border space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto">
              <PiggyBank size={24} />
            </div>
            <div>
              <h3 className="text-sm font-semibold theme-text-primary">Belum Ada Catatan Tabungan</h3>
              <p className="text-xs theme-text-muted mt-0.5 max-w-sm mx-auto">
                Mulai menabung dengan menekan tombol <strong>Setor Dana</strong> di bagian atas.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                playTapSound();
                setIsGuideModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold theme-bg-card border theme-border text-emerald-500 hover:text-emerald-400"
            >
              <BookOpen size={13} />
              <span>Lihat Panduan Penggunaan</span>
            </button>
          </div>
        ) : (
          <div className="divide-y theme-border">
            {filteredEntries.map((entry) => {
              const isDeposit = entry.type === 'IN';
              const catName = entry.category?.trim();
              return (
                <div
                  key={entry.id}
                  className="py-3 px-2 flex items-center justify-between gap-3 hover:bg-zinc-500/5 transition rounded-xl"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div
                      className={`p-2 rounded-xl shrink-0 ${
                        isDeposit
                          ? 'bg-emerald-500/10 text-emerald-500'
                          : 'bg-rose-500/10 text-rose-500'
                      }`}
                    >
                      {isDeposit ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold theme-text-primary">
                          {isDeposit ? 'Setor Dana' : 'Tarik Dana'}
                        </span>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-md font-medium truncate max-w-[140px] sm:max-w-xs ${
                            catName
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                              : 'bg-zinc-500/10 theme-text-muted border theme-border'
                          }`}
                        >
                          {catName || 'Uang Bebas (Umum)'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] theme-text-muted mt-0.5 flex-wrap">
                        <span>{formatDateJakarta(entry.createdAt, true)}</span>
                        {entry.notes && (
                          <>
                            <span>•</span>
                            <span className="italic truncate max-w-[180px] sm:max-w-md">"{entry.notes}"</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                    <span
                      className={`text-sm sm:text-base font-extrabold font-mono ${
                        isDeposit ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {isDeposit ? '+' : '-'}
                      {formatRupiah(entry.amountRupiah)}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDeleteEntry(entry)}
                      title="Hapus catatan mutasi"
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

      {/* ===================== MODAL BUKU PANDUAN PENGGUNAAN ===================== */}
      <AnimatePresence>
        {isGuideModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-lg rounded-2xl theme-bg-card border theme-border p-5 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between pb-3 border-b theme-border">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-xl bg-emerald-500/10 text-emerald-500">
                    <BookOpen size={18} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold theme-text-primary">
                      Panduan Penggunaan Buku Tabungan
                    </h3>
                    <p className="text-[11px] theme-text-muted">
                      Cara praktis mengelola tabungan pribadi secara mandiri
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsGuideModalOpen(false)}
                  className="p-1.5 rounded-lg text-zinc-400 hover:theme-text-primary transition"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Guide Content Cards */}
              <div className="space-y-3 text-xs leading-relaxed">
                {/* 1. Konsep Utama */}
                <div className="p-3.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 space-y-1.5">
                  <div className="flex items-center gap-1.5 font-bold text-emerald-600 dark:text-emerald-400">
                    <ShieldCheck size={16} />
                    <span>1. Terpisah 100% dari Kas & Stok Toko</span>
                  </div>
                  <p className="theme-text-secondary">
                    Buku tabungan ini adalah brankas catatan dana pribadi pemilik toko. Dana yang masuk dan keluar di menu ini <strong>tidak mengubah</strong> stok Robux (FIFO), tidak merusak antrean batch, dan tidak mempengaruhi laba rugi toko Anda.
                  </p>
                </div>

                {/* 2. Pembagian Pos Kategori */}
                <div className="p-3.5 rounded-xl border theme-border theme-bg-card space-y-1.5">
                  <div className="flex items-center gap-1.5 font-bold theme-text-primary">
                    <Layers size={16} className="text-emerald-500" />
                    <span>2. Pilihan Pos Tabungan Fleksibel</span>
                  </div>
                  <ul className="space-y-1 theme-text-secondary pl-1 list-disc list-inside">
                    <li>
                      <strong>Uang Bebas (Umum):</strong> Tempat menaruh dana tabungan yang bebas tanpa peruntukan khusus.
                    </li>
                    <li>
                      <strong>Pos Kategori Khusus:</strong> Anda bebas membuat pos apa saja sesuai target kebutuhan pribadi (misal: <em>Makan, Mainan, Liburan, Dana Darurat, Servis Kendaraan, Gadget</em>).
                    </li>
                  </ul>
                </div>

                {/* 3. Cara Menyetor */}
                <div className="p-3.5 rounded-xl border theme-border theme-bg-card space-y-1.5">
                  <div className="flex items-center gap-1.5 font-bold theme-text-primary">
                    <ArrowDownLeft size={16} className="text-emerald-500" />
                    <span>3. Cara Menyetor Dana Tabungan</span>
                  </div>
                  <p className="theme-text-secondary">
                    Tekan tombol <strong>Setor Dana</strong>, masukkan nominal yang ingin ditabung, lalu tentukan apakah ingin disimpan ke <em>Uang Bebas</em> atau dimasukkan ke <em>Pos Kategori Tertentu</em>. Anda juga bisa langsung mengetikkan nama pos baru saat menyetor.
                  </p>
                </div>

                {/* 4. Cara Menarik */}
                <div className="p-3.5 rounded-xl border theme-border theme-bg-card space-y-1.5">
                  <div className="flex items-center gap-1.5 font-bold theme-text-primary">
                    <ArrowUpRight size={16} className="text-rose-500" />
                    <span>4. Cara Mengambil / Memakai Dana Tabungan</span>
                  </div>
                  <p className="theme-text-secondary">
                    Tekan tombol <strong>Tarik Dana</strong> (atau klik tombol <em>Gunakan Dana</em> pada kartu pos yang diinginkan). Pilih pos sumber dana yang diambil. Sistem otomatis memeriksa saldo tersedia pada pos tersebut untuk mencegah penarikan melebihi saldo.
                  </p>
                </div>

                {/* 5. Keamanan Data */}
                <div className="p-3.5 rounded-xl border theme-border theme-bg-card space-y-1.5">
                  <div className="flex items-center gap-1.5 font-bold theme-text-primary">
                    <CheckCircle2 size={16} className="text-emerald-500" />
                    <span>5. Cadangan & Keamanan Lokal</span>
                  </div>
                  <p className="theme-text-secondary">
                    Seluruh catatan tabungan Anda tersimpan aman di database lokal perangkat (IndexedDB) dan otomatis ikut tersimpan saat Anda melakukan ekspor cadangan data JSON toko di menu Pengaturan.
                  </p>
                </div>
              </div>

              <div className="pt-2 border-t theme-border flex justify-end">
                <button
                  type="button"
                  onClick={() => setIsGuideModalOpen(false)}
                  className="w-full sm:w-auto px-5 py-2 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white transition active:scale-95"
                >
                  Saya Mengerti
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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
                    <ArrowDownLeft size={18} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold theme-text-primary">Setor Dana Tabungan</h3>
                    <p className="text-[11px] theme-text-muted">Simpan uang ke brankas tabungan pribadi</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsDepositModalOpen(false)}
                  className="p-1 rounded-lg text-zinc-400 hover:theme-text-primary"
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
                        className="px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition active:scale-95"
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
                      className={`p-2 rounded-xl text-xs font-medium border transition text-center truncate ${
                        depositCategoryMode === 'UNALLOCATED'
                          ? 'border-emerald-500 bg-emerald-500/10 text-emerald-500 font-bold'
                          : 'theme-border theme-text-muted hover:theme-text-primary'
                      }`}
                    >
                      Uang Bebas
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
                      className={`p-2 rounded-xl text-xs font-medium border transition text-center truncate ${
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
                      className={`p-2 rounded-xl text-xs font-medium border transition text-center truncate ${
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
                        placeholder="Contoh: Makan, Mainan, Liburan, Gadget..."
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
                    Catatan Keterangan (Opsional)
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: Sisihan sisa belanja, tabungan mingguan..."
                    value={depositNotes}
                    onChange={(e) => setDepositNotes(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl theme-bg-card theme-border border theme-text-primary focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                {/* Tanggal */}
                <div>
                  <label className="text-xs font-semibold theme-text-secondary block mb-1">
                    Tanggal Transaksi
                  </label>
                  <input
                    type="date"
                    value={depositDateKey}
                    onChange={(e) => setDepositDateKey(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl theme-bg-card theme-border border theme-text-primary focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                {/* Tombol Simpan */}
                <div className="flex items-center justify-end gap-2 pt-3 border-t theme-border">
                  <button
                    type="button"
                    onClick={() => setIsDepositModalOpen(false)}
                    className="px-4 py-2 text-xs font-semibold rounded-xl theme-border border theme-text-secondary hover:theme-text-primary"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm shadow-emerald-600/20 active:scale-95 transition"
                  >
                    Simpan Tabungan
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ===================== MODAL PAKAI / TARIK TABUNGAN ===================== */}
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
                    <ArrowUpRight size={18} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold theme-text-primary">Tarik Dana Tabungan</h3>
                    <p className="text-[11px] theme-text-muted">Gunakan dana dari pos tabungan yang dipilih</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsWithdrawModalOpen(false)}
                  className="p-1 rounded-lg text-zinc-400 hover:theme-text-primary"
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
                      Uang Bebas (Umum) — Saldo: {formatRupiah(summary.unallocatedBalance)}
                    </option>
                    {summary.categories.map((c) => (
                      <option key={c.name} value={c.name}>
                        Pos "{c.name}" — Saldo: {formatRupiah(c.balance)}
                      </option>
                    ))}
                  </select>
                  <div className="mt-1.5 flex items-center justify-between text-[11px] p-2 rounded-lg bg-zinc-500/5 border theme-border">
                    <span className="theme-text-muted">Saldo Tersedia di Pos Ini:</span>
                    <span className="font-mono font-bold text-emerald-500">
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
                  {/* Quick percentage buttons with anti-overflow design */}
                  {availableWithdrawBalance > 0 && (
                    <div className="grid grid-cols-3 gap-1.5 mt-2">
                      <button
                        type="button"
                        onClick={() => {
                          playTapSound();
                          setWithdrawAmount(Math.round(availableWithdrawBalance * 0.25));
                        }}
                        className="py-1 rounded-lg text-[10px] font-semibold bg-zinc-500/10 theme-text-secondary hover:theme-text-primary border theme-border text-center truncate"
                      >
                        25%
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          playTapSound();
                          setWithdrawAmount(Math.round(availableWithdrawBalance * 0.5));
                        }}
                        className="py-1 rounded-lg text-[10px] font-semibold bg-zinc-500/10 theme-text-secondary hover:theme-text-primary border theme-border text-center truncate"
                      >
                        50%
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          playTapSound();
                          setWithdrawAmount(availableWithdrawBalance);
                        }}
                        className="py-1 rounded-lg text-[10px] font-bold bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 border border-rose-500/20 text-center truncate"
                      >
                        Semua Saldo
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

                {/* Tanggal */}
                <div>
                  <label className="text-xs font-semibold theme-text-secondary block mb-1">
                    Tanggal Transaksi
                  </label>
                  <input
                    type="date"
                    value={withdrawDateKey}
                    onChange={(e) => setWithdrawDateKey(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl theme-bg-card theme-border border theme-text-primary focus:outline-none focus:ring-1 focus:ring-rose-500"
                  />
                </div>

                {/* Tombol Simpan */}
                <div className="flex items-center justify-end gap-2 pt-3 border-t theme-border">
                  <button
                    type="button"
                    onClick={() => setIsWithdrawModalOpen(false)}
                    className="px-4 py-2 text-xs font-semibold rounded-xl theme-border border theme-text-secondary hover:theme-text-primary"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 text-xs font-bold rounded-xl bg-rose-600 hover:bg-rose-500 text-white shadow-sm shadow-rose-600/20 active:scale-95 transition"
                  >
                    Konfirmasi Tarik
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ===================== MODAL TAMBAH POS KATEGORI ===================== */}
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
                  <div>
                    <h3 className="text-base font-bold theme-text-primary">Buat Pos Kategori Baru</h3>
                    <p className="text-[11px] theme-text-muted">Target alokasi pos tabungan mandiri</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCategoryModalOpen(false)}
                  className="p-1 rounded-lg text-zinc-400 hover:theme-text-primary"
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
                    placeholder="Contoh: Makan, Mainan, Liburan, Gadget..."
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    autoFocus={true}
                    className="w-full px-3 py-2 text-xs rounded-xl theme-bg-card theme-border border theme-text-primary focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                  <p className="text-[11px] theme-text-muted mt-1.5 leading-relaxed">
                    Anda bebas membuat nama kategori apa saja sesuai target peruntukan tabungan pribadi.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t theme-border">
                  <button
                    type="button"
                    onClick={() => setIsCategoryModalOpen(false)}
                    className="px-4 py-2 text-xs font-semibold rounded-xl theme-border border theme-text-secondary hover:theme-text-primary"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm shadow-emerald-600/20 active:scale-95 transition"
                  >
                    Buat Pos Kategori
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
