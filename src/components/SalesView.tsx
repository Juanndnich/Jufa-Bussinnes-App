import React, { useMemo, useState } from 'react';
import {
  Plus,
  Trash2,
  Copy,
  Save,
  Search,
  Eye,
  XCircle,
  ArrowUpDown,
  ShoppingBag,
  FileSpreadsheet,
} from 'lucide-react';
import Swal from 'sweetalert2';
import { AppSettings, StockBatch, Transaction } from '../types';
import {
  cancelTransaction,
  saveMultipleTransactions,
  TransactionInput,
} from '../services/repository';
import { formatDecimal, formatNumber, formatRupiah } from '../utils/formatters';
import {
  allocateStockFIFO,
  calculateTransactionFinancials,
  calculateWeightedAverageRate,
  safeDivide,
} from '../utils/calculations';

interface SalesViewProps {
  transactions: Transaction[];
  batches: StockBatch[];
  settings: AppSettings;
  onRefreshData: () => Promise<void>;
}

interface MultiRowState {
  id: string;
  customer_name: string;
  quantity: number;
  sell_rate: number;
  discount: number;
  fee: number;
  payment_method: string;
  amount_paid: number;
  delivery_status: 'SELESAI' | 'SEBAGIAN' | 'BELUM_DIKIRIM';
  source: string;
  notes: string;
}

export const SalesView: React.FC<SalesViewProps> = ({
  transactions,
  batches,
  settings,
  onRefreshData,
}) => {
  const [activeMode, setActiveMode] = useState<'single' | 'multi'>('single');

  // Single Transaction Form State (Clean Initial)
  const [singleForm, setSingleForm] = useState<{
    date: string;
    customer_name: string;
    quantity: number;
    sell_rate: number;
    discount: number;
    fee: number;
    payment_method: string;
    amount_paid: number;
    delivery_status: 'SELESAI' | 'SEBAGIAN' | 'BELUM_DIKIRIM';
    source: string;
    notes: string;
  }>({
    date: new Date().toISOString().slice(0, 16),
    customer_name: '',
    quantity: 100,
    sell_rate: settings.default_rate || 165,
    discount: 0,
    fee: 0,
    payment_method: settings.payment_methods[0] || 'BCA',
    amount_paid: 100 * (settings.default_rate || 165),
    delivery_status: 'SELESAI',
    source: settings.sales_sources[0] || 'WhatsApp',
    notes: '',
  });

  // Multi Transaction Form State (Clean Blank Row)
  const [multiRows, setMultiRows] = useState<MultiRowState[]>([
    {
      id: 'row_' + Date.now(),
      customer_name: '',
      quantity: 100,
      sell_rate: settings.default_rate || 165,
      discount: 0,
      fee: 0,
      payment_method: settings.payment_methods[0] || 'BCA',
      amount_paid: 100 * (settings.default_rate || 165),
      delivery_status: 'SELESAI',
      source: settings.sales_sources[0] || 'WhatsApp',
      notes: '',
    },
  ]);
  const [multiDate, setMultiDate] = useState<string>(new Date().toISOString().slice(0, 16));

  // Table Search and Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [paymentFilter, setPaymentFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ACTIVE');
  const [sortBy, setSortBy] = useState<'date' | 'revenue' | 'profit'>('date');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  // Detail Modal State
  const [selectedTrx, setSelectedTrx] = useState<Transaction | null>(null);

  const totalStockAvailable = useMemo(() => {
    return batches.reduce((sum, b) => sum + b.remaining_quantity, 0);
  }, [batches]);

  // Handle single form Robux quantity change to auto-suggest tiered rate
  const handleSingleQtyChange = (qty: number) => {
    let rate = singleForm.sell_rate;
    if (settings.small_pack_threshold > 0) {
      if (qty <= settings.small_pack_threshold && settings.small_pack_rate > 0) {
        rate = settings.small_pack_rate;
      } else if (qty > settings.small_pack_threshold && settings.large_pack_rate > 0) {
        rate = settings.large_pack_rate;
      }
    }
    const gross = qty * rate;
    const net = Math.max(0, gross - singleForm.discount);
    setSingleForm(prev => ({
      ...prev,
      quantity: qty,
      sell_rate: rate,
      amount_paid: net,
    }));
  };

  // Preview FIFO & Financials for Single Form
  const singlePreview = useMemo(() => {
    const fifo = allocateStockFIFO(singleForm.quantity, batches);
    const fin = calculateTransactionFinancials(
      singleForm.quantity,
      singleForm.sell_rate,
      singleForm.discount,
      singleForm.fee,
      fifo.totalCogs,
      singleForm.amount_paid
    );
    return { fifo, fin };
  }, [singleForm, batches]);

  // Aggregate Preview for Multi Rows
  const multiAggregate = useMemo(() => {
    let totalQty = 0;
    let totalGross = 0;
    let totalDiscount = 0;
    let totalNet = 0;
    let totalFee = 0;
    let totalCogs = 0;
    let profitCount = 0;
    let breakEvenCount = 0;
    let lossCount = 0;

    const batchesClone = JSON.parse(JSON.stringify(batches)) as StockBatch[];

    multiRows.forEach(row => {
      totalQty += row.quantity || 0;
      const gross = (row.quantity || 0) * (row.sell_rate || 0);
      const disc = row.discount || 0;
      const net = gross - disc;
      const fee = row.fee || 0;

      totalGross += gross;
      totalDiscount += disc;
      totalNet += net;
      totalFee += fee;

      const fifo = allocateStockFIFO(row.quantity, batchesClone);
      totalCogs += fifo.totalCogs;
      fifo.updatedBatches.forEach(u => {
        const b = batchesClone.find(x => x.id === u.id);
        if (b) b.remaining_quantity = u.newRemainingQuantity;
      });

      const netProfit = net - fifo.totalCogs - fee;
      if (netProfit > 0) profitCount++;
      else if (netProfit === 0) breakEvenCount++;
      else lossCount++;
    });

    const totalGrossProfit = totalNet - totalCogs;
    const totalNetProfit = totalGrossProfit - totalFee;
    const weightedAvgRate = calculateWeightedAverageRate(totalNet, totalQty);
    const avgRevenuePerTrx = safeDivide(totalNet, multiRows.length, 0);
    const avgProfitPerTrx = safeDivide(totalNetProfit, multiRows.length, 0);

    return {
      totalQty,
      totalGross,
      totalDiscount,
      totalNet,
      totalFee,
      totalCogs,
      totalGrossProfit,
      totalNetProfit,
      weightedAvgRate,
      avgRevenuePerTrx,
      avgProfitPerTrx,
      profitCount,
      breakEvenCount,
      lossCount,
      hasEnoughStock: totalQty <= totalStockAvailable,
    };
  }, [multiRows, batches, totalStockAvailable]);

  // Submit Single Transaction
  const handleSaveSingle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (singleForm.quantity <= 0) {
      Swal.fire({
        icon: 'error',
        title: 'Jumlah Tidak Valid',
        text: 'Jumlah Robux harus lebih besar dari 0!',
      });
      return;
    }

    if (singleForm.quantity > totalStockAvailable) {
      Swal.fire({
        icon: 'error',
        title: 'Stok Tidak Cukup',
        text: `Stok saat ini ${formatNumber(totalStockAvailable)} R$, dibutuhkan ${formatNumber(
          singleForm.quantity
        )} R$! Silakan restock terlebih dahulu.`,
      });
      return;
    }

    try {
      const input: TransactionInput = {
        date: new Date(singleForm.date).toISOString(),
        customer_name: singleForm.customer_name.trim() || 'Pelanggan Umum',
        quantity: singleForm.quantity,
        sell_rate: singleForm.sell_rate,
        discount: singleForm.discount,
        fee: singleForm.fee,
        payment_method: singleForm.payment_method,
        amount_paid: singleForm.amount_paid,
        delivery_status: singleForm.delivery_status,
        notes: singleForm.notes.trim(),
        source: singleForm.source,
      };

      await saveMultipleTransactions([input]);
      await onRefreshData();

      Swal.fire({
        icon: 'success',
        title: 'Penjualan Dicatat!',
        text: `Transaksi ${formatNumber(singleForm.quantity)} R$ berhasil disimpan ke database SQLite.`,
        timer: 1600,
        showConfirmButton: false,
      });

      setSingleForm(prev => ({
        ...prev,
        customer_name: '',
        notes: '',
      }));
    } catch (err: any) {
      Swal.fire({
        icon: 'error',
        title: 'Gagal Menyimpan',
        text: err.message || 'Terjadi kesalahan sistem',
      });
    }
  };

  // Submit Multi Transactions
  const handleSaveMulti = async () => {
    if (!multiAggregate.hasEnoughStock) {
      Swal.fire({
        icon: 'error',
        title: 'Stok Tidak Cukup',
        text: `Total pesanan ${formatNumber(
          multiAggregate.totalQty
        )} R$ melebihi stok yang tersedia (${formatNumber(totalStockAvailable)} R$)!`,
      });
      return;
    }

    const confirm = await Swal.fire({
      icon: 'question',
      title: 'Simpan Semua Transaksi?',
      html: `<div style="text-align:left; font-size: 13px; line-height: 1.6;">
        <p><strong>Total Pesanan:</strong> ${multiRows.length} transaksi</p>
        <p><strong>Total Robux:</strong> ${formatNumber(multiAggregate.totalQty)} R$</p>
        <p><strong>Total Pendapatan:</strong> ${formatRupiah(multiAggregate.totalNet)}</p>
        <p><strong>Total Laba Bersih:</strong> ${formatRupiah(multiAggregate.totalNetProfit)}</p>
        <br/>
        <p style="color:#a1a1aa;">Semua transaksi akan dieksekusi secara atomik dalam 1 transaksi SQLite.</p>
      </div>`,
      showCancelButton: true,
      confirmButtonText: 'Ya, Simpan Semua',
      cancelButtonText: 'Batal',
    });

    if (!confirm.isConfirmed) return;

    try {
      const inputs: TransactionInput[] = multiRows.map(r => ({
        date: new Date(multiDate).toISOString(),
        customer_name: r.customer_name.trim() || 'Pelanggan Umum',
        quantity: r.quantity,
        sell_rate: r.sell_rate,
        discount: r.discount,
        fee: r.fee,
        payment_method: r.payment_method,
        amount_paid: r.amount_paid,
        delivery_status: r.delivery_status,
        source: r.source,
        notes: r.notes.trim(),
      }));

      await saveMultipleTransactions(inputs);
      await onRefreshData();

      Swal.fire({
        icon: 'success',
        title: 'Semua Transaksi Tersimpan!',
        text: `${inputs.length} transaksi berhasil dicatat dan stok dialokasikan secara FIFO.`,
      });

      setMultiRows([
        {
          id: 'row_' + Date.now(),
          customer_name: '',
          quantity: 100,
          sell_rate: settings.default_rate,
          discount: 0,
          fee: 0,
          payment_method: settings.payment_methods[0] || 'BCA',
          amount_paid: 100 * settings.default_rate,
          delivery_status: 'SELESAI',
          source: settings.sales_sources[0] || 'WhatsApp',
          notes: '',
        },
      ]);
    } catch (err: any) {
      Swal.fire({
        icon: 'error',
        title: 'Transaksi Gagal Disimpan',
        text: err.message || 'Database rollback terjadi.',
      });
    }
  };

  // Cancel Transaction Action
  const handleCancelTrx = async (trx: Transaction) => {
    const { value: reason } = await Swal.fire({
      icon: 'warning',
      title: `Batalkan ${trx.transaction_code}?`,
      text: 'Stok akan dikembalikan ke batch semula dan arus kas disesuaikan secara aman.',
      input: 'text',
      inputLabel: 'Alasan Pembatalan',
      inputPlaceholder: 'Misal: Pelanggan salah transfer / membatalkan pesanan',
      inputValidator: v => (!v ? 'Alasan pembatalan wajib diisi!' : null),
      showCancelButton: true,
      confirmButtonText: 'Konfirmasi Batalkan',
      cancelButtonText: 'Batal',
    });

    if (reason) {
      try {
        await cancelTransaction(trx.id, reason);
        await onRefreshData();
        Swal.fire({
          icon: 'success',
          title: 'Transaksi Dibatalkan',
          text: 'Stok telah berhasil dipulihkan kembali ke batch semula.',
        });
      } catch (err: any) {
        Swal.fire({
          icon: 'error',
          title: 'Gagal',
          text: err.message,
        });
      }
    }
  };

  // Filtered & Sorted Transactions Table
  const filteredTransactions = useMemo(() => {
    return transactions
      .filter(t => {
        if (statusFilter !== 'ALL' && t.status !== statusFilter) return false;
        if (paymentFilter !== 'ALL' && t.payment_status !== paymentFilter) return false;
        if (searchTerm) {
          const s = searchTerm.toLowerCase();
          const matchCode = t.transaction_code.toLowerCase().includes(s);
          const matchCust = (t.customer_name || '').toLowerCase().includes(s);
          const matchDate = t.date.includes(s);
          if (!matchCode && !matchCust && !matchDate) return false;
        }
        return true;
      })
      .sort((a, b) => {
        let cmp = 0;
        if (sortBy === 'date') cmp = new Date(b.date).getTime() - new Date(a.date).getTime();
        else if (sortBy === 'revenue') cmp = b.net_revenue - a.net_revenue;
        else if (sortBy === 'profit') cmp = b.net_profit - a.net_profit;
        return sortOrder === 'desc' ? cmp : -cmp;
      });
  }, [transactions, searchTerm, paymentFilter, statusFilter, sortBy, sortOrder]);

  return (
    <div className="space-y-6">
      {/* Mode Selector Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
        <div>
          <h2 className="text-base sm:text-lg font-poppins font-bold text-white">Modul Pencatatan Penjualan</h2>
          <p className="text-xs text-neutral-400">
            Pencatatan real-time dengan alokasi batch stok FIFO dan perhitungan laba akurat.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:flex sm:items-center gap-1.5 bg-[#111114] p-1 rounded-xl border border-white/10 w-full sm:w-auto">
          <button
            onClick={() => setActiveMode('single')}
            className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition text-center ${
              activeMode === 'single'
                ? 'bg-white text-black shadow-sm'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <ShoppingBag size={14} className="shrink-0" />
            <span className="truncate">Satu Transaksi</span>
          </button>
          <button
            onClick={() => setActiveMode('multi')}
            className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition text-center ${
              activeMode === 'multi'
                ? 'bg-white text-black shadow-sm'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <FileSpreadsheet size={14} className="shrink-0" />
            <span className="truncate">Banyak Transaksi</span>
          </button>
        </div>
      </div>

      {/* MODE A: Single Transaction Form */}
      {activeMode === 'single' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <form
            onSubmit={handleSaveSingle}
            className="lg:col-span-2 bg-[#09090b] p-6 rounded-2xl border border-white/10 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="font-heading font-bold text-white text-sm">Formulir Penjualan Satuan</h3>
              <span className="text-xs text-zinc-400">
                Stok Tersedia:{' '}
                <strong className="text-white font-mono">
                  {formatNumber(totalStockAvailable)} R$
                </strong>
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-zinc-300 block mb-1">
                  Tanggal & Waktu
                </label>
                <input
                  type="datetime-local"
                  value={singleForm.date}
                  onChange={e => setSingleForm({ ...singleForm, date: e.target.value })}
                  className="w-full bg-[#111114] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-white/30"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-medium text-zinc-300 block mb-1">
                  Nama / Kontak Pelanggan
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Budi (WA / Discord)"
                  value={singleForm.customer_name}
                  onChange={e => setSingleForm({ ...singleForm, customer_name: e.target.value })}
                  className="w-full bg-[#111114] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-white/30"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-zinc-300 block mb-1">
                  Jumlah Robux (R$)
                </label>
                <input
                  type="number"
                  min="1"
                  value={singleForm.quantity || ''}
                  onChange={e => handleSingleQtyChange(Number(e.target.value))}
                  className="w-full bg-[#111114] border border-white/10 rounded-xl px-3 py-2 text-xs font-mono font-bold text-white focus:outline-none focus:border-white/30"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-medium text-zinc-300 block mb-1">
                  Rate Jual per Robux (Rp)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={singleForm.sell_rate || ''}
                  onChange={e => {
                    const r = Number(e.target.value);
                    const gross = singleForm.quantity * r;
                    const net = Math.max(0, gross - singleForm.discount);
                    setSingleForm({ ...singleForm, sell_rate: r, amount_paid: net });
                  }}
                  className="w-full bg-[#111114] border border-white/10 rounded-xl px-3 py-2 text-xs font-mono font-bold text-white focus:outline-none focus:border-white/30"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-medium text-zinc-300 block mb-1">
                  Diskon Penjualan (Rp)
                </label>
                <input
                  type="number"
                  min="0"
                  value={singleForm.discount || ''}
                  placeholder="0"
                  onChange={e => {
                    const disc = Number(e.target.value);
                    const gross = singleForm.quantity * singleForm.sell_rate;
                    const net = Math.max(0, gross - disc);
                    setSingleForm({ ...singleForm, discount: disc, amount_paid: net });
                  }}
                  className="w-full bg-[#111114] border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-white/30"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-zinc-300 block mb-1">
                  Biaya Layanan / Fee Transaksi (Rp)
                </label>
                <input
                  type="number"
                  min="0"
                  value={singleForm.fee || ''}
                  placeholder="0"
                  onChange={e => setSingleForm({ ...singleForm, fee: Number(e.target.value) })}
                  className="w-full bg-[#111114] border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-white/30"
                />
                <span className="text-[10px] text-zinc-500">Biaya yang ditanggung penjual</span>
              </div>

              <div>
                <label className="text-xs font-medium text-zinc-300 block mb-1">
                  Metode Pembayaran
                </label>
                <select
                  value={singleForm.payment_method}
                  onChange={e => setSingleForm({ ...singleForm, payment_method: e.target.value })}
                  className="w-full bg-[#111114] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-white/30"
                >
                  {settings.payment_methods.map(m => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-zinc-300 block mb-1">
                  Uang Diterima / Dibayar (Rp)
                </label>
                <input
                  type="number"
                  min="0"
                  value={singleForm.amount_paid}
                  onChange={e =>
                    setSingleForm({ ...singleForm, amount_paid: Number(e.target.value) })
                  }
                  className="w-full bg-[#111114] border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-white/30"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-zinc-300 block mb-1">
                  Sumber Penjualan
                </label>
                <select
                  value={singleForm.source}
                  onChange={e => setSingleForm({ ...singleForm, source: e.target.value })}
                  className="w-full bg-[#111114] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-white/30"
                >
                  {settings.sales_sources.map(s => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-zinc-300 block mb-1">
                  Status Pengiriman Robux
                </label>
                <select
                  value={singleForm.delivery_status}
                  onChange={e =>
                    setSingleForm({
                      ...singleForm,
                      delivery_status: e.target.value as any,
                    })
                  }
                  className="w-full bg-[#111114] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-white/30"
                >
                  <option value="SELESAI">Selesai (Sudah Dikirim)</option>
                  <option value="SEBAGIAN">Sebagian</option>
                  <option value="BELUM_DIKIRIM">Belum Dikirim</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-zinc-300 block mb-1">
                Catatan Transaksi
              </label>
              <textarea
                rows={2}
                placeholder="Catatan pesanan, username Roblox pembeli..."
                value={singleForm.notes}
                onChange={e => setSingleForm({ ...singleForm, notes: e.target.value })}
                className="w-full bg-[#111114] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-white/30"
              />
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={!singlePreview.fifo.success && totalStockAvailable === 0}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white hover:bg-zinc-200 text-black font-bold text-xs shadow-sm disabled:opacity-40 transition"
              >
                <Save size={14} />
                <span>Simpan Transaksi Penjualan</span>
              </button>
            </div>
          </form>

          {/* Real-time Financial Breakdown for Single Mode */}
          <div className="bg-[#09090b] p-6 rounded-2xl border border-white/10 space-y-4 flex flex-col justify-between">
            <div>
              <h3 className="font-heading font-bold text-white text-sm border-b border-white/10 pb-3 flex items-center justify-between">
                <span>Kalkulasi Otomatis</span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                    singlePreview.fin.netProfit >= 0
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'bg-rose-500/20 text-rose-400'
                  }`}
                >
                  {singlePreview.fin.netProfit >= 0 ? 'STATUS: UNTUNG' : 'STATUS: RUGI'}
                </span>
              </h3>

              <div className="space-y-2.5 text-xs mt-4">
                <div className="flex justify-between text-zinc-300">
                  <span>Pendapatan Kotor:</span>
                  <span className="font-mono">{formatRupiah(singlePreview.fin.grossRevenue)}</span>
                </div>
                {singlePreview.fin.discount > 0 && (
                  <div className="flex justify-between text-amber-300">
                    <span>Diskon:</span>
                    <span className="font-mono">-{formatRupiah(singlePreview.fin.discount)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-white border-t border-white/10 pt-1.5">
                  <span>Pendapatan Bersih:</span>
                  <span className="font-mono text-white">
                    {formatRupiah(singlePreview.fin.netRevenue)}
                  </span>
                </div>
                <div className="flex justify-between text-zinc-400">
                  <span>Modal HPP (FIFO):</span>
                  <span className="font-mono">-{formatRupiah(singlePreview.fin.cogs)}</span>
                </div>
                <div className="flex justify-between font-medium text-zinc-300">
                  <span>Laba Kotor:</span>
                  <span className="font-mono">{formatRupiah(singlePreview.fin.grossProfit)}</span>
                </div>
                {singlePreview.fin.fee > 0 && (
                  <div className="flex justify-between text-zinc-400">
                    <span>Biaya Fee:</span>
                    <span className="font-mono">-{formatRupiah(singlePreview.fin.fee)}</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-bold border-t border-white/10 pt-2 text-white">
                  <span>Laba Bersih:</span>
                  <span
                    className={`font-mono ${
                      singlePreview.fin.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {formatRupiah(singlePreview.fin.netProfit)}
                  </span>
                </div>
                <div className="flex justify-between text-zinc-400 text-[11px] font-mono">
                  <span>Margin:</span>
                  <span className="font-bold text-white">
                    {singlePreview.fin.marginPercentage}%
                  </span>
                </div>
              </div>

              {/* FIFO Batch allocation details */}
              <div className="mt-5 p-3.5 rounded-xl bg-[#111114] border border-white/10 text-[11px] space-y-1.5">
                <span className="font-bold text-zinc-300 block">Alokasi Batch FIFO:</span>
                {singlePreview.fifo.allocations.length === 0 ? (
                  <span className="text-zinc-500">Belum ada alokasi batch stok.</span>
                ) : (
                  singlePreview.fifo.allocations.map((a, idx) => (
                    <div key={idx} className="flex justify-between text-zinc-400 font-mono">
                      <span>
                        {a.batch_code} ({formatNumber(a.quantity)} R$ @ Rp{a.cost_per_unit}):
                      </span>
                      <span className="text-white">{formatRupiah(a.subtotal_cost)}</span>
                    </div>
                  ))
                )}
              </div>

              {/* Receivables notice */}
              {singlePreview.fin.accountsReceivable > 0 && (
                <div className="mt-3 p-2.5 rounded-lg bg-amber-950/20 border border-amber-500/30 text-amber-300 text-[11px]">
                  <strong>Piutang:</strong> Sisa belum dibayar{' '}
                  <span className="font-mono font-bold">
                    {formatRupiah(singlePreview.fin.accountsReceivable)}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODE B: Multi-Transaction Spreadsheet Form */}
      {activeMode === 'multi' && (
        <div className="bg-[#09090b] p-6 rounded-2xl border border-white/10 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
            <div>
              <h3 className="font-heading font-bold text-white text-sm">Pencatatan Banyak Transaksi Sekaligus</h3>
              <p className="text-xs text-zinc-400">
                Merekap pesanan harian dalam format tabel cepat.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-400">Tanggal:</span>
                <input
                  type="datetime-local"
                  value={multiDate}
                  onChange={e => setMultiDate(e.target.value)}
                  className="bg-[#111114] border border-white/10 rounded-lg px-2.5 py-1 text-xs text-white"
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  setMultiRows([
                    ...multiRows,
                    {
                      id: 'row_' + Date.now(),
                      customer_name: '',
                      quantity: 100,
                      sell_rate: settings.default_rate,
                      discount: 0,
                      fee: 0,
                      payment_method: settings.payment_methods[0] || 'BCA',
                      amount_paid: 100 * settings.default_rate,
                      delivery_status: 'SELESAI',
                      source: settings.sales_sources[0] || 'WhatsApp',
                      notes: '',
                    },
                  ]);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white text-black font-bold text-xs hover:bg-zinc-200 transition"
              >
                <Plus size={14} /> + Tambah Baris
              </button>
            </div>
          </div>

          {/* Rows Table */}
          <div className="overflow-x-auto border border-white/10 rounded-xl">
            <table className="w-full text-left text-xs min-w-[850px]">
              <thead className="bg-[#111114] text-zinc-400 border-b border-white/10">
                <tr>
                  <th className="p-2.5 w-10 text-center font-mono">#</th>
                  <th className="p-2.5">Pelanggan</th>
                  <th className="p-2.5 w-24">Robux (R$)</th>
                  <th className="p-2.5 w-24">Rate (Rp)</th>
                  <th className="p-2.5 w-24">Diskon (Rp)</th>
                  <th className="p-2.5 w-24">Fee (Rp)</th>
                  <th className="p-2.5 w-28">Metode</th>
                  <th className="p-2.5 w-28">Kas Diterima</th>
                  <th className="p-2.5 text-right">Subtotal</th>
                  <th className="p-2.5 w-20 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {multiRows.map((row, idx) => {
                  const gross = (row.quantity || 0) * (row.sell_rate || 0);
                  const net = Math.max(0, gross - (row.discount || 0));

                  return (
                    <tr key={row.id} className="hover:bg-white/5">
                      <td className="p-2 text-center text-zinc-500 font-mono">{idx + 1}</td>
                      <td className="p-2">
                        <input
                          type="text"
                          value={row.customer_name}
                          onChange={e => {
                            const val = e.target.value;
                            setMultiRows(
                              multiRows.map(r => (r.id === row.id ? { ...r, customer_name: val } : r))
                            );
                          }}
                          className="w-full bg-[#111114] border border-white/10 rounded px-2 py-1 text-white placeholder-zinc-600"
                          placeholder="Nama pembeli"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          min="1"
                          value={row.quantity || ''}
                          onChange={e => {
                            const q = Number(e.target.value);
                            const r = row.sell_rate;
                            const sub = Math.max(0, q * r - row.discount);
                            setMultiRows(
                              multiRows.map(item =>
                                item.id === row.id
                                  ? { ...item, quantity: q, amount_paid: sub }
                                  : item
                              )
                            );
                          }}
                          className="w-full bg-[#111114] border border-white/10 rounded px-2 py-1 text-white font-mono font-bold"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          step="0.1"
                          value={row.sell_rate || ''}
                          onChange={e => {
                            const rate = Number(e.target.value);
                            const sub = Math.max(0, row.quantity * rate - row.discount);
                            setMultiRows(
                              multiRows.map(item =>
                                item.id === row.id
                                  ? { ...item, sell_rate: rate, amount_paid: sub }
                                  : item
                              )
                            );
                          }}
                          className="w-full bg-[#111114] border border-white/10 rounded px-2 py-1 text-white font-mono font-bold"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          value={row.discount || ''}
                          placeholder="0"
                          onChange={e => {
                            const d = Number(e.target.value);
                            const sub = Math.max(0, row.quantity * row.sell_rate - d);
                            setMultiRows(
                              multiRows.map(item =>
                                item.id === row.id ? { ...item, discount: d, amount_paid: sub } : item
                              )
                            );
                          }}
                          className="w-full bg-[#111114] border border-white/10 rounded px-2 py-1 text-white font-mono"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          value={row.fee || ''}
                          placeholder="0"
                          onChange={e => {
                            const f = Number(e.target.value);
                            setMultiRows(
                              multiRows.map(item => (item.id === row.id ? { ...item, fee: f } : item))
                            );
                          }}
                          className="w-full bg-[#111114] border border-white/10 rounded px-2 py-1 text-white font-mono"
                        />
                      </td>
                      <td className="p-2">
                        <select
                          value={row.payment_method}
                          onChange={e => {
                            const m = e.target.value;
                            setMultiRows(
                              multiRows.map(item =>
                                item.id === row.id ? { ...item, payment_method: m } : item
                              )
                            );
                          }}
                          className="w-full bg-[#111114] border border-white/10 rounded px-1.5 py-1 text-white"
                        >
                          {settings.payment_methods.map(pm => (
                            <option key={pm} value={pm}>
                              {pm}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          value={row.amount_paid}
                          onChange={e => {
                            const a = Number(e.target.value);
                            setMultiRows(
                              multiRows.map(item =>
                                item.id === row.id ? { ...item, amount_paid: a } : item
                              )
                            );
                          }}
                          className="w-full bg-[#111114] border border-white/10 rounded px-2 py-1 text-white font-mono"
                        />
                      </td>
                      <td className="p-2 text-right font-mono font-bold text-white">
                        {formatRupiah(net)}
                      </td>
                      <td className="p-2 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            title="Gandakan Baris"
                            onClick={() => {
                              setMultiRows([
                                ...multiRows,
                                {
                                  ...row,
                                  id: 'row_' + Date.now() + Math.random(),
                                },
                              ]);
                            }}
                            className="p-1 hover:bg-white/10 rounded text-zinc-400 hover:text-white"
                          >
                            <Copy size={13} />
                          </button>
                          {multiRows.length > 1 && (
                            <button
                              type="button"
                              title="Hapus Baris"
                              onClick={() => {
                                setMultiRows(multiRows.filter(r => r.id !== row.id));
                              }}
                              className="p-1 hover:bg-rose-950/40 rounded text-zinc-400 hover:text-rose-400"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Multi-mode Aggregate Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
            <div className="p-3 bg-[#111114] rounded-xl border border-white/10">
              <span className="text-[11px] text-zinc-400 block">Total Robux</span>
              <span className="text-sm font-bold font-mono text-white">
                {formatNumber(multiAggregate.totalQty)} R$
              </span>
            </div>
            <div className="p-3 bg-[#111114] rounded-xl border border-white/10">
              <span className="text-[11px] text-zinc-400 block">Total Pendapatan</span>
              <span className="text-sm font-bold font-mono text-white">
                {formatRupiah(multiAggregate.totalNet)}
              </span>
            </div>
            <div className="p-3 bg-[#111114] rounded-xl border border-white/10">
              <span className="text-[11px] text-zinc-400 block">Total HPP (FIFO)</span>
              <span className="text-sm font-bold font-mono text-zinc-400">
                {formatRupiah(multiAggregate.totalCogs)}
              </span>
            </div>
            <div className="p-3 bg-[#111114] rounded-xl border border-white/10">
              <span className="text-[11px] text-zinc-400 block">Total Laba Bersih</span>
              <span
                className={`text-sm font-bold font-mono ${
                  multiAggregate.totalNetProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {formatRupiah(multiAggregate.totalNetProfit)}
              </span>
            </div>
            <div className="p-3 bg-[#111114] rounded-xl border border-white/10">
              <span className="text-[11px] text-zinc-400 block">Rate Rata-rata</span>
              <span className="text-sm font-bold font-mono text-white">
                Rp{multiAggregate.weightedAvgRate}
              </span>
            </div>
            <div className="p-3 bg-[#111114] rounded-xl border border-white/10">
              <span className="text-[11px] text-zinc-400 block">Rata-rata Laba/Trx</span>
              <span className="text-sm font-bold font-mono text-white">
                {formatRupiah(multiAggregate.avgProfitPerTrx)}
              </span>
            </div>
          </div>

          {/* Action Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
            <div className="flex items-center gap-2 text-xs">
              <span className="text-zinc-400">Status:</span>
              <span className="px-2 py-0.5 rounded bg-white/10 text-white font-bold">
                {multiAggregate.profitCount} Untung
              </span>
              <span className="px-2 py-0.5 rounded bg-[#111114] text-zinc-400 font-bold border border-white/10">
                {multiAggregate.breakEvenCount} Impas
              </span>
              {multiAggregate.lossCount > 0 && (
                <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-400 font-bold">
                  {multiAggregate.lossCount} Rugi
                </span>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={async () => {
                  const res = await Swal.fire({
                    title: 'Kosongkan Formulir?',
                    text: 'Semua baris transaksi yang belum disimpan akan direset.',
                    icon: 'warning',
                    showCancelButton: true,
                    confirmButtonText: 'Ya, Kosongkan',
                    cancelButtonText: 'Batal',
                  });
                  if (res.isConfirmed) {
                    setMultiRows([
                      {
                        id: 'row_' + Date.now(),
                        customer_name: '',
                        quantity: 100,
                        sell_rate: settings.default_rate,
                        discount: 0,
                        fee: 0,
                        payment_method: settings.payment_methods[0] || 'BCA',
                        amount_paid: 100 * settings.default_rate,
                        delivery_status: 'SELESAI',
                        source: settings.sales_sources[0] || 'WhatsApp',
                        notes: '',
                      },
                    ]);
                  }
                }}
                className="px-4 py-2 rounded-xl bg-[#111114] hover:bg-[#18181b] text-zinc-300 font-medium text-xs border border-white/10 transition"
              >
                Kosongkan
              </button>

              <button
                type="button"
                onClick={handleSaveMulti}
                disabled={!multiAggregate.hasEnoughStock && totalStockAvailable === 0}
                className="flex items-center gap-2 px-6 py-2 rounded-xl bg-white hover:bg-zinc-200 text-black font-bold text-xs shadow-sm disabled:opacity-40 transition"
              >
                <Save size={14} />
                <span>Simpan Semua ({multiRows.length} Transaksi)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transactions History Table */}
      <div className="bg-[#09090b] p-6 rounded-2xl border border-white/10 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="font-heading font-bold text-white text-sm">Riwayat Transaksi Penjualan</h3>
            <p className="text-xs text-zinc-400">
              Total {filteredTransactions.length} transaksi tercatat di SQLite
            </p>
          </div>

          <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 w-full md:w-auto">
            <div className="relative col-span-2 sm:w-56">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500"
              />
              <input
                type="text"
                placeholder="Cari transaksi..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full bg-[#111114] border border-white/10 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-white/30"
              />
            </div>

            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="bg-[#111114] border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-white"
            >
              <option value="ALL">Semua Status</option>
              <option value="ACTIVE">Aktif</option>
              <option value="CANCELLED">Dibatalkan</option>
              <option value="REFUNDED">Refund</option>
            </select>

            <select
              value={paymentFilter}
              onChange={e => setPaymentFilter(e.target.value)}
              className="bg-[#111114] border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-white"
            >
              <option value="ALL">Semua Bayar</option>
              <option value="LUNAS">Lunas</option>
              <option value="SEBAGIAN">Sebagian</option>
              <option value="BELUM_LUNAS">Belum Lunas</option>
            </select>

            <div className="col-span-2 sm:col-span-1 flex items-center gap-1.5">
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as any)}
                className="flex-1 bg-[#111114] border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-white"
              >
                <option value="date">Urut Tanggal</option>
                <option value="revenue">Urut Nilai</option>
                <option value="profit">Urut Laba</option>
              </select>

              <button
                onClick={() => setSortOrder(prev => (prev === 'desc' ? 'asc' : 'desc'))}
                className="p-1.5 bg-[#111114] border border-white/10 rounded-xl text-neutral-300 hover:text-white shrink-0"
                title="Balik Urutan"
              >
                <ArrowUpDown size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* Transactions Table */}
        <div className="overflow-x-auto border border-white/10 rounded-xl">
          <table className="w-full text-left text-xs min-w-[900px]">
            <thead className="bg-[#111114] text-zinc-400 border-b border-white/10">
              <tr>
                <th className="p-3">Kode Transaksi</th>
                <th className="p-3">Tanggal</th>
                <th className="p-3">Pelanggan</th>
                <th className="p-3 text-right">Robux</th>
                <th className="p-3 text-right">Rate</th>
                <th className="p-3 text-right">Total Nilai</th>
                <th className="p-3 text-right">HPP (Modal)</th>
                <th className="p-3 text-right">Laba Bersih</th>
                <th className="p-3 text-center">Bayar</th>
                <th className="p-3 text-center">Status</th>
                <th className="p-3 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-8 text-center text-zinc-500">
                    Tidak ada transaksi yang cocok dengan filter atau database masih bersih.
                  </td>
                </tr>
              ) : (
                filteredTransactions.map(trx => (
                  <tr
                    key={trx.id}
                    className={`hover:bg-white/5 transition ${
                      trx.status === 'CANCELLED' ? 'opacity-40 line-through' : ''
                    }`}
                  >
                    <td className="p-3 font-mono text-zinc-300 font-semibold">
                      {trx.transaction_code}
                    </td>
                    <td className="p-3 text-zinc-400">{trx.date.slice(0, 16).replace('T', ' ')}</td>
                    <td className="p-3 font-medium text-white">{trx.customer_name}</td>
                    <td className="p-3 text-right font-mono font-bold text-white">
                      {formatNumber(trx.quantity)} R$
                    </td>
                    <td className="p-3 text-right font-mono text-zinc-300">Rp{trx.sell_rate}</td>
                    <td className="p-3 text-right font-mono font-bold text-white">
                      {formatRupiah(trx.net_revenue)}
                    </td>
                    <td className="p-3 text-right font-mono text-zinc-400">
                      {formatRupiah(trx.cogs)}
                    </td>
                    <td
                      className={`p-3 text-right font-mono font-bold ${
                        trx.net_profit >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {formatRupiah(trx.net_profit)}
                    </td>
                    <td className="p-3 text-center">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          trx.payment_status === 'LUNAS'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        }`}
                      >
                        {trx.payment_status}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          trx.status === 'ACTIVE'
                            ? 'bg-white/10 text-white'
                            : trx.status === 'CANCELLED'
                            ? 'bg-rose-500/20 text-rose-400'
                            : 'bg-indigo-500/20 text-indigo-400'
                        }`}
                      >
                        {trx.status}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setSelectedTrx(trx)}
                          title="Lihat Detail Transaksi & Alokasi FIFO"
                          className="p-1 hover:bg-white/10 rounded text-zinc-400 hover:text-white"
                        >
                          <Eye size={14} />
                        </button>
                        {trx.status === 'ACTIVE' && (
                          <button
                            type="button"
                            onClick={() => handleCancelTrx(trx)}
                            title="Batalkan Transaksi & Pulihkan Stok"
                            className="p-1 hover:bg-rose-950/40 rounded text-zinc-400 hover:text-rose-400"
                          >
                            <XCircle size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Transaction Details Modal */}
      {selectedTrx && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#09090b] border border-white/15 rounded-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <h3 className="text-sm font-heading font-bold text-white">Detail Transaksi</h3>
                <span className="text-xs font-mono text-zinc-400">
                  {selectedTrx.transaction_code}
                </span>
              </div>
              <button
                onClick={() => setSelectedTrx(null)}
                className="text-zinc-400 hover:text-white text-base font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-zinc-400">Pelanggan:</span>
                <span className="text-white font-medium">{selectedTrx.customer_name}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/5 font-mono">
                <span className="text-zinc-400 font-sans">Tanggal:</span>
                <span className="text-white">{selectedTrx.date}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/5 font-mono">
                <span className="text-zinc-400 font-sans">Robux:</span>
                <span className="text-white font-bold">
                  {formatNumber(selectedTrx.quantity)} R$
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/5 font-mono">
                <span className="text-zinc-400 font-sans">Rate Jual:</span>
                <span className="text-white">Rp{selectedTrx.sell_rate}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/5 font-mono">
                <span className="text-zinc-400 font-sans">Pendapatan Bersih:</span>
                <span className="text-white font-bold">
                  {formatRupiah(selectedTrx.net_revenue)}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/5 font-mono">
                <span className="text-zinc-400 font-sans">Modal HPP (COGS):</span>
                <span className="text-zinc-300">{formatRupiah(selectedTrx.cogs)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/5 font-mono">
                <span className="text-zinc-400 font-sans">Laba Bersih:</span>
                <span
                  className={`font-bold ${
                    selectedTrx.net_profit >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {formatRupiah(selectedTrx.net_profit)} ({selectedTrx.margin_percentage}%)
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-zinc-400">Metode & Kas:</span>
                <span className="text-white font-mono">
                  {selectedTrx.payment_method} — {formatRupiah(selectedTrx.amount_paid)}
                </span>
              </div>
            </div>

            {/* FIFO Batch breakdown */}
            <div className="p-3 bg-[#111114] rounded-xl border border-white/10 text-xs space-y-1.5 font-mono">
              <span className="font-bold text-zinc-300 block font-sans">Rincian Batch Stok FIFO:</span>
              {selectedTrx.batch_allocations.map((a, i) => (
                <div key={i} className="flex justify-between text-zinc-400 text-[11px]">
                  <span>
                    Batch {a.batch_code} ({formatNumber(a.quantity)} R$ @ Rp{a.cost_per_unit}):
                  </span>
                  <span className="text-white">{formatRupiah(a.subtotal_cost)}</span>
                </div>
              ))}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSelectedTrx(null)}
                className="px-4 py-2 bg-[#18181b] hover:bg-[#27272a] text-white text-xs font-semibold rounded-xl border border-white/10"
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
