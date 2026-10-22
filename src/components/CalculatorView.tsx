import React, { useState } from 'react';
import { Calculator, CheckCircle, XCircle, Info } from 'lucide-react';
import { calculateQuickSales } from '../utils/calculations';
import { formatRupiah } from '../utils/formatters';

export const CalculatorView: React.FC = () => {
  const [quantity, setQuantity] = useState<number>(100);
  const [sellRate, setSellRate] = useState<number>(166);
  const [costPerUnit, setCostPerUnit] = useState<number>(160);
  const [discountNominal, setDiscountNominal] = useState<number>(0);
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [feeNominal, setFeeNominal] = useState<number>(0);
  const [feePercent, setFeePercent] = useState<number>(0);

  const result = calculateQuickSales({
    quantity,
    sell_rate: sellRate,
    cost_per_unit: costPerUnit,
    discount_nominal: discountNominal,
    discount_percent: discountPercent,
    fee_nominal: feeNominal,
    fee_percent: feePercent,
  });

  return (
    <div className="space-y-6">
      <div className="bg-[#09090b] p-5 rounded-2xl border border-white/10">
        <h2 className="text-lg font-heading font-bold text-white flex items-center gap-2">
          <Calculator className="text-white" size={20} />
          <span>Kalkulator Penjualan Cepat</span>
        </h2>
        <p className="text-xs text-zinc-400 mt-1">
          Simulasikan keuntungan instan untuk penawaran pesanan pelanggan tanpa perlu menyimpan transaksi ke database.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Parameters */}
        <div className="bg-[#09090b] p-6 rounded-2xl border border-white/10 space-y-4">
          <h3 className="font-heading font-bold text-white text-sm border-b border-white/10 pb-3">
            Parameter Penjualan
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-zinc-300 block mb-1">
                Jumlah Robux (R$)
              </label>
              <input
                type="number"
                min="1"
                value={quantity || ''}
                onChange={e => setQuantity(Number(e.target.value))}
                className="w-full bg-[#111114] border border-white/10 rounded-xl px-3 py-2 text-sm font-mono font-bold text-white focus:outline-none focus:border-white/30"
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
                value={sellRate || ''}
                onChange={e => setSellRate(Number(e.target.value))}
                className="w-full bg-[#111114] border border-white/10 rounded-xl px-3 py-2 text-sm font-mono font-bold text-white focus:outline-none focus:border-white/30"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-zinc-300 block mb-1">
                Modal per Robux (HPP) (Rp)
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={costPerUnit || ''}
                onChange={e => setCostPerUnit(Number(e.target.value))}
                className="w-full bg-[#111114] border border-white/10 rounded-xl px-3 py-2 text-sm font-mono text-zinc-300 focus:outline-none focus:border-white/30"
              />
              <span className="text-[10px] text-zinc-500">Harga modal beli Anda</span>
            </div>

            <div>
              <label className="text-xs font-medium text-zinc-300 block mb-1">
                Diskon Nominal (Rp)
              </label>
              <input
                type="number"
                min="0"
                value={discountNominal || ''}
                placeholder="0"
                onChange={e => setDiscountNominal(Number(e.target.value))}
                className="w-full bg-[#111114] border border-white/10 rounded-xl px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-white/30"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-zinc-300 block mb-1">
                Diskon Persen (%)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={discountPercent || ''}
                placeholder="0"
                onChange={e => setDiscountPercent(Number(e.target.value))}
                className="w-full bg-[#111114] border border-white/10 rounded-xl px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-white/30"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-zinc-300 block mb-1">
                Biaya Tetap / Admin (Rp)
              </label>
              <input
                type="number"
                min="0"
                value={feeNominal || ''}
                placeholder="0"
                onChange={e => setFeeNominal(Number(e.target.value))}
                className="w-full bg-[#111114] border border-white/10 rounded-xl px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-white/30"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-zinc-300 block mb-1">
                Fee Persentase Marketplace (%)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={feePercent || ''}
                placeholder="0"
                onChange={e => setFeePercent(Number(e.target.value))}
                className="w-full bg-[#111114] border border-white/10 rounded-xl px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-white/30"
              />
            </div>
          </div>
        </div>

        {/* Calculation Output Card */}
        <div className="bg-[#09090b] p-6 rounded-2xl border border-white/10 space-y-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="font-heading font-bold text-white text-sm">Hasil Analisis Keuangan</h3>
              <div
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                  result.status === 'UNTUNG'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : result.status === 'RUGI'
                    ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                    : 'bg-[#18181b] text-zinc-400 border border-white/10'
                }`}
              >
                {result.status === 'UNTUNG' && <CheckCircle size={13} />}
                {result.status === 'RUGI' && <XCircle size={13} />}
                {result.status === 'IMPAS' && <Info size={13} />}
                <span>STATUS: {result.status}</span>
              </div>
            </div>

            <div className="space-y-3 text-xs mt-4">
              <div className="flex justify-between text-zinc-400">
                <span>Harga Normal:</span>
                <span className="font-mono text-white font-semibold">
                  {formatRupiah(result.normal_price)}
                </span>
              </div>

              {result.discount > 0 && (
                <div className="flex justify-between text-amber-300">
                  <span>Total Diskon:</span>
                  <span className="font-mono font-semibold">
                    -{formatRupiah(result.discount)}
                  </span>
                </div>
              )}

              <div className="flex justify-between text-sm font-bold text-white border-t border-white/10 pt-2">
                <span>Harga Bayar Pelanggan:</span>
                <span className="font-mono">
                  {formatRupiah(result.final_price)}
                </span>
              </div>

              <div className="flex justify-between text-zinc-400">
                <span>Total Modal (COGS):</span>
                <span className="font-mono text-zinc-300">
                  {formatRupiah(result.total_cogs)}
                </span>
              </div>

              {result.fee > 0 && (
                <div className="flex justify-between text-zinc-400">
                  <span>Total Fee / Admin:</span>
                  <span className="font-mono text-rose-300">
                    -{formatRupiah(result.fee)}
                  </span>
                </div>
              )}

              <div className="flex justify-between text-zinc-300">
                <span>Laba Kotor:</span>
                <span className="font-mono font-semibold">
                  {formatRupiah(result.gross_profit)}
                </span>
              </div>

              <div className="flex justify-between text-base font-bold border-t border-white/10 pt-2.5">
                <span className="text-white">Laba Bersih Perkiraan:</span>
                <span
                  className={`font-mono ${
                    result.net_profit >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {formatRupiah(result.net_profit)}
                </span>
              </div>

              <div className="flex justify-between text-zinc-400 font-mono">
                <span>Margin Keuntungan:</span>
                <span className="font-bold text-white">
                  {result.margin_percentage !== null ? `${result.margin_percentage}%` : 'N/A'}
                </span>
              </div>
            </div>
          </div>

          {/* Break-even point box */}
          <div className="p-4 rounded-xl bg-[#111114] border border-white/10 text-xs space-y-1.5 font-mono">
            <div className="flex items-center justify-between text-zinc-300 font-bold font-sans">
              <span>Rate Titik Impas (BEP):</span>
              <span className="font-mono text-white text-sm">
                Rp{result.break_even_price} / R$
              </span>
            </div>
            <p className="text-[11px] font-sans text-zinc-400">
              {sellRate < result.break_even_price ? (
                <span className="text-rose-400 font-medium">
                  ⚠️ Peringatan: Rate jual Anda (Rp{sellRate}) di bawah titik impas! Anda akan rugi Rp
                  {Math.abs(result.net_profit).toLocaleString('id-ID')}.
                </span>
              ) : (
                <span className="text-emerald-400 font-medium">
                  ✓ Rate jual Anda aman di atas titik impas. Estimasi laba Rp
                  {result.net_profit.toLocaleString('id-ID')}.
                </span>
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
