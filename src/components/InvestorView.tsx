import React, { useMemo, useState } from 'react';
import {
  Users,
  Plus,
  Trash2,
  Edit2,
  DollarSign,
  TrendingUp,
  Clock,
  PieChart,
  Calendar,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import Swal from 'sweetalert2';
import { Investor, Transaction } from '../types';
import { addInvestor, deleteInvestor, updateInvestor } from '../services/repository';
import { formatNumber, formatRupiah } from '../utils/formatters';

interface InvestorViewProps {
  investors: Investor[];
  transactions: Transaction[];
  onRefreshData: () => Promise<void>;
}

export const InvestorView: React.FC<InvestorViewProps> = ({
  investors,
  transactions,
  onRefreshData,
}) => {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<'today' | '7days' | '30days' | 'thisMonth' | 'all'>('30days');
  const [selectedInvestorId, setSelectedInvestorId] = useState<string>(investors[0]?.id || '');

  // Form State
  const [form, setForm] = useState({
    name: '',
    invested_amount: 1000000,
    share_percentage: 50,
    duration_months: 6,
    start_date: new Date().toISOString().slice(0, 10),
    status: 'AKTIF' as const,
    notes: '',
  });

  // Calculate Real Business Profit for Selected Period
  const periodProfits = useMemo(() => {
    const now = new Date();
    let start = new Date();

    if (selectedPeriod === 'today') {
      start.setHours(0, 0, 0, 0);
    } else if (selectedPeriod === '7days') {
      start.setDate(now.getDate() - 7);
      start.setHours(0, 0, 0, 0);
    } else if (selectedPeriod === '30days') {
      start.setDate(now.getDate() - 30);
      start.setHours(0, 0, 0, 0);
    } else if (selectedPeriod === 'thisMonth') {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
    } else {
      start = new Date(1970, 0, 1);
    }

    const filtered = transactions.filter(t => {
      if (t.status === 'CANCELLED') return false;
      return new Date(t.date) >= start;
    });

    const totalRevenue = filtered.reduce((s, t) => s + (t.net_revenue || 0), 0);
    const totalCogs = filtered.reduce((s, t) => s + (t.cogs || 0), 0);
    const totalNetProfit = filtered.reduce((s, t) => s + (t.net_profit || 0), 0);
    const robuxSold = filtered.reduce((s, t) => s + (t.quantity || 0), 0);

    return { totalRevenue, totalCogs, totalNetProfit, robuxSold, count: filtered.length };
  }, [transactions, selectedPeriod]);

  // Selected Investor
  const currentInvestor = useMemo(() => {
    return investors.find(i => i.id === selectedInvestorId) || investors[0] || null;
  }, [investors, selectedInvestorId]);

  // Profit Sharing Calculation for Selected Investor
  const sharingSummary = useMemo(() => {
    if (!currentInvestor) {
      return {
        investorShare: 0,
        ownerShare: 0,
        investorPercent: 50,
        ownerPercent: 50,
        roiPercent: 0,
      };
    }

    const investorPercent = currentInvestor.share_percentage || 50;
    const ownerPercent = 100 - investorPercent;

    const baseProfit = Math.max(0, periodProfits.totalNetProfit);
    const investorShare = Math.round((baseProfit * investorPercent) / 100);
    const ownerShare = Math.round(baseProfit - investorShare);

    const roiPercent = currentInvestor.invested_amount > 0
      ? Number(((investorShare / currentInvestor.invested_amount) * 100).toFixed(2))
      : 0;

    return {
      investorShare,
      ownerShare,
      investorPercent,
      ownerPercent,
      roiPercent,
    };
  }, [currentInvestor, periodProfits]);

  // Handle Add Investor
  const handleSaveInvestor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      Swal.fire({ icon: 'warning', title: 'Nama Wajib Diisi' });
      return;
    }

    try {
      await addInvestor({
        name: form.name.trim(),
        invested_amount: Number(form.invested_amount),
        share_percentage: Number(form.share_percentage),
        duration_months: Number(form.duration_months),
        start_date: form.start_date,
        status: form.status,
        notes: form.notes.trim(),
      });

      await onRefreshData();
      setIsAddModalOpen(false);
      setForm({
        name: '',
        invested_amount: 1000000,
        share_percentage: 50,
        duration_months: 6,
        start_date: new Date().toISOString().slice(0, 10),
        status: 'AKTIF',
        notes: '',
      });

      Swal.fire({
        icon: 'success',
        title: 'Investor Ditambahkan',
        text: 'Data investasi dan pembagian hasil telah disimpan.',
        timer: 1600,
        showConfirmButton: false,
      });
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Gagal', text: err.message });
    }
  };

  // Handle Delete Investor
  const handleDeleteInvestor = async (id: string, name: string) => {
    const confirm = await Swal.fire({
      icon: 'warning',
      title: `Hapus Investor ${name}?`,
      text: 'Data kesepakatan investasi ini akan dihapus dari sistem.',
      showCancelButton: true,
      confirmButtonText: 'Ya, Hapus',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#e11d48',
    });

    if (!confirm.isConfirmed) return;

    try {
      await deleteInvestor(id);
      await onRefreshData();
      Swal.fire({ icon: 'success', title: 'Investor Dihapus', timer: 1400, showConfirmButton: false });
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Gagal Menghapus', text: err.message });
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b theme-border pb-4">
        <div>
          <h2 className="text-base sm:text-lg font-heading font-bold theme-text-primary flex items-center gap-2">
            <Users size={20} /> Manajemen Investor & Sistem Bagi Hasil (Profit Sharing)
          </h2>
          <p className="text-xs theme-text-secondary">
            Catat modal suntikan investor, jangka waktu, dan hitung otomatis pembagian laba bersih (misal 50% Pemilik : 50% Investor).
          </p>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-white hover:bg-neutral-200 text-black font-bold text-xs shadow-sm transition"
        >
          <Plus size={15} /> Tambah Investor Baru
        </button>
      </div>

      {investors.length === 0 ? (
        <div className="theme-bg-surface p-8 rounded-2xl border theme-border text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl theme-bg-card border theme-border flex items-center justify-center mx-auto theme-text-secondary">
            <Users size={24} />
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <h3 className="font-heading font-bold theme-text-primary text-sm">Belum Ada Investor Terdaftar</h3>
            <p className="text-xs theme-text-muted">
              Jika Anda memiliki rekanan atau pemodal yang menyuntikkan dana ke JUFA STORE, tambahkan profil investor untuk membagi hasil keuntungan secara adil dan transparan.
            </p>
          </div>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="px-4 py-2 rounded-xl bg-white text-black font-bold text-xs hover:bg-neutral-200 transition"
          >
            + Daftarkan Investor Pertama
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Daftar Investor */}
          <div className="theme-bg-surface p-5 sm:p-6 rounded-2xl border theme-border space-y-4">
            <div className="flex items-center justify-between border-b theme-border pb-2.5">
              <h3 className="font-heading font-bold theme-text-primary text-sm flex items-center gap-2">
                <Users size={16} /> Daftar Investor ({investors.length})
              </h3>
            </div>

            <div className="space-y-2.5">
              {investors.map(inv => {
                const isSelected = (currentInvestor?.id === inv.id);

                return (
                  <div
                    key={inv.id}
                    onClick={() => setSelectedInvestorId(inv.id)}
                    className={`p-3.5 rounded-xl border transition cursor-pointer flex items-center justify-between ${
                      isSelected
                        ? 'theme-bg-card theme-border ring-1 ring-white/20'
                        : 'theme-bg-input theme-border-subtle hover:theme-border'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <strong className="text-xs theme-text-primary">{inv.name}</strong>
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                            inv.status === 'AKTIF'
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'bg-zinc-500/20 text-zinc-400'
                          }`}
                        >
                          {inv.status}
                        </span>
                      </div>
                      <div className="text-[11px] theme-text-secondary mt-0.5 font-mono">
                        Modal: {formatRupiah(inv.invested_amount)} ({inv.share_percentage}% bagi hasil)
                      </div>
                      <div className="text-[10px] theme-text-muted mt-0.5 flex items-center gap-1">
                        <Clock size={11} /> Durasi: {inv.duration_months} Bulan (Mulai: {inv.start_date})
                      </div>
                    </div>

                    <button
                      onClick={e => {
                        e.stopPropagation();
                        handleDeleteInvestor(inv.id, inv.name);
                      }}
                      className="p-1.5 theme-text-muted hover:text-rose-400 rounded transition"
                      title="Hapus investor"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Kalkulasi Realtime Bagi Hasil */}
          <div className="lg:col-span-2 theme-bg-surface p-5 sm:p-6 rounded-2xl border theme-border space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b theme-border pb-3">
              <div>
                <h3 className="font-heading font-bold theme-text-primary text-sm flex items-center gap-2">
                  <PieChart size={16} /> Kalkulasi Pembagian Hasil: {currentInvestor?.name}
                </h3>
                <p className="text-xs theme-text-secondary mt-0.5">
                  Modal Pokok: <strong className="font-mono theme-text-primary">{formatRupiah(currentInvestor?.invested_amount || 0)}</strong> • Kesepakatan: {sharingSummary.investorPercent}% Investor : {sharingSummary.ownerPercent}% Toko
                </p>
              </div>

              {/* Filter Periode */}
              <select
                value={selectedPeriod}
                onChange={e => setSelectedPeriod(e.target.value as any)}
                className="theme-bg-card border theme-border rounded-xl px-3 py-1.5 text-xs theme-text-primary focus:outline-none"
              >
                <option value="today">Hari Ini</option>
                <option value="7days">7 Hari Terakhir</option>
                <option value="30days">30 Hari Terakhir</option>
                <option value="thisMonth">Bulan Berjalan</option>
                <option value="all">Seluruh Riwayat</option>
              </select>
            </div>

            {/* Metric Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="p-3.5 rounded-xl theme-bg-card border theme-border">
                <span className="text-[11px] theme-text-muted block">Omzet Periode</span>
                <strong className="text-sm font-mono theme-text-primary block mt-0.5">
                  {formatRupiah(periodProfits.totalRevenue)}
                </strong>
                <span className="text-[10px] theme-text-muted">
                  {formatNumber(periodProfits.robuxSold)} R$ terjual
                </span>
              </div>

              <div className="p-3.5 rounded-xl theme-bg-card border theme-border">
                <span className="text-[11px] theme-text-muted block">Modal HPP Robux</span>
                <strong className="text-sm font-mono text-rose-400 block mt-0.5">
                  -{formatRupiah(periodProfits.totalCogs)}
                </strong>
                <span className="text-[10px] theme-text-muted">Modal persediaan FIFO</span>
              </div>

              <div className="p-3.5 rounded-xl theme-bg-card border theme-border col-span-2 sm:col-span-1">
                <span className="text-[11px] theme-text-muted block">Total Laba Bersih</span>
                <strong className="text-sm font-mono text-emerald-400 block mt-0.5">
                  {formatRupiah(periodProfits.totalNetProfit)}
                </strong>
                <span className="text-[10px] theme-text-muted">Dasar pembagian hasil</span>
              </div>
            </div>

            {/* Split Result Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              {/* Hak Investor */}
              <div className="p-4 rounded-xl border border-cyan-500/30 bg-cyan-500/10 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-cyan-400">
                  <span>HAK INVESTOR ({sharingSummary.investorPercent}%)</span>
                  <DollarSign size={16} />
                </div>
                <div className="text-xl font-heading font-bold text-white font-mono">
                  {formatRupiah(sharingSummary.investorShare)}
                </div>
                <p className="text-[11px] theme-text-muted">
                  Estimasi ROI hasil laba terhadap modal pokok: <strong>{sharingSummary.roiPercent}%</strong>
                </p>
              </div>

              {/* Hak Pemilik Toko */}
              <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-emerald-400">
                  <span>HAK PEMILIK TOKO ({sharingSummary.ownerPercent}%)</span>
                  <TrendingUp size={16} />
                </div>
                <div className="text-xl font-heading font-bold text-white font-mono">
                  {formatRupiah(sharingSummary.ownerShare)}
                </div>
                <p className="text-[11px] theme-text-muted">
                  Laba bersih murni yang menjadi hak pengelola toko setelah bagi hasil.
                </p>
              </div>
            </div>

            {/* Notes */}
            {currentInvestor?.notes && (
              <div className="p-3.5 rounded-xl theme-bg-card border theme-border text-xs">
                <span className="font-bold theme-text-secondary block mb-1">Catatan Kesepakatan:</span>
                <p className="theme-text-primary leading-relaxed">{currentInvestor.notes}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal Tambah Investor */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <form
            onSubmit={handleSaveInvestor}
            className="theme-bg-surface border theme-border rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b theme-border pb-3">
              <h4 className="font-heading font-bold theme-text-primary text-base">
                Tambah Rekanan Investor Baru
              </h4>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="p-1.5 rounded-lg theme-text-muted hover:theme-text-primary theme-bg-card"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium theme-text-secondary block mb-1">
                  Nama Investor
                </label>
                <input
                  type="text"
                  placeholder="Misal: Bapak Rian / Investor A"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  className="w-full theme-bg-input border theme-border rounded-xl px-3 py-2 text-xs theme-text-primary focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-medium theme-text-secondary block mb-1">
                  Modal yang Disuntikkan (Rp)
                </label>
                <input
                  type="number"
                  min="0"
                  step="50000"
                  value={form.invested_amount}
                  onChange={e => setForm({ ...form, invested_amount: Number(e.target.value) })}
                  className="w-full theme-bg-input border theme-border rounded-xl px-3 py-2 text-xs font-mono font-bold theme-text-primary focus:outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium theme-text-secondary block mb-1">
                    Bagi Hasil Investor (%)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="99"
                    value={form.share_percentage}
                    onChange={e => setForm({ ...form, share_percentage: Number(e.target.value) })}
                    className="w-full theme-bg-input border theme-border rounded-xl px-3 py-2 text-xs font-mono font-bold theme-text-primary focus:outline-none"
                    required
                  />
                  <span className="text-[10px] theme-text-muted">
                    Toko: {100 - form.share_percentage}%
                  </span>
                </div>

                <div>
                  <label className="text-xs font-medium theme-text-secondary block mb-1">
                    Jangka Waktu (Bulan)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={form.duration_months}
                    onChange={e => setForm({ ...form, duration_months: Number(e.target.value) })}
                    className="w-full theme-bg-input border theme-border rounded-xl px-3 py-2 text-xs font-mono font-bold theme-text-primary focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium theme-text-secondary block mb-1">
                  Tanggal Mulai
                </label>
                <input
                  type="date"
                  value={form.start_date}
                  onChange={e => setForm({ ...form, start_date: e.target.value })}
                  className="w-full theme-bg-input border theme-border rounded-xl px-3 py-2 text-xs theme-text-primary focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-medium theme-text-secondary block mb-1">
                  Catatan Kesepakatan (Opsional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Misal: Modal dikembalikan di akhir periode, bagi hasil cair setiap akhir bulan..."
                  value={form.notes}
                  onChange={e => setForm({ ...form, notes: e.target.value })}
                  className="w-full theme-bg-input border theme-border rounded-xl px-3 py-2 text-xs theme-text-primary focus:outline-none"
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="px-4 py-2 rounded-xl theme-bg-input border theme-border text-xs font-bold theme-text-secondary hover:theme-text-primary"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-white text-black font-bold text-xs hover:bg-neutral-200 transition"
              >
                Simpan Investor
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
