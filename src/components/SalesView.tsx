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
  AlertCircle,
  Edit3,
} from 'lucide-react';
import Swal from 'sweetalert2';
import { showToast, showAlert, cleanupSwalLocks } from '../utils/alert';
import { AppSettings, DeliveryStatus, PaymentStatus, StockBatch, Transaction } from '../types';
import {
  cancelTransaction,
  saveMultipleTransactions,
  TransactionInput,
  updateTransaction,
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
  amount_paid: number;
  payment_method: string;
  payment_status: 'LUNAS' | 'BELUM_LUNAS';
  delivery_status: 'SELESAI' | 'BELUM_DIKIRIM';
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

  const defaultMethod = settings.payment_methods && settings.payment_methods.length > 0 
    ? settings.payment_methods[0] 
    : 'Tunai/Transfer';

  // Single Transaction Form State (Clean & direct to the point)
  const [singleForm, setSingleForm] = useState<{
    date: string;
    customer_name: string;
    quantity: number;
    sell_rate: number;
    amount_paid: number;
    payment_method: string;
    payment_status: 'LUNAS' | 'BELUM_LUNAS';
    delivery_status: 'SELESAI' | 'BELUM_DIKIRIM';
    source: string;
    notes: string;
  }>({
    date: new Date().toISOString().slice(0, 16),
    customer_name: '',
    quantity: 100,
    sell_rate: settings.default_rate || 165,
    amount_paid: 100 * (settings.default_rate || 165),
    payment_method: defaultMethod,
    payment_status: 'LUNAS',
    delivery_status: 'SELESAI',
    source: settings.sales_sources?.[0] || 'WhatsApp',
    notes: '',
  });

  // Multi Transaction Form State
  const [multiRows, setMultiRows] = useState<MultiRowState[]>([
    {
      id: 'row_' + Date.now(),
      customer_name: '',
      quantity: 100,
      sell_rate: settings.default_rate || 165,
      amount_paid: 100 * (settings.default_rate || 165),
      payment_method: defaultMethod,
      payment_status: 'LUNAS',
      delivery_status: 'SELESAI',
      source: settings.sales_sources?.[0] || 'WhatsApp',
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

  // Detail & Edit Modal State
  const [selectedTrx, setSelectedTrx] = useState<Transaction | null>(null);
  const [isEditingTrx, setIsEditingTrx] = useState(false);
  const [editTrxForm, setEditTrxForm] = useState<{
    customer_name: string;
    payment_status: PaymentStatus;
    delivery_status: DeliveryStatus;
    notes: string;
  }>({
    customer_name: '',
    payment_status: 'LUNAS',
    delivery_status: 'SELESAI',
    notes: '',
  });

  const openDetailTrx = (t: Transaction, editMode = false) => {
    setSelectedTrx(t);
    setIsEditingTrx(editMode);
    setEditTrxForm({
      customer_name: t.customer_name,
      payment_status: t.payment_status,
      delivery_status: t.delivery_status,
      notes: t.notes || '',
    });
  };

  const handleSaveTrxEdit = async () => {
    if (!selectedTrx) return;
    try {
      await updateTransaction(selectedTrx.id, editTrxForm);
      await onRefreshData();
      showToast('Perubahan transaksi berhasil disimpan!', 'success');
      setSelectedTrx(null);
      setIsEditingTrx(false);
    } catch (err: any) {
      showAlert('Gagal Menyimpan Perubahan', err.message, 'error');
    } finally {
      cleanupSwalLocks();
    }
  };

  const totalStockAvailable = useMemo(() => {
    return batches.reduce((sum, b) => sum + b.remaining_quantity, 0);
  }, [batches]);

  // Handle single form Robux quantity change
  const handleSingleQtyChange = (qty: number) => {
    let rate = singleForm.sell_rate;
    if (settings.small_pack_threshold > 0) {
      if (qty <= settings.small_pack_threshold && settings.small_pack_rate > 0) {
        rate = settings.small_pack_rate;
      } else if (qty > settings.small_pack_threshold && settings.large_pack_rate > 0) {
        rate = settings.large_pack_rate;
      }
    }
    const total = qty * rate;
    setSingleForm(prev => ({
      ...prev,
      quantity: qty,
      sell_rate: rate,
      amount_paid: total,
    }));
  };

  // Preview FIFO & Financials for Single Form
  const singlePreview = useMemo(() => {
    const fifo = allocateStockFIFO(singleForm.quantity, batches);
    const fin = calculateTransactionFinancials(
      singleForm.quantity,
      singleForm.sell_rate,
      0, // no discount
      0, // no fee
      fifo.totalCogs,
      singleForm.amount_paid
    );
    return { fifo, fin };
  }, [singleForm, batches]);

  // Aggregate Preview for Multi Rows
  const multiAggregate = useMemo(() => {
    let totalQty = 0;
    let totalNet = 0;
    let totalCogs = 0;
    let profitCount = 0;
    let breakEvenCount = 0;
    let lossCount = 0;

    const batchesClone = JSON.parse(JSON.stringify(batches)) as StockBatch[];

    multiRows.forEach(row => {
      totalQty += row.quantity || 0;
      const net = row.amount_paid > 0 ? row.amount_paid : (row.quantity || 0) * (row.sell_rate || 0);
      totalNet += net;

      const fifo = allocateStockFIFO(row.quantity, batchesClone);
      totalCogs += fifo.totalCogs;
      fifo.updatedBatches.forEach(u => {
        const b = batchesClone.find(x => x.id === u.id);
        if (b) b.remaining_quantity = u.newRemainingQuantity;
      });

      const netProfit = net - fifo.totalCogs;
      if (netProfit > 0) profitCount++;
      else if (netProfit === 0) breakEvenCount++;
      else lossCount++;
    });

    const totalGrossProfit = totalNet - totalCogs;
    const totalNetProfit = totalGrossProfit;
    const weightedAvgRate = calculateWeightedAverageRate(totalNet, totalQty);
    const avgRevenuePerTrx = safeDivide(totalNet, multiRows.length, 0);
    const avgProfitPerTrx = safeDivide(totalNetProfit, multiRows.length, 0);

    return {
      totalQty,
      totalNet,
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
        discount: 0,
        fee: 0,
        payment_method: singleForm.payment_method || 'Tunai/Transfer',
        amount_paid: singleForm.amount_paid,
        payment_status: singleForm.payment_status,
        delivery_status: singleForm.delivery_status,
        notes: singleForm.notes.trim(),
        source: singleForm.source,
      };

      await saveMultipleTransactions([input]);
      await onRefreshData();

      showToast(`Penjualan ${formatNumber(singleForm.quantity)} R$ Berhasil Dicatat!`, 'success');

      setSingleForm(prev => ({
        ...prev,
        customer_name: '',
        notes: '',
      }));
    } catch (err: any) {
      showAlert('Gagal Menyimpan', err.message || 'Terjadi kesalahan sistem', 'error');
    } finally {
      cleanupSwalLocks();
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
        <p><strong>Total Uang Masuk:</strong> ${formatRupiah(multiAggregate.totalNet)}</p>
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
        discount: 0,
        fee: 0,
        payment_method: r.payment_method || 'Tunai/Transfer',
        amount_paid: r.amount_paid,
        payment_status: r.payment_status,
        delivery_status: r.delivery_status,
        source: r.source,
        notes: r.notes.trim(),
      }));

      await saveMultipleTransactions(inputs);
      await onRefreshData();

      showToast(`${inputs.length} Transaksi Berhasil Disimpan!`, 'success');

      setMultiRows([
        {
          id: 'row_' + Date.now(),
          customer_name: '',
          quantity: 100,
          sell_rate: settings.default_rate || 165,
          amount_paid: 100 * (settings.default_rate || 165),
          payment_method: defaultMethod,
          payment_status: 'LUNAS',
          delivery_status: 'SELESAI',
          source: settings.sales_sources?.[0] || 'WhatsApp',
          notes: '',
        },
      ]);
    } catch (err: any) {
      showAlert('Transaksi Gagal Disimpan', err.message || 'Database rollback terjadi.', 'error');
    } finally {
      cleanupSwalLocks();
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

  const hasPaymentMethods = settings.payment_methods && settings.payment_methods.length > 0;

  return (
    <div className="space-y-6">
      {/* Mode Selector Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b theme-border pb-4">
        <div>
          <h2 className="text-base sm:text-lg font-heading font-bold theme-text-primary">
            Modul Pencatatan Penjualan
          </h2>
          <p className="text-xs theme-text-secondary">
            Catat penjualan Robux secara presisi tanpa potongan sepihak. Data tersimpan murni sesuai input Anda.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:flex sm:items-center gap-1.5 theme-bg-card p-1 rounded-xl border theme-border w-full sm:w-auto">
          <button
            onClick={() => setActiveMode('single')}
            className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition text-center ${
              activeMode === 'single'
                ? 'theme-bg-surface theme-text-primary shadow-sm border theme-border'
                : 'theme-text-muted hover:theme-text-primary'
            }`}
          >
            <ShoppingBag size={14} className="shrink-0" />
            <span className="truncate">Satu Transaksi</span>
          </button>
          <button
            onClick={() => setActiveMode('multi')}
            className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition text-center ${
              activeMode === 'multi'
                ? 'theme-bg-surface theme-text-primary shadow-sm border theme-border'
                : 'theme-text-muted hover:theme-text-primary'
            }`}
          >
            <FileSpreadsheet size={14} className="shrink-0" />
            <span className="truncate">Banyak Transaksi</span>
          </button>
        </div>
      </div>

      {/* Warning jika Metode Pembayaran Belum Ditambahkan */}
      {!hasPaymentMethods && (
        <div className="p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-500 flex items-start gap-3 text-xs">
          <AlertCircle size={18} className="shrink-0 mt-0.5" />
          <div className="flex-1">
            <strong>Perhatian: Daftar metode pembayaran belum ditambahkan.</strong>
            <p className="mt-0.5 opacity-90">
              Anda dapat menambahkan metode pembayaran (misal BCA, Dana, QRIS, GoPay) di menu <strong>Pengaturan</strong> agar muncul rapi pada pilihan dropdown. Transaksi saat ini tetap dapat dicatat menggunakan opsi umum.
            </p>
          </div>
        </div>
      )}

      {/* MODE A: Single Transaction Clean Form */}
      {activeMode === 'single' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <form
            onSubmit={handleSaveSingle}
            className="lg:col-span-2 theme-bg-surface p-5 sm:p-6 rounded-2xl border theme-border space-y-4"
          >
            <div className="flex items-center justify-between border-b theme-border pb-3">
              <span className="text-xs font-bold font-heading theme-text-primary flex items-center gap-2">
                <ShoppingBag size={15} /> Formulir Penjualan Cepat
              </span>
              <span className="text-[11px] theme-text-muted">
                Stok Tersedia:{' '}
                <strong className="font-mono theme-text-primary">
                  {formatNumber(totalStockAvailable)} R$
                </strong>
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium theme-text-secondary block mb-1">
                  Waktu Transaksi
                </label>
                <input
                  type="datetime-local"
                  value={singleForm.date}
                  onChange={e => setSingleForm({ ...singleForm, date: e.target.value })}
                  className="w-full theme-bg-input border theme-border rounded-xl px-3 py-2 text-xs theme-text-primary focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-medium theme-text-secondary block mb-1">
                  Nama Pelanggan (Opsional)
                </label>
                <input
                  type="text"
                  placeholder="Misal: Kevin / Pelanggan Umum"
                  value={singleForm.customer_name}
                  onChange={e => setSingleForm({ ...singleForm, customer_name: e.target.value })}
                  className="w-full theme-bg-input border theme-border rounded-xl px-3 py-2 text-xs theme-text-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-medium theme-text-secondary block mb-1">
                  Jumlah Robux Terjual (R$)
                </label>
                <input
                  type="number"
                  min="1"
                  value={singleForm.quantity || ''}
                  onChange={e => handleSingleQtyChange(Number(e.target.value))}
                  className="w-full theme-bg-input border theme-border rounded-xl px-3 py-2 text-xs font-mono font-bold theme-text-primary focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-medium theme-text-secondary block mb-1">
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
                    setSingleForm({ ...singleForm, sell_rate: r, amount_paid: gross });
                  }}
                  className="w-full theme-bg-input border theme-border rounded-xl px-3 py-2 text-xs font-mono font-bold theme-text-primary focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-medium theme-text-secondary block mb-1">
                  Total Uang Masuk / Diterima (Rp)
                </label>
                <input
                  type="number"
                  min="0"
                  value={singleForm.amount_paid}
                  onChange={e =>
                    setSingleForm({ ...singleForm, amount_paid: Number(e.target.value) })
                  }
                  className="w-full theme-bg-input border theme-border rounded-xl px-3 py-2 text-xs font-mono font-bold theme-text-primary focus:outline-none"
                  required
                />
                <span className="text-[10px] theme-text-muted">
                  Bisa diedit bebas jika ada pembulatan harga
                </span>
              </div>

              <div>
                <label className="text-xs font-medium theme-text-secondary block mb-1">
                  Metode Pembayaran
                </label>
                <select
                  value={singleForm.payment_method}
                  onChange={e => setSingleForm({ ...singleForm, payment_method: e.target.value })}
                  className="w-full theme-bg-input border theme-border rounded-xl px-3 py-2 text-xs theme-text-primary focus:outline-none"
                >
                  {hasPaymentMethods ? (
                    settings.payment_methods.map(m => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))
                  ) : (
                    <>
                      <option value="Tunai/Transfer">Tunai / Transfer Bank</option>
                      <option value="E-Wallet">E-Wallet (Dana/GoPay/OVO)</option>
                      <option value="QRIS">QRIS</option>
                    </>
                  )}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium theme-text-secondary block mb-1">
                  Status Pembayaran
                </label>
                <select
                  value={singleForm.payment_status}
                  onChange={e =>
                    setSingleForm({
                      ...singleForm,
                      payment_status: e.target.value as any,
                    })
                  }
                  className="w-full theme-bg-input border theme-border rounded-xl px-3 py-2 text-xs theme-text-primary font-bold focus:outline-none"
                >
                  <option value="LUNAS">LUNAS (Sudah Diterima Penuh)</option>
                  <option value="BELUM_LUNAS">BELUM LUNAS (Piutang)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-medium theme-text-secondary block mb-1">
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
                  className="w-full theme-bg-input border theme-border rounded-xl px-3 py-2 text-xs theme-text-primary font-bold focus:outline-none"
                >
                  <option value="SELESAI">SELESAI (Sudah Dikirim)</option>
                  <option value="BELUM_DIKIRIM">BELUM DIKIRIM (Proses Antrian)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-medium theme-text-secondary block mb-1">
                  Catatan / Username Roblox (Opsional)
                </label>
                <input
                  type="text"
                  placeholder="Username pembeli atau no HP..."
                  value={singleForm.notes}
                  onChange={e => setSingleForm({ ...singleForm, notes: e.target.value })}
                  className="w-full theme-bg-input border theme-border rounded-xl px-3 py-2 text-xs theme-text-primary focus:outline-none"
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={!singlePreview.fifo.success && totalStockAvailable === 0}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white hover:bg-neutral-200 text-black font-bold text-xs shadow-sm disabled:opacity-40 transition"
              >
                <Save size={14} />
                <span>Simpan Transaksi Penjualan</span>
              </button>
            </div>
          </form>

          {/* Real-time Financial Breakdown for Single Mode */}
          <div className="theme-bg-surface p-5 sm:p-6 rounded-2xl border theme-border space-y-4 flex flex-col justify-between">
            <div>
              <h3 className="font-heading font-bold theme-text-primary text-sm border-b theme-border pb-3 flex items-center justify-between">
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
                <div className="flex justify-between theme-text-secondary">
                  <span>Uang Diterima:</span>
                  <span className="font-mono font-bold theme-text-primary">
                    {formatRupiah(singleForm.amount_paid)}
                  </span>
                </div>
                <div className="flex justify-between theme-text-secondary">
                  <span>Modal HPP (FIFO):</span>
                  <span className="font-mono text-rose-400">
                    -{formatRupiah(singlePreview.fin.cogs)}
                  </span>
                </div>
                <div className="flex justify-between font-bold border-t theme-border pt-2 theme-text-primary text-sm">
                  <span>Laba Bersih:</span>
                  <span
                    className={`font-mono ${
                      singlePreview.fin.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {formatRupiah(singlePreview.fin.netProfit)}
                  </span>
                </div>
                <div className="flex justify-between theme-text-secondary text-[11px] font-mono">
                  <span>Margin Keuntungan:</span>
                  <span className="font-bold theme-text-primary">
                    {singlePreview.fin.marginPercentage}%
                  </span>
                </div>
              </div>

              {/* FIFO Batch allocation details */}
              <div className="mt-5 p-3.5 rounded-xl theme-bg-card border theme-border text-[11px] space-y-1.5">
                <span className="font-bold theme-text-secondary block">Alokasi Stok (FIFO):</span>
                {singlePreview.fifo.allocations.length === 0 ? (
                  <span className="theme-text-muted">Belum ada alokasi batch stok.</span>
                ) : (
                  singlePreview.fifo.allocations.map((a, idx) => (
                    <div key={idx} className="flex justify-between theme-text-secondary font-mono">
                      <span>
                        {a.batch_code} ({formatNumber(a.quantity)} R$):
                      </span>
                      <span className="theme-text-primary">{formatRupiah(a.subtotal_cost)}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="text-[11px] theme-text-muted p-3 rounded-xl theme-bg-card border theme-border">
              Data yang Anda simpan akan masuk ke buku kas dan mengurangi stok secara otomatis sesuai tanggal yang dipilih.
            </div>
          </div>
        </div>
      )}

      {/* MODE B: Multi-Transaction Spreadsheet Form */}
      {activeMode === 'multi' && (
        <div className="theme-bg-surface p-5 sm:p-6 rounded-2xl border theme-border space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b theme-border pb-4">
            <div>
              <h3 className="font-heading font-bold theme-text-primary text-sm">
                Pencatatan Banyak Transaksi Sekaligus
              </h3>
              <p className="text-xs theme-text-secondary">
                Merekap daftar pesanan pelanggan dalam tabel spreadsheet yang cepat dan ringkas.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs theme-text-secondary">Waktu:</span>
                <input
                  type="datetime-local"
                  value={multiDate}
                  onChange={e => setMultiDate(e.target.value)}
                  className="theme-bg-input border theme-border rounded-lg px-2.5 py-1 text-xs theme-text-primary"
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
                      sell_rate: settings.default_rate || 165,
                      amount_paid: 100 * (settings.default_rate || 165),
                      payment_method: defaultMethod,
                      payment_status: 'LUNAS',
                      delivery_status: 'SELESAI',
                      source: settings.sales_sources?.[0] || 'WhatsApp',
                      notes: '',
                    },
                  ]);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white text-black font-bold text-xs hover:bg-neutral-200 transition"
              >
                <Plus size={14} /> + Tambah Baris
              </button>
            </div>
          </div>

          {/* Rows Table */}
          <div className="overflow-x-auto border theme-border rounded-xl">
            <table className="w-full text-left text-xs min-w-[700px]">
              <thead className="theme-bg-card theme-text-secondary border-b theme-border">
                <tr>
                  <th className="p-2.5 w-10 text-center font-mono">#</th>
                  <th className="p-2.5">Pelanggan</th>
                  <th className="p-2.5 w-24">Robux (R$)</th>
                  <th className="p-2.5 w-24">Rate (Rp)</th>
                  <th className="p-2.5 w-28">Uang Masuk</th>
                  <th className="p-2.5 w-28">Metode</th>
                  <th className="p-2.5 w-24">Status Bayar</th>
                  <th className="p-2.5 w-24">Status Kirim</th>
                  <th className="p-2.5 w-16 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y theme-border-subtle">
                {multiRows.map((row, idx) => (
                  <tr key={row.id} className="theme-bg-card-hover">
                    <td className="p-2 text-center theme-text-muted font-mono">{idx + 1}</td>
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
                        className="w-full theme-bg-input border theme-border rounded px-2 py-1 theme-text-primary"
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
                          const sub = q * r;
                          setMultiRows(
                            multiRows.map(item =>
                              item.id === row.id
                                ? { ...item, quantity: q, amount_paid: sub }
                                : item
                            )
                          );
                        }}
                        className="w-full theme-bg-input border theme-border rounded px-2 py-1 theme-text-primary font-mono font-bold"
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="number"
                        step="0.1"
                        value={row.sell_rate || ''}
                        onChange={e => {
                          const rate = Number(e.target.value);
                          const sub = row.quantity * rate;
                          setMultiRows(
                            multiRows.map(item =>
                              item.id === row.id
                                ? { ...item, sell_rate: rate, amount_paid: sub }
                                : item
                            )
                          );
                        }}
                        className="w-full theme-bg-input border theme-border rounded px-2 py-1 theme-text-primary font-mono font-bold"
                      />
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
                        className="w-full theme-bg-input border theme-border rounded px-2 py-1 theme-text-primary font-mono font-bold"
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
                        className="w-full theme-bg-input border theme-border rounded px-1.5 py-1 theme-text-primary"
                      >
                        {hasPaymentMethods ? (
                          settings.payment_methods.map(pm => (
                            <option key={pm} value={pm}>
                              {pm}
                            </option>
                          ))
                        ) : (
                          <option value="Tunai/Transfer">Tunai/Transfer</option>
                        )}
                      </select>
                    </td>
                    <td className="p-2">
                      <select
                        value={row.payment_status}
                        onChange={e => {
                          const ps = e.target.value as any;
                          setMultiRows(
                            multiRows.map(item =>
                              item.id === row.id ? { ...item, payment_status: ps } : item
                            )
                          );
                        }}
                        className="w-full theme-bg-input border theme-border rounded px-1.5 py-1 theme-text-primary font-bold text-[11px]"
                      >
                        <option value="LUNAS">LUNAS</option>
                        <option value="BELUM_LUNAS">BELUM LUNAS</option>
                      </select>
                    </td>
                    <td className="p-2">
                      <select
                        value={row.delivery_status}
                        onChange={e => {
                          const ds = e.target.value as any;
                          setMultiRows(
                            multiRows.map(item =>
                              item.id === row.id ? { ...item, delivery_status: ds } : item
                            )
                          );
                        }}
                        className="w-full theme-bg-input border theme-border rounded px-1.5 py-1 theme-text-primary text-[11px]"
                      >
                        <option value="SELESAI">SELESAI</option>
                        <option value="BELUM_DIKIRIM">BELUM</option>
                      </select>
                    </td>
                    <td className="p-2 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setMultiRows([
                              ...multiRows,
                              {
                                ...row,
                                id: 'row_' + Date.now() + Math.random(),
                              },
                            ]);
                          }}
                          className="p-1 theme-text-muted hover:theme-text-primary rounded"
                          title="Duplikat baris"
                        >
                          <Copy size={13} />
                        </button>
                        <button
                          type="button"
                          disabled={multiRows.length === 1}
                          onClick={() => {
                            setMultiRows(multiRows.filter(r => r.id !== row.id));
                          }}
                          className="p-1 theme-text-muted hover:text-rose-400 rounded disabled:opacity-20"
                          title="Hapus baris"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Aggregate Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-xl theme-bg-card border theme-border text-xs">
            <div>
              <span className="theme-text-muted block text-[11px]">Total Transaksi</span>
              <strong className="font-mono text-sm theme-text-primary">
                {multiRows.length} Baris
              </strong>
            </div>
            <div>
              <span className="theme-text-muted block text-[11px]">Total Robux</span>
              <strong className="font-mono text-sm theme-text-primary">
                {formatNumber(multiAggregate.totalQty)} R$
              </strong>
            </div>
            <div>
              <span className="theme-text-muted block text-[11px]">Total Uang Diterima</span>
              <strong className="font-mono text-sm theme-text-primary">
                {formatRupiah(multiAggregate.totalNet)}
              </strong>
            </div>
            <div>
              <span className="theme-text-muted block text-[11px]">Estimasi Laba Bersih</span>
              <strong className="font-mono text-sm text-emerald-400">
                {formatRupiah(multiAggregate.totalNetProfit)}
              </strong>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleSaveMulti}
              disabled={!multiAggregate.hasEnoughStock || multiRows.length === 0}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-white hover:bg-neutral-200 text-black font-bold text-xs shadow-sm disabled:opacity-40 transition"
            >
              <Save size={14} />
              <span>Simpan Sekaligus ({multiRows.length} Transaksi)</span>
            </button>
          </div>
        </div>
      )}

      {/* Filter and Transaction History Section */}
      <div className="theme-bg-surface p-5 sm:p-6 rounded-2xl border theme-border space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-heading font-bold theme-text-primary text-sm">
              Riwayat Transaksi Penjualan
            </h3>
            <p className="text-xs theme-text-secondary">
              Total {transactions.length} transaksi tercatat di database SQLite lokal.
            </p>
          </div>

          {/* Quick Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-2.5 theme-text-muted" />
              <input
                type="text"
                placeholder="Cari kode / pelanggan..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs theme-bg-card border theme-border rounded-xl theme-text-primary focus:outline-none w-44 sm:w-56"
              />
            </div>

            <select
              value={paymentFilter}
              onChange={e => setPaymentFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs theme-bg-card border theme-border rounded-xl theme-text-primary focus:outline-none"
            >
              <option value="ALL">Semua Pembayaran</option>
              <option value="LUNAS">Lunas</option>
              <option value="BELUM_LUNAS">Belum Lunas</option>
            </select>

            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs theme-bg-card border theme-border rounded-xl theme-text-primary focus:outline-none"
            >
              <option value="ACTIVE">Aktif</option>
              <option value="CANCELLED">Dibatalkan</option>
              <option value="ALL">Semua Status</option>
            </select>
          </div>
        </div>

        {/* Transactions Table */}
        <div className="overflow-x-auto border theme-border rounded-xl">
          <table className="w-full text-left text-xs min-w-[750px]">
            <thead className="theme-bg-card theme-text-secondary border-b theme-border">
              <tr>
                <th className="p-3">Kode Transaksi</th>
                <th className="p-3">Waktu</th>
                <th className="p-3">Pelanggan</th>
                <th className="p-3 text-right">Robux (R$)</th>
                <th className="p-3 text-right">Uang Masuk</th>
                <th className="p-3 text-right">Laba Bersih</th>
                <th className="p-3 text-center">Status</th>
                <th className="p-3 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y theme-border-subtle">
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center theme-text-muted">
                    Tidak ada transaksi yang sesuai kriteria pencarian.
                  </td>
                </tr>
              ) : (
                filteredTransactions.map(t => (
                  <tr key={t.id} className="theme-bg-card-hover">
                    <td className="p-3 font-mono font-bold theme-text-primary">
                      {t.transaction_code}
                    </td>
                    <td className="p-3 theme-text-secondary whitespace-nowrap">
                      {new Date(t.date).toLocaleDateString('id-ID', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="p-3 theme-text-primary font-medium">{t.customer_name}</td>
                    <td className="p-3 text-right font-mono font-bold theme-text-primary">
                      {formatNumber(t.quantity)} R$
                    </td>
                    <td className="p-3 text-right font-mono theme-text-primary">
                      {formatRupiah(t.amount_paid)}
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-emerald-400">
                      {formatRupiah(t.net_profit)}
                    </td>
                    <td className="p-3 text-center">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          t.status === 'CANCELLED'
                            ? 'bg-rose-500/20 text-rose-400'
                            : t.payment_status === 'LUNAS'
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : 'bg-amber-500/20 text-amber-400'
                        }`}
                      >
                        {t.status === 'CANCELLED' ? 'DIBATALKAN' : t.payment_status}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => openDetailTrx(t, false)}
                          className="p-1 theme-text-muted hover:theme-text-primary rounded"
                          title="Lihat Detail Transaksi"
                        >
                          <Eye size={14} />
                        </button>
                        {t.status === 'ACTIVE' && (
                          <button
                            onClick={() => openDetailTrx(t, true)}
                            className="p-1 theme-text-muted hover:text-sky-400 rounded"
                            title="Edit Data Transaksi"
                          >
                            <Edit3 size={14} />
                          </button>
                        )}
                        {t.status === 'ACTIVE' && (
                          <button
                            onClick={() => handleCancelTrx(t)}
                            className="p-1 theme-text-muted hover:text-rose-400 rounded"
                            title="Batalkan Transaksi & Pulihkan Stok"
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

      {/* Detail Modal */}
      {selectedTrx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="theme-bg-surface border theme-border rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b theme-border pb-3">
              <div>
                <h4 className="font-heading font-bold theme-text-primary text-base flex items-center gap-2">
                  <span>{isEditingTrx ? 'Edit Transaksi' : 'Detail Transaksi'}</span>
                  <span className="font-mono text-xs px-2 py-0.5 rounded bg-white/10 text-zinc-300">
                    {selectedTrx.transaction_code}
                  </span>
                </h4>
                <p className="text-xs theme-text-muted mt-0.5">{selectedTrx.date}</p>
              </div>
              <button
                onClick={() => {
                  setSelectedTrx(null);
                  setIsEditingTrx(false);
                }}
                className="p-1.5 rounded-lg theme-text-muted hover:theme-text-primary theme-bg-card"
              >
                ✕
              </button>
            </div>

            {isEditingTrx ? (
              /* Mode Edit Transaksi */
              <div className="space-y-3.5 text-xs">
                <div>
                  <label className="text-xs font-medium theme-text-secondary block mb-1">
                    Nama Pelanggan
                  </label>
                  <input
                    type="text"
                    value={editTrxForm.customer_name}
                    onChange={e => setEditTrxForm({ ...editTrxForm, customer_name: e.target.value })}
                    className="w-full theme-bg-input border theme-border rounded-xl px-3 py-2 text-xs theme-text-primary font-bold focus:outline-none"
                    placeholder="Nama pelanggan..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium theme-text-secondary block mb-1">
                      Status Pembayaran
                    </label>
                    <select
                      value={editTrxForm.payment_status}
                      onChange={e => setEditTrxForm({ ...editTrxForm, payment_status: e.target.value as any })}
                      className="w-full theme-bg-input border theme-border rounded-xl px-3 py-2 text-xs theme-text-primary font-bold focus:outline-none"
                    >
                      <option value="LUNAS">LUNAS</option>
                      <option value="BELUM_LUNAS">BELUM LUNAS (Utang)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-medium theme-text-secondary block mb-1">
                      Status Pengiriman
                    </label>
                    <select
                      value={editTrxForm.delivery_status}
                      onChange={e => setEditTrxForm({ ...editTrxForm, delivery_status: e.target.value as any })}
                      className="w-full theme-bg-input border theme-border rounded-xl px-3 py-2 text-xs theme-text-primary font-bold focus:outline-none"
                    >
                      <option value="SELESAI">SELESAI</option>
                      <option value="BELUM_DIKIRIM">BELUM DIKIRIM</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium theme-text-secondary block mb-1">
                    Catatan / Username Roblox
                  </label>
                  <textarea
                    rows={2}
                    value={editTrxForm.notes}
                    onChange={e => setEditTrxForm({ ...editTrxForm, notes: e.target.value })}
                    className="w-full theme-bg-input border theme-border rounded-xl px-3 py-2 text-xs theme-text-primary focus:outline-none"
                    placeholder="Catatan transaksi..."
                  />
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEditingTrx(false)}
                    className="px-4 py-2 rounded-xl border theme-border theme-text-secondary hover:theme-text-primary text-xs font-semibold transition"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveTrxEdit}
                    className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-white text-black font-bold text-xs hover:bg-neutral-200 transition"
                  >
                    <Save size={13} />
                    <span>Simpan Perubahan</span>
                  </button>
                </div>
              </div>
            ) : (
              /* Mode Pratinjau Transaksi */
              <div className="space-y-3 text-xs">
                <div className="flex justify-between py-1 border-b theme-border-subtle">
                  <span className="theme-text-secondary">Pelanggan:</span>
                  <span className="font-bold theme-text-primary">{selectedTrx.customer_name}</span>
                </div>
                <div className="flex justify-between py-1 border-b theme-border-subtle">
                  <span className="theme-text-secondary">Robux Dikirim:</span>
                  <span className="font-mono font-bold theme-text-primary">
                    {formatNumber(selectedTrx.quantity)} R$
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b theme-border-subtle">
                  <span className="theme-text-secondary">Rate Jual:</span>
                  <span className="font-mono theme-text-primary">
                    Rp{formatDecimal(selectedTrx.sell_rate)}/R$
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b theme-border-subtle">
                  <span className="theme-text-secondary">Uang Diterima:</span>
                  <span className="font-mono font-bold theme-text-primary">
                    {formatRupiah(selectedTrx.amount_paid)}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b theme-border-subtle">
                  <span className="theme-text-secondary">Status Pembayaran:</span>
                  <span className={`font-bold px-2 py-0.5 rounded text-[10px] ${
                    selectedTrx.payment_status === 'LUNAS' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                  }`}>
                    {selectedTrx.payment_status}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b theme-border-subtle">
                  <span className="theme-text-secondary">Status Pengiriman:</span>
                  <span className="font-bold theme-text-primary">{selectedTrx.delivery_status}</span>
                </div>
                <div className="flex justify-between py-1 border-b theme-border-subtle">
                  <span className="theme-text-secondary">Metode Bayar:</span>
                  <span className="theme-text-primary">{selectedTrx.payment_method}</span>
                </div>
                <div className="flex justify-between py-1 border-b theme-border-subtle">
                  <span className="theme-text-secondary">Modal HPP (FIFO):</span>
                  <span className="font-mono text-rose-400">-{formatRupiah(selectedTrx.cogs)}</span>
                </div>
                <div className="flex justify-between py-1.5 border-t theme-border font-bold text-sm">
                  <span className="theme-text-primary">Laba Bersih:</span>
                  <span className="font-mono text-emerald-400">
                    {formatRupiah(selectedTrx.net_profit)}
                  </span>
                </div>
                {selectedTrx.notes && (
                  <div className="p-3 rounded-xl theme-bg-card border theme-border">
                    <span className="theme-text-muted block text-[11px] mb-1">Catatan:</span>
                    <p className="theme-text-primary">{selectedTrx.notes}</p>
                  </div>
                )}

                <div className="pt-2 flex justify-end gap-2">
                  {selectedTrx.status === 'ACTIVE' && (
                    <button
                      onClick={() => setIsEditingTrx(true)}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl theme-bg-card hover:theme-bg-card-hover border theme-border theme-text-primary font-bold text-xs transition"
                    >
                      <Edit3 size={13} />
                      <span>Edit Data</span>
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setSelectedTrx(null);
                      setIsEditingTrx(false);
                    }}
                    className="px-4 py-2 rounded-xl bg-white text-black font-bold text-xs hover:bg-neutral-200 transition"
                  >
                    Tutup
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
