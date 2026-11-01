import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  TrendingUp,
  TrendingDown,
  Sparkles,
  Landmark,
  CreditCard,
  DollarSign,
  Clock,
  CheckSquare,
  AlertCircle,
  Zap,
  Check,
  Edit3,
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  X,
  FileText,
  MoreVertical,
} from 'lucide-react';
import { repository } from '../../db/repository';
import { StockBatch, PersonalUsage, Loan, StockMovement } from '../../db/schema';
import { NumberInput } from '../../components/NumberInput';
import { parseRobuxOrMoneyShorthand } from '../../domain/calculations';
import { formatRupiah, formatNumber, formatDecimal, formatDateJakarta } from '../../utils/formatters';
import { showSuccessAlert, showErrorAlert, showWarningAlert, showConfirmDialog, showCustomAlert } from '../../utils/alert';
import { playTapSound, playSuccessSound, playDeleteSound } from '../../utils/sound';

export const StockView: React.FC = () => {
  // Hanya 3 Tab Utama: Batch Aktif, Restock, Riwayat (Maksimal 3 menu)
  const [activeTab, setActiveTab] = useState<'batches' | 'restock' | 'history'>('batches');

  // Sub-modals untuk fitur akuntansi sekunder agar tidak memadati sub-tab
  const [showReconcileModal, setShowReconcileModal] = useState(false);
  const [showPriveModal, setShowPriveModal] = useState(false);
  const [showLoansModal, setShowLoansModal] = useState(false);
  const [showRateModal, setShowRateModal] = useState(false);

  // Settings & Rate Jual Toko
  const [defaultSellRate, setDefaultSellRate] = useState<number | undefined>(undefined);
  const [newDefaultRateInput, setNewDefaultRateInput] = useState('');
  const [isSavingRate, setIsSavingRate] = useState(false);

  // Riwayat Mutasi Terpadu State
  const [historyMovements, setHistoryMovements] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyFilterBatch, setHistoryFilterBatch] = useState('');
  const [historyFilterCategory, setHistoryFilterCategory] = useState<string>('ALL');
  const [historyStartDate, setHistoryStartDate] = useState('');
  const [historyEndDate, setHistoryEndDate] = useState('');
  const [historySearch, setHistorySearch] = useState('');
  const [historyPage, setHistoryPage] = useState(1);
  const historyPageSize = 15;

  // Batches state
  const [batches, setBatches] = useState<StockBatch[]>([]);
  const [allBatches, setAllBatches] = useState<StockBatch[]>([]);
  const [showDepletedBatches, setShowDepletedBatches] = useState(false);
  const [summary, setSummary] = useState({
    totalRemainingRobux: 0,
    totalRemainingCostRupiah: 0,
    activeBatchCount: 0,
    averageCostPerRobux: 0,
  });

  // Overflow action menu state per batch
  const [openActionMenuBatchId, setOpenActionMenuBatchId] = useState<string | null>(null);

  // Unified Edit Modal State (Jumlah Robux + Catatan disatukan)
  const [editingBatch, setEditingBatch] = useState<StockBatch | null>(null);
  const [editActiveSection, setEditActiveSection] = useState<'ROBUX' | 'NOTES'>('ROBUX');
  const [editNewInitialRobux, setEditNewInitialRobux] = useState('');
  const [editReason, setEditReason] = useState('');
  const [editCostMode, setEditCostMode] = useState<'KEEP_TOTAL_COST' | 'KEEP_UNIT_COST'>('KEEP_TOTAL_COST');
  const [editBatchNotes, setEditBatchNotes] = useState('');
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

  // Loans State
  const [loans, setLoans] = useState<Loan[]>([]);
  const [expandedLoanId, setExpandedLoanId] = useState<string | null>(null);

  // Form: Sumber Dana Restock
  const [fundingSource, setFundingSource] = useState<'OWN_FUNDS' | 'LOAN' | 'COMBINED'>('OWN_FUNDS');
  const [ownFundsInput, setOwnFundsInput] = useState('');
  const [loanFundsInput, setLoanFundsInput] = useState('');
  const [lenderName, setLenderName] = useState('');
  const [loanDueDate, setLoanDueDate] = useState('');
  const [loanNotes, setLoanNotes] = useState('');

  // Personal Usages (Prive) state
  const [personalUsages, setPersonalUsages] = useState<PersonalUsage[]>([]);

  // Restock Form State
  const [restockRobux, setRestockRobux] = useState('');
  const [restockCost, setRestockCost] = useState('');
  const [restockNotes, setRestockNotes] = useState('');
  const [targetSellRate, setTargetSellRate] = useState('');
  const [isSubmittingRestock, setIsSubmittingRestock] = useState(false);

  // Sisa Robux Akun Form State
  const [accountRobux, setAccountRobux] = useState('');
  const [accountModalPerRobux, setAccountModalPerRobux] = useState('');
  const [accountNotes, setAccountNotes] = useState('');
  const [isSubmittingReconcile, setIsSubmittingReconcile] = useState(false);

  // Prive Form State
  const [priveRobux, setPriveRobux] = useState('');
  const [priveNotes, setPriveNotes] = useState('');
  const [isSubmittingPrive, setIsSubmittingPrive] = useState(false);

  // Parse Shorthand Inputs
  const parsedRestockRobux = useMemo(() => parseRobuxOrMoneyShorthand(restockRobux), [restockRobux]);
  const parsedRestockCost = useMemo(() => parseRobuxOrMoneyShorthand(restockCost), [restockCost]);
  const parsedOwnFunds = useMemo(() => parseRobuxOrMoneyShorthand(ownFundsInput), [ownFundsInput]);
  const parsedLoanFunds = useMemo(() => parseRobuxOrMoneyShorthand(loanFundsInput), [loanFundsInput]);

  // Load Main Data
  const loadData = async () => {
    try {
      const [availBatches, allB, sum, prives, allLoans, settings] = await Promise.all([
        repository.getAvailableBatches(),
        repository.getAllBatches(),
        repository.getTotalStockSummary(),
        repository.getPersonalUsages(),
        repository.getLoans(),
        repository.getSettings(),
      ]);
      setBatches(availBatches);
      setAllBatches(allB);
      setSummary(sum);
      setPersonalUsages(prives);
      setLoans(allLoans);
      if (settings?.defaultSellRate) {
        setDefaultSellRate(settings.defaultSellRate);
      } else {
        setDefaultSellRate(undefined);
      }
    } catch (err) {
      console.error('Failed to load stock data:', err);
    }
  };

  const loadHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const res = await repository.getStockMovements();
      setHistoryMovements(res.movements);
    } catch (err) {
      console.error('Failed to load stock movements history:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  useEffect(() => {
    loadData();
    if (activeTab === 'history') {
      loadHistory();
    }
  }, [activeTab]);

  // Close overflow menu when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-overflow-menu]')) {
        setOpenActionMenuBatchId(null);
      }
    };
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, []);

  // Handler: Buka Unified Edit Modal
  const handleOpenEditBatch = (batch: StockBatch) => {
    playTapSound();
    setOpenActionMenuBatchId(null);
    setEditingBatch(batch);
    setEditActiveSection('ROBUX');
    setEditNewInitialRobux(String(batch.initialRobux));
    setEditReason('');
    setEditCostMode('KEEP_TOTAL_COST');
    setEditBatchNotes(batch.notes || '');
  };

  // Handler: Simpan Unified Edit (Koreksi Robux & Catatan)
  const handleSaveUnifiedEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBatch) return;

    if (editActiveSection === 'NOTES') {
      try {
        await repository.updateStockBatchNotes(editingBatch.id, editBatchNotes.trim());
        playSuccessSound();
        setEditingBatch(null);
        await loadData();
        await showSuccessAlert('Catatan Diperbarui', 'Catatan batch berhasil disimpan.');
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Gagal menyimpan catatan';
        await showErrorAlert('Gagal Menyimpan', msg);
      }
      return;
    }

    // Section ROBUX
    const newRobuxVal = parseInt(editNewInitialRobux, 10);
    if (isNaN(newRobuxVal) || newRobuxVal <= 0) {
      await showWarningAlert('Jumlah Tidak Valid', 'Jumlah Robux awal baru harus berupa bilangan bulat positif.');
      return;
    }

    const soldOrUsed = editingBatch.initialRobux - editingBatch.remainingRobux;
    if (newRobuxVal < soldOrUsed) {
      await showErrorAlert(
        'Jumlah Terlalu Kecil',
        `Batch ini sudah terpakai/terjual sebanyak ${formatNumber(soldOrUsed)} R$. Jumlah awal baru minimal harus ${formatNumber(soldOrUsed)} R$.`
      );
      return;
    }

    if (newRobuxVal === editingBatch.initialRobux) {
      // Jika jumlah sama, simpan catatan saja jika berubah
      if (editBatchNotes.trim() !== (editingBatch.notes || '')) {
        await repository.updateStockBatchNotes(editingBatch.id, editBatchNotes.trim());
        await loadData();
      }
      setEditingBatch(null);
      return;
    }

    if (!editReason.trim()) {
      await showWarningAlert('Alasan Wajib Diisi', 'Mohon isi alasan koreksi jumlah Robux pada batch ini.');
      return;
    }

    setIsSubmittingEdit(true);
    try {
      await repository.editBatchInitialRobux({
        batchId: editingBatch.id,
        newInitialRobux: newRobuxVal,
        reason: editReason.trim(),
        costMode: editCostMode,
      });

      if (editBatchNotes.trim() !== (editingBatch.notes || '')) {
        await repository.updateStockBatchNotes(editingBatch.id, editBatchNotes.trim());
      }

      playSuccessSound();
      setEditingBatch(null);
      await loadData();
      if (activeTab === 'history') {
        await loadHistory();
      }

      await showSuccessAlert(
        'Koreksi Berhasil Disimpan',
        `Batch ${editingBatch.id} berhasil diperbarui menjadi ${formatNumber(newRobuxVal)} R$.`
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal mengoreksi jumlah batch';
      await showErrorAlert('Gagal Mengoreksi', msg);
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  // Handler: Simpan Default Sell Rate
  const handleSaveDefaultRate = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseFloat(newDefaultRateInput);
    if (isNaN(parsed) || parsed <= 0) {
      await showWarningAlert('Rate Tidak Valid', 'Masukkan rate jual standar yang valid (lebih dari 0).');
      return;
    }

    setIsSavingRate(true);
    try {
      await repository.updateSettings({ defaultSellRate: parsed });
      setDefaultSellRate(parsed);
      setShowRateModal(false);
      setNewDefaultRateInput('');
      playSuccessSound();
      await showSuccessAlert('Rate Jual Diperbarui', `Rate jual standar Anda telah diatur ke Rp${formatDecimal(parsed, 2)} / R$.`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal menyimpan rate jual';
      await showErrorAlert('Gagal', msg);
    } finally {
      setIsSavingRate(false);
    }
  };

  // Handler: Hapus Default Sell Rate
  const handleClearDefaultRate = async () => {
    const ok = await showConfirmDialog({
      title: 'Hapus Rate Jual Standar?',
      text: 'Formulir penjualan dan kalkulator tidak akan lagi mengisi otomatis rate jual.',
      confirmButtonText: 'Ya, Hapus',
      isDanger: true,
    });
    if (!ok) return;

    try {
      await repository.updateSettings({ defaultSellRate: undefined });
      setDefaultSellRate(undefined);
      setShowRateModal(false);
      playTapSound();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal menghapus rate';
      await showErrorAlert('Gagal', msg);
    }
  };

  // Handler Pindah ke Riwayat Khusus Batch Tertentu
  const handleViewBatchHistory = (batchId: string) => {
    playTapSound();
    setOpenActionMenuBatchId(null);
    setHistoryFilterBatch(batchId);
    setHistoryFilterCategory('ALL');
    setHistoryStartDate('');
    setHistoryEndDate('');
    setActiveTab('history');
  };

  // Handler: Restock Submit
  const handleRestockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const robuxVal = Math.floor(parsedRestockRobux);
    let costVal = Math.floor(parsedRestockCost);

    if (fundingSource === 'COMBINED' && costVal === 0 && (parsedOwnFunds > 0 || parsedLoanFunds > 0)) {
      costVal = Math.floor(parsedOwnFunds + parsedLoanFunds);
    }

    if (robuxVal <= 0) {
      await showWarningAlert('Jumlah Robux Kosong', 'Masukkan jumlah Robux yang dibeli lebih dari 0.');
      return;
    }
    if (costVal <= 0) {
      await showWarningAlert('Biaya Beli Kosong', 'Masukkan total modal beli lebih dari 0.');
      return;
    }

    let finalOwnFunds = costVal;
    let finalLoanFunds = 0;

    if (fundingSource === 'LOAN') {
      finalOwnFunds = 0;
      finalLoanFunds = costVal;
      if (!lenderName.trim()) {
        await showWarningAlert('Nama Pemberi Pinjaman', 'Nama pemberi pinjaman / kreditor wajib diisi.');
        return;
      }
      if (!loanDueDate) {
        await showWarningAlert('Jatuh Tempo', 'Pilih tanggal jatuh tempo pengembalian pinjaman.');
        return;
      }
    } else if (fundingSource === 'COMBINED') {
      finalOwnFunds = Math.floor(parsedOwnFunds);
      finalLoanFunds = Math.floor(parsedLoanFunds);

      if (finalOwnFunds <= 0 || finalLoanFunds <= 0) {
        await showWarningAlert(
          'Rincian Modal Gabungan Belum Lengkap',
          'Untuk sumber dana gabungan, masukkan porsi uang ril kas dan porsi pinjaman modal masing-masing lebih dari Rp0.'
        );
        return;
      }

      if (finalOwnFunds + finalLoanFunds !== costVal) {
        await showWarningAlert(
          'Selisih Pembagian Modal',
          `Porsi uang ril (${formatRupiah(finalOwnFunds)}) + pinjaman (${formatRupiah(finalLoanFunds)}) = ${formatRupiah(finalOwnFunds + finalLoanFunds)}, tidak sama dengan Total Biaya Beli (${formatRupiah(costVal)}). Mohon sesuaikan nominalnya.`
        );
        return;
      }

      if (!lenderName.trim()) {
        await showWarningAlert('Nama Pemberi Pinjaman', 'Nama pemberi pinjaman / kreditor wajib diisi.');
        return;
      }
      if (!loanDueDate) {
        await showWarningAlert('Jatuh Tempo', 'Pilih tanggal jatuh tempo pengembalian pinjaman.');
        return;
      }
    }

    setIsSubmittingRestock(true);
    try {
      await repository.createRestockBatch({
        robux: robuxVal,
        totalCostRupiah: costVal,
        notes: restockNotes.trim() || undefined,
        fundingSource,
        ownFundsRupiah: finalOwnFunds,
        loanFundsRupiah: finalLoanFunds,
        loanDetails:
          fundingSource === 'LOAN' || fundingSource === 'COMBINED'
            ? {
                lenderName: lenderName.trim(),
                dueDate: loanDueDate,
                notes: loanNotes.trim() || undefined,
              }
            : undefined,
      });

      setRestockRobux('');
      setRestockCost('');
      setOwnFundsInput('');
      setLoanFundsInput('');
      setRestockNotes('');
      setTargetSellRate('');
      setFundingSource('OWN_FUNDS');
      setLenderName('');
      setLoanDueDate('');
      setLoanNotes('');
      playSuccessSound();
      await loadData();
      setActiveTab('batches');

      const successDetail =
        fundingSource === 'COMBINED'
          ? `Batch baru ${formatNumber(robuxVal)} R$ dengan sumber DANA GABUNGAN berhasil ditambahkan ke antrean FIFO.`
          : fundingSource === 'LOAN'
          ? `Batch baru ${formatNumber(robuxVal)} R$ dengan sumber dana Pinjaman (${lenderName.trim()}) berhasil ditambahkan ke antrean FIFO.`
          : `Batch baru ${formatNumber(robuxVal)} R$ seharga ${formatRupiah(costVal)} (Modal Rp${formatDecimal(costVal / robuxVal, 2)}/R$) berhasil ditambahkan ke antrean FIFO.`;

      await showSuccessAlert('Restock Berhasil Dicatat', successDetail);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal mencatat restock';
      await showErrorAlert('Gagal Menyimpan', msg);
    } finally {
      setIsSubmittingRestock(false);
    }
  };

  // Handler: Sisa Robux Akun Submit
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
      setShowReconcileModal(false);
      playSuccessSound();
      await loadData();
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

  // Handler: Pemakaian Pribadi (Prive) Submit
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
      setShowPriveModal(false);
      await loadData();
      playSuccessSound();
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

  // Handler: Sesuaikan Sisa / Tandai Habis Batch
  const handleAdjustBatchStock = async (batch: StockBatch) => {
    playTapSound();
    setOpenActionMenuBatchId(null);
    const res = await showCustomAlert({
      title: 'Kelola Stok Batch ' + batch.id,
      text: 'Sisa stok tercatat: ' + formatNumber(batch.remainingRobux) + ' R$. Apakah batch ini sudah habis total di akun Roblox atau masih tersisa sebagian?',
      showDenyButton: true,
      showCancelButton: true,
      confirmButtonText: 'Masih Tersisa (Sesuaikan)',
      denyButtonText: 'Habis Total (0 R$)',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#0ea5e9',
      denyButtonColor: '#ef4444',
    });

    if (res.isDenied) {
      try {
        await repository.closeBatchTotal(batch.id, 'Ditandai habis total oleh pengguna');
        playSuccessSound();
        await loadData();
        await showSuccessAlert('Batch Ditutup', 'Batch ' + batch.id + ' telah ditandai habis total (0 R$).');
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Gagal menutup batch';
        await showErrorAlert('Gagal', msg);
      }
    } else if (res.isConfirmed) {
      const { value: newAmount } = await showCustomAlert({
        title: 'Ketik Sisa Robux Ril',
        text: 'Berapa sisa Robux ril yang ada di akun saat ini? (Maksimal ' + formatNumber(batch.initialRobux) + ' R$):',
        input: 'number',
        inputValue: String(batch.remainingRobux),
        showCancelButton: true,
        confirmButtonText: 'Simpan Sisa Baru',
        cancelButtonText: 'Batal',
        inputValidator: (val) => {
          const n = parseInt(val, 10);
          if (isNaN(n) || n < 0) return 'Masukkan angka 0 atau lebih';
          if (n > batch.initialRobux) return 'Tidak boleh melebihi stok awal (' + batch.initialRobux + ' R$)';
          return null;
        },
      });

      if (newAmount !== undefined) {
        const parsed = parseInt(newAmount, 10);
        try {
          await repository.adjustBatchRemainingStock(batch.id, parsed, 'Penyesuaian sisa stok menjadi ' + parsed + ' R$');
          playSuccessSound();
          await loadData();
          await showSuccessAlert('Sisa Stok Disimpan', 'Sisa stok batch ' + batch.id + ' disesuaikan menjadi ' + formatNumber(parsed) + ' R$.');
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Gagal menyesuaikan stok';
          await showErrorAlert('Gagal', msg);
        }
      }
    }
  };

  // Handler: Hapus Batch
  const handleDeleteBatch = async (batch: StockBatch) => {
    setOpenActionMenuBatchId(null);
    if (batch.remainingRobux !== batch.initialRobux) {
      await showErrorAlert(
        'Tidak Dapat Dihapus',
        'Batch ini sudah memiliki transaksi penjualan atau pemakaian pribadi teralokasi. Hanya batch yang belum terpakai sama sekali yang boleh dihapus.'
      );
      return;
    }

    const ok = await showConfirmDialog({
      title: 'Hapus Batch Ini?',
      text: `Batch ${batch.id} (${formatNumber(batch.initialRobux)} R$) akan dihapus permanen. Jika ada catatan kas keluar/utang terkait, akan dibatalkan secara atomik. Lanjutkan?`,
      confirmButtonText: 'Ya, Hapus Permanen',
      isDanger: true,
    });
    if (!ok) return;

    try {
      await repository.deleteStockBatch(batch.id);
      playDeleteSound();
      await loadData();
      await showSuccessAlert('Batch Dihapus', 'Batch dan entri kas/utang terkait telah berhasil dihapus.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal menghapus batch';
      await showErrorAlert('Gagal Menghapus', msg);
    }
  };

  // Filtered Movements for Riwayat Terpadu
  const filteredHistory = useMemo(() => {
    return historyMovements.filter((m) => {
      if (historyFilterBatch && m.batchId !== historyFilterBatch) return false;
      if (historyFilterCategory !== 'ALL' && m.type !== historyFilterCategory) return false;
      if (historyStartDate && m.createdAt < historyStartDate) return false;
      if (historyEndDate) {
        const endDayNext = new Date(historyEndDate);
        endDayNext.setDate(endDayNext.getDate() + 1);
        if (new Date(m.createdAt) >= endDayNext) return false;
      }
      if (historySearch.trim()) {
        const q = historySearch.toLowerCase();
        const matchBatch = m.batchId?.toLowerCase().includes(q);
        const matchRef = m.referenceId?.toLowerCase().includes(q);
        const matchNotes = m.notes?.toLowerCase().includes(q);
        if (!matchBatch && !matchRef && !matchNotes) return false;
      }
      return true;
    });
  }, [historyMovements, historyFilterBatch, historyFilterCategory, historyStartDate, historyEndDate, historySearch]);

  const totalHistoryPages = Math.ceil(filteredHistory.length / historyPageSize) || 1;
  const paginatedHistory = useMemo(() => {
    const start = (historyPage - 1) * historyPageSize;
    return filteredHistory.slice(start, start + historyPageSize);
  }, [filteredHistory, historyPage, historyPageSize]);

  // Handler: Ekspor CSV Riwayat Terpadu
  const handleExportHistoryCsv = () => {
    if (filteredHistory.length === 0) {
      showWarningAlert('Tidak Ada Data', 'Tidak ada riwayat mutasi stok untuk diekspor pada filter ini.');
      return;
    }

    const headers = [
      'Waktu (WIB)',
      'ID Batch',
      'Jenis Mutasi',
      'Perubahan Robux',
      'Saldo Sisa Batch',
      'HPP/Biaya Terkait (Rp)',
      'Referensi Transaksi',
      'Catatan / Alasan',
    ];

    const rows = filteredHistory.map((m) => {
      const typeLabel =
        m.type === 'RESTOCK'
          ? 'Restock Kulakan'
          : m.type === 'SALE'
          ? 'Penjualan'
          : m.type === 'PERSONAL_USE'
          ? 'Pemakaian Pribadi (Prive)'
          : m.type === 'EDIT'
          ? 'Koreksi Robux'
          : m.type === 'RECONCILE_ADD'
          ? 'Sisa Robux Akun'
          : m.type;

      const deltaRobux =
        m.type === 'RESTOCK' || m.type === 'RECONCILE_ADD' || m.type === 'VOID_RESTORE'
          ? `+${m.robuxAmount}`
          : m.type === 'EDIT'
          ? `${m.robuxAmount >= 0 ? '+' : ''}${m.robuxAmount}`
          : `-${m.robuxAmount}`;

      return [
        `"${formatDateJakarta(m.createdAt)}"`,
        `"${m.batchId}"`,
        `"${typeLabel}"`,
        `"${deltaRobux}"`,
        m.balanceAfter !== undefined ? `"${m.balanceAfter}"` : '""',
        `"${m.costAllocatedRupiah || 0}"`,
        `"${m.referenceId || ''}"`,
        `"${(m.notes || '').replace(/"/g, '""')}"`,
      ].join(',');
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Riwayat_Stok_JufaStore_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    playTapSound();
  };

  // Batches terorganisir: Aktif vs Habis
  const activeBatchesList = useMemo(() => {
    return allBatches.filter((b) => b.remainingRobux > 0);
  }, [allBatches]);

  const depletedBatchesList = useMemo(() => {
    return allBatches.filter((b) => b.remainingRobux === 0);
  }, [allBatches]);

  return (
    <div className="space-y-4">
      {/* 1. Header Ringkasan Atas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <div className="p-3.5 rounded-2xl theme-bg-card border theme-border space-y-1">
          <span className="text-[11px] font-medium theme-text-muted flex items-center gap-1.5">
            <Coins size={13} className="text-amber-400" />
            <span>Total Stok Tersedia</span>
          </span>
          <div className="text-lg sm:text-xl font-bold font-mono text-amber-400">
            {formatNumber(summary.totalRemainingRobux)}{' '}
            <span className="text-xs font-normal theme-text-muted">R$</span>
          </div>
          <span className="text-[10px] theme-text-muted block">
            {summary.activeBatchCount} batch persediaan aktif
          </span>
        </div>

        <div className="p-3.5 rounded-2xl theme-bg-card border theme-border space-y-1">
          <span className="text-[11px] font-medium theme-text-muted flex items-center gap-1.5">
            <CreditCard size={13} className="text-emerald-500" />
            <span>Total Nilai Modal Sisa</span>
          </span>
          <div className="text-lg sm:text-xl font-bold font-mono text-emerald-500 dark:text-emerald-400">
            {formatRupiah(summary.totalRemainingCostRupiah)}
          </div>
          <span className="text-[10px] theme-text-muted block">
            Aset persediaan belum terjual
          </span>
        </div>

        <div className="p-3.5 rounded-2xl theme-bg-card border theme-border space-y-1">
          <span className="text-[11px] font-medium theme-text-muted flex items-center gap-1.5">
            <Zap size={13} className="text-sky-400" />
            <span>Rata-rata Modal</span>
          </span>
          <div className="text-lg sm:text-xl font-bold font-mono theme-text-primary">
            Rp{formatDecimal(summary.averageCostPerRobux, 2)}
          </div>
          <span className="text-[10px] theme-text-muted block">
            per 1 Robux (semua batch aktif)
          </span>
        </div>

        {/* Kartu Rate Jual Standar Saya */}
        <div className="p-3.5 rounded-2xl theme-bg-card border theme-border space-y-1 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium theme-text-muted flex items-center gap-1.5">
              <DollarSign size={13} className="text-cyan-400" />
              <span>Rate Jual Saya</span>
            </span>
            <button
              type="button"
              onClick={() => {
                playTapSound();
                setNewDefaultRateInput(defaultSellRate ? String(defaultSellRate) : '');
                setShowRateModal(true);
              }}
              className="text-[10px] font-semibold text-emerald-500 hover:underline min-h-[30px] flex items-center"
            >
              Ubah
            </button>
          </div>
          <div className="text-lg sm:text-xl font-bold font-mono text-cyan-400">
            {defaultSellRate !== undefined ? (
              <>Rp{formatDecimal(defaultSellRate, 2)} <span className="text-xs font-normal theme-text-muted">/ R$</span></>
            ) : (
              <span className="text-xs font-normal theme-text-muted italic">Belum diatur</span>
            )}
          </div>
          <span className="text-[10px] theme-text-muted block truncate">
            {defaultSellRate !== undefined ? 'Diisi otomatis di form jual' : 'Klik Ubah untuk menetapkan'}
          </span>
        </div>
      </div>

      {/* 2. Sub Tabs Navigation: MAKSIMAL 3 MENU & EQUAL WIDTH GRID (No Horizontal Scroll) */}
      <div className="grid grid-cols-3 gap-1 p-1 rounded-2xl theme-bg-surface border theme-border text-xs font-semibold">
        <button
          type="button"
          onClick={() => {
            playTapSound();
            setActiveTab('batches');
          }}
          className={`py-2 rounded-xl transition flex items-center justify-center gap-1.5 ${
            activeTab === 'batches'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'theme-text-secondary hover:theme-text-primary'
          }`}
        >
          <Layers size={14} />
          <span>Batch Aktif</span>
        </button>

        <button
          type="button"
          onClick={() => {
            playTapSound();
            setActiveTab('restock');
          }}
          className={`py-2 rounded-xl transition flex items-center justify-center gap-1.5 ${
            activeTab === 'restock'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'theme-text-secondary hover:theme-text-primary'
          }`}
        >
          <Plus size={14} />
          <span>Restock</span>
        </button>

        <button
          type="button"
          onClick={() => {
            playTapSound();
            setActiveTab('history');
          }}
          className={`py-2 rounded-xl transition flex items-center justify-center gap-1.5 ${
            activeTab === 'history'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'theme-text-secondary hover:theme-text-primary'
          }`}
        >
          <History size={14} />
          <span>Riwayat</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: BATCH AKTIF */}
      {/* ========================================================================= */}
      {activeTab === 'batches' && (
        <div className="space-y-3">
          {/* Action Row: Tombol Cepat Sisa Akun, Prive, dan Pinjaman Modal */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 pb-1">
            <div className="flex items-center gap-1.5 text-xs font-semibold theme-text-secondary">
              <Package size={14} className="text-emerald-500" />
              <span>Antrean Batch Persediaan FIFO</span>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => {
                  playTapSound();
                  setShowReconcileModal(true);
                }}
                className="px-2.5 py-1.5 rounded-xl text-xs font-medium theme-bg-card border theme-border hover:border-indigo-500/40 text-indigo-400 flex items-center gap-1.5 transition min-h-[36px]"
              >
                <Sliders size={13} />
                <span>+ Sisa Akun</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  playTapSound();
                  setShowPriveModal(true);
                }}
                className="px-2.5 py-1.5 rounded-xl text-xs font-medium theme-bg-card border theme-border hover:border-amber-500/40 text-amber-400 flex items-center gap-1.5 transition min-h-[36px]"
              >
                <UserCheck size={13} />
                <span>Pakai Pribadi</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  playTapSound();
                  setShowLoansModal(true);
                }}
                className="px-2.5 py-1.5 rounded-xl text-xs font-medium theme-bg-card border theme-border hover:border-emerald-500/40 theme-text-secondary flex items-center gap-1.5 transition min-h-[36px]"
              >
                <Landmark size={13} />
                <span>Pinjaman</span>
                {loans.filter((l) => l.status === 'ACTIVE').length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-500/20 text-amber-300 font-mono font-bold">
                    {loans.filter((l) => l.status === 'ACTIVE').length}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Daftar Batch Aktif */}
          {activeBatchesList.length === 0 ? (
            <div className="p-8 rounded-2xl theme-bg-card border theme-border text-center space-y-2">
              <Package size={32} className="mx-auto theme-text-muted opacity-40" />
              <p className="text-sm font-medium theme-text-primary">Belum Ada Stok Robux</p>
              <p className="text-xs theme-text-muted max-w-sm mx-auto">
                Persediaan masih kosong (0 R$). Buka tab "Restock" di atas untuk mencatat pembelian stok pertama Anda.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {activeBatchesList.map((batch, idx) => {
                const percentLeft = batch.initialRobux > 0 
                  ? Math.round((batch.remainingRobux / batch.initialRobux) * 100) 
                  : 0;

                // FIFO Queue Badge Label
                const queueBadge =
                  idx === 0
                    ? { label: 'Dijual lebih dulu', color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' }
                    : idx === 1
                    ? { label: 'Berikutnya', color: 'bg-sky-500/15 text-sky-400 border-sky-500/30' }
                    : { label: `Antrean #${idx + 1}`, color: 'bg-zinc-500/15 text-zinc-300 border-zinc-500/30' };

                return (
                  <div
                    key={batch.id}
                    className="p-3.5 sm:p-4 rounded-2xl theme-bg-card border theme-border hover:theme-bg-card-hover transition space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {/* FIFO Priority Badge */}
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${queueBadge.color}`}>
                            {queueBadge.label}
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
                            {batch.sourceType === 'RESTOCK' ? 'Restock' : 'Sisa Akun'}
                          </span>

                          {batch.fundingSource === 'LOAN' && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1">
                              <Landmark size={10} />
                              <span>Pinjaman</span>
                            </span>
                          )}
                          {batch.fundingSource === 'COMBINED' && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center gap-1">
                              <Layers size={10} />
                              <span>Gabungan</span>
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs theme-text-muted">
                          <span className="flex items-center gap-1">
                            <Calendar size={12} />
                            <span>{formatDateJakarta(batch.createdAt)}</span>
                          </span>
                          {batch.notes && <span>• {batch.notes}</span>}
                        </div>
                      </div>

                      {/* Angka Sisa Robux & Sisa Modal */}
                      <div className="flex items-center justify-between sm:justify-end gap-4 border-t sm:border-t-0 pt-2 sm:pt-0 theme-border-subtle">
                        <div>
                          <span className="text-[10px] theme-text-muted block">Sisa Robux</span>
                          <span className="font-mono text-sm font-bold text-amber-400">
                            {formatNumber(batch.remainingRobux)}{' '}
                            <span className="text-[10px] font-normal theme-text-muted">
                              / {formatNumber(batch.initialRobux)} R$
                            </span>
                          </span>
                          <div className="w-20 bg-zinc-200 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden mt-1">
                            <div
                              className="bg-amber-400 h-full rounded-full transition-all"
                              style={{ width: `${percentLeft}%` }}
                            />
                          </div>
                        </div>

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

                    {/* Tombol Aksi: Maks 2 tombol terlihat + Menu Overflow 3 Titik (44px Touch Target) */}
                    <div className="flex items-center justify-between pt-2 border-t theme-border-subtle">
                      <span className="text-[11px] theme-text-muted">
                        Modal Awal: {formatRupiah(batch.totalCostRupiah)}
                      </span>

                      <div className="flex items-center gap-1.5 relative" data-overflow-menu>
                        {/* Tombol 1: Edit (Unified Modal) */}
                        <button
                          type="button"
                          onClick={() => handleOpenEditBatch(batch)}
                          className="px-2.5 py-1.5 min-h-[38px] rounded-xl theme-bg-surface border theme-border hover:border-emerald-500/40 text-emerald-400 text-xs font-medium flex items-center gap-1.5 transition"
                        >
                          <Edit3 size={13} />
                          <span>Edit</span>
                        </button>

                        {/* Tombol 2: Sisa / Habis */}
                        <button
                          type="button"
                          onClick={() => handleAdjustBatchStock(batch)}
                          className="px-2.5 py-1.5 min-h-[38px] rounded-xl theme-bg-surface border border-amber-500/30 text-amber-400 hover:bg-amber-500/10 text-xs font-medium flex items-center gap-1.5 transition"
                        >
                          <CheckSquare size={13} />
                          <span>Sisa/Habis</span>
                        </button>

                        {/* Tombol 3-Dot Overflow Menu */}
                        <div className="relative">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              playTapSound();
                              setOpenActionMenuBatchId(openActionMenuBatchId === batch.id ? null : batch.id);
                            }}
                            className="p-2 min-h-[38px] min-w-[38px] rounded-xl theme-bg-surface border theme-border hover:theme-text-primary text-zinc-400 flex items-center justify-center transition"
                            title="Menu Lainnya"
                          >
                            <MoreVertical size={15} />
                          </button>

                          {/* Dropdown Menu */}
                          {openActionMenuBatchId === batch.id && (
                            <div className="absolute right-0 bottom-full mb-1 w-44 rounded-xl theme-bg-card border theme-border shadow-2xl py-1 z-30 text-xs font-medium space-y-0.5">
                              <button
                                type="button"
                                onClick={() => handleViewBatchHistory(batch.id)}
                                className="w-full px-3 py-2 text-left hover:theme-bg-surface flex items-center gap-2 theme-text-secondary hover:theme-text-primary transition min-h-[44px]"
                              >
                                <History size={14} className="text-sky-400" />
                                <span>Lihat Riwayat Batch</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteBatch(batch)}
                                disabled={batch.remainingRobux !== batch.initialRobux}
                                className={`w-full px-3 py-2 text-left flex items-center gap-2 transition min-h-[44px] ${
                                  batch.remainingRobux === batch.initialRobux
                                    ? 'hover:theme-bg-surface text-red-400'
                                    : 'opacity-40 cursor-not-allowed theme-text-muted'
                                }`}
                              >
                                <Trash2 size={14} />
                                <span>Hapus Batch</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Toggle Lipat / Buka Batch Habis */}
          {depletedBatchesList.length > 0 && (
            <div className="pt-2">
              <button
                type="button"
                onClick={() => {
                  playTapSound();
                  setShowDepletedBatches(!showDepletedBatches);
                }}
                className="w-full py-2.5 px-4 rounded-xl theme-bg-surface border theme-border text-xs font-semibold theme-text-secondary hover:theme-text-primary flex items-center justify-between transition min-h-[44px]"
              >
                <span className="flex items-center gap-2">
                  <Package size={14} className="text-zinc-500" />
                  <span>
                    {showDepletedBatches ? 'Sembunyikan' : 'Tampilkan'} Batch Habis ({depletedBatchesList.length})
                  </span>
                </span>
                {showDepletedBatches ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
              </button>

              {showDepletedBatches && (
                <div className="space-y-2 mt-2 opacity-75">
                  {depletedBatchesList.map((batch) => (
                    <div
                      key={batch.id}
                      className="p-3 rounded-xl theme-bg-surface border theme-border flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-zinc-500/10 text-zinc-400 border border-zinc-500/20">
                            Habis
                          </span>
                          <span className="font-mono font-bold theme-text-muted">{batch.id}</span>
                          <span className="text-[11px] theme-text-muted">
                            ({formatNumber(batch.initialRobux)} R$ • {formatRupiah(batch.totalCostRupiah)})
                          </span>
                        </div>
                        <span className="text-[10px] theme-text-muted block">
                          {formatDateJakarta(batch.createdAt)} {batch.notes ? `• ${batch.notes}` : ''}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleViewBatchHistory(batch.id)}
                        className="px-2.5 py-1.5 rounded-lg theme-bg-card border theme-border text-zinc-400 hover:text-sky-400 text-xs flex items-center gap-1 transition min-h-[36px]"
                      >
                        <History size={13} />
                        <span>Riwayat</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: RESTOCK BARU */}
      {/* ========================================================================= */}
      {activeTab === 'restock' && (
        <div className="p-4 sm:p-5 rounded-2xl theme-bg-card border theme-border space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b theme-border">
            <Plus size={16} className="text-emerald-500" />
            <h2 className="text-sm font-semibold theme-text-primary">Catat Pembelian Stok Baru (Restock)</h2>
          </div>

          <form onSubmit={handleRestockSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold theme-text-secondary block mb-1">
                  Jumlah Robux Dibeli *
                </label>
                <input
                  type="text"
                  value={restockRobux}
                  onChange={(e) => setRestockRobux(e.target.value)}
                  placeholder="Contoh: 1000 atau 1k"
                  className="w-full px-3.5 py-2.5 rounded-xl theme-bg-input border theme-border text-xs sm:text-sm theme-text-primary font-mono focus:border-emerald-500 outline-none transition"
                />
                {parsedRestockRobux > 0 && (
                  <span className="text-[11px] text-amber-400 font-mono mt-1 block">
                    = {formatNumber(parsedRestockRobux)} R$
                  </span>
                )}
              </div>

              <div>
                <label className="text-xs font-semibold theme-text-secondary block mb-1">
                  Total Biaya Beli (Rupiah Ril Keluar) *
                </label>
                <input
                  type="text"
                  value={restockCost}
                  onChange={(e) => setRestockCost(e.target.value)}
                  placeholder="Contoh: 150000 atau 150k"
                  className="w-full px-3.5 py-2.5 rounded-xl theme-bg-input border theme-border text-xs sm:text-sm theme-text-primary font-mono focus:border-emerald-500 outline-none transition"
                />
                {parsedRestockCost > 0 && (
                  <span className="text-[11px] text-emerald-400 font-mono mt-1 block">
                    = {formatRupiah(parsedRestockCost)}
                  </span>
                )}
              </div>
            </div>

            {/* Sumber Dana Restock */}
            <div className="space-y-2 pt-2 border-t theme-border">
              <label className="text-xs font-semibold theme-text-secondary block">
                Sumber Modal Pembelian:
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setFundingSource('OWN_FUNDS')}
                  className={`py-2 px-2 rounded-xl text-xs font-medium border text-center transition min-h-[44px] ${
                    fundingSource === 'OWN_FUNDS'
                      ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400 font-semibold shadow-sm'
                      : 'theme-border theme-bg-surface theme-text-muted hover:theme-text-primary'
                  }`}
                >
                  Kas Sendiri
                </button>
                <button
                  type="button"
                  onClick={() => setFundingSource('LOAN')}
                  className={`py-2 px-2 rounded-xl text-xs font-medium border text-center transition min-h-[44px] ${
                    fundingSource === 'LOAN'
                      ? 'border-amber-500 bg-amber-500/10 text-amber-400 font-semibold shadow-sm'
                      : 'theme-border theme-bg-surface theme-text-muted hover:theme-text-primary'
                  }`}
                >
                  Pinjaman/Utang
                </button>
                <button
                  type="button"
                  onClick={() => setFundingSource('COMBINED')}
                  className={`py-2 px-2 rounded-xl text-xs font-medium border text-center transition min-h-[44px] ${
                    fundingSource === 'COMBINED'
                      ? 'border-purple-500 bg-purple-500/10 text-purple-400 font-semibold shadow-sm'
                      : 'theme-border theme-bg-surface theme-text-muted hover:theme-text-primary'
                  }`}
                >
                  Gabungan
                </button>
              </div>

              {/* Rincian Sumber Dana Gabungan */}
              {fundingSource === 'COMBINED' && (
                <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 space-y-2.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="text-[11px] font-semibold text-purple-300 block mb-1">
                        Porsi Kas Sendiri (Rupiah) *
                      </label>
                      <input
                        type="text"
                        value={ownFundsInput}
                        onChange={(e) => setOwnFundsInput(e.target.value)}
                        placeholder="Contoh: 100000"
                        className="w-full px-3 py-2 rounded-lg theme-bg-input border theme-border text-xs theme-text-primary font-mono outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-purple-300 block mb-1">
                        Porsi Pinjaman Modal (Rupiah) *
                      </label>
                      <input
                        type="text"
                        value={loanFundsInput}
                        onChange={(e) => setLoanFundsInput(e.target.value)}
                        placeholder="Contoh: 50000"
                        className="w-full px-3 py-2 rounded-lg theme-bg-input border theme-border text-xs theme-text-primary font-mono outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Data Pinjaman jika LOAN atau COMBINED */}
              {(fundingSource === 'LOAN' || fundingSource === 'COMBINED') && (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 space-y-2.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="text-[11px] font-semibold text-amber-300 block mb-1">
                        Pemberi Pinjaman / Kreditor *
                      </label>
                      <input
                        type="text"
                        value={lenderName}
                        onChange={(e) => setLenderName(e.target.value)}
                        placeholder="Nama teman / rekan / bank"
                        className="w-full px-3 py-2 rounded-lg theme-bg-input border theme-border text-xs theme-text-primary outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-amber-300 block mb-1">
                        Jatuh Tempo Pengembalian *
                      </label>
                      <input
                        type="date"
                        value={loanDueDate}
                        onChange={(e) => setLoanDueDate(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg theme-bg-input border theme-border text-xs theme-text-primary outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="text-xs font-semibold theme-text-secondary block mb-1">
                Catatan Restock (Opsional)
              </label>
              <input
                type="text"
                value={restockNotes}
                onChange={(e) => setRestockNotes(e.target.value)}
                placeholder="Catatan tambahan batch ini"
                className="w-full px-3.5 py-2.5 rounded-xl theme-bg-input border theme-border text-xs sm:text-sm theme-text-primary outline-none transition"
              />
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={isSubmittingRestock}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-semibold transition shadow-md disabled:opacity-50 min-h-[44px] flex items-center gap-2"
              >
                <Plus size={15} />
                <span>{isSubmittingRestock ? 'Menyimpan...' : 'Simpan Batch Restock'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: RIWAYAT TERPADU (Movements & Prive) */}
      {/* ========================================================================= */}
      {activeTab === 'history' && (
        <div className="space-y-3.5">
          {/* Header & Filter Controls */}
          <div className="p-4 rounded-2xl theme-bg-card border theme-border space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold theme-text-primary flex items-center gap-2">
                  <History size={16} className="text-emerald-500" />
                  <span>Riwayat Mutasi Persediaan Lengkap</span>
                </h2>
                <p className="text-xs theme-text-muted mt-0.5">
                  Arus keluar-masuk stok Robux, penjualan, prive, dan koreksi FIFO.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleExportHistoryCsv}
                  className="px-3 py-2 rounded-xl text-xs font-medium theme-bg-surface border theme-border theme-text-secondary hover:theme-text-primary flex items-center gap-1.5 transition min-h-[38px]"
                >
                  <Download size={13} className="text-emerald-500" />
                  <span>Ekspor CSV</span>
                </button>
              </div>
            </div>

            {/* Filter Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 pt-2 border-t theme-border text-xs">
              {/* Kategori */}
              <div>
                <label className="text-[11px] theme-text-muted block mb-1">Jenis Mutasi:</label>
                <select
                  value={historyFilterCategory}
                  onChange={(e) => {
                    setHistoryFilterCategory(e.target.value);
                    setHistoryPage(1);
                  }}
                  className="w-full px-3 py-2 rounded-xl theme-bg-input border theme-border theme-text-primary outline-none"
                >
                  <option value="ALL">Semua Jenis</option>
                  <option value="RESTOCK">Restock Kulakan</option>
                  <option value="SALE">Penjualan Pelanggan</option>
                  <option value="PERSONAL_USE">Pemakaian Pribadi (Prive)</option>
                  <option value="EDIT">Koreksi Robux</option>
                  <option value="RECONCILE_ADD">Sisa Robux Akun</option>
                  <option value="VOID_RESTORE">Pengembalian / Void</option>
                </select>
              </div>

              {/* Tanggal Mulai */}
              <div>
                <label className="text-[11px] theme-text-muted block mb-1">Mulai Tanggal:</label>
                <input
                  type="date"
                  value={historyStartDate}
                  onChange={(e) => {
                    setHistoryStartDate(e.target.value);
                    setHistoryPage(1);
                  }}
                  className="w-full px-3 py-2 rounded-xl theme-bg-input border theme-border theme-text-primary outline-none"
                />
              </div>

              {/* Tanggal Sampai */}
              <div>
                <label className="text-[11px] theme-text-muted block mb-1">Sampai Tanggal:</label>
                <input
                  type="date"
                  value={historyEndDate}
                  onChange={(e) => {
                    setHistoryEndDate(e.target.value);
                    setHistoryPage(1);
                  }}
                  className="w-full px-3 py-2 rounded-xl theme-bg-input border theme-border theme-text-primary outline-none"
                />
              </div>

              {/* Pencarian */}
              <div>
                <label className="text-[11px] theme-text-muted block mb-1">Cari ID/Catatan:</label>
                <div className="relative">
                  <Search size={13} className="absolute left-3 top-2.5 text-zinc-400" />
                  <input
                    type="text"
                    value={historySearch}
                    onChange={(e) => {
                      setHistorySearch(e.target.value);
                      setHistoryPage(1);
                    }}
                    placeholder="ID batch/ref..."
                    className="w-full pl-8 pr-3 py-2 rounded-xl theme-bg-input border theme-border theme-text-primary outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Batch Filter Indicator */}
            {historyFilterBatch && (
              <div className="flex items-center justify-between p-2 rounded-xl bg-sky-500/10 border border-sky-500/20 text-xs text-sky-400">
                <span>Menampilkan mutasi untuk batch: <strong>{historyFilterBatch}</strong></span>
                <button
                  type="button"
                  onClick={() => setHistoryFilterBatch('')}
                  className="text-sky-300 hover:underline flex items-center gap-1"
                >
                  <X size={12} />
                  <span>Reset Filter Batch</span>
                </button>
              </div>
            )}
          </div>

          {/* List Mutasi Riwayat (Cards di mobile, Zero Horizontal Scroll) */}
          {isLoadingHistory ? (
            <div className="p-8 text-center text-xs theme-text-muted">Memuat riwayat stok...</div>
          ) : filteredHistory.length === 0 ? (
            <div className="p-8 rounded-2xl theme-bg-card border theme-border text-center space-y-1">
              <History size={28} className="mx-auto theme-text-muted opacity-40" />
              <p className="text-xs font-semibold theme-text-primary">Tidak Ada Riwayat</p>
              <p className="text-[11px] theme-text-muted">Belum ada mutasi stok sesuai filter yang dipilih.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {paginatedHistory.map((m) => {
                const isPositive =
                  m.type === 'RESTOCK' || m.type === 'RECONCILE_ADD' || m.type === 'VOID_RESTORE' ||
                  (m.type === 'EDIT' && m.robuxAmount >= 0);

                const typeBadge =
                  m.type === 'RESTOCK'
                    ? { label: 'Restock', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' }
                    : m.type === 'SALE'
                    ? { label: 'Penjualan', color: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' }
                    : m.type === 'PERSONAL_USE'
                    ? { label: 'Prive', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' }
                    : m.type === 'EDIT'
                    ? { label: 'Koreksi', color: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' }
                    : m.type === 'RECONCILE_ADD'
                    ? { label: 'Sisa Akun', color: 'bg-purple-500/10 text-purple-400 border-purple-500/20' }
                    : { label: m.type, color: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20' };

                return (
                  <div
                    key={m.id}
                    className="p-3 sm:p-3.5 rounded-xl theme-bg-card border theme-border flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${typeBadge.color}`}>
                          {typeBadge.label}
                        </span>
                        <span className="font-mono text-[11px] font-bold theme-text-secondary">
                          {m.batchId}
                        </span>
                        {m.referenceId && (
                          <span className="font-mono text-[10px] theme-text-muted">
                            • Ref: {m.referenceId}
                          </span>
                        )}
                      </div>

                      <div className="text-[11px] theme-text-muted flex flex-wrap items-center gap-x-2">
                        <span>{formatDateJakarta(m.createdAt)}</span>
                        {m.notes && <span>• {m.notes}</span>}
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-4 border-t sm:border-t-0 pt-1.5 sm:pt-0 theme-border-subtle">
                      <div className="text-left sm:text-right">
                        <span className="text-[10px] theme-text-muted block">Jumlah Robux</span>
                        <span className={`font-mono text-xs sm:text-sm font-bold ${isPositive ? 'text-emerald-400' : 'text-amber-400'}`}>
                          {isPositive ? `+${formatNumber(m.robuxAmount)}` : `-${formatNumber(m.robuxAmount)}`} R$
                        </span>
                      </div>

                      {m.balanceAfter !== undefined && (
                        <div className="text-right">
                          <span className="text-[10px] theme-text-muted block">Sisa di Batch</span>
                          <span className="font-mono text-xs sm:text-sm font-semibold theme-text-primary">
                            {formatNumber(m.balanceAfter)} R$
                          </span>
                        </div>
                      )}

                      {m.costAllocatedRupiah > 0 && (
                        <div className="text-right hidden sm:block">
                          <span className="text-[10px] theme-text-muted block">Nilai Modal</span>
                          <span className="font-mono text-xs theme-text-secondary">
                            {formatRupiah(m.costAllocatedRupiah)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Pagination */}
              {totalHistoryPages > 1 && (
                <div className="flex items-center justify-between pt-3 text-xs theme-text-secondary">
                  <span>
                    Halaman {historyPage} dari {totalHistoryPages} ({filteredHistory.length} mutasi)
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={historyPage <= 1}
                      onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                      className="px-3 py-1.5 rounded-lg theme-bg-card border theme-border disabled:opacity-40 min-h-[36px]"
                    >
                      Sebelumnya
                    </button>
                    <button
                      type="button"
                      disabled={historyPage >= totalHistoryPages}
                      onClick={() => setHistoryPage((p) => Math.min(totalHistoryPages, p + 1))}
                      className="px-3 py-1.5 rounded-lg theme-bg-card border theme-border disabled:opacity-40 min-h-[36px]"
                    >
                      Berikutnya
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: EDIT BATCH TERPADU (Jumlah Robux FIFO + Catatan) */}
      {/* ========================================================================= */}
      {editingBatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl theme-bg-card border theme-border shadow-2xl p-4 sm:p-5 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b theme-border">
              <div className="flex items-center gap-2">
                <Edit3 size={16} className="text-emerald-500" />
                <h3 className="text-sm font-bold theme-text-primary">
                  Edit Batch: <span className="font-mono text-emerald-400">{editingBatch.id}</span>
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingBatch(null)}
                className="p-1.5 rounded-lg text-zinc-400 hover:theme-text-primary transition min-h-[36px] min-w-[36px] flex items-center justify-center"
              >
                <X size={16} />
              </button>
            </div>

            {/* Tab Seksi Edit: Robux vs Catatan */}
            <div className="grid grid-cols-2 gap-1 p-1 rounded-xl theme-bg-surface border theme-border text-xs font-semibold">
              <button
                type="button"
                onClick={() => setEditActiveSection('ROBUX')}
                className={`py-1.5 rounded-lg transition ${
                  editActiveSection === 'ROBUX'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'theme-text-secondary hover:theme-text-primary'
                }`}
              >
                Jumlah Robux
              </button>
              <button
                type="button"
                onClick={() => setEditActiveSection('NOTES')}
                className={`py-1.5 rounded-lg transition ${
                  editActiveSection === 'NOTES'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'theme-text-secondary hover:theme-text-primary'
                }`}
              >
                Catatan Batch
              </button>
            </div>

            <form onSubmit={handleSaveUnifiedEdit} className="space-y-3.5">
              {editActiveSection === 'ROBUX' ? (
                <>
                  <div className="p-3 rounded-xl bg-zinc-500/10 border theme-border space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="theme-text-muted">Stok Awal Saat Ini:</span>
                      <span className="font-mono font-bold theme-text-primary">{formatNumber(editingBatch.initialRobux)} R$</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="theme-text-muted">Sudah Terjual/Terpakai:</span>
                      <span className="font-mono text-amber-400">
                        {formatNumber(editingBatch.initialRobux - editingBatch.remainingRobux)} R$
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="theme-text-muted">Total Modal Batch:</span>
                      <span className="font-mono theme-text-primary">{formatRupiah(editingBatch.totalCostRupiah)}</span>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold theme-text-secondary block mb-1">
                      Jumlah Robux Awal Baru *
                    </label>
                    <input
                      type="number"
                      value={editNewInitialRobux}
                      onChange={(e) => setEditNewInitialRobux(e.target.value)}
                      min={editingBatch.initialRobux - editingBatch.remainingRobux}
                      className="w-full px-3.5 py-2.5 rounded-xl theme-bg-input border theme-border text-xs sm:text-sm font-mono theme-text-primary outline-none focus:border-emerald-500 transition"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold theme-text-secondary block mb-1">
                      Mode Penyesuaian Modal FIFO:
                    </label>
                    <div className="space-y-1.5">
                      <label className="flex items-start gap-2 p-2 rounded-xl theme-bg-surface border theme-border cursor-pointer text-xs">
                        <input
                          type="radio"
                          name="costMode"
                          checked={editCostMode === 'KEEP_TOTAL_COST'}
                          onChange={() => setEditCostMode('KEEP_TOTAL_COST')}
                          className="mt-0.5 accent-emerald-500"
                        />
                        <div>
                          <span className="font-semibold theme-text-primary block">Pilihan A: Pertahankan Total Modal Batch</span>
                          <span className="text-[10px] theme-text-muted block">
                            Total modal tetap {formatRupiah(editingBatch.totalCostRupiah)}. Harga modal per unit disesuaikan otomatis.
                          </span>
                        </div>
                      </label>

                      <label className="flex items-start gap-2 p-2 rounded-xl theme-bg-surface border theme-border cursor-pointer text-xs">
                        <input
                          type="radio"
                          name="costMode"
                          checked={editCostMode === 'KEEP_UNIT_COST'}
                          onChange={() => setEditCostMode('KEEP_UNIT_COST')}
                          className="mt-0.5 accent-emerald-500"
                        />
                        <div>
                          <span className="font-semibold theme-text-primary block">Pilihan B: Pertahankan Harga Modal per Robux</span>
                          <span className="text-[10px] theme-text-muted block">
                            Harga modal tetap Rp{formatDecimal(editingBatch.unitCostDisplay, 2)}/R$. Total modal dan kas/utang bertambah/berkurang.
                          </span>
                        </div>
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold theme-text-secondary block mb-1">
                      Alasan Koreksi Jumlah *
                    </label>
                    <input
                      type="text"
                      value={editReason}
                      onChange={(e) => setEditReason(e.target.value)}
                      placeholder="Contoh: Salah ketik jumlah saat restock"
                      className="w-full px-3.5 py-2 rounded-xl theme-bg-input border theme-border text-xs theme-text-primary outline-none focus:border-emerald-500 transition"
                      required
                    />
                  </div>
                </>
              ) : (
                <div>
                  <label className="text-xs font-semibold theme-text-secondary block mb-1">
                    Catatan Batch
                  </label>
                  <textarea
                    rows={3}
                    value={editBatchNotes}
                    onChange={(e) => setEditBatchNotes(e.target.value)}
                    placeholder="Tulis catatan atau keterangan mengenai batch ini..."
                    className="w-full px-3.5 py-2 rounded-xl theme-bg-input border theme-border text-xs theme-text-primary outline-none focus:border-emerald-500 transition"
                  />
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t theme-border">
                <button
                  type="button"
                  onClick={() => setEditingBatch(null)}
                  className="px-4 py-2 rounded-xl theme-bg-surface border theme-border text-xs font-semibold theme-text-secondary hover:theme-text-primary min-h-[40px]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingEdit}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition disabled:opacity-50 min-h-[40px]"
                >
                  {isSubmittingEdit ? 'Menyimpan...' : 'Simpan Perubahan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: UBAH RATE JUAL STANDAR TOKO */}
      {/* ========================================================================= */}
      {showRateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl theme-bg-card border theme-border shadow-2xl p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b theme-border">
              <div className="flex items-center gap-2">
                <DollarSign size={16} className="text-cyan-400" />
                <h3 className="text-sm font-bold theme-text-primary">Rate Jual Standar Toko</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowRateModal(false)}
                className="p-1.5 rounded-lg text-zinc-400 hover:theme-text-primary min-h-[36px] min-w-[36px] flex items-center justify-center"
              >
                <X size={16} />
              </button>
            </div>

            <p className="text-xs theme-text-muted">
              Rate ini akan terisi otomatis saat membuka Catat Penjualan Cepat atau Kalkulator untuk mempercepat transaksi.
            </p>

            <form onSubmit={handleSaveDefaultRate} className="space-y-3.5">
              <div>
                <label className="text-xs font-semibold theme-text-secondary block mb-1">
                  Rate Jual Standar (Rp per 1 Robux) *
                </label>
                <input
                  type="number"
                  step="any"
                  value={newDefaultRateInput}
                  onChange={(e) => setNewDefaultRateInput(e.target.value)}
                  placeholder="Contoh: 160"
                  className="w-full px-3.5 py-2.5 rounded-xl theme-bg-input border theme-border text-sm font-mono theme-text-primary outline-none focus:border-cyan-400 transition"
                  required
                />
              </div>

              <div className="flex items-center justify-between pt-2 border-t theme-border">
                {defaultSellRate !== undefined ? (
                  <button
                    type="button"
                    onClick={handleClearDefaultRate}
                    className="text-xs text-red-400 hover:underline min-h-[36px] flex items-center"
                  >
                    Hapus Rate
                  </button>
                ) : <div />}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowRateModal(false)}
                    className="px-3.5 py-2 rounded-xl theme-bg-surface border theme-border text-xs font-semibold theme-text-secondary hover:theme-text-primary min-h-[38px]"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingRate}
                    className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold transition disabled:opacity-50 min-h-[38px]"
                  >
                    {isSavingRate ? 'Menyimpan...' : 'Simpan Rate'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: TAMBAH SISA ROBUX AKUN */}
      {/* ========================================================================= */}
      {showReconcileModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl theme-bg-card border theme-border shadow-2xl p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b theme-border">
              <div className="flex items-center gap-2">
                <Sliders size={16} className="text-indigo-400" />
                <h3 className="text-sm font-bold theme-text-primary">Catat Sisa Robux Akun</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowReconcileModal(false)}
                className="p-1.5 rounded-lg text-zinc-400 hover:theme-text-primary min-h-[36px] min-w-[36px] flex items-center justify-center"
              >
                <X size={16} />
              </button>
            </div>

            <p className="text-xs theme-text-muted">
              Menambahkan sisa Robux yang sudah ada di akun Roblox tanpa mencatat pengeluaran kas baru.
            </p>

            <form onSubmit={handleAccountRemainderSubmit} className="space-y-3">
              <div>
                <label className="text-xs font-semibold theme-text-secondary block mb-1">
                  Jumlah Robux di Akun *
                </label>
                <input
                  type="number"
                  value={accountRobux}
                  onChange={(e) => setAccountRobux(e.target.value)}
                  placeholder="Contoh: 500"
                  className="w-full px-3.5 py-2.5 rounded-xl theme-bg-input border theme-border text-xs sm:text-sm font-mono theme-text-primary outline-none focus:border-indigo-400 transition"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold theme-text-secondary block mb-1">
                  Modal per Robux (Boleh Rp0)
                </label>
                <input
                  type="number"
                  step="any"
                  value={accountModalPerRobux}
                  onChange={(e) => setAccountModalPerRobux(e.target.value)}
                  placeholder="Rp0 jika Robux gratis / sisa lama"
                  className="w-full px-3.5 py-2.5 rounded-xl theme-bg-input border theme-border text-xs sm:text-sm font-mono theme-text-primary outline-none focus:border-indigo-400 transition"
                />
              </div>

              <div>
                <label className="text-xs font-semibold theme-text-secondary block mb-1">
                  Catatan Sisa Akun (Opsional)
                </label>
                <input
                  type="text"
                  value={accountNotes}
                  onChange={(e) => setAccountNotes(e.target.value)}
                  placeholder="Sisa Robux Akun Roblox"
                  className="w-full px-3.5 py-2 rounded-xl theme-bg-input border theme-border text-xs theme-text-primary outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t theme-border">
                <button
                  type="button"
                  onClick={() => setShowReconcileModal(false)}
                  className="px-3.5 py-2 rounded-xl theme-bg-surface border theme-border text-xs font-semibold theme-text-secondary hover:theme-text-primary min-h-[38px]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingReconcile}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition disabled:opacity-50 min-h-[38px]"
                >
                  {isSubmittingReconcile ? 'Menyimpan...' : 'Tambahkan ke Stok'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: CATAT PEMAKAIAN PRIBADI (PRIVE) */}
      {/* ========================================================================= */}
      {showPriveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl theme-bg-card border theme-border shadow-2xl p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b theme-border">
              <div className="flex items-center gap-2">
                <UserCheck size={16} className="text-amber-400" />
                <h3 className="text-sm font-bold theme-text-primary">Catat Pemakaian Pribadi (Prive)</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowPriveModal(false)}
                className="p-1.5 rounded-lg text-zinc-400 hover:theme-text-primary min-h-[36px] min-w-[36px] flex items-center justify-center"
              >
                <X size={16} />
              </button>
            </div>

            <p className="text-xs theme-text-muted">
              Robux yang diambil pemilik untuk kebutuhan sendiri. Memotong antrean FIFO tanpa mengubah saldo kas dan tidak mengurangi laba bersih toko.
            </p>

            <form onSubmit={handlePersonalUsageSubmit} className="space-y-3">
              <div>
                <label className="text-xs font-semibold theme-text-secondary block mb-1">
                  Jumlah Robux Dipakai Sendiri *
                </label>
                <input
                  type="number"
                  value={priveRobux}
                  onChange={(e) => setPriveRobux(e.target.value)}
                  placeholder="Contoh: 100"
                  max={summary.totalRemainingRobux}
                  className="w-full px-3.5 py-2.5 rounded-xl theme-bg-input border theme-border text-xs sm:text-sm font-mono theme-text-primary outline-none focus:border-amber-400 transition"
                  required
                />
                <span className="text-[10px] theme-text-muted mt-1 block">
                  Stok tersedia: {formatNumber(summary.totalRemainingRobux)} R$
                </span>
              </div>

              <div>
                <label className="text-xs font-semibold theme-text-secondary block mb-1">
                  Keperluan / Catatan (Opsional)
                </label>
                <input
                  type="text"
                  value={priveNotes}
                  onChange={(e) => setPriveNotes(e.target.value)}
                  placeholder="Misal: beli avatar gamepass sendiri"
                  className="w-full px-3.5 py-2 rounded-xl theme-bg-input border theme-border text-xs theme-text-primary outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t theme-border">
                <button
                  type="button"
                  onClick={() => setShowPriveModal(false)}
                  className="px-3.5 py-2 rounded-xl theme-bg-surface border theme-border text-xs font-semibold theme-text-secondary hover:theme-text-primary min-h-[38px]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingPrive}
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold transition disabled:opacity-50 min-h-[38px]"
                >
                  {isSubmittingPrive ? 'Memotong...' : 'Catat Prive'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 5: PINJAMAN MODAL (LOANS) */}
      {/* ========================================================================= */}
      {showLoansModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl theme-bg-card border theme-border shadow-2xl p-4 sm:p-5 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b theme-border">
              <div className="flex items-center gap-2">
                <Landmark size={16} className="text-amber-400" />
                <h3 className="text-sm font-bold theme-text-primary">Daftar Pinjaman Modal Restock</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowLoansModal(false)}
                className="p-1.5 rounded-lg text-zinc-400 hover:theme-text-primary min-h-[36px] min-w-[36px] flex items-center justify-center"
              >
                <X size={16} />
              </button>
            </div>

            {loans.length === 0 ? (
              <div className="p-6 text-center text-xs theme-text-muted space-y-1">
                <Landmark size={24} className="mx-auto opacity-30" />
                <p>Belum ada pinjaman modal aktif.</p>
                <p className="text-[10px]">Pilih sumber dana 'Pinjaman' saat restock jika menggunakan modal utang.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {loans.map((loan) => (
                  <div key={loan.id} className="p-3 rounded-xl theme-bg-surface border theme-border space-y-1 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold theme-text-primary">{loan.borrowerOrLender}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        loan.status === 'ACTIVE'
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      }`}>
                        {loan.status === 'ACTIVE' ? 'Aktif' : 'Lunas'}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="theme-text-muted">Sisa Pokok Utang:</span>
                      <span className="font-mono font-bold text-amber-400">{formatRupiah(loan.remainingLoanRupiah)}</span>
                    </div>
                    <div className="flex justify-between text-[11px] theme-text-muted">
                      <span>Jatuh Tempo: {loan.dueDate}</span>
                      <span>Total Awal: {formatRupiah(loan.loanAmountRupiah)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end pt-2 border-t theme-border">
              <button
                type="button"
                onClick={() => setShowLoansModal(false)}
                className="px-4 py-2 rounded-xl theme-bg-surface border theme-border text-xs font-semibold theme-text-secondary hover:theme-text-primary min-h-[38px]"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
