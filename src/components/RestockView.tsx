import React, { useMemo, useState } from 'react';
import { Truck, Save, CheckCircle2, Layers, Eye, Edit3 } from 'lucide-react';
import Swal from 'sweetalert2';
import { showToast, showAlert, cleanupSwalLocks } from '../utils/alert';
import { AppSettings, StockBatch } from '../types';
import { addBatch, updateBatch } from '../services/repository';
import { formatNumber, formatRupiah } from '../utils/formatters';

interface RestockViewProps {
  batches: StockBatch[];
  settings: AppSettings;
  onRefreshData: () => Promise<void>;
}

export const RestockView: React.FC<RestockViewProps> = ({
  batches,
  settings,
  onRefreshData,
}) => {
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [supplier, setSupplier] = useState<string>(settings.suppliers[0] || 'Supplier Utama');
  const [customSupplier, setCustomSupplier] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(2000);
  const [purchaseCost, setPurchaseCost] = useState<number>(320000);
  const [paymentMethod, setPaymentMethod] = useState<string>(settings.payment_methods[0] || 'BCA');
  const [paymentStatus, setPaymentStatus] = useState<'LUNAS' | 'BELUM_LUNAS'>('LUNAS');
  const [notes, setNotes] = useState<string>('');

  // Detail & Edit Batch State
  const [selectedBatch, setSelectedBatch] = useState<StockBatch | null>(null);
  const [isEditingBatch, setIsEditingBatch] = useState(false);
  const [editBatchForm, setEditBatchForm] = useState<{
    supplier: string;
    payment_status: 'LUNAS' | 'BELUM_LUNAS';
    notes: string;
  }>({
    supplier: '',
    payment_status: 'LUNAS',
    notes: '',
  });

  const openDetailBatch = (b: StockBatch, editMode = false) => {
    setSelectedBatch(b);
    setIsEditingBatch(editMode);
    setEditBatchForm({
      supplier: b.supplier,
      payment_status: b.payment_status,
      notes: b.notes || '',
    });
  };

  const handleSaveBatchEdit = async () => {
    if (!selectedBatch) return;
    try {
      await updateBatch(selectedBatch.id, editBatchForm);
      await onRefreshData();
      showToast('Perubahan data restock berhasil disimpan!', 'success');
      setSelectedBatch(null);
      setIsEditingBatch(false);
    } catch (err: any) {
      showAlert('Gagal Menyimpan Perubahan', err.message, 'error');
    } finally {
      cleanupSwalLocks();
    }
  };

  const costPerUnit = useMemo(() => {
    return quantity > 0 ? Number((purchaseCost / quantity).toFixed(2)) : 0;
  }, [purchaseCost, quantity]);

  // Hitung akumulasi sisa stok lama yang belum terjual dari batch sebelumnya
  const currentAvailableStock = useMemo(() => {
    return batches.reduce((acc, b) => acc + (b.remaining_quantity || 0), 0);
  }, [batches]);

  const currentAvailableAsset = useMemo(() => {
    return batches.reduce((acc, b) => acc + ((b.remaining_quantity || 0) * (b.cost_per_unit || 0)), 0);
  }, [batches]);

  const combinedTotalStock = currentAvailableStock + (quantity || 0);
  const combinedTotalAsset = currentAvailableAsset + (purchaseCost || 0);
  const blendedCostPerUnit = combinedTotalStock > 0 ? (combinedTotalAsset / combinedTotalStock).toFixed(2) : '0';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (quantity <= 0) {
      Swal.fire({
        icon: 'error',
        title: 'Jumlah Tidak Valid',
        text: 'Jumlah Robux harus lebih besar dari 0!',
      });
      return;
    }
    if (purchaseCost <= 0) {
      Swal.fire({
        icon: 'error',
        title: 'Harga Beli Tidak Valid',
        text: 'Harga beli total harus lebih besar dari 0!',
      });
      return;
    }

    const finalSupplier = supplier === 'CUSTOM' ? customSupplier.trim() || 'Supplier Umum' : supplier;

    try {
      await addBatch({
        date: new Date(date).toISOString(),
        supplier: finalSupplier,
        initial_quantity: quantity,
        purchase_cost: purchaseCost,
        extra_cost: 0,
        discount: 0,
        total_cost: purchaseCost,
        cost_per_unit: costPerUnit,
        payment_method: paymentMethod,
        payment_status: paymentStatus,
        notes: notes.trim(),
      });

      await onRefreshData();

      showToast(`Restock ${formatNumber(quantity)} R$ Berhasil Disimpan!`, 'success');
      setNotes('');
    } catch (err: any) {
      showAlert('Gagal Menyimpan Restock', err.message, 'error');
    } finally {
      cleanupSwalLocks();
    }
  };

  return (
    <div className="space-y-6">
      <div className="theme-bg-surface p-4 sm:p-5 rounded-2xl border theme-border">
        <h2 className="text-base sm:text-lg font-heading font-bold theme-text-primary flex items-center gap-2">
          <Truck size={20} />
          <span>Restock Pembelian Stok & Supplier</span>
        </h2>
        <p className="text-xs theme-text-secondary mt-1">
          Setiap pembelian Robux membentuk batch persediaan baru secara transparan dengan modal per unitnya sendiri (FIFO).
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form Restock */}
        <form
          onSubmit={handleSubmit}
          className="lg:col-span-2 theme-bg-surface p-5 sm:p-6 rounded-2xl border theme-border space-y-4"
        >
          <div className="flex items-center justify-between border-b theme-border pb-3">
            <h3 className="font-heading font-bold theme-text-primary text-sm">Formulir Pembelian / Restock</h3>
            <span className="text-[10px] text-zinc-300 font-mono bg-white/10 px-2 py-0.5 rounded border border-white/15">
              Batch Baru Otomatis
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-zinc-300 block mb-1">
                Tanggal Pembelian
              </label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full bg-[#111114] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-white/30"
                required
              />
            </div>

            <div>
              <label className="text-xs font-medium text-zinc-300 block mb-1">
                Supplier / Penjual Stok
              </label>
              <select
                value={supplier}
                onChange={e => setSupplier(e.target.value)}
                className="w-full bg-[#111114] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-white/30"
              >
                {settings.suppliers.map(s => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
                <option value="CUSTOM">+ Tulis Supplier Baru</option>
              </select>
              {supplier === 'CUSTOM' && (
                <input
                  type="text"
                  placeholder="Ketik nama supplier baru..."
                  value={customSupplier}
                  onChange={e => setCustomSupplier(e.target.value)}
                  className="mt-2 w-full bg-[#111114] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-white/30"
                  required
                />
              )}
            </div>

            <div>
              <label className="text-xs font-medium text-zinc-300 block mb-1">
                Jumlah Robux yang Diterima (R$)
              </label>
              <input
                type="number"
                min="1"
                value={quantity || ''}
                onChange={e => setQuantity(Number(e.target.value))}
                className="w-full bg-[#111114] border border-white/10 rounded-xl px-3 py-2 text-xs font-mono font-bold text-white focus:outline-none focus:border-white/30"
                required
              />
            </div>

            <div>
              <label className="text-xs font-medium text-zinc-300 block mb-1">
                Harga Total Pembelian (Rp)
              </label>
              <input
                type="number"
                min="0"
                value={purchaseCost || ''}
                onChange={e => setPurchaseCost(Number(e.target.value))}
                className="w-full bg-[#111114] border border-white/10 rounded-xl px-3 py-2 text-xs font-mono font-bold text-white focus:outline-none focus:border-white/30"
                required
              />
            </div>

            <div>
              <label className="text-xs font-medium text-zinc-300 block mb-1">
                Metode Pembayaran
              </label>
              <select
                value={paymentMethod}
                onChange={e => setPaymentMethod(e.target.value)}
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
                Status Pembayaran Restock
              </label>
              <select
                value={paymentStatus}
                onChange={e => setPaymentStatus(e.target.value as any)}
                className="w-full bg-[#111114] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-white/30"
              >
                <option value="LUNAS">Lunas (Catat Kas Keluar)</option>
                <option value="BELUM_LUNAS">Belum Lunas (Utang Restock)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-zinc-300 block mb-1">
              Catatan / Referensi
            </label>
            <textarea
              rows={2}
              placeholder="Catatan nomor transfer, no invoice supplier..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full bg-[#111114] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-white/30"
            />
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-white hover:bg-zinc-200 text-black font-bold text-xs shadow-sm transition"
            >
              <Save size={14} />
              <span>Simpan Batch Restock</span>
            </button>
          </div>
        </form>

        {/* Real-time Restock Breakdown Preview */}
        <div className="bg-[#09090b] p-6 rounded-2xl border border-white/10 space-y-4 flex flex-col justify-between">
          <div>
            <h3 className="font-heading font-bold text-white text-sm border-b border-white/10 pb-3">
              Kalkulasi Modal Batch
            </h3>

            <div className="space-y-3 text-xs mt-4">
              <div className="flex justify-between text-zinc-400">
                <span>Harga Pembelian Pokok:</span>
                <span className="font-mono text-white">{formatRupiah(purchaseCost)}</span>
              </div>

              <div className="flex justify-between text-sm font-bold text-white border-t border-white/10 pt-2">
                <span>Total Modal Batch:</span>
                <span className="font-mono text-white">
                  {formatRupiah(purchaseCost)}
                </span>
              </div>

              <div className="flex justify-between text-base font-bold border-t border-white/10 pt-2 text-white">
                <span>Modal per Robux (HPP):</span>
                <span className="font-mono">Rp{costPerUnit} / R$</span>
              </div>
            </div>

            {/* Gabungan Sisa Stok Lama & Restock Baru */}
            <div className="mt-4 p-3.5 rounded-xl bg-gradient-to-br from-emerald-950/30 to-zinc-900 border border-emerald-500/20 space-y-2">
              <div className="flex items-center gap-1.5 font-bold text-emerald-400 text-xs">
                <Layers size={14} />
                <span>Penggabungan Stok Toko</span>
              </div>
              <div className="text-[11px] space-y-1.5 text-zinc-300">
                <div className="flex justify-between">
                  <span className="text-zinc-400">Sisa Stok Lama (Belum Terjual):</span>
                  <span className="font-mono font-semibold text-zinc-200">{formatNumber(currentAvailableStock)} R$</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Restock Pembelian Baru:</span>
                  <span className="font-mono font-semibold text-emerald-400">+{formatNumber(quantity || 0)} R$</span>
                </div>
                <div className="flex justify-between border-t border-emerald-500/20 pt-1.5 font-bold text-white text-xs">
                  <span>Total Stok Siap Jual:</span>
                  <span className="font-mono text-emerald-300">{formatNumber(combinedTotalStock)} R$</span>
                </div>
                <div className="flex justify-between text-[10px] text-zinc-400 pt-0.5">
                  <span>Estimasi Rata-rata Modal Toko:</span>
                  <span className="font-mono text-zinc-300">Rp{blendedCostPerUnit} / R$</span>
                </div>
              </div>
            </div>

            <div className="mt-4 p-3.5 rounded-xl bg-[#111114] border border-white/10 text-[11px] text-zinc-400 space-y-2">
              <div className="flex items-center gap-1.5 font-bold text-zinc-200">
                <CheckCircle2 size={13} className="text-white" />
                <span>Aturan Akuntansi Baku</span>
              </div>
              <p>
                Pembelian stok ini <strong>tidak mengurangi laba</strong> bisnis Anda secara langsung. Uang tunai berubah menjadi aset persediaan senilai{' '}
                <strong className="text-white font-mono">{formatRupiah(purchaseCost)}</strong>.
              </p>
              <p>
                Modal ini baru dibebankan proporsional saat Robux terjual kepada pembeli.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* History of Batches */}
      <div className="bg-[#09090b] p-6 rounded-2xl border border-white/10 space-y-4">
        <h3 className="font-heading font-bold text-white text-sm">Riwayat Seluruh Batch Restock</h3>
        <div className="overflow-x-auto border border-white/10 rounded-xl">
          <table className="w-full text-left text-xs min-w-[850px]">
            <thead className="bg-[#111114] text-zinc-400 border-b border-white/10">
              <tr>
                <th className="p-3">Kode Batch</th>
                <th className="p-3">Tanggal</th>
                <th className="p-3">Supplier</th>
                <th className="p-3 text-right">Robux Awal</th>
                <th className="p-3 text-right">Sisa Stok</th>
                <th className="p-3 text-right">Modal / Unit</th>
                <th className="p-3 text-right">Total Biaya</th>
                <th className="p-3 text-center">Bayar</th>
                <th className="p-3">Catatan</th>
                <th className="p-3 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {batches.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-zinc-500">
                    Belum ada riwayat restock.
                  </td>
                </tr>
              ) : (
                batches.map(b => (
                  <tr key={b.id} className="hover:bg-white/5 transition">
                    <td className="p-3 font-mono font-bold text-zinc-300">{b.batch_code}</td>
                    <td className="p-3 text-zinc-400">{b.date.slice(0, 10)}</td>
                    <td className="p-3 font-medium text-white">{b.supplier}</td>
                    <td className="p-3 text-right font-mono text-zinc-400">
                      {formatNumber(b.initial_quantity)} R$
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-white">
                      {formatNumber(b.remaining_quantity)} R$
                    </td>
                    <td className="p-3 text-right font-mono text-zinc-300 font-semibold">
                      Rp{b.cost_per_unit}
                    </td>
                    <td className="p-3 text-right font-mono text-white">{formatRupiah(b.total_cost)}</td>
                    <td className="p-3 text-center">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          b.payment_status === 'LUNAS'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        }`}
                      >
                        {b.payment_status}
                      </span>
                    </td>
                    <td className="p-3 text-zinc-400 truncate max-w-[150px]">{b.notes || '-'}</td>
                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => openDetailBatch(b, false)}
                          className="p-1 text-zinc-400 hover:text-white rounded"
                          title="Lihat Pratinjau Batch"
                        >
                          <Eye size={14} />
                        </button>
                        <button
                          onClick={() => openDetailBatch(b, true)}
                          className="p-1 text-zinc-400 hover:text-sky-400 rounded"
                          title="Edit Data Batch Restock"
                        >
                          <Edit3 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail & Edit Batch Modal */}
      {selectedBatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#111114] border border-white/10 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <h4 className="font-heading font-bold text-white text-base flex items-center gap-2">
                  <span>{isEditingBatch ? 'Edit Batch Restock' : 'Detail Batch Restock'}</span>
                  <span className="font-mono text-xs px-2 py-0.5 rounded bg-white/10 text-zinc-300">
                    {selectedBatch.batch_code}
                  </span>
                </h4>
                <p className="text-xs text-zinc-400 mt-0.5">{selectedBatch.date.slice(0, 10)}</p>
              </div>
              <button
                onClick={() => {
                  setSelectedBatch(null);
                  setIsEditingBatch(false);
                }}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white bg-white/5"
              >
                ✕
              </button>
            </div>

            {isEditingBatch ? (
              /* Mode Edit Batch */
              <div className="space-y-3.5 text-xs">
                <div>
                  <label className="text-xs font-medium text-zinc-300 block mb-1">
                    Nama Supplier
                  </label>
                  <input
                    type="text"
                    value={editBatchForm.supplier}
                    onChange={e => setEditBatchForm({ ...editBatchForm, supplier: e.target.value })}
                    className="w-full bg-[#18181b] border border-white/10 rounded-xl px-3 py-2 text-xs text-white font-bold focus:outline-none"
                    placeholder="Nama supplier..."
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-zinc-300 block mb-1">
                    Status Pembayaran
                  </label>
                  <select
                    value={editBatchForm.payment_status}
                    onChange={e => setEditBatchForm({ ...editBatchForm, payment_status: e.target.value as any })}
                    className="w-full bg-[#18181b] border border-white/10 rounded-xl px-3 py-2 text-xs text-white font-bold focus:outline-none"
                  >
                    <option value="LUNAS">LUNAS</option>
                    <option value="BELUM_LUNAS">BELUM LUNAS (Utang Restock)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-zinc-300 block mb-1">
                    Catatan / Nomor Referensi
                  </label>
                  <textarea
                    rows={2}
                    value={editBatchForm.notes}
                    onChange={e => setEditBatchForm({ ...editBatchForm, notes: e.target.value })}
                    className="w-full bg-[#18181b] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                    placeholder="Catatan..."
                  />
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEditingBatch(false)}
                    className="px-4 py-2 rounded-xl border border-white/10 text-zinc-400 hover:text-white text-xs font-semibold transition"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveBatchEdit}
                    className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-white text-black font-bold text-xs hover:bg-zinc-200 transition"
                  >
                    <Save size={13} />
                    <span>Simpan Perubahan</span>
                  </button>
                </div>
              </div>
            ) : (
              /* Mode Pratinjau Batch */
              <div className="space-y-3 text-xs">
                <div className="flex justify-between py-1 border-b border-white/5">
                  <span className="text-zinc-400">Supplier:</span>
                  <span className="font-bold text-white">{selectedBatch.supplier}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-white/5">
                  <span className="text-zinc-400">Robux Awal:</span>
                  <span className="font-mono font-bold text-white">
                    {formatNumber(selectedBatch.initial_quantity)} R$
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-white/5">
                  <span className="text-zinc-400">Sisa Stok Saat Ini:</span>
                  <span className="font-mono font-bold text-emerald-400">
                    {formatNumber(selectedBatch.remaining_quantity)} R$
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-white/5">
                  <span className="text-zinc-400">Modal per Robux (HPP):</span>
                  <span className="font-mono font-semibold text-white">
                    Rp{selectedBatch.cost_per_unit} / R$
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-white/5">
                  <span className="text-zinc-400">Total Modal Pembelian:</span>
                  <span className="font-mono font-bold text-white">
                    {formatRupiah(selectedBatch.total_cost)}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-white/5">
                  <span className="text-zinc-400">Status Pembayaran:</span>
                  <span className={`font-bold px-2 py-0.5 rounded text-[10px] ${
                    selectedBatch.payment_status === 'LUNAS' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                  }`}>
                    {selectedBatch.payment_status}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-white/5">
                  <span className="text-zinc-400">Metode Bayar:</span>
                  <span className="text-white">{selectedBatch.payment_method}</span>
                </div>
                {selectedBatch.notes && (
                  <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                    <span className="text-zinc-500 block text-[11px] mb-1">Catatan:</span>
                    <p className="text-zinc-200">{selectedBatch.notes}</p>
                  </div>
                )}

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    onClick={() => setIsEditingBatch(true)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-white font-bold text-xs transition"
                  >
                    <Edit3 size={13} />
                    <span>Edit Data</span>
                  </button>
                  <button
                    onClick={() => {
                      setSelectedBatch(null);
                      setIsEditingBatch(false);
                    }}
                    className="px-4 py-2 rounded-xl bg-white text-black font-bold text-xs hover:bg-zinc-200 transition"
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
