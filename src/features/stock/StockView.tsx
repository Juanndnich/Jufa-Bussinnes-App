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
} from 'lucide-react';
import { repository } from '../../db/repository';
import { StockBatch, PersonalUsage, Loan } from '../../db/schema';
import { parseRobuxOrMoneyShorthand } from '../../domain/calculations';
import { formatRupiah, formatNumber, formatDecimal, formatDateJakarta } from '../../utils/formatters';
import { showSuccessAlert, showErrorAlert, showWarningAlert, showConfirmDialog, showCustomAlert } from '../../utils/alert';
import { playTapSound, playSuccessSound, playDeleteSound } from '../../utils/sound';
import { exportPersonalUsagesToCsv } from '../../utils/exportCsv';

export const StockView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'batches' | 'restock' | 'loans' | 'reconcile' | 'personal' | 'personal-history'>('batches');

  // Loans State
  const [loans, setLoans] = useState<Loan[]>([]);
  const [expandedLoanId, setExpandedLoanId] = useState<string | null>(null);

  // Form: Sumber Dana Restock (Dana Sendiri vs Pinjaman vs Gabungan Sekaligus)
  const [fundingSource, setFundingSource] = useState<'OWN_FUNDS' | 'LOAN' | 'COMBINED'>('OWN_FUNDS');
  const [ownFundsInput, setOwnFundsInput] = useState('');
  const [loanFundsInput, setLoanFundsInput] = useState('');
  const [lenderName, setLenderName] = useState('');
  const [loanDueDate, setLoanDueDate] = useState('');
  const [loanNotes, setLoanNotes] = useState('');

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
  const [targetSellRate, setTargetSellRate] = useState('');
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
      const [available, all, sum, usages, loanList] = await Promise.all([
        repository.getAvailableBatches(),
        repository.getAllBatches(),
        repository.getTotalStockSummary(),
        repository.getPersonalUsages(),
        repository.getLoans(),
      ]);
      setBatches(available);
      setAllBatches(all);
      setSummary(sum);
      setPersonalUsages(usages);
      setLoans(loanList);
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
          ? `Batch baru ${formatNumber(robuxVal)} R$ dengan sumber DANA GABUNGAN (Kas: ${formatRupiah(finalOwnFunds)} + Utang: ${formatRupiah(finalLoanFunds)}) berhasil ditambahkan ke antrean FIFO.`
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


  // Handler: Sesuaikan Sisa / Tandai Habis Batch
  const handleAdjustBatchStock = async (batch: StockBatch) => {
    playTapSound();
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
          await showSuccessAlert('Sisa Stok Diperbarui', 'Sisa stok batch ' + batch.id + ' berhasil disesuaikan menjadi ' + formatNumber(parsed) + ' R$.');
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Gagal memperbarui sisa stok';
          await showErrorAlert('Gagal', msg);
        }
      }
    }
  };

  // Handler: Bayar Cicilan Pinjaman Manual
  const handlePayLoanManual = async (loan: Loan) => {
    playTapSound();
    if (loan.remainingLoanRupiah <= 0) {
      await showWarningAlert('Sudah Lunas', 'Pinjaman ini sudah lunas sepenuhnya.');
      return;
    }

    const { value: amountStr } = await showCustomAlert({
      title: 'Bayar Cicilan Pinjaman',
      text: 'Sisa pokok utang ke ' + loan.borrowerOrLender + ': ' + formatRupiah(loan.remainingLoanRupiah) + '. Masukkan nominal pembayaran dari kas toko (Rp):',
      input: 'number',
      inputPlaceholder: '0',
      showCancelButton: true,
      confirmButtonText: 'Bayar Cicilan',
      cancelButtonText: 'Batal',
      inputValidator: (val) => {
        const n = parseInt(val, 10);
        if (isNaN(n) || n <= 0) return 'Masukkan nominal lebih dari Rp0';
        if (n > loan.remainingLoanRupiah) return 'Nominal melebihi sisa utang (' + formatRupiah(loan.remainingLoanRupiah) + ')';
        return null;
      },
    });

    if (amountStr) {
      const amount = parseInt(amountStr, 10);
      try {
        await repository.payLoanManual(loan.id, amount, 'Pembayaran cicilan utang ' + loan.borrowerOrLender);
        playSuccessSound();
        await loadData();
        await showSuccessAlert('Pembayaran Berhasil', 'Pembayaran ' + formatRupiah(amount) + ' untuk ' + loan.borrowerOrLender + ' berhasil dicatat di buku kas dan utang.');
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Gagal mencatat pembayaran';
        await showErrorAlert('Gagal', msg);
      }
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

  const parsedRestockRobux = useMemo(() => parseRobuxOrMoneyShorthand(restockRobux), [restockRobux]);
  const parsedRestockCost = useMemo(() => parseRobuxOrMoneyShorthand(restockCost), [restockCost]);
  const parsedOwnFunds = useMemo(() => parseRobuxOrMoneyShorthand(ownFundsInput), [ownFundsInput]);
  const parsedLoanFunds = useMemo(() => parseRobuxOrMoneyShorthand(loanFundsInput), [loanFundsInput]);
  const parsedTargetSellRate = useMemo(() => parseFloat(targetSellRate) || 0, [targetSellRate]);

  const calculatedRestockAvg = 
    parsedRestockRobux > 0 && parsedRestockCost > 0
      ? parsedRestockCost / parsedRestockRobux
      : 0;

  const simulationProjection = useMemo(() => {
    if (parsedRestockRobux <= 0 || parsedRestockCost <= 0 || parsedTargetSellRate <= 0) {
      return null;
    }
    const targetRevenue = Math.round(parsedRestockRobux * parsedTargetSellRate);
    const grossProfit = targetRevenue - parsedRestockCost;
    const profitPerRobux = parsedTargetSellRate - calculatedRestockAvg;
    const margin = targetRevenue > 0 ? (grossProfit / targetRevenue) * 100 : 0;

    return {
      targetRevenue,
      grossProfit,
      profitPerRobux,
      margin,
      isProfit: grossProfit > 0,
      isLoss: grossProfit < 0,
      isBreakEven: grossProfit === 0,
    };
  }, [parsedRestockRobux, parsedRestockCost, parsedTargetSellRate, calculatedRestockAvg]);

  // Rekomendasi Rate Jual Cerdas berdasarkan Modal Kulakan (Realita Pasar)
  const recommendedRateTiers = useMemo(() => {
    if (calculatedRestockAvg <= 0 || parsedRestockRobux <= 0 || parsedRestockCost <= 0) {
      return [];
    }

    // 1. Tier Kompetitif (Cepat Laku): ~6% di atas modal (min +Rp3)
    const competitiveRate = Math.max(
      Math.ceil(calculatedRestockAvg + 3),
      Math.round(calculatedRestockAvg * 1.06)
    );
    const competitiveProfit = Math.round(parsedRestockRobux * competitiveRate) - parsedRestockCost;
    const competitiveMargin =
      competitiveRate > 0
        ? ((competitiveRate - calculatedRestockAvg) / competitiveRate) * 100
        : 0;

    // 2. Tier Sedang (Standar Pasar): ~14% di atas modal (min +Rp8)
    const standardRate = Math.max(
      Math.ceil(calculatedRestockAvg + 8),
      Math.round(calculatedRestockAvg * 1.14)
    );
    const standardProfit = Math.round(parsedRestockRobux * standardRate) - parsedRestockCost;
    const standardMargin =
      standardRate > 0
        ? ((standardRate - calculatedRestockAvg) / standardRate) * 100
        : 0;

    // 3. Tier Santai (Margin Lebih): ~22% di atas modal (min +Rp15)
    const optimalRate = Math.max(
      Math.ceil(calculatedRestockAvg + 15),
      Math.round(calculatedRestockAvg * 1.22)
    );
    const optimalProfit = Math.round(parsedRestockRobux * optimalRate) - parsedRestockCost;
    const optimalMargin =
      optimalRate > 0
        ? ((optimalRate - calculatedRestockAvg) / optimalRate) * 100
        : 0;

    return [
      {
        id: 'fast',
        title: 'Cepat Laku (Kompetitif)',
        badge: 'Perputaran Kilat',
        badgeColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25',
        rate: competitiveRate,
        profitTotal: competitiveProfit,
        profitPerUnit: competitiveRate - calculatedRestockAvg,
        margin: competitiveMargin,
        desc: 'Cocok jika ingin cepat balik modal atau mengejar tanggal jatuh tempo pinjaman.',
      },
      {
        id: 'standard',
        title: 'Sedang (Standar Pasar)',
        badge: 'Paling Seimbang',
        badgeColor: 'bg-blue-500/10 text-blue-400 border-blue-500/25',
        rate: standardRate,
        profitTotal: standardProfit,
        profitPerUnit: standardRate - calculatedRestockAvg,
        margin: standardMargin,
        desc: 'Harga pas di pasaran, penjualan lancar tanpa banting harga, margin sehat.',
        isRecommended: true,
      },
      {
        id: 'relaxed',
        title: 'Santai (Margin Lebih)',
        badge: 'Untung Maksimal',
        badgeColor: 'bg-purple-500/10 text-purple-400 border-purple-500/25',
        rate: optimalRate,
        profitTotal: optimalProfit,
        profitPerUnit: optimalRate - calculatedRestockAvg,
        margin: optimalMargin,
        desc: 'Keuntungan lebih tebal, namun membutuhkan waktu penjualan lebih lama di pasar.',
      },
    ];
  }, [calculatedRestockAvg, parsedRestockRobux, parsedRestockCost]);

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
            setActiveTab('loans');
          }}
          className={`px-3.5 py-2 rounded-xl transition whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'loans'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'theme-text-secondary hover:theme-text-primary'
          }`}
        >
          <Landmark size={14} />
          <span>Pinjaman Modal</span>
          {loans.filter((l) => l.status === 'ACTIVE').length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-500/20 text-amber-300 font-mono font-bold">
              {loans.filter((l) => l.status === 'ACTIVE').length}
            </span>
          )}
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
                        {batch.fundingSource === 'LOAN' && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1">
                            <Landmark size={10} />
                            <span>Pinjaman Penuh</span>
                          </span>
                        )}
                        {batch.fundingSource === 'COMBINED' && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center gap-1">
                            <Layers size={10} />
                            <span>Gabungan (Kas + Pinjaman)</span>
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs theme-text-muted">
                        <span className="flex items-center gap-1">
                          <Calendar size={12} />
                          <span>{formatDateJakarta(batch.createdAt)}</span>
                        </span>
                        {batch.fundingSource === 'COMBINED' && (
                          <span className="text-[11px] text-purple-300 font-mono">
                            • Kas: {formatRupiah(batch.ownFundsRupiah || 0)} + Utang: {formatRupiah(batch.loanFundsRupiah || 0)}
                          </span>
                        )}
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

                      {/* Tombol Aksi Batch: Sesuaikan Sisa / Habis, Edit Catatan & Hapus */}
                      <div className="flex items-center gap-1.5 pl-3 border-l theme-border-subtle shrink-0">
                        <button
                          type="button"
                          onClick={() => handleAdjustBatchStock(batch)}
                          className="px-2 py-1.5 rounded-lg theme-bg-surface border border-amber-500/30 text-amber-400 hover:bg-amber-500/10 text-[11px] font-semibold flex items-center gap-1 transition"
                          title="Sesuaikan sisa stok akun atau tandai habis total"
                        >
                          <CheckSquare size={13} />
                          <span className="hidden md:inline">Sisa/Habis</span>
                        </button>

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
            Catat pembelian Robux dari supplier/kulakan ke antrean persediaan FIFO. Pilih apakah pembelian menggunakan uang kas toko sendiri atau dana pinjaman/utang modal.
          </p>

          {/* Pemilihan Sumber Dana Restock */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold theme-text-primary block">
              Sumber Dana Pembelian Stok
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => {
                  playTapSound();
                  setFundingSource('OWN_FUNDS');
                }}
                className={`p-3 rounded-xl border flex items-center gap-2.5 transition ${
                  fundingSource === 'OWN_FUNDS'
                    ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400 font-bold shadow-sm'
                    : 'theme-border theme-bg-surface theme-text-secondary hover:theme-text-primary'
                }`}
              >
                <DollarSign size={16} />
                <div className="text-left">
                  <span className="text-xs block">1. Dana Sendiri</span>
                  <span className="text-[10px] opacity-75 font-normal block">100% uang ril kas</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  playTapSound();
                  setFundingSource('LOAN');
                }}
                className={`p-3 rounded-xl border flex items-center gap-2.5 transition ${
                  fundingSource === 'LOAN'
                    ? 'border-amber-500 bg-amber-500/10 text-amber-400 font-bold shadow-sm'
                    : 'theme-border theme-bg-surface theme-text-secondary hover:theme-text-primary'
                }`}
              >
                <Landmark size={16} />
                <div className="text-left">
                  <span className="text-xs block">2. Pinjaman (Utang)</span>
                  <span className="text-[10px] opacity-75 font-normal block">100% utang modal</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  playTapSound();
                  setFundingSource('COMBINED');
                }}
                className={`p-3 rounded-xl border flex items-center gap-2.5 transition ${
                  fundingSource === 'COMBINED'
                    ? 'border-purple-500 bg-purple-500/10 text-purple-400 font-bold shadow-sm'
                    : 'theme-border theme-bg-surface theme-text-secondary hover:theme-text-primary'
                }`}
              >
                <Layers size={16} />
                <div className="text-left">
                  <span className="text-xs block">3. Gabungan (Kas + Utang)</span>
                  <span className="text-[10px] opacity-75 font-normal block">Sekali 2 dalam 1 restock</span>
                </div>
              </button>
            </div>
          </div>

          {/* Input Jumlah Robux */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium theme-text-secondary">
                Jumlah Robux yang Dibeli (R$)
              </label>
              {parsedRestockRobux > 0 && (
                <span className="text-[11px] font-mono font-bold text-amber-400">
                  {formatNumber(parsedRestockRobux)} R$
                </span>
              )}
            </div>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-amber-400">
                R$
              </span>
              <input
                type="text"
                placeholder="0"
                value={restockRobux}
                onChange={(e) => setRestockRobux(e.target.value)}
                className="w-full pl-11 pr-3 py-2.5 rounded-xl theme-bg-input border theme-border text-sm theme-text-primary focus:outline-none focus:border-emerald-500 font-mono font-bold"
                required
              />
            </div>
            <span className="text-[10px] theme-text-muted block">
              Mendukung ketikan langsung atau format cepat: contoh <span className="font-mono">1000</span>, <span className="font-mono">1k</span>, <span className="font-mono">5k</span>.
            </span>
          </div>

          {/* Input Biaya Beli / Pokok Pinjaman / Total Gabungan */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium theme-text-secondary">
                {fundingSource === 'COMBINED'
                  ? 'Total Biaya Modal Keseluruhan (Rp)'
                  : fundingSource === 'LOAN'
                  ? 'Jumlah Pokok Pinjaman Modal (Rp)'
                  : 'Total Uang Ril Dikeluarkan (Rp)'}
              </label>
              {parsedRestockCost > 0 && (
                <span
                  className={`text-[11px] font-mono font-bold ${
                    fundingSource === 'COMBINED'
                      ? 'text-purple-400'
                      : fundingSource === 'LOAN'
                      ? 'text-amber-400'
                      : 'text-emerald-400'
                  }`}
                >
                  {formatRupiah(parsedRestockCost)}
                </span>
              )}
            </div>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold theme-text-muted">
                Rp
              </span>
              <input
                type="text"
                placeholder="0"
                value={restockCost}
                onChange={(e) => setRestockCost(e.target.value)}
                className="w-full pl-10 pr-3 py-2.5 rounded-xl theme-bg-input border theme-border text-sm theme-text-primary focus:outline-none focus:border-emerald-500 font-mono font-bold"
                required
              />
            </div>
            <span className="text-[10px] theme-text-muted block">
              {fundingSource === 'COMBINED'
                ? 'Total nilai modal Robux yang dibeli (akan dibagi antara uang ril kas toko dan pinjaman modal).'
                : fundingSource === 'LOAN'
                ? 'Nominal pokok uang pinjaman yang harus dikembalikan kepada kreditor/pemberi pinjaman.'
                : 'Uang keluar ini akan otomatis memotong saldo kas toko di Buku Kas.'}
            </span>
          </div>

          {/* Form Pembagian Modal Jika Memilih Sumber Dana Gabungan */}
          {fundingSource === 'COMBINED' && (
            <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/25 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-1 pb-1 border-b border-purple-500/20">
                <div className="flex items-center gap-2 text-purple-400 font-bold text-xs">
                  <Layers size={15} />
                  <span>Rincian Pembagian Modal (Sekali 2: Uang Kas Ril + Pinjaman)</span>
                </div>
                {parsedRestockCost > 0 && (
                  <span className="text-[11px] font-mono font-bold text-purple-300">
                    Total: {formatRupiah(parsedRestockCost)}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Porsi Uang Ril (Kas Toko) */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold theme-text-primary flex items-center gap-1.5">
                      <DollarSign size={13} className="text-emerald-400" />
                      <span>Uang Ril / Kas Sendiri (Rp) <span className="text-red-400">*</span></span>
                    </label>
                    {parsedOwnFunds > 0 && (
                      <span className="text-[10px] font-mono font-bold text-emerald-400">
                        {formatRupiah(parsedOwnFunds)}
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-emerald-400">
                      Rp
                    </span>
                    <input
                      type="text"
                      placeholder="0"
                      value={ownFundsInput}
                      onChange={(e) => setOwnFundsInput(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 rounded-xl theme-bg-input border theme-border text-xs font-mono font-bold theme-text-primary focus:outline-none focus:border-emerald-500"
                      required={fundingSource === 'COMBINED'}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="theme-text-muted">Memotong kas toko</span>
                    {parsedRestockCost > 0 && parsedLoanFunds > 0 && parsedRestockCost > parsedLoanFunds && (
                      <button
                        type="button"
                        onClick={() => {
                          playTapSound();
                          setOwnFundsInput(String(parsedRestockCost - parsedLoanFunds));
                        }}
                        className="text-emerald-400 underline font-semibold"
                      >
                        Set Sisa ({formatRupiah(parsedRestockCost - parsedLoanFunds)})
                      </button>
                    )}
                  </div>
                </div>

                {/* Porsi Pinjaman Modal (Utang) */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold theme-text-primary flex items-center gap-1.5">
                      <Landmark size={13} className="text-amber-400" />
                      <span>Pinjaman Modal / Utang (Rp) <span className="text-red-400">*</span></span>
                    </label>
                    {parsedLoanFunds > 0 && (
                      <span className="text-[10px] font-mono font-bold text-amber-400">
                        {formatRupiah(parsedLoanFunds)}
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-amber-400">
                      Rp
                    </span>
                    <input
                      type="text"
                      placeholder="0"
                      value={loanFundsInput}
                      onChange={(e) => setLoanFundsInput(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 rounded-xl theme-bg-input border theme-border text-xs font-mono font-bold theme-text-primary focus:outline-none focus:border-amber-500"
                      required={fundingSource === 'COMBINED'}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="theme-text-muted">Masuk buku utang pinjaman</span>
                    {parsedRestockCost > 0 && parsedOwnFunds > 0 && parsedRestockCost > parsedOwnFunds && (
                      <button
                        type="button"
                        onClick={() => {
                          playTapSound();
                          setLoanFundsInput(String(parsedRestockCost - parsedOwnFunds));
                        }}
                        className="text-amber-400 underline font-semibold"
                      >
                        Set Sisa ({formatRupiah(parsedRestockCost - parsedOwnFunds)})
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Status Kesesuaian Total */}
              {parsedRestockCost > 0 && (
                <div
                  className={`p-2.5 rounded-xl border text-[11px] flex flex-wrap items-center justify-between gap-2 ${
                    parsedOwnFunds + parsedLoanFunds === parsedRestockCost
                      ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400'
                      : 'bg-amber-500/10 border-amber-500/25 text-amber-400'
                  }`}
                >
                  <span>
                    Kas: <strong>{formatRupiah(parsedOwnFunds)}</strong> + Pinjaman: <strong>{formatRupiah(parsedLoanFunds)}</strong> = <strong>{formatRupiah(parsedOwnFunds + parsedLoanFunds)}</strong>
                  </span>
                  <span className="font-bold">
                    {parsedOwnFunds + parsedLoanFunds === parsedRestockCost
                      ? '✓ Total Cocok'
                      : `Selisih: ${formatRupiah(Math.abs(parsedRestockCost - (parsedOwnFunds + parsedLoanFunds)))}`}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Form Informasi Kreditor Jika Ada Unsur Pinjaman */}
          {(fundingSource === 'LOAN' || fundingSource === 'COMBINED') && (
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 space-y-3">
              <div className="flex items-center gap-2 text-amber-400 font-bold text-xs pb-1 border-b border-amber-500/20">
                <Landmark size={15} />
                <span>
                  {fundingSource === 'COMBINED'
                    ? `Rincian Kreditor untuk Porsi Pinjaman (${formatRupiah(parsedLoanFunds)})`
                    : 'Rincian Informasi Pinjaman / Utang Modal'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium theme-text-secondary">
                    Pemberi Pinjaman / Kreditor <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: Nama Teman / Vendor A"
                    value={lenderName}
                    onChange={(e) => setLenderName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl theme-bg-input border theme-border text-xs theme-text-primary focus:outline-none focus:border-amber-500"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium theme-text-secondary">
                    Tanggal Jatuh Tempo <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="date"
                    value={loanDueDate}
                    onChange={(e) => setLoanDueDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl theme-bg-input border theme-border text-xs theme-text-primary focus:outline-none focus:border-amber-500 font-mono"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium theme-text-secondary">
                  Catatan / Kesepakatan Pinjaman
                </label>
                <input
                  type="text"
                  placeholder="Keterangan tambahan utang modal..."
                  value={loanNotes}
                  onChange={(e) => setLoanNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl theme-bg-input border theme-border text-xs theme-text-primary focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="text-[11px] theme-text-muted leading-relaxed pt-1">
                <strong>Cara Kerja Pelunasan Otomatis:</strong>{' '}
                {fundingSource === 'COMBINED'
                  ? `Kas toko Anda hanya dipotong sebesar porsi uang ril kas (${formatRupiah(parsedOwnFunds)}). Porsi pinjaman sebesar ${formatRupiah(parsedLoanFunds)} dicatat di buku pinjaman dan akan otomatis dicicil dari bagian modal HPP saat Robux batch ini terjual.`
                  : 'Kas toko saat ini tidak berkurang. Ketika Robux dari batch ini terjual, uang bagian modal HPP otomatis dialokasikan untuk melunasi sisa pokok pinjaman ini sampai lunas (Rp0). Laba kotor selebihnya adalah milik Anda & pemodal.'}
              </div>
            </div>
          )}

          {/* Analisis Modal Kulakan Batch Ini */}
          {calculatedRestockAvg > 0 && (
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                  Modal Kulakan Batch Ini:
                </span>
                <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-emerald-500/20 text-emerald-300">
                  Rate {formatDecimal(calculatedRestockAvg, 2)}
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-mono font-extrabold text-emerald-400">
                  Rp{formatDecimal(calculatedRestockAvg, 2)}
                </span>
                <span className="text-xs theme-text-secondary">per 1 Robux (Modal HPP)</span>
              </div>
              <p className="text-[11px] theme-text-muted">
                Artinya setiap 1 Robux Anda beli dengan modal <strong>Rp{formatDecimal(calculatedRestockAvg, 2)} per Robux</strong> (Total {formatNumber(parsedRestockRobux)} R$ senilai {formatRupiah(parsedRestockCost)}).
              </p>
            </div>
          )}

          {/* Rekomendasi Rate Jual Cerdas Berdasarkan Modal Kulakan (Realita Pasar) */}
          {recommendedRateTiers.length > 0 && (
            <div className="p-4 rounded-xl theme-bg-surface border theme-border space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pb-1 border-b theme-border">
                <div className="flex items-center gap-1.5">
                  <Zap size={15} className="text-amber-400" />
                  <span className="text-xs font-bold uppercase tracking-wider theme-text-primary">
                    Rekomendasi Rate Jual (Berdasarkan Modal Rp{formatDecimal(calculatedRestockAvg, 2)})
                  </span>
                </div>
                <span className="text-[11px] theme-text-muted">
                  Klik tombol pada kartu untuk simulasi otomatis
                </span>
              </div>

              {/* 3 Kartu Tingkat Rate */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {recommendedRateTiers.map((tier) => {
                  const isSelected = targetSellRate === String(tier.rate);
                  return (
                    <div
                      key={tier.id}
                      className={`p-3 rounded-xl border flex flex-col justify-between transition ${
                        isSelected
                          ? 'border-emerald-500 bg-emerald-500/10 shadow-sm'
                          : 'theme-border theme-bg-card hover:theme-bg-surface'
                      }`}
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-xs font-bold theme-text-primary truncate">
                            {tier.title}
                          </span>
                          <span
                            className={`px-1.5 py-0.5 rounded-md text-[9px] font-bold border ${tier.badgeColor}`}
                          >
                            {tier.badge}
                          </span>
                        </div>

                        <div className="flex items-baseline gap-1.5">
                          <span className="text-xl font-mono font-extrabold text-amber-400">
                            Rate {tier.rate}
                          </span>
                          <span className="text-[11px] font-mono text-emerald-400 font-bold">
                            (+{formatDecimal(tier.margin, 1)}%)
                          </span>
                        </div>

                        <div className="text-[11px] space-y-0.5 pt-1 border-t theme-border">
                          <div className="flex items-center justify-between">
                            <span className="theme-text-muted">Laba Batch:</span>
                            <span className="font-mono font-bold text-emerald-400">
                              +{formatRupiah(tier.profitTotal)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="theme-text-muted">Untung / R$:</span>
                            <span className="font-mono font-medium theme-text-secondary">
                              +Rp{formatDecimal(tier.profitPerUnit, 1)}
                            </span>
                          </div>
                        </div>

                        <p className="text-[10px] theme-text-muted leading-relaxed line-clamp-2">
                          {tier.desc}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          playTapSound();
                          setTargetSellRate(String(tier.rate));
                        }}
                        className={`w-full mt-3 py-1.5 px-2.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                          isSelected
                            ? 'bg-emerald-600 text-white shadow-sm'
                            : 'theme-bg-surface border theme-border hover:theme-bg-card theme-text-primary'
                        }`}
                      >
                        {isSelected ? (
                          <>
                            <Check size={12} />
                            <span>Sedang Dipilih</span>
                          </>
                        ) : (
                          <span>Gunakan Rate Ini</span>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Catatan Edukasi Pasar */}
              <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[11px] theme-text-secondary flex items-start gap-2">
                <Info size={14} className="text-amber-400 shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  <strong>Catatan Pasar:</strong> Robux dengan rate tinggi cenderung lebih sulit terjual karena persaingan harga yang ketat. Menggunakan <strong>Rate Cepat Laku atau Rate Sedang</strong> membantu perputaran stok tetap lancar sehingga modal dan utang pinjaman Anda dapat segera dilunasi.
                </p>
              </div>
            </div>
          )}

          {/* SIMULASI PROYEKSI LABA JUAL (Live Simulation) */}
          {calculatedRestockAvg > 0 && (
            <div className="p-4 rounded-xl theme-bg-surface border theme-border space-y-3">
              <div className="flex items-center gap-1.5">
                <Sparkles size={14} className="text-cyan-400" />
                <span className="text-xs font-bold uppercase tracking-wider theme-text-primary">
                  Simulasi Proyeksi Laba Jual (Berapa Rupiah Untungnya)
                </span>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium theme-text-secondary">
                  Target Rate Jual yang Anda Inginkan (Rp / R$)
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold theme-text-muted">
                    Rp
                  </span>
                  <input
                    type="number"
                    step="any"
                    inputMode="decimal"
                    placeholder="Ketik target rate jual (contoh: 140, 150...)"
                    value={targetSellRate}
                    onChange={(e) => setTargetSellRate(e.target.value)}
                    className="w-full pl-10 pr-3 py-2 rounded-xl theme-bg-input border theme-border text-xs theme-text-primary focus:outline-none focus:border-cyan-500 font-mono font-bold"
                  />
                </div>
              </div>

              {simulationProjection && (
                <div className="space-y-2 pt-1">
                  {simulationProjection.isProfit && (
                    <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs space-y-2">
                      <div className="flex items-center justify-between text-emerald-400 font-bold">
                        <span className="flex items-center gap-1">
                          <TrendingUp size={15} />
                          <span>Estimasi Keuntungan Toko (Laba Bersih Batch):</span>
                        </span>
                        <span className="text-sm font-mono font-extrabold">
                          +{formatRupiah(simulationProjection.grossProfit)}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 border-t border-emerald-500/20 text-[11px]">
                        <div>
                          <span className="theme-text-muted block">Target Omzet Jual:</span>
                          <span className="font-mono font-bold text-white dark:text-white theme-text-primary">
                            {formatRupiah(simulationProjection.targetRevenue)}
                          </span>
                        </div>
                        <div>
                          <span className="theme-text-muted block">Untung per 1 Robux:</span>
                          <span className="font-mono font-bold text-emerald-400">
                            +Rp{formatDecimal(simulationProjection.profitPerRobux, 2)} / R$
                          </span>
                        </div>
                        <div>
                          <span className="theme-text-muted block">Margin Untung:</span>
                          <span className="font-mono font-bold text-emerald-400">
                            +{formatDecimal(simulationProjection.margin, 1)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {simulationProjection.isBreakEven && (
                    <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-400">
                      Target rate sama dengan modal kulakan (Rp0 keuntungan, hanya balik modal).
                    </div>
                  )}

                  {simulationProjection.isLoss && (
                    <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-400 space-y-1">
                      <div className="flex items-center gap-1.5 font-bold">
                        <TrendingDown size={15} />
                        <span>Peringatan Bahaya Kerugian!</span>
                      </div>
                      <p className="text-[11px] leading-relaxed">
                        Target rate jual (Rate {targetSellRate}) lebih murah dari modal kulakan Anda (Rate {formatDecimal(calculatedRestockAvg, 2)}).
                        Jika Anda menjual di rate ini, Anda akan <strong>RUGI -{formatRupiah(Math.abs(simulationProjection.grossProfit))}</strong> (-Rp{formatDecimal(Math.abs(simulationProjection.profitPerRobux), 2)} per Robux). Jangan jual di bawah modal!
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

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
            disabled={isSubmittingRestock || parsedRestockRobux <= 0 || parsedRestockCost <= 0}
            className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition active:scale-98 shadow-md"
          >
            <CheckCircle2 size={17} />
            <span>{isSubmittingRestock ? 'Menyimpan...' : 'Simpan Restock ke FIFO'}</span>
          </button>
        </form>
      )}

      {/* TAB PINJAMAN MODAL (LOANS) */}
      {activeTab === 'loans' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b theme-border">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
                <Landmark size={20} />
              </div>
              <div>
                <h2 className="text-sm font-bold theme-text-primary tracking-tight">
                  Daftar Pinjaman & Utang Modal Restock
                </h2>
                <p className="text-xs theme-text-secondary">
                  Pantau pelunasan otomatis dari omzet penjualan FIFO dan cicilan manual
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                playTapSound();
                setFundingSource('LOAN');
                setActiveTab('restock');
              }}
              className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold flex items-center gap-1.5 transition shadow-sm self-start sm:self-auto"
            >
              <Plus size={14} />
              <span>Pinjaman Baru</span>
            </button>
          </div>

          {/* Metric Cards Pinjaman */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-4 rounded-2xl theme-bg-card border theme-border">
              <span className="text-xs theme-text-muted block">Total Pokok Pinjaman</span>
              <span className="text-xl font-mono font-extrabold theme-text-primary block mt-1">
                {formatRupiah(loans.reduce((acc, l) => acc + l.loanAmountRupiah, 0))}
              </span>
              <span className="text-[11px] theme-text-muted mt-1 block">
                {loans.length} Pinjaman Tercatat
              </span>
            </div>

            <div className="p-4 rounded-2xl theme-bg-card border theme-border">
              <span className="text-xs theme-text-muted block">Sisa Utang Belum Lunas</span>
              <span className="text-xl font-mono font-extrabold text-amber-400 block mt-1">
                {formatRupiah(loans.filter((l) => l.status === 'ACTIVE').reduce((acc, l) => acc + l.remainingLoanRupiah, 0))}
              </span>
              <span className="text-[11px] theme-text-muted mt-1 block">
                {loans.filter((l) => l.status === 'ACTIVE').length} Pinjaman Aktif
              </span>
            </div>

            <div className="p-4 rounded-2xl theme-bg-card border theme-border">
              <span className="text-xs theme-text-muted block">Total Sudah Terbayar</span>
              <span className="text-xl font-mono font-extrabold text-emerald-400 block mt-1">
                {formatRupiah(
                  loans.reduce((acc, l) => {
                    const paid = (l.payments || []).reduce((pAcc, p) => pAcc + p.amountRupiah, 0);
                    return acc + paid;
                  }, 0)
                )}
              </span>
              <span className="text-[11px] theme-text-muted mt-1 block">
                Otomatis dari Penjualan & Manual
              </span>
            </div>
          </div>

          {/* List Pinjaman */}
          {loans.length === 0 ? (
            <div className="p-8 rounded-2xl theme-bg-card border theme-border text-center space-y-2">
              <Landmark size={32} className="mx-auto theme-text-muted opacity-40" />
              <p className="text-sm font-medium theme-text-primary">Belum Ada Pinjaman Modal</p>
              <p className="text-xs theme-text-muted max-w-sm mx-auto">
                Jika Anda melakukan pembelian restock menggunakan dana pinjaman, data utang modal dan progres pelunasan otomatisnya akan tercatat rapi di sini.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {loans.map((loan) => {
                const totalPaid = (loan.payments || []).reduce((acc, p) => acc + p.amountRupiah, 0);
                const percentPaid = loan.loanAmountRupiah > 0 ? Math.min(100, Math.round((totalPaid / loan.loanAmountRupiah) * 100)) : 100;
                const isOverdue = loan.status === 'ACTIVE' && loan.dueDate && loan.dueDate < new Date().toISOString().substring(0, 10);
                const isExpanded = expandedLoanId === loan.id;

                return (
                  <div
                    key={loan.id}
                    className="p-4 rounded-2xl theme-bg-card border theme-border space-y-3 transition hover:border-amber-500/30"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b theme-border">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            loan.status === 'PAID'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : isOverdue
                              ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                              : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          }`}
                        >
                          {loan.status === 'PAID' ? 'Lunas' : isOverdue ? 'Jatuh Tempo Lewat' : 'Belum Lunas'}
                        </span>
                        <span className="text-xs font-mono font-bold theme-text-primary">
                          {loan.borrowerOrLender}
                        </span>
                        <span className="text-[11px] theme-text-muted font-mono">
                          ({loan.id})
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-xs theme-text-muted self-end sm:self-auto">
                        <span className="flex items-center gap-1">
                          <Clock size={12} />
                          <span>Tempo: {loan.dueDate || '-'}</span>
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <span className="text-[11px] theme-text-muted block">Pokok Pinjaman Awal</span>
                        <span className="text-base font-mono font-bold theme-text-primary block">
                          {formatRupiah(loan.loanAmountRupiah)}
                        </span>
                      </div>

                      <div>
                        <span className="text-[11px] theme-text-muted block">Sisa Pokok Utang</span>
                        <span className={`text-base font-mono font-bold block ${loan.remainingLoanRupiah > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                          {formatRupiah(loan.remainingLoanRupiah)}
                        </span>
                      </div>

                      <div>
                        <span className="text-[11px] theme-text-muted block">Terbayar ({percentPaid}%)</span>
                        <span className="text-base font-mono font-bold text-emerald-400 block">
                          {formatRupiah(totalPaid)}
                        </span>
                        <div className="w-full bg-zinc-200 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden mt-1">
                          <div
                            className="bg-emerald-400 h-full rounded-full transition-all"
                            style={{ width: `${percentPaid}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {loan.notes && (
                      <p className="text-xs theme-text-secondary bg-zinc-50 dark:bg-zinc-900/50 p-2.5 rounded-xl border theme-border">
                        {loan.notes}
                      </p>
                    )}

                    <div className="flex items-center justify-between pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          playTapSound();
                          setExpandedLoanId(isExpanded ? null : loan.id);
                        }}
                        className="text-xs font-semibold theme-text-secondary hover:theme-text-primary flex items-center gap-1.5 transition"
                      >
                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        <span>
                          {isExpanded ? 'Tutup Riwayat Pembayaran' : `Riwayat Pembayaran (${(loan.payments || []).length})`}
                        </span>
                      </button>

                      {loan.status === 'ACTIVE' && (
                        <button
                          type="button"
                          onClick={() => handlePayLoanManual(loan)}
                          className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold flex items-center gap-1.5 transition shadow-sm"
                        >
                          <CreditCard size={13} />
                          <span>Bayar Cicilan Manual</span>
                        </button>
                      )}
                    </div>

                    {/* Riwayat Pembayaran Detail */}
                    {isExpanded && (
                      <div className="mt-2 p-3 rounded-xl theme-bg-surface border theme-border space-y-2 text-xs">
                        <span className="text-[11px] font-bold uppercase tracking-wider theme-text-muted block">
                          Daftar Pembayaran Cicilan / Pelunasan:
                        </span>
                        {(!loan.payments || loan.payments.length === 0) ? (
                          <p className="text-xs theme-text-muted py-2 text-center">
                            Belum ada riwayat pembayaran. Pembayaran akan terisi otomatis saat Robux dari batch terkait terjual, atau jika Anda membayar cicilan manual.
                          </p>
                        ) : (
                          <div className="divide-y theme-border font-mono text-[11px]">
                            {loan.payments.map((p) => (
                              <div key={p.id} className="py-1.5 flex items-center justify-between">
                                <div className="space-y-0.5">
                                  <div className="flex items-center gap-1.5">
                                    <span
                                      className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                                        p.source === 'AUTO_SALE'
                                          ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                                          : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                      }`}
                                    >
                                      {p.source === 'AUTO_SALE' ? 'Auto Penjualan' : 'Manual'}
                                    </span>
                                    <span className="theme-text-primary font-sans">{p.notes || '-'}</span>
                                  </div>
                                  <span className="text-[10px] theme-text-muted font-sans">
                                    {formatDateJakarta(p.date)}
                                  </span>
                                </div>
                                <span className="font-bold text-emerald-400 text-xs">
                                  +{formatRupiah(p.amountRupiah)}
                                </span>
                              </div>
                            ))}
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
