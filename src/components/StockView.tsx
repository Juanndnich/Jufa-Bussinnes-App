import React, { useMemo, useState } from 'react';
import { Package, Plus, History, ArrowUpDown, Layers } from 'lucide-react';
import Swal from 'sweetalert2';
import { showToast, showAlert, cleanupSwalLocks } from '../utils/alert';
import { StockBatch, StockMovement } from '../types';
import { addStockAdjustment } from '../services/repository';
import { formatNumber, formatRupiah } from '../utils/formatters';

interface StockViewProps {
  batches: StockBatch[];
  stockMovements: StockMovement[];
  onRefreshData: () => Promise<void>;
  onNavigateToRestock: () => void;
}

export const StockView: React.FC<StockViewProps> = ({
  batches,
  stockMovements,
  onRefreshData,
  onNavigateToRestock,
}) => {
  const [activeTab, setActiveTab] = useState<'batches' | 'movements'>('batches');
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);
  const [adjType, setAdjType] = useState<'ADJUSTMENT_ADD' | 'ADJUSTMENT_SUB'>('ADJUSTMENT_ADD');
  const [adjQty, setAdjQty] = useState<number>(100);
  const [adjReason, setAdjReason] = useState<string>('');
  const [selectedBatchId, setSelectedBatchId] = useState<string>('');

  const totalAvailableStock = useMemo(() => {
    return batches.reduce((sum, b) => sum + (b.remaining_quantity || 0), 0);
  }, [batches]);

  const totalSoldStock = useMemo(() => {
    return batches.reduce(
      (sum, b) => sum + (b.initial_quantity - b.remaining_quantity),
      0
    );
  }, [batches]);

  const totalAssetValue = useMemo(() => {
    return batches.reduce(
      (sum, b) => sum + (b.remaining_quantity || 0) * (b.cost_per_unit || 0),
      0
    );
  }, [batches]);

  const handleSaveAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (adjQty <= 0) {
      Swal.fire({
        icon: 'error',
        title: 'Jumlah Tidak Valid',
        text: 'Jumlah penyesuaian harus lebih dari 0',
      });
      return;
    }
    if (!adjReason.trim()) {
      Swal.fire({
        icon: 'error',
        title: 'Alasan Wajib Diisi',
        text: 'Penyesuaian stok harus memiliki catatan alasan resmi!',
      });
      return;
    }

    try {
      await addStockAdjustment(adjType, adjQty, adjReason.trim(), selectedBatchId || undefined);
      await onRefreshData();
      setShowAdjustmentModal(false);
      setAdjReason('');
      showToast('Penyesuaian Stok Berhasil Disimpan!');
    } catch (err: any) {
      showAlert('Gagal Menyesuaikan Stok', err.message, 'error');
    } finally {
      cleanupSwalLocks();
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 theme-bg-surface p-4 sm:p-5 rounded-2xl border theme-border">
        <div>
          <h2 className="text-base sm:text-lg font-heading font-bold theme-text-primary flex items-center gap-2">
            <Package size={20} />
            <span>Manajemen Stok Robux & Persediaan</span>
          </h2>
          <p className="text-xs theme-text-secondary mt-1">
            Pantau stok tersedia, nilai persediaan batch FIFO, dan riwayat mutasi stok.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => setShowAdjustmentModal(true)}
            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl theme-bg-card hover:theme-bg-card-hover theme-text-primary text-xs font-semibold border theme-border transition active:scale-95"
          >
            <ArrowUpDown size={13} />
            <span>Koreksi Stok</span>
          </button>
          <button
            onClick={onNavigateToRestock}
            className="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-neutral-200 text-black text-xs font-bold transition shadow-sm active:scale-95"
          >
            <Plus size={14} />
            <span>+ Restock</span>
          </button>
        </div>
      </div>

      {/* Stock Metrics Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <div className="theme-bg-surface p-4 sm:p-5 rounded-2xl border theme-border overflow-hidden">
          <span className="text-[11px] theme-text-muted block mb-1 truncate">Stok Tersedia Saat Ini</span>
          <div className="text-2xl sm:text-3xl font-bold font-mono theme-text-primary flex items-baseline gap-1 tracking-tight whitespace-nowrap overflow-hidden text-ellipsis">
            {formatNumber(totalAvailableStock)}
            <span className="text-xs font-normal theme-text-muted font-sans">R$</span>
          </div>
          <span className="text-[10px] theme-text-muted mt-2 block truncate">
            Stok aktif siap dijual
          </span>
        </div>

        <div className="theme-bg-surface p-4 sm:p-5 rounded-2xl border theme-border overflow-hidden">
          <span className="text-[11px] theme-text-muted block mb-1 truncate">Total Nilai Persediaan</span>
          <div className="text-2xl sm:text-3xl font-bold font-mono theme-text-primary tracking-tight whitespace-nowrap overflow-hidden text-ellipsis">
            {formatRupiah(totalAssetValue)}
          </div>
          <span className="text-[10px] theme-text-muted mt-2 block truncate">
            Aset modal persediaan buku riil
          </span>
        </div>

        <div className="theme-bg-surface p-4 sm:p-5 rounded-2xl border theme-border overflow-hidden">
          <span className="text-[11px] theme-text-muted block mb-1 truncate">Total Robux Terjual</span>
          <div className="text-2xl sm:text-3xl font-bold font-mono theme-text-primary flex items-baseline gap-1 tracking-tight whitespace-nowrap overflow-hidden text-ellipsis">
            {formatNumber(totalSoldStock)}
            <span className="text-xs font-normal theme-text-muted font-sans">R$</span>
          </div>
          <span className="text-[10px] theme-text-muted mt-2 block truncate">
            Akumulasi Robux keluar dari batch
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="theme-bg-surface p-5 sm:p-6 rounded-2xl border theme-border space-y-4">
        <div className="flex items-center gap-2 border-b theme-border pb-3">
          <button
            onClick={() => setActiveTab('batches')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
              activeTab === 'batches'
                ? 'bg-white text-black shadow-sm'
                : 'theme-text-muted hover:theme-text-primary'
            }`}
          >
            <Layers size={14} />
            <span>Daftar Batch Stok ({batches.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('movements')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
              activeTab === 'movements'
                ? 'bg-white text-black shadow-sm'
                : 'theme-text-muted hover:theme-text-primary'
            }`}
          >
            <History size={14} />
            <span>Riwayat Mutasi Stok ({stockMovements.length})</span>
          </button>
        </div>

        {/* Tab 1: Batches Table */}
        {activeTab === 'batches' && (
          <div className="overflow-x-auto border theme-border rounded-xl">
            <table className="w-full text-left text-xs min-w-[750px]">
              <thead className="theme-bg-card theme-text-secondary border-b theme-border">
                <tr>
                  <th className="p-3">Kode Batch</th>
                  <th className="p-3">Tanggal Restock</th>
                  <th className="p-3">Supplier</th>
                  <th className="p-3 text-right">Modal Awal</th>
                  <th className="p-3 text-right">Sisa Stok</th>
                  <th className="p-3 text-right">HPP / Unit</th>
                  <th className="p-3 text-right">Nilai Sisa</th>
                  <th className="p-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y theme-border-subtle">
                {batches.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center theme-text-muted">
                      Belum ada batch stok. Klik "Beli Stok (Restock)" untuk menambahkan persediaan pertama Anda.
                    </td>
                  </tr>
                ) : (
                  batches.map(b => (
                    <tr key={b.id} className="theme-bg-card-hover transition">
                      <td className="p-3 font-mono font-bold theme-text-primary">{b.batch_code}</td>
                      <td className="p-3 theme-text-secondary">{b.date.slice(0, 10)}</td>
                      <td className="p-3 theme-text-primary font-medium">{b.supplier}</td>
                      <td className="p-3 text-right font-mono theme-text-secondary">
                        {formatNumber(b.initial_quantity)} R$
                      </td>
                      <td className="p-3 text-right font-mono font-bold theme-text-primary">
                        {formatNumber(b.remaining_quantity)} R$
                      </td>
                      <td className="p-3 text-right font-mono theme-text-secondary font-semibold">
                        Rp{b.cost_per_unit}
                      </td>
                      <td className="p-3 text-right font-mono font-bold theme-text-primary">
                        {formatRupiah(b.remaining_quantity * b.cost_per_unit)}
                      </td>
                      <td className="p-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            b.remaining_quantity > 0
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : 'theme-bg-card theme-text-muted'
                          }`}
                        >
                          {b.remaining_quantity > 0 ? 'TERSEDIA' : 'HABIS'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 2: Stock Movements Table */}
        {activeTab === 'movements' && (
          <div className="overflow-x-auto border theme-border rounded-xl">
            <table className="w-full text-left text-xs min-w-[700px]">
              <thead className="theme-bg-card theme-text-secondary border-b theme-border">
                <tr>
                  <th className="p-3">Waktu</th>
                  <th className="p-3">Tipe Mutasi</th>
                  <th className="p-3 text-right">Jumlah (R$)</th>
                  <th className="p-3">Referensi</th>
                  <th className="p-3">Keterangan</th>
                </tr>
              </thead>
              <tbody className="divide-y theme-border-subtle">
                {stockMovements.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center theme-text-muted">
                      Belum ada riwayat pergerakan stok.
                    </td>
                  </tr>
                ) : (
                  stockMovements.map(m => {
                    const isPositive =
                      m.type === 'PURCHASE' ||
                      m.type === 'ADJUSTMENT_ADD' ||
                      m.type === 'REFUND_RESTORE' ||
                      m.type === 'CANCELLATION_RESTORE';

                    return (
                      <tr key={m.id} className="theme-bg-card-hover transition font-mono">
                        <td className="p-3 theme-text-secondary font-sans">{m.date.slice(0, 16).replace('T', ' ')}</td>
                        <td className="p-3 font-semibold font-sans">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              isPositive
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                            }`}
                          >
                            {m.type}
                          </span>
                        </td>
                        <td
                          className={`p-3 text-right font-bold ${
                            isPositive ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {isPositive ? '+' : '-'}
                          {formatNumber(m.quantity)} R$
                        </td>
                        <td className="p-3 theme-text-primary">{m.reference_id}</td>
                        <td className="p-3 theme-text-secondary font-sans">{m.notes}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Stock Adjustment Modal */}
      {showAdjustmentModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveAdjustment}
            className="bg-[#09090b] border border-white/15 rounded-2xl max-w-md w-full p-6 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-sm font-heading font-bold text-white flex items-center gap-2">
                <ArrowUpDown size={16} />
                <span>Koreksi & Penyesuaian Stok</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowAdjustmentModal(false)}
                className="text-zinc-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-zinc-300 block mb-1">
                  Jenis Penyesuaian
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAdjType('ADJUSTMENT_ADD')}
                    className={`py-2 rounded-xl text-xs font-bold border transition ${
                      adjType === 'ADJUSTMENT_ADD'
                        ? 'bg-white text-black border-white'
                        : 'border-white/10 text-zinc-400 hover:text-white'
                    }`}
                  >
                    + Tambah Stok
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjType('ADJUSTMENT_SUB')}
                    className={`py-2 rounded-xl text-xs font-bold border transition ${
                      adjType === 'ADJUSTMENT_SUB'
                        ? 'bg-rose-500/20 border-rose-500 text-rose-300'
                        : 'border-white/10 text-zinc-400 hover:text-white'
                    }`}
                  >
                    − Kurang Stok
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-zinc-300 block mb-1">
                  Jumlah Robux (R$)
                </label>
                <input
                  type="number"
                  min="1"
                  value={adjQty}
                  onChange={e => setAdjQty(Number(e.target.value))}
                  className="w-full bg-[#111114] border border-white/10 rounded-xl px-3 py-2 text-xs font-mono font-bold text-white focus:outline-none focus:border-white/30"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-medium text-zinc-300 block mb-1">
                  Pilih Batch (Opsional)
                </label>
                <select
                  value={selectedBatchId}
                  onChange={e => setSelectedBatchId(e.target.value)}
                  className="w-full bg-[#111114] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-white/30"
                >
                  <option value="">Semua Batch (Otomatis FIFO)</option>
                  {batches.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.batch_code} (Sisa: {formatNumber(b.remaining_quantity)} R$)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-zinc-300 block mb-1">
                  Alasan Penyesuaian (Wajib)
                </label>
                <textarea
                  rows={2}
                  placeholder="Misal: Koreksi stok expired di Roblox, bonus supplier..."
                  value={adjReason}
                  onChange={e => setAdjReason(e.target.value)}
                  className="w-full bg-[#111114] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-white/30"
                  required
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAdjustmentModal(false)}
                className="px-4 py-2 bg-[#18181b] text-zinc-300 text-xs font-semibold rounded-xl border border-white/10"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-white text-black text-xs font-bold rounded-xl hover:bg-zinc-200 transition"
              >
                Simpan Penyesuaian
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
