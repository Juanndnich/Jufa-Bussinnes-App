import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  Plus,
  Coins,
  DollarSign,
  TrendingUp,
  Percent,
  Calendar,
  Trash2,
  Edit2,
  CheckCircle2,
  Calculator,
  ArrowRight,
  Send,
  PieChart,
  Wallet,
  Clock,
  UserCheck,
} from 'lucide-react';
import { repository } from '../../db/repository';
import { Investor, InvestorPayout } from '../../db/schema';
import { NumberInput } from '../../components/NumberInput';
import { formatRupiah, formatNumber, formatDecimal, formatDateJakarta } from '../../utils/formatters';
import { showSuccessAlert, showErrorAlert, showWarningAlert, showConfirmDialog } from '../../utils/alert';
import { playTapSound, playSuccessSound, playDeleteSound } from '../../utils/sound';

export const InvestorView: React.FC = () => {
  const [investors, setInvestors] = useState<Investor[]>([]);
  const [payouts, setPayouts] = useState<InvestorPayout[]>([]);
  const [dashboardSummary, setDashboardSummary] = useState({
    netProfit: 0,
    monthProfit: 0,
    totalGrossProfit: 0,
  });

  // Modal Tambah / Edit Investor
  const [showInvestorModal, setShowInvestorModal] = useState(false);
  const [editingInvestor, setEditingInvestor] = useState<Investor | null>(null);
  const [formName, setFormName] = useState('');
  const [formCapital, setFormCapital] = useState('');
  const [formPercentage, setFormPercentage] = useState('');
  const [formJoinDate, setFormJoinDate] = useState(() => new Date().toISOString().substring(0, 10));
  const [formNotes, setFormNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modal Penyaluran Bagi Hasil
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [payoutInvestorId, setPayoutInvestorId] = useState('');
  const [payoutAmount, setPayoutAmount] = useState('');
  const [payoutNotes, setPayoutNotes] = useState('');
  const [isSubmittingPayout, setIsSubmittingPayout] = useState(false);

  // Mode Simulasi Bagi Hasil: 'ALL' | 'MONTH' | 'CUSTOM'
  const [simulationMode, setSimulationMode] = useState<'ALL' | 'MONTH' | 'CUSTOM'>('ALL');
  const [customProfitInput, setCustomProfitInput] = useState('');

  const loadData = async () => {
    try {
      const [invList, payList, sum] = await Promise.all([
        repository.getInvestors(),
        repository.getInvestorPayouts(),
        repository.getDashboardSummary(),
      ]);
      setInvestors(invList);
      setPayouts(payList);
      setDashboardSummary({
        netProfit: sum.netProfit,
        monthProfit: sum.monthProfit,
        totalGrossProfit: sum.totalGrossProfit,
      });
    } catch (err) {
      console.error('Failed to load investor data:', err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Laba acuan untuk simulasi bagi hasil
  const referenceProfit = useMemo(() => {
    if (simulationMode === 'MONTH') {
      return Math.max(0, dashboardSummary.monthProfit);
    }
    if (simulationMode === 'CUSTOM') {
      return Math.max(0, Math.floor(parseFloat(customProfitInput) || 0));
    }
    return Math.max(0, dashboardSummary.netProfit);
  }, [simulationMode, dashboardSummary, customProfitInput]);

  // Total modal masuk dari seluruh investor
  const totalInvestorCapital = useMemo(() => {
    return investors.reduce((sum, inv) => sum + (inv.capitalAmountRupiah || 0), 0);
  }, [investors]);

  // Total persentase bagi hasil seluruh investor aktif
  const totalActivePercentage = useMemo(() => {
    return investors
      .filter((inv) => inv.status === 'ACTIVE')
      .reduce((sum, inv) => sum + (inv.sharePercentage || 0), 0);
  }, [investors]);

  // Total bagi hasil yang dialokasikan ke investor dari laba acuan
  const totalInvestorShare = useMemo(() => {
    return Math.floor((referenceProfit * totalActivePercentage) / 100);
  }, [referenceProfit, totalActivePercentage]);

  // Sisa laba bersih untuk pemilik toko
  const ownerShare = useMemo(() => {
    return referenceProfit - totalInvestorShare;
  }, [referenceProfit, totalInvestorShare]);

  // Total dividen/bagi hasil yang sudah pernah dibayarkan
  const totalPaidOut = useMemo(() => {
    return payouts.reduce((sum, p) => sum + (p.amountRupiah || 0), 0);
  }, [payouts]);

  // Payouts per investor
  const payoutsPerInvestor = useMemo(() => {
    const map: Record<string, number> = {};
    for (const p of payouts) {
      map[p.investorId] = (map[p.investorId] || 0) + p.amountRupiah;
    }
    return map;
  }, [payouts]);

  // Handler: Buka Modal Tambah Investor
  const handleOpenAddModal = () => {
    playTapSound();
    setEditingInvestor(null);
    setFormName('');
    setFormCapital('');
    setFormPercentage('');
    setFormJoinDate(new Date().toISOString().substring(0, 10));
    setFormNotes('');
    setShowInvestorModal(true);
  };

  // Handler: Buka Modal Edit Investor
  const handleOpenEditModal = (inv: Investor) => {
    playTapSound();
    setEditingInvestor(inv);
    setFormName(inv.name);
    setFormCapital(String(inv.capitalAmountRupiah));
    setFormPercentage(String(inv.sharePercentage));
    setFormJoinDate(inv.joinDate || new Date().toISOString().substring(0, 10));
    setFormNotes(inv.notes || '');
    setShowInvestorModal(true);
  };

  // Handler: Simpan Investor (Tambah / Edit)
  const handleSubmitInvestor = async (e: React.FormEvent) => {
    e.preventDefault();
    const nameTrim = formName.trim();
    const capitalVal = Math.floor(parseFloat(formCapital) || 0);
    const pctVal = parseFloat(formPercentage) || 0;

    if (!nameTrim) {
      await showWarningAlert('Nama Kosong', 'Masukkan nama investor.');
      return;
    }
    if (pctVal <= 0 || pctVal > 100) {
      await showWarningAlert('Persentase Tidak Valid', 'Persentase bagi hasil harus antara 0.1% s/d 100%.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingInvestor) {
        await repository.updateInvestor(editingInvestor.id, {
          name: nameTrim,
          capitalAmountRupiah: capitalVal,
          sharePercentage: pctVal,
          joinDate: formJoinDate,
          notes: formNotes.trim() || undefined,
        });
        playSuccessSound();
        await showSuccessAlert('Data Diperbarui', `Data investor "${nameTrim}" berhasil disimpan.`);
      } else {
        await repository.addInvestor({
          name: nameTrim,
          capitalAmountRupiah: capitalVal,
          sharePercentage: pctVal,
          joinDate: formJoinDate,
          status: 'ACTIVE',
          notes: formNotes.trim() || undefined,
        });
        playSuccessSound();
        await showSuccessAlert('Investor Ditambahkan', `Investor "${nameTrim}" berhasil dicatat ke sistem.`);
      }

      setShowInvestorModal(false);
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal menyimpan investor';
      await showErrorAlert('Gagal', msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handler: Hapus Investor
  const handleDeleteInvestor = async (inv: Investor) => {
    const ok = await showConfirmDialog({
      title: 'Hapus Investor Ini?',
      text: `Investor "${inv.name}" beserta riwayat penyaluran bagi hasilnya akan dihapus permanen.`,
      confirmButtonText: 'Ya, Hapus Investor',
      isDanger: true,
    });

    if (ok) {
      playDeleteSound();
      await repository.deleteInvestor(inv.id);
      await loadData();
      await showSuccessAlert('Investor Dihapus', `Data investor "${inv.name}" telah dihapus.`);
    }
  };

  // Handler: Toggle Status Investor
  const handleToggleStatus = async (inv: Investor) => {
    playTapSound();
    const nextStatus = inv.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    await repository.updateInvestor(inv.id, { status: nextStatus });
    await loadData();
  };

  // Handler: Buka Modal Penyaluran Bagi Hasil
  const handleOpenPayoutModal = (inv?: Investor) => {
    playTapSound();
    if (inv) {
      setPayoutInvestorId(inv.id);
      // Hitung otomatis estimasi pembagiannya
      const estShare = Math.floor((referenceProfit * inv.sharePercentage) / 100);
      setPayoutAmount(estShare > 0 ? String(estShare) : '');
      setPayoutNotes(`Bagi Hasil Periode ${new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}`);
    } else {
      setPayoutInvestorId(investors[0]?.id || '');
      setPayoutAmount('');
      setPayoutNotes('');
    }
    setShowPayoutModal(true);
  };

  // Handler: Simpan Penyaluran Bagi Hasil
  const handleSubmitPayout = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountVal = Math.floor(parseFloat(payoutAmount) || 0);
    const targetInv = investors.find((i) => i.id === payoutInvestorId);

    if (!targetInv) {
      await showWarningAlert('Pilih Investor', 'Pilih investor penerima bagi hasil.');
      return;
    }
    if (amountVal <= 0) {
      await showWarningAlert('Nominal Kosong', 'Masukkan jumlah uang bagi hasil lebih dari Rp0.');
      return;
    }

    setIsSubmittingPayout(true);
    try {
      await repository.recordInvestorPayout({
        investorId: targetInv.id,
        investorName: targetInv.name,
        amountRupiah: amountVal,
        periodNotes: payoutNotes.trim() || undefined,
      });

      playSuccessSound();
      setShowPayoutModal(false);
      setPayoutAmount('');
      setPayoutNotes('');
      await loadData();
      await showSuccessAlert(
        'Bagi Hasil Disalurkan',
        `Penyaluran ${formatRupiah(amountVal)} untuk ${targetInv.name} berhasil dicatat.`
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal mencatat bagi hasil';
      await showErrorAlert('Gagal', msg);
    } finally {
      setIsSubmittingPayout(false);
    }
  };

  // Handler: Hapus Riwayat Penyaluran
  const handleDeletePayout = async (payout: InvestorPayout) => {
    const ok = await showConfirmDialog({
      title: 'Hapus Riwayat Penyaluran?',
      text: `Catatan bagi hasil ${formatRupiah(payout.amountRupiah)} untuk ${payout.investorName} akan dihapus.`,
      confirmButtonText: 'Ya, Hapus',
      isDanger: true,
    });

    if (ok) {
      playDeleteSound();
      await repository.deleteInvestorPayout(payout.id);
      await loadData();
    }
  };

  return (
    <div className="space-y-5 max-w-4xl mx-auto pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b theme-border">
        <div className="flex items-center gap-2.5">
          <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-500 border border-purple-500/20">
            <Users size={20} />
          </div>
          <div>
            <h1 className="text-lg font-bold theme-text-primary tracking-tight">
              Investor & Pembagian Hasil
            </h1>
            <p className="text-xs theme-text-secondary">
              Pantau modal pemodal, simulasi bagi hasil laba bersih, dan pencatatan dividen
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {investors.length > 0 && (
            <button
              type="button"
              onClick={() => handleOpenPayoutModal()}
              className="px-3.5 py-2 rounded-xl theme-bg-card border theme-border hover:theme-bg-card-hover theme-text-primary text-xs font-semibold flex items-center gap-1.5 transition active:scale-98"
            >
              <Send size={14} className="text-emerald-500" />
              <span>Salurkan Bagi Hasil</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleOpenAddModal}
            className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 transition active:scale-98 shadow-sm"
          >
            <Plus size={15} />
            <span>Tambah Investor</span>
          </button>
        </div>
      </div>

      {/* 4 Kartu Metrik Ringkasan Investor */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl theme-bg-card border theme-border">
          <div className="flex items-center justify-between">
            <span className="text-xs theme-text-muted">Total Modal Investor</span>
            <span className="p-1 rounded-lg bg-purple-500/10 text-purple-400">
              <Wallet size={14} />
            </span>
          </div>
          <span className="text-xl font-mono font-extrabold theme-text-primary block mt-2">
            {formatRupiah(totalInvestorCapital)}
          </span>
          <span className="text-[10px] theme-text-muted mt-1 block">
            {investors.length} pemodal terdaftar
          </span>
        </div>

        <div className="p-4 rounded-2xl theme-bg-card border theme-border">
          <div className="flex items-center justify-between">
            <span className="text-xs theme-text-muted">Total Porsi Bagi Hasil</span>
            <span className="p-1 rounded-lg bg-blue-500/10 text-blue-400">
              <Percent size={14} />
            </span>
          </div>
          <span className="text-xl font-mono font-extrabold text-blue-500 dark:text-blue-400 block mt-2">
            {formatDecimal(totalActivePercentage, 1)}%
          </span>
          <span className="text-[10px] theme-text-muted mt-1 block">
            Sisa Pemilik Toko: {formatDecimal(Math.max(0, 100 - totalActivePercentage), 1)}%
          </span>
        </div>

        <div className="p-4 rounded-2xl theme-bg-card border theme-border">
          <div className="flex items-center justify-between">
            <span className="text-xs theme-text-muted">Estimasi Bagian Investor</span>
            <span className="p-1 rounded-lg bg-amber-500/10 text-amber-400">
              <PieChart size={14} />
            </span>
          </div>
          <span className="text-xl font-mono font-extrabold text-amber-500 dark:text-amber-400 block mt-2">
            {formatRupiah(totalInvestorShare)}
          </span>
          <span className="text-[10px] theme-text-muted mt-1 block">
            Dari laba acuan saat ini
          </span>
        </div>

        <div className="p-4 rounded-2xl theme-bg-card border theme-border">
          <div className="flex items-center justify-between">
            <span className="text-xs theme-text-muted">Total Dividen Dibayar</span>
            <span className="p-1 rounded-lg bg-emerald-500/10 text-emerald-400">
              <CheckCircle2 size={14} />
            </span>
          </div>
          <span className="text-xl font-mono font-extrabold text-emerald-500 dark:text-emerald-400 block mt-2">
            {formatRupiah(totalPaidOut)}
          </span>
          <span className="text-[10px] theme-text-muted mt-1 block">
            {payouts.length} kali penyaluran dividen
          </span>
        </div>
      </div>

      {/* Kalkulator & Simulator Pembagian Hasil Real-Time */}
      <div className="p-5 rounded-2xl theme-bg-card border theme-border space-y-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b theme-border">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
              <Calculator size={16} />
            </div>
            <div>
              <h2 className="text-sm font-bold theme-text-primary">
                Simulasi Pembagian Hasil Keuntungan
              </h2>
              <p className="text-[11px] theme-text-muted">
                Kalkulasi otomatis porsi keuntungan bersih untuk investor dan pemilik toko
              </p>
            </div>
          </div>

          {/* Mode Switcher */}
          <div className="flex items-center gap-1 p-1 rounded-xl theme-bg-surface border theme-border self-start sm:self-auto">
            <button
              type="button"
              onClick={() => {
                playTapSound();
                setSimulationMode('ALL');
              }}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                simulationMode === 'ALL'
                  ? 'theme-btn-primary shadow-sm'
                  : 'theme-text-secondary hover:theme-text-primary'
              }`}
            >
              Semua Waktu
            </button>
            <button
              type="button"
              onClick={() => {
                playTapSound();
                setSimulationMode('MONTH');
              }}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                simulationMode === 'MONTH'
                  ? 'theme-btn-primary shadow-sm'
                  : 'theme-text-secondary hover:theme-text-primary'
              }`}
            >
              Bulan Ini
            </button>
            <button
              type="button"
              onClick={() => {
                playTapSound();
                setSimulationMode('CUSTOM');
              }}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                simulationMode === 'CUSTOM'
                  ? 'theme-btn-primary shadow-sm'
                  : 'theme-text-secondary hover:theme-text-primary'
              }`}
            >
              Target Bebas
            </button>
          </div>
        </div>

        {/* Input Laba Kustom jika Mode Target Bebas */}
        {simulationMode === 'CUSTOM' && (
          <div className="p-3 rounded-xl theme-bg-surface border theme-border space-y-1.5 animate-in fade-in duration-150">
            <NumberInput
              label="Masukkan Target Laba Bersih yang Ingin Disimulasikan:"
              isCurrency={true}
              placeholder="Contoh: 1000000"
              value={customProfitInput === '' ? '' : parseInt(customProfitInput, 10)}
              onChange={(val) => setCustomProfitInput(val === '' ? '' : String(val))}
            />
          </div>
        )}

        {/* Kotak Gambaran Hasil Bagi Hasil */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="p-3.5 rounded-xl theme-bg-surface border theme-border space-y-1">
            <span className="text-[11px] theme-text-muted block">Laba Bersih Acuan:</span>
            <span className="text-lg font-mono font-bold text-emerald-500 dark:text-emerald-400 block">
              {formatRupiah(referenceProfit)}
            </span>
            <span className="text-[10px] theme-text-muted block">
              {simulationMode === 'MONTH'
                ? 'Laba bersih toko bulan berjalan'
                : simulationMode === 'CUSTOM'
                ? 'Target laba kustom yang Anda ketik'
                : 'Akumulasi laba bersih toko riil'}
            </span>
          </div>

          <div className="p-3.5 rounded-xl theme-bg-surface border theme-border space-y-1">
            <span className="text-[11px] theme-text-muted block">
              Bagian Seluruh Investor ({formatDecimal(totalActivePercentage, 1)}%):
            </span>
            <span className="text-lg font-mono font-bold text-amber-500 dark:text-amber-400 block">
              {formatRupiah(totalInvestorShare)}
            </span>
            <span className="text-[10px] theme-text-muted block">
              Total hak bagi hasil para pemodal
            </span>
          </div>

          <div className="p-3.5 rounded-xl theme-bg-surface border theme-border space-y-1">
            <span className="text-[11px] theme-text-muted block">
              Bagian Bersih Pemilik Toko ({formatDecimal(Math.max(0, 100 - totalActivePercentage), 1)}%):
            </span>
            <span className="text-lg font-mono font-bold theme-text-primary block">
              {formatRupiah(ownerShare)}
            </span>
            <span className="text-[10px] theme-text-muted block">
              Keuntungan bersih milik Anda setelah bagi hasil
            </span>
          </div>
        </div>
      </div>

      {/* Daftar Investor Aktif & Nonaktif */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold theme-text-primary flex items-center gap-2">
            <UserCheck size={16} className="text-purple-500" />
            <span>Daftar Pemodal / Investor ({investors.length})</span>
          </h2>
        </div>

        {investors.length === 0 ? (
          <div className="p-8 rounded-2xl theme-bg-card border theme-border text-center space-y-3">
            <Users size={36} className="mx-auto theme-text-muted opacity-40" />
            <div>
              <p className="text-sm font-semibold theme-text-primary">Belum Ada Investor Terdaftar</p>
              <p className="text-xs theme-text-muted max-w-sm mx-auto mt-1">
                Jika ada orang yang menanam modal di bisnis Robux Anda, catat di sini untuk menghitung bagi hasil secara transparan.
              </p>
            </div>
            <button
              type="button"
              onClick={handleOpenAddModal}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition"
            >
              <Plus size={14} />
              <span>Tambah Investor Pertama</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {investors.map((inv) => {
              const invShareAmount = Math.floor((referenceProfit * inv.sharePercentage) / 100);
              const alreadyPaid = payoutsPerInvestor[inv.id] || 0;

              return (
                <div
                  key={inv.id}
                  className="p-4 rounded-2xl theme-bg-card border theme-border flex flex-col justify-between space-y-3 shadow-sm"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold theme-text-primary text-sm">{inv.name}</span>
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(inv)}
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border transition ${
                            inv.status === 'ACTIVE'
                              ? 'bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 border-emerald-500/20'
                              : 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'
                          }`}
                        >
                          {inv.status === 'ACTIVE' ? 'Aktif' : 'Nonaktif'}
                        </button>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(inv)}
                          className="p-1.5 rounded-lg theme-text-muted hover:theme-text-primary hover:theme-bg-surface transition"
                          title="Edit Investor"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteInvestor(inv)}
                          className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition"
                          title="Hapus Investor"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2 rounded-xl theme-bg-surface border theme-border-subtle">
                        <span className="text-[10px] theme-text-muted block">Modal Masuk:</span>
                        <span className="font-mono font-bold theme-text-primary block mt-0.5">
                          {formatRupiah(inv.capitalAmountRupiah)}
                        </span>
                      </div>
                      <div className="p-2 rounded-xl theme-bg-surface border theme-border-subtle">
                        <span className="text-[10px] theme-text-muted block">Porsi Bagi Hasil:</span>
                        <span className="font-mono font-bold text-purple-500 dark:text-purple-400 block mt-0.5">
                          {inv.sharePercentage}%
                        </span>
                      </div>
                    </div>

                    {/* Rincian Hak Bagi Hasil & Dividen */}
                    <div className="space-y-1 pt-1 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="theme-text-muted">Hak Bagi Hasil Saat Ini:</span>
                        <span className="font-mono font-bold text-amber-500 dark:text-amber-400">
                          {formatRupiah(invShareAmount)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="theme-text-muted">Dividen Sudah Dibayar:</span>
                        <span className="font-mono font-medium text-emerald-500 dark:text-emerald-400">
                          {formatRupiah(alreadyPaid)}
                        </span>
                      </div>
                      {inv.notes && (
                        <p className="text-[11px] theme-text-muted italic pt-1 border-t theme-border-subtle">
                          Catatan: {inv.notes}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Tombol Salurkan Dividen Langsung */}
                  <button
                    type="button"
                    onClick={() => handleOpenPayoutModal(inv)}
                    className="w-full py-2 rounded-xl theme-bg-surface border theme-border hover:theme-bg-card text-xs font-semibold theme-text-primary flex items-center justify-center gap-1.5 transition active:scale-98"
                  >
                    <Send size={13} className="text-emerald-500" />
                    <span>Catat Penyaluran Bagi Hasil</span>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Riwayat Penyaluran Bagi Hasil (Dividen) */}
      {payouts.length > 0 && (
        <div className="p-4 sm:p-5 rounded-2xl theme-bg-card border theme-border space-y-3">
          <h2 className="text-xs font-bold theme-text-secondary uppercase tracking-wider flex items-center gap-2">
            <Clock size={14} className="theme-text-muted" />
            <span>Riwayat Penyaluran Dividen / Bagi Hasil</span>
          </h2>

          <div className="space-y-2">
            {payouts.map((p) => (
              <div
                key={p.id}
                className="p-3 rounded-xl theme-bg-surface border theme-border flex items-center justify-between gap-3 text-xs"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-bold theme-text-primary">{p.investorName}</span>
                    <span className="font-mono text-[10px] theme-text-muted">• {formatDateJakarta(p.createdAt)}</span>
                  </div>
                  {p.periodNotes && (
                    <span className="text-[11px] theme-text-muted block">{p.periodNotes}</span>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <span className="font-mono font-bold text-emerald-500 dark:text-emerald-400 text-sm">
                    {formatRupiah(p.amountRupiah)}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDeletePayout(p)}
                    className="p-1 rounded text-zinc-500 hover:text-red-400 transition"
                    title="Hapus Catatan Ini"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal Tambah / Edit Investor */}
      {showInvestorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
          <form
            onSubmit={handleSubmitInvestor}
            className="w-full max-w-md rounded-2xl theme-bg-card border theme-border p-5 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between pb-3 border-b theme-border">
              <h3 className="font-bold theme-text-primary text-base flex items-center gap-2">
                <Users size={18} className="text-purple-500" />
                <span>{editingInvestor ? 'Edit Data Investor' : 'Tambah Investor Baru'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowInvestorModal(false)}
                className="text-xs theme-text-muted hover:theme-text-primary"
              >
                Tutup
              </button>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-medium theme-text-secondary">
                  Nama Investor / Pemodal *
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Kevin, Investor #1"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl theme-bg-input border theme-border text-xs theme-text-primary focus:outline-none focus:border-purple-500 font-medium"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <NumberInput
                  label="Modal Masuk (Rp)"
                  isCurrency={true}
                  placeholder="0"
                  value={formCapital === '' ? '' : parseInt(formCapital, 10)}
                  onChange={(val) => setFormCapital(val === '' ? '' : String(val))}
                />

                <NumberInput
                  label="Bagi Hasil (%) *"
                  suffix="%"
                  allowDecimals={true}
                  maxDecimals={2}
                  placeholder="Contoh: 30"
                  value={formPercentage === '' ? '' : parseFloat(formPercentage)}
                  onChange={(val) => setFormPercentage(val === '' ? '' : String(val))}
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium theme-text-secondary">
                  Tanggal Bergabung
                </label>
                <input
                  type="date"
                  value={formJoinDate}
                  onChange={(e) => setFormJoinDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl theme-bg-input border theme-border text-xs theme-text-primary focus:outline-none focus:border-purple-500 font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium theme-text-secondary">
                  Catatan Kesepakatan (Opsional)
                </label>
                <input
                  type="text"
                  placeholder="Keterangan singkat..."
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl theme-bg-input border theme-border text-xs theme-text-primary focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t theme-border">
              <button
                type="button"
                onClick={() => setShowInvestorModal(false)}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl text-xs font-medium theme-text-secondary hover:theme-text-primary transition"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
              >
                {isSubmitting ? 'Menyimpan...' : 'Simpan Data'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal Penyaluran Bagi Hasil */}
      {showPayoutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
          <form
            onSubmit={handleSubmitPayout}
            className="w-full max-w-md rounded-2xl theme-bg-card border theme-border p-5 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between pb-3 border-b theme-border">
              <h3 className="font-bold theme-text-primary text-base flex items-center gap-2">
                <Send size={18} className="text-emerald-500" />
                <span>Catat Penyaluran Bagi Hasil</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowPayoutModal(false)}
                className="text-xs theme-text-muted hover:theme-text-primary"
              >
                Tutup
              </button>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-medium theme-text-secondary">
                  Pilih Investor Penerima *
                </label>
                <select
                  value={payoutInvestorId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setPayoutInvestorId(id);
                    const inv = investors.find((i) => i.id === id);
                    if (inv) {
                      const est = Math.floor((referenceProfit * inv.sharePercentage) / 100);
                      setPayoutAmount(est > 0 ? String(est) : '');
                    }
                  }}
                  className="w-full px-3 py-2 rounded-xl theme-bg-input border theme-border text-xs theme-text-primary focus:outline-none focus:border-emerald-500 font-medium"
                  required
                >
                  {investors.map((inv) => (
                    <option key={inv.id} value={inv.id}>
                      {inv.name} ({inv.sharePercentage}%)
                    </option>
                  ))}
                </select>
              </div>

              <NumberInput
                label="Nominal Uang Diserahkan (Rp) *"
                isCurrency={true}
                placeholder="0"
                value={payoutAmount === '' ? '' : parseInt(payoutAmount, 10)}
                onChange={(val) => setPayoutAmount(val === '' ? '' : String(val))}
                required
              />

              <div className="space-y-1">
                <label className="text-xs font-medium theme-text-secondary">
                  Keterangan Periode (Opsional)
                </label>
                <input
                  type="text"
                  placeholder="Misal: Bagi Hasil Bulan Oktober 2026"
                  value={payoutNotes}
                  onChange={(e) => setPayoutNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl theme-bg-input border theme-border text-xs theme-text-primary focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t theme-border">
              <button
                type="button"
                onClick={() => setShowPayoutModal(false)}
                disabled={isSubmittingPayout}
                className="px-4 py-2 rounded-xl text-xs font-medium theme-text-secondary hover:theme-text-primary transition"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isSubmittingPayout}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
              >
                {isSubmittingPayout ? 'Menyimpan...' : 'Simpan Pembagian'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
