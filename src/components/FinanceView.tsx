import React, { useMemo, useState } from 'react';
import {
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  Layers,
  ShieldCheck,
  CreditCard,
} from 'lucide-react';
import Swal from 'sweetalert2';
import { AppSettings, Cashflow, StockBatch, Transaction } from '../types';
import { addCashflow } from '../services/repository';
import { formatNumber, formatRupiah } from '../utils/formatters';

interface FinanceViewProps {
  cashflows: Cashflow[];
  transactions: Transaction[];
  batches: StockBatch[];
  settings: AppSettings;
  onRefreshData: () => Promise<void>;
}

export const FinanceView: React.FC<FinanceViewProps> = ({
  cashflows,
  transactions,
  batches,
  settings,
  onRefreshData,
}) => {
  const [showModal, setShowModal] = useState(false);
  const [cfType, setCfType] = useState<'IN' | 'OUT'>('OUT');
  const [cfCategory, setCfCategory] = useState<string>('BIAYA_OPERASIONAL');
  const [cfAmount, setCfAmount] = useState<number>(50000);
  const [cfPaymentMethod, setCfPaymentMethod] = useState<string>(settings.payment_methods[0] || 'BCA');
  const [cfNotes, setCfNotes] = useState<string>('');
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));

  const [selectedCatFilter, setSelectedCatFilter] = useState<string>('ALL');

  // Key Financial Metrics
  const totalCashIn = useMemo(() => {
    return cashflows.filter(c => c.type === 'IN').reduce((sum, c) => sum + c.amount, 0);
  }, [cashflows]);

  const totalCashOut = useMemo(() => {
    return cashflows.filter(c => c.type === 'OUT').reduce((sum, c) => sum + c.amount, 0);
  }, [cashflows]);

  const cashBalance = totalCashIn - totalCashOut;

  const totalReceivables = useMemo(() => {
    return transactions
      .filter(t => t.status === 'ACTIVE' && t.accounts_receivable > 0)
      .reduce((sum, t) => sum + t.accounts_receivable, 0);
  }, [transactions]);

  const totalPayables = useMemo(() => {
    return batches
      .filter(b => b.payment_status === 'BELUM_LUNAS')
      .reduce((sum, b) => sum + b.total_cost, 0);
  }, [batches]);

  const totalInventoryValue = useMemo(() => {
    return batches.reduce((sum, b) => sum + b.remaining_quantity * b.cost_per_unit, 0);
  }, [batches]);

  const totalBusinessAssets = cashBalance + totalInventoryValue + totalReceivables - totalPayables;

  const handleSaveCashflow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cfAmount <= 0) {
      Swal.fire({
        icon: 'error',
        title: 'Jumlah Tidak Valid',
        text: 'Nominal arus kas harus lebih dari Rp0!',
      });
      return;
    }

    try {
      await addCashflow({
        date: new Date(date).toISOString(),
        type: cfType,
        category: cfCategory,
        amount: cfAmount,
        payment_method: cfPaymentMethod,
        reference_id: 'MANUAL',
        notes: cfNotes.trim(),
      });

      await onRefreshData();
      setShowModal(false);
      setCfNotes('');

      Swal.fire({
        icon: 'success',
        title: 'Arus Kas Dicatat',
        text: 'Transaksi kas berhasil disimpan ke database SQLite.',
        timer: 1600,
        showConfirmButton: false,
      });
    } catch (err: any) {
      Swal.fire({
        icon: 'error',
        title: 'Gagal',
        text: err.message,
      });
    }
  };

  const filteredCashflows = useMemo(() => {
    if (selectedCatFilter === 'ALL') return cashflows;
    return cashflows.filter(c => c.category === selectedCatFilter);
  }, [cashflows, selectedCatFilter]);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#09090b] p-4 sm:p-5 rounded-2xl border border-white/10">
        <div>
          <h2 className="text-base sm:text-lg font-poppins font-bold text-white flex items-center gap-2">
            <Wallet className="text-white" size={20} />
            <span>Buku Kas & Manajemen Saldo</span>
          </h2>
          <p className="text-xs text-neutral-400 mt-1">
            Pemisahan tegas antara Saldo Kas, Nilai Aset Persediaan, Piutang Pelanggan, dan Laba Bersih.
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-white hover:bg-neutral-200 text-black text-xs font-bold transition shadow-sm w-full sm:w-auto"
        >
          <Plus size={14} />
          <span>+ Catat Kas Masuk / Keluar</span>
        </button>
      </div>

      {/* Balance Sheet Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Real Cash Balance */}
        <div className="bg-[#09090b] p-5 rounded-2xl border border-white/10">
          <div className="flex items-center justify-between text-zinc-400 text-xs mb-2">
            <span className="font-medium uppercase tracking-wider text-[11px]">Saldo Kas Riil</span>
            <span className="p-2 rounded-xl bg-white/5 border border-white/10 text-white">
              <Wallet size={15} />
            </span>
          </div>
          <div className="text-2xl font-bold font-mono text-white">{formatRupiah(cashBalance)}</div>
          <div className="text-[11px] text-zinc-400 mt-2 flex justify-between font-mono">
            <span className="text-emerald-400">Masuk: {formatRupiah(totalCashIn)}</span>
            <span className="text-rose-400">Keluar: {formatRupiah(totalCashOut)}</span>
          </div>
        </div>

        {/* Inventory Value */}
        <div className="bg-[#09090b] p-5 rounded-2xl border border-white/10">
          <div className="flex items-center justify-between text-zinc-400 text-xs mb-2">
            <span className="font-medium uppercase tracking-wider text-[11px]">Nilai Persediaan</span>
            <span className="p-2 rounded-xl bg-white/5 border border-white/10 text-zinc-300">
              <Layers size={15} />
            </span>
          </div>
          <div className="text-2xl font-bold font-mono text-zinc-200">
            {formatRupiah(totalInventoryValue)}
          </div>
          <div className="text-[11px] text-zinc-500 mt-2">
            Aset modal persediaan belum terjual
          </div>
        </div>

        {/* Accounts Receivable (Piutang) */}
        <div className="bg-[#09090b] p-5 rounded-2xl border border-white/10">
          <div className="flex items-center justify-between text-zinc-400 text-xs mb-2">
            <span className="font-medium uppercase tracking-wider text-[11px]">Piutang Pelanggan</span>
            <span className="p-2 rounded-xl bg-white/5 border border-white/10 text-white">
              <CreditCard size={15} />
            </span>
          </div>
          <div className="text-2xl font-bold font-mono text-white">
            {formatRupiah(totalReceivables)}
          </div>
          <div className="text-[11px] text-zinc-500 mt-2">
            Penjualan yang belum lunas
          </div>
        </div>

        {/* Total Net Business Asset */}
        <div className="bg-[#09090b] p-5 rounded-2xl border border-white/10">
          <div className="flex items-center justify-between text-zinc-400 text-xs mb-2">
            <span className="font-medium uppercase tracking-wider text-[11px]">Total Aset Bisnis</span>
            <span className="p-2 rounded-xl bg-white/5 border border-white/10 text-emerald-400">
              <ShieldCheck size={15} />
            </span>
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-400">
            {formatRupiah(totalBusinessAssets)}
          </div>
          <div className="text-[11px] text-zinc-500 mt-2 font-mono">
            Kas + Stok + Piutang − Utang
          </div>
        </div>
      </div>

      {/* Cashflow Table */}
      <div className="bg-[#09090b] p-6 rounded-2xl border border-white/10 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
          <div>
            <h3 className="font-heading font-bold text-white text-sm">Buku Kas & Riwayat Arus Kas</h3>
            <p className="text-xs text-zinc-400">
              Semua mutasi uang masuk dan keluar
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-400">Filter Kategori:</span>
            <select
              value={selectedCatFilter}
              onChange={e => setSelectedCatFilter(e.target.value)}
              className="bg-[#111114] border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white"
            >
              <option value="ALL">Semua Kategori</option>
              <option value="PENDAPATAN_PENJUALAN">Pendapatan Penjualan</option>
              <option value="PEMBELIAN_STOK">Pembelian Stok</option>
              <option value="BIAYA_TRANSAKSI">Biaya Transaksi</option>
              <option value="BIAYA_OPERASIONAL">Biaya Operasional</option>
              <option value="MODAL_AWAL">Modal Awal</option>
              <option value="PENAMBAHAN_MODAL">Penambahan Modal</option>
              <option value="PRIVE_PEMILIK">Prive Pemilik</option>
              <option value="PENGEMBALIAN_DANA">Pengembalian Dana</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto border border-white/10 rounded-xl">
          <table className="w-full text-left text-xs min-w-[750px]">
            <thead className="bg-[#111114] text-zinc-400 border-b border-white/10">
              <tr>
                <th className="p-3">Waktu</th>
                <th className="p-3">Arah Kas</th>
                <th className="p-3">Kategori</th>
                <th className="p-3 text-right">Nominal (Rp)</th>
                <th className="p-3">Metode</th>
                <th className="p-3">Keterangan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredCashflows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-zinc-500">
                    Belum ada catatan arus kas.
                  </td>
                </tr>
              ) : (
                filteredCashflows.map(cf => (
                  <tr key={cf.id} className="hover:bg-white/5 transition font-mono">
                    <td className="p-3 text-zinc-400 font-sans">{cf.date.slice(0, 16).replace('T', ' ')}</td>
                    <td className="p-3 font-semibold font-sans">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                          cf.type === 'IN'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                        }`}
                      >
                        {cf.type === 'IN' ? (
                          <>
                            <ArrowUpRight size={11} /> KAS MASUK
                          </>
                        ) : (
                          <>
                            <ArrowDownRight size={11} /> KAS KELUAR
                          </>
                        )}
                      </span>
                    </td>
                    <td className="p-3 text-white font-sans">{cf.category}</td>
                    <td
                      className={`p-3 text-right font-bold ${
                        cf.type === 'IN' ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {cf.type === 'IN' ? '+' : '-'}
                      {formatRupiah(cf.amount)}
                    </td>
                    <td className="p-3 text-zinc-300 font-sans">{cf.payment_method}</td>
                    <td className="p-3 text-zinc-300 font-sans">{cf.notes || cf.reference_id}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Manual Cashflow Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveCashflow}
            className="bg-[#09090b] border border-white/15 rounded-2xl max-w-md w-full p-6 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-sm font-heading font-bold text-white flex items-center gap-2">
                <Wallet size={16} />
                <span>Catat Arus Kas Manual</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-zinc-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-zinc-300 block mb-1">Jenis Kas</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setCfType('IN');
                      setCfCategory('PENAMBAHAN_MODAL');
                    }}
                    className={`py-2 rounded-xl text-xs font-bold border transition ${
                      cfType === 'IN'
                        ? 'bg-white text-black border-white'
                        : 'border-white/10 text-zinc-400 hover:text-white'
                    }`}
                  >
                    + Kas Masuk
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCfType('OUT');
                      setCfCategory('BIAYA_OPERASIONAL');
                    }}
                    className={`py-2 rounded-xl text-xs font-bold border transition ${
                      cfType === 'OUT'
                        ? 'bg-rose-500/20 border-rose-500 text-rose-300'
                        : 'border-white/10 text-zinc-400 hover:text-white'
                    }`}
                  >
                    − Kas Keluar
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-zinc-300 block mb-1">Tanggal</label>
                <input
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  className="w-full bg-[#111114] border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-medium text-zinc-300 block mb-1">Kategori</label>
                <select
                  value={cfCategory}
                  onChange={e => setCfCategory(e.target.value)}
                  className="w-full bg-[#111114] border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
                >
                  {cfType === 'IN' ? (
                    <>
                      <option value="PENAMBAHAN_MODAL">Penambahan Modal Pemilik</option>
                      <option value="MODAL_AWAL">Setoran Modal Awal</option>
                      <option value="PENERIMAAN_PIUTANG">Penerimaan Pelunasan Piutang</option>
                      <option value="PENYESUAIAN_KAS">Penyesuaian Saldo Kas (Plus)</option>
                    </>
                  ) : (
                    <>
                      <option value="BIAYA_OPERASIONAL">Biaya Operasional (Listrik, Wifi, Pulsa)</option>
                      <option value="PRIVE_PEMILIK">Prive Pemilik (Tarik Uang Pribadi)</option>
                      <option value="BIAYA_TRANSAKSI">Biaya Admin / Layanan Lain</option>
                      <option value="PEMBAYARAN_UTANG">Pembayaran Utang Supplier</option>
                      <option value="PENYESUAIAN_KAS">Penyesuaian Saldo Kas (Minus)</option>
                    </>
                  )}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-zinc-300 block mb-1">Nominal (Rp)</label>
                <input
                  type="number"
                  min="1"
                  value={cfAmount}
                  onChange={e => setCfAmount(Number(e.target.value))}
                  className="w-full bg-[#111114] border border-white/10 rounded-xl px-3 py-2 text-xs font-mono font-bold text-white focus:outline-none focus:border-white/30"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-medium text-zinc-300 block mb-1">
                  Metode Pembayaran
                </label>
                <select
                  value={cfPaymentMethod}
                  onChange={e => setCfPaymentMethod(e.target.value)}
                  className="w-full bg-[#111114] border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
                >
                  {settings.payment_methods.map(m => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-zinc-300 block mb-1">Keterangan</label>
                <textarea
                  rows={2}
                  placeholder="Misal: Biaya internet toko bulan ini, tarik prive..."
                  value={cfNotes}
                  onChange={e => setCfNotes(e.target.value)}
                  className="w-full bg-[#111114] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-white/30"
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-4 py-2 bg-[#18181b] text-zinc-300 text-xs font-semibold rounded-xl border border-white/10"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-white text-black text-xs font-bold rounded-xl hover:bg-zinc-200 transition"
              >
                Simpan Transaksi Kas
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
