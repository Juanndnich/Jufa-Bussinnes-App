import React, { useState, useEffect } from 'react';
import {
  Receipt,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Calendar,
  User,
  Layers,
  TrendingUp,
  AlertTriangle,
  RotateCcw,
  FileText,
  FileSpreadsheet,
  X,
} from 'lucide-react';
import { repository } from '../../db/repository';
import { Sale } from '../../db/schema';
import {
  formatRupiah,
  formatNumber,
  formatDecimal,
  formatDateJakarta,
} from '../../utils/formatters';
import { showSuccessAlert, showErrorAlert, showConfirmDialog } from '../../utils/alert';
import { playTapSound, playDeleteSound } from '../../utils/sound';
import { exportSalesToCsv } from '../../utils/exportCsv';

export const SalesView: React.FC = () => {
  const [sales, setSales] = useState<Sale[]>([]);
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'ACTIVE' | 'VOID'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [selectedSaleDetail, setSelectedSaleDetail] = useState<Sale | null>(null);

  const loadSales = async () => {
    try {
      const data = await repository.getSales();
      setSales(data);
    } catch (err) {
      console.error('Failed to load sales:', err);
    }
  };

  useEffect(() => {
    loadSales();
  }, []);

  // Filter sales dengan status, rentang tanggal, & pencarian teks
  const filteredSales = sales.filter((s) => {
    if (filterStatus !== 'ALL' && s.status !== filterStatus) return false;
    const saleDate = s.createdAt.substring(0, 10);
    if (filterStartDate && saleDate < filterStartDate) return false;
    if (filterEndDate && saleDate > filterEndDate) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchInv = s.invoiceNumber.toLowerCase().includes(q);
      const matchCust = s.customerName?.toLowerCase().includes(q) || false;
      const matchNotes = s.notes?.toLowerCase().includes(q) || false;
      return matchInv || matchCust || matchNotes;
    }
    return true;
  });

  // Handler: Batalkan Transaksi (VOID)
  const handleVoidSale = async (sale: Sale) => {
    const ok = await showConfirmDialog({
      title: 'Batalkan Transaksi Ini?',
      text: `Transaksi ${sale.invoiceNumber} (${formatNumber(sale.robuxSold)} R$) akan dibatalkan. Stok Robux dan modal HPP akan otomatis dikembalikan ke antrean FIFO, dan uang masuk di Buku Kas akan dibatalkan.`,
      confirmButtonText: 'Ya, Batalkan Transaksi',
      isDanger: true,
    });

    if (ok) {
      try {
        playDeleteSound();
        await repository.voidSale(sale.id, 'Dibatalkan oleh pengguna');
        await loadSales();
        await showSuccessAlert(
          'Transaksi Dibatalkan',
          `Stok ${formatNumber(sale.robuxSold)} R$ telah kembali ke persediaan FIFO.`
        );
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Gagal membatalkan transaksi';
        await showErrorAlert('Gagal', msg);
      }
    }
  };

  return (
    <div className="space-y-5 max-w-4xl mx-auto pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b theme-border">
        <div className="flex items-center gap-2.5">
          <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
            <Receipt size={20} />
          </div>
          <div>
            <h1 className="text-lg font-bold theme-text-primary tracking-tight">
              Riwayat Penjualan
            </h1>
            <p className="text-xs theme-text-secondary">
              Daftar seluruh transaksi penjualan Robux, rincian alokasi FIFO, & pembatalan
            </p>
          </div>
        </div>

        {/* Quick CSV Export Button */}
        <button
          type="button"
          onClick={() => {
            playTapSound();
            exportSalesToCsv(filteredSales);
          }}
          disabled={filteredSales.length === 0}
          className="px-3.5 py-2 rounded-xl theme-bg-card border theme-border hover:theme-bg-card-hover disabled:opacity-40 disabled:cursor-not-allowed theme-text-primary text-xs font-semibold flex items-center gap-2 transition active:scale-98 self-start sm:self-auto shadow-sm"
          title="Unduh laporan penjualan terfilter ke format CSV / Excel"
        >
          <FileSpreadsheet size={15} className="text-emerald-500" />
          <span>Ekspor CSV ({filteredSales.length})</span>
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="space-y-2.5">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              placeholder="Cari invoice, nama pembeli, atau catatan..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-3 py-2 rounded-xl theme-bg-card border theme-border text-xs theme-text-primary focus:outline-none focus:border-emerald-500 font-medium"
            />
          </div>

          <div className="flex items-center gap-1.5 p-1 rounded-xl theme-bg-surface border theme-border self-start sm:self-auto">
            <button
              type="button"
              onClick={() => {
                playTapSound();
                setFilterStatus('ALL');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                filterStatus === 'ALL'
                  ? 'theme-btn-primary shadow-sm'
                  : 'theme-text-secondary hover:theme-text-primary'
              }`}
            >
              Semua ({sales.length})
            </button>
            <button
              type="button"
              onClick={() => {
                playTapSound();
                setFilterStatus('ACTIVE');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                filterStatus === 'ACTIVE'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'theme-text-secondary hover:theme-text-primary'
              }`}
            >
              Sukses ({sales.filter((s) => s.status === 'ACTIVE').length})
            </button>
            <button
              type="button"
              onClick={() => {
                playTapSound();
                setFilterStatus('VOID');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                filterStatus === 'VOID'
                  ? 'bg-red-600 text-white shadow-sm'
                  : 'theme-text-secondary hover:theme-text-primary'
              }`}
            >
              Batal ({sales.filter((s) => s.status === 'VOID').length})
            </button>
          </div>
        </div>

        {/* Filter Rentang Tanggal */}
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
              className="px-2.5 py-1 rounded-lg theme-bg-card border theme-border text-[11px] theme-text-primary focus:outline-none focus:border-emerald-500 font-mono"
            />
            <span className="theme-text-muted text-[11px]">s/d</span>
            <input
              type="date"
              value={filterEndDate}
              onChange={(e) => setFilterEndDate(e.target.value)}
              className="px-2.5 py-1 rounded-lg theme-bg-card border theme-border text-[11px] theme-text-primary focus:outline-none focus:border-emerald-500 font-mono"
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

      {/* Sales List */}
      {filteredSales.length === 0 ? (
        <div className="p-8 rounded-2xl theme-bg-card border theme-border text-center space-y-2">
          <Receipt size={32} className="mx-auto theme-text-muted opacity-40" />
          <p className="text-sm font-medium theme-text-primary">Belum Ada Transaksi Penjualan</p>
          <p className="text-xs theme-text-muted max-w-sm mx-auto">
            Gunakan menu <strong>Kalkulator</strong> untuk menghitung transaksi dan mencatat penjualan pertama Anda.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredSales.map((sale) => {
            const isVoid = sale.status === 'VOID';
            const margin = sale.totalRevenueRupiah > 0
              ? (sale.grossProfitRupiah / sale.totalRevenueRupiah) * 100
              : null;

            return (
              <div
                key={sale.id}
                className={`p-4 rounded-2xl theme-bg-card border transition ${
                  isVoid
                    ? 'border-red-900/30 opacity-70 bg-red-950/5'
                    : 'theme-border hover:theme-bg-card-hover'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  {/* Left: Invoice & Details */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold theme-text-primary">
                        {sale.invoiceNumber}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 ${
                          isVoid
                            ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                            : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        }`}
                      >
                        {isVoid ? <XCircle size={10} /> : <CheckCircle2 size={10} />}
                        <span>{isVoid ? 'DIBATALKAN' : 'SUKSES'}</span>
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs theme-text-muted">
                      <span className="flex items-center gap-1">
                        <Calendar size={12} />
                        <span>{formatDateJakarta(sale.createdAt)}</span>
                      </span>
                      {sale.customerName && (
                        <span className="flex items-center gap-1 font-medium text-zinc-300">
                          <User size={12} />
                          <span>{sale.customerName}</span>
                        </span>
                      )}
                      {sale.notes && <span>• {sale.notes}</span>}
                    </div>
                  </div>

                  {/* Right: Numbers & Profit */}
                  <div className="flex items-center gap-4 justify-between sm:justify-end border-t sm:border-t-0 pt-2 sm:pt-0 theme-border-subtle">
                    <div className="text-left sm:text-right">
                      <span className="text-[10px] theme-text-muted block">Jumlah Terjual</span>
                      <span className="font-mono text-sm font-bold text-amber-400">
                        {formatNumber(sale.robuxSold)} R$
                      </span>
                      <span className="text-[10px] font-mono theme-text-muted block">
                        Rate: Rp{sale.rateUsed}
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] theme-text-muted block">Total Omzet</span>
                      <span className="font-mono text-sm font-bold theme-text-primary block">
                        {formatRupiah(sale.totalRevenueRupiah)}
                      </span>
                      <span
                        className={`text-[10px] font-mono font-bold block ${
                          sale.grossProfitRupiah >= 0 ? 'text-emerald-400' : 'text-red-400'
                        }`}
                      >
                        Laba: {formatRupiah(sale.grossProfitRupiah)}{' '}
                        {margin !== null && `(${formatDecimal(margin, 1)}%)`}
                      </span>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-1.5 pl-2 border-l theme-border-subtle">
                      <button
                        type="button"
                        onClick={() => setSelectedSaleDetail(sale)}
                        className="p-1.5 rounded-lg theme-bg-surface border theme-border hover:theme-text-primary text-zinc-400 transition"
                        title="Lihat Alokasi Batch FIFO"
                      >
                        <Layers size={14} />
                      </button>

                      {!isVoid && (
                        <button
                          type="button"
                          onClick={() => handleVoidSale(sale)}
                          className="p-1.5 rounded-lg theme-bg-surface border border-red-500/20 text-red-400 hover:bg-red-500/10 transition"
                          title="Batalkan Transaksi (Kembalikan Stok)"
                        >
                          <RotateCcw size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Detail Alokasi Batch FIFO */}
      {selectedSaleDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-2xl theme-bg-card border theme-border p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b theme-border">
              <h3 className="font-bold theme-text-primary text-sm flex items-center gap-2">
                <Layers size={16} className="text-emerald-500" />
                <span>Rincian Alokasi Batch FIFO</span>
              </h3>
              <button
                type="button"
                onClick={() => setSelectedSaleDetail(null)}
                className="text-xs theme-text-muted hover:theme-text-primary"
              >
                Tutup
              </button>
            </div>

            <div className="space-y-1 text-xs">
              <div className="flex justify-between py-1">
                <span className="theme-text-muted">Invoice:</span>
                <span className="font-mono font-bold theme-text-primary">
                  {selectedSaleDetail.invoiceNumber}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="theme-text-muted">Total Robux Terjual:</span>
                <span className="font-mono font-bold text-amber-400">
                  {formatNumber(selectedSaleDetail.robuxSold)} R$
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="theme-text-muted">Total HPP Modal:</span>
                <span className="font-mono font-bold theme-text-primary">
                  {formatRupiah(selectedSaleDetail.totalCogsRupiah)}
                </span>
              </div>
            </div>

            {/* List Alokasi Per Batch */}
            <div className="space-y-2 pt-2 border-t theme-border">
              <span className="text-[11px] font-semibold theme-text-muted block">
                Batch yang Terpakai:
              </span>
              {selectedSaleDetail.allocations.map((alloc, i) => (
                <div
                  key={i}
                  className="p-3 rounded-xl theme-bg-surface border theme-border text-xs flex items-center justify-between"
                >
                  <div>
                    <span className="font-mono font-bold theme-text-primary block">
                      {alloc.batchId}
                    </span>
                    <span className="text-[10px] theme-text-muted">
                      Ambil {formatNumber(alloc.robuxTaken)} R$
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="font-mono font-bold text-emerald-400 block">
                      {formatRupiah(alloc.costAllocatedRupiah)}
                    </span>
                    <span className="text-[10px] theme-text-muted">
                      Modal dialokasikan
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-2 text-right">
              <button
                type="button"
                onClick={() => setSelectedSaleDetail(null)}
                className="px-4 py-2 rounded-xl theme-btn-primary hover:opacity-90 text-xs font-semibold transition"
              >
                Tutup Rincian
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
