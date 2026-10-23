import React, { useMemo, useState } from 'react';
import { Truck, Save, CheckCircle2 } from 'lucide-react';
import Swal from 'sweetalert2';
import { AppSettings, StockBatch } from '../types';
import { addBatch } from '../services/repository';
import { calculateRestockCost } from '../utils/calculations';
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
  const [extraCost, setExtraCost] = useState<number>(0);
  const [discount, setDiscount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<string>(settings.payment_methods[0] || 'BCA');
  const [paymentStatus, setPaymentStatus] = useState<'LUNAS' | 'BELUM_LUNAS'>('LUNAS');
  const [notes, setNotes] = useState<string>('');

  const restockCalc = useMemo(() => {
    return calculateRestockCost(purchaseCost, extraCost, discount, quantity);
  }, [purchaseCost, extraCost, discount, quantity]);

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
        extra_cost: extraCost,
        discount: discount,
        total_cost: restockCalc.totalCost,
        cost_per_unit: restockCalc.costPerUnit,
        payment_method: paymentMethod,
        payment_status: paymentStatus,
        notes: notes.trim(),
      });

      await onRefreshData();

      Swal.fire({
        icon: 'success',
        title: 'Restock Berhasil Disimpan!',
        text: `Batch baru berhasil dibuat dengan HPP modal Rp${restockCalc.costPerUnit} / Robux.`,
        timer: 1600,
        showConfirmButton: false,
      });

      setNotes('');
    } catch (err: any) {
      Swal.fire({
        icon: 'error',
        title: 'Gagal Menyimpan Restock',
        text: err.message,
      });
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
                Biaya Tambahan / Admin (Rp)
              </label>
              <input
                type="number"
                min="0"
                value={extraCost || ''}
                placeholder="0"
                onChange={e => setExtraCost(Number(e.target.value))}
                className="w-full bg-[#111114] border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-white/30"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-zinc-300 block mb-1">
                Diskon Pembelian (Rp)
              </label>
              <input
                type="number"
                min="0"
                value={discount || ''}
                placeholder="0"
                onChange={e => setDiscount(Number(e.target.value))}
                className="w-full bg-[#111114] border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-white/30"
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

              {extraCost > 0 && (
                <div className="flex justify-between text-zinc-400">
                  <span>Biaya Admin / Transfer:</span>
                  <span className="font-mono text-white">+{formatRupiah(extraCost)}</span>
                </div>
              )}

              {discount > 0 && (
                <div className="flex justify-between text-amber-300">
                  <span>Diskon Pembelian:</span>
                  <span className="font-mono">-{formatRupiah(discount)}</span>
                </div>
              )}

              <div className="flex justify-between text-sm font-bold text-white border-t border-white/10 pt-2">
                <span>Total Modal Batch:</span>
                <span className="font-mono text-white">
                  {formatRupiah(restockCalc.totalCost)}
                </span>
              </div>

              <div className="flex justify-between text-base font-bold border-t border-white/10 pt-2 text-white">
                <span>Modal per Robux (HPP):</span>
                <span className="font-mono">Rp{restockCalc.costPerUnit} / R$</span>
              </div>
            </div>

            <div className="mt-5 p-3.5 rounded-xl bg-[#111114] border border-white/10 text-[11px] text-zinc-400 space-y-2">
              <div className="flex items-center gap-1.5 font-bold text-zinc-200">
                <CheckCircle2 size={13} className="text-white" />
                <span>Aturan Akuntansi Baku</span>
              </div>
              <p>
                Pembelian stok ini <strong>tidak mengurangi laba</strong> bisnis Anda secara langsung. Uang tunai berubah menjadi aset persediaan senilai{' '}
                <strong className="text-white font-mono">{formatRupiah(restockCalc.totalCost)}</strong>.
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
          <table className="w-full text-left text-xs min-w-[800px]">
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
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {batches.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-zinc-500">
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
                    <td className="p-3 text-zinc-400">{b.notes || '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
