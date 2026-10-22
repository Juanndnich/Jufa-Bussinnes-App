import React, { useMemo, useState } from 'react';
import {
  TrendingUp,
  AlertTriangle,
  Sliders,
} from 'lucide-react';
import { StockBatch } from '../types';
import { formatDecimal, formatNumber, formatRupiah } from '../utils/formatters';

interface PriceSimulatorViewProps {
  batches: StockBatch[];
}

export const PriceSimulatorView: React.FC<PriceSimulatorViewProps> = ({ batches }) => {
  const [selectedBatchId, setSelectedBatchId] = useState<string>('');
  const [customUnitCost, setCustomUnitCost] = useState<number>(160);
  const [targetRobuxOrder, setTargetRobuxOrder] = useState<number>(100);
  const [desiredRate, setDesiredRate] = useState<number>(166);
  const [fixedFee, setFixedFee] = useState<number>(0);
  const [variableFeePercent, setVariableFeePercent] = useState<number>(0);
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [targetMarginPercent, setTargetMarginPercent] = useState<number>(10);

  const [compareRates, setCompareRates] = useState<number[]>([150, 155, 160, 165, 170, 171]);
  const [newRateInput, setNewRateInput] = useState<number>(175);

  const activeCostPerUnit = useMemo(() => {
    if (selectedBatchId) {
      const b = batches.find(x => x.id === selectedBatchId);
      if (b) return b.cost_per_unit;
    }
    return customUnitCost;
  }, [selectedBatchId, batches, customUnitCost]);

  const totalStockAvailable = useMemo(() => {
    return batches.reduce((sum, b) => sum + b.remaining_quantity, 0);
  }, [batches]);

  const sim = useMemo(() => {
    const qty = targetRobuxOrder;
    const rate = desiredRate;
    const cost = activeCostPerUnit;

    const normalGross = qty * rate;
    const disc = Math.round((normalGross * discountPercent) / 100);
    const netRevenue = Math.max(0, normalGross - disc);
    const cogs = Math.round(qty * cost);

    const fee = Math.round(fixedFee + (netRevenue * variableFeePercent) / 100);
    const grossProfit = netRevenue - cogs;
    const netProfit = grossProfit - fee;
    const margin = netRevenue > 0 ? (netProfit / netRevenue) * 100 : 0;

    const denom = qty * (1 - discountPercent / 100) * (1 - variableFeePercent / 100);
    const breakEvenRate = denom > 0 ? Number((((qty * cost) + fixedFee) / denom).toFixed(2)) : 0;

    const targetMarginFactor = 1 - (targetMarginPercent / 100) - (variableFeePercent / 100);
    const rateForTargetMargin =
      targetMarginFactor > 0 && qty * (1 - discountPercent / 100) > 0
        ? Number(
            (((qty * cost) + fixedFee) / (qty * (1 - discountPercent / 100) * targetMarginFactor)).toFixed(2)
          )
        : 0;

    const stockQty = totalStockAvailable > 0 ? totalStockAvailable : 10000;
    const projections = [1.0, 0.75, 0.5, 0.25].map(pct => {
      const soldRobux = Math.round(stockQty * pct);
      const remainingRobux = stockQty - soldRobux;
      const projRev = Math.round(soldRobux * rate * (1 - discountPercent / 100));
      const projCogs = Math.round(soldRobux * cost);
      const projFee = Math.round(fixedFee * (soldRobux / Math.max(1, qty)) + (projRev * variableFeePercent) / 100);
      const projProfit = projRev - projCogs - projFee;
      const remainingValue = Math.round(remainingRobux * cost);

      return {
        percent: pct * 100,
        soldRobux,
        remainingRobux,
        projRev,
        projCogs,
        projProfit,
        remainingValue,
      };
    });

    let status: 'UNTUNG' | 'IMPAS' | 'RUGI' = 'IMPAS';
    if (netProfit > 0) status = 'UNTUNG';
    else if (netProfit < 0) status = 'RUGI';

    return {
      normalGross,
      disc,
      netRevenue,
      cogs,
      fee,
      grossProfit,
      netProfit,
      margin,
      breakEvenRate,
      rateForTargetMargin,
      projections,
      status,
      isBelowCost: rate < cost,
    };
  }, [
    targetRobuxOrder,
    desiredRate,
    activeCostPerUnit,
    fixedFee,
    variableFeePercent,
    discountPercent,
    targetMarginPercent,
    totalStockAvailable,
  ]);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-[#09090b] p-5 rounded-2xl border border-white/10">
        <h2 className="text-lg font-heading font-bold text-white flex items-center gap-2">
          <TrendingUp className="text-white" size={20} />
          <span>Simulator Harga Jual & Titik Impas</span>
        </h2>
        <p className="text-xs text-zinc-400 mt-1">
          Uji sensitivitas harga untuk menjamin bisnis tidak merugi, menghitung rate minimum impas, dan proyeksi perputaran stok.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Simulator Control Inputs */}
        <div className="bg-[#09090b] p-6 rounded-2xl border border-white/10 space-y-4">
          <h3 className="font-heading font-bold text-white text-sm border-b border-white/10 pb-3 flex items-center gap-2">
            <Sliders size={15} />
            <span>Parameter Simulasi</span>
          </h3>

          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-zinc-300 block mb-1">
                Pilih Batch Stok Acuan
              </label>
              <select
                value={selectedBatchId}
                onChange={e => setSelectedBatchId(e.target.value)}
                className="w-full bg-[#111114] border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
              >
                <option value="">Manual / Kustom (Ketik di bawah)</option>
                {batches.map(b => (
                  <option key={b.id} value={b.id}>
                    {b.batch_code} (Modal: Rp{b.cost_per_unit} / R$ - Sisa {formatNumber(b.remaining_quantity)} R$)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-zinc-300 block mb-1">
                Modal per Robux (HPP) (Rp)
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={activeCostPerUnit}
                onChange={e => {
                  setSelectedBatchId('');
                  setCustomUnitCost(Number(e.target.value));
                }}
                className="w-full bg-[#111114] border border-white/10 rounded-xl px-3 py-2 text-xs font-mono font-bold text-zinc-300"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-zinc-300 block mb-1">
                Rate Jual yang Diuji (Rp / R$)
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={desiredRate}
                onChange={e => setDesiredRate(Number(e.target.value))}
                className="w-full bg-[#111114] border border-white/10 rounded-xl px-3 py-2 text-xs font-mono font-bold text-white"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-zinc-300 block mb-1">
                Jumlah Robux per Order (R$)
              </label>
              <input
                type="number"
                min="1"
                value={targetRobuxOrder}
                onChange={e => setTargetRobuxOrder(Number(e.target.value))}
                className="w-full bg-[#111114] border border-white/10 rounded-xl px-3 py-2 text-xs font-mono font-bold text-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-zinc-300 block mb-1">
                  Diskon (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={discountPercent}
                  onChange={e => setDiscountPercent(Number(e.target.value))}
                  className="w-full bg-[#111114] border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-white"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-zinc-300 block mb-1">
                  Target Margin (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="99"
                  value={targetMarginPercent}
                  onChange={e => setTargetMarginPercent(Number(e.target.value))}
                  className="w-full bg-[#111114] border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-emerald-400"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-zinc-300 block mb-1">
                  Fee Tetap (Rp)
                </label>
                <input
                  type="number"
                  min="0"
                  value={fixedFee}
                  onChange={e => setFixedFee(Number(e.target.value))}
                  className="w-full bg-[#111114] border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-white"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-zinc-300 block mb-1">
                  Fee Variabel (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={variableFeePercent}
                  onChange={e => setVariableFeePercent(Number(e.target.value))}
                  className="w-full bg-[#111114] border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-white"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Calculation Summary Card */}
        <div className="bg-[#09090b] p-6 rounded-2xl border border-white/10 space-y-4 lg:col-span-2 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="font-heading font-bold text-white text-sm">Evaluasi Keuntungan & Titik Impas</h3>
              <span
                className={`px-3 py-0.5 rounded-full text-xs font-bold ${
                  sim.status === 'UNTUNG'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : sim.status === 'RUGI'
                    ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                    : 'bg-[#18181b] text-zinc-400 border border-white/10'
                }`}
              >
                {sim.status}
              </span>
            </div>

            {sim.isBelowCost && (
              <div className="p-3 mt-4 rounded-xl bg-rose-950/30 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
                <AlertTriangle size={16} className="shrink-0 text-rose-400" />
                <span>
                  <strong>BAHAYA:</strong> Rate jual yang diuji (Rp{desiredRate}) berada di bawah modal dasar (Rp{activeCostPerUnit}).
                </span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 font-mono">
              <div className="p-4 rounded-xl bg-[#111114] border border-white/10 space-y-2 text-xs">
                <span className="font-heading font-bold text-white block text-xs">Titik Impas (BEP)</span>
                <div className="flex justify-between text-zinc-400">
                  <span className="font-sans">Rate Minimum Impas:</span>
                  <span className="font-bold text-white text-sm">
                    Rp{sim.breakEvenRate} / R$
                  </span>
                </div>
                <div className="flex justify-between text-zinc-400">
                  <span className="font-sans">Target Margin {targetMarginPercent}%:</span>
                  <span className="font-bold text-emerald-400">
                    Rp{sim.rateForTargetMargin} / R$
                  </span>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[#111114] border border-white/10 space-y-2 text-xs">
                <span className="font-heading font-bold text-white block text-xs">Hasil Pesanan {targetRobuxOrder} R$</span>
                <div className="flex justify-between text-zinc-400">
                  <span className="font-sans">Omzet Bersih:</span>
                  <span className="text-white font-semibold">
                    {formatRupiah(sim.netRevenue)}
                  </span>
                </div>
                <div className="flex justify-between text-zinc-400">
                  <span className="font-sans">Modal HPP:</span>
                  <span className="text-zinc-300">
                    {formatRupiah(sim.cogs)}
                  </span>
                </div>
                <div className="flex justify-between text-zinc-400">
                  <span className="font-sans">Laba Bersih:</span>
                  <span
                    className={`font-bold ${
                      sim.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {formatRupiah(sim.netProfit)} ({formatDecimal(sim.margin, 1)}%)
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Projections Table for Inventory Run-off */}
          <div className="mt-4 pt-4 border-t border-white/10">
            <h4 className="text-xs font-heading font-bold text-zinc-300 mb-2">
              Proyeksi Perputaran Stok ({formatNumber(totalStockAvailable || 10000)} R$ pada Rate Rp{desiredRate})
            </h4>
            <div className="overflow-x-auto border border-white/10 rounded-xl">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-[#111114] text-zinc-400 border-b border-white/10 font-sans">
                  <tr>
                    <th className="p-2">Target</th>
                    <th className="p-2 text-right">Robux Terjual</th>
                    <th className="p-2 text-right">Omzet</th>
                    <th className="p-2 text-right">HPP</th>
                    <th className="p-2 text-right">Laba</th>
                    <th className="p-2 text-right">Sisa Nilai</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {sim.projections.map(p => (
                    <tr key={p.percent} className="hover:bg-white/5">
                      <td className="p-2 font-bold text-white font-sans">{p.percent}% Stok</td>
                      <td className="p-2 text-right text-white">
                        {formatNumber(p.soldRobux)} R$
                      </td>
                      <td className="p-2 text-right text-white">
                        {formatRupiah(p.projRev)}
                      </td>
                      <td className="p-2 text-right text-zinc-400">
                        {formatRupiah(p.projCogs)}
                      </td>
                      <td
                        className={`p-2 text-right font-bold ${
                          p.projProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {formatRupiah(p.projProfit)}
                      </td>
                      <td className="p-2 text-right text-zinc-500">
                        {formatRupiah(p.remainingValue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Multi-rate Scenario Comparison Table */}
      <div className="bg-[#09090b] p-6 rounded-2xl border border-white/10 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-3">
          <div>
            <h3 className="font-heading font-bold text-white text-sm">Tabel Perbandingan Skenario Rate Jual</h3>
            <p className="text-xs text-zinc-400">
              Evaluasi berbagai tingkat harga pasar dengan modal Rp{activeCostPerUnit} / R$
            </p>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="number"
              step="0.1"
              value={newRateInput}
              onChange={e => setNewRateInput(Number(e.target.value))}
              className="bg-[#111114] border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white w-28 font-mono"
              placeholder="Rate baru"
            />
            <button
              onClick={() => {
                if (newRateInput > 0 && !compareRates.includes(newRateInput)) {
                  setCompareRates([...compareRates, newRateInput].sort((a, b) => a - b));
                }
              }}
              className="px-3 py-1.5 rounded-xl bg-white hover:bg-zinc-200 text-black font-bold text-xs transition"
            >
              + Tambah Rate
            </button>
          </div>
        </div>

        <div className="overflow-x-auto border border-white/10 rounded-xl">
          <table className="w-full text-left text-xs min-w-[700px] font-mono">
            <thead className="bg-[#111114] text-zinc-400 border-b border-white/10 font-sans">
              <tr>
                <th className="p-3">Skenario Rate</th>
                <th className="p-3 text-right">Omzet / 100 R$</th>
                <th className="p-3 text-right">Modal / 100 R$</th>
                <th className="p-3 text-right">Laba / 100 R$</th>
                <th className="p-3 text-right">Margin</th>
                <th className="p-3 text-center">Status</th>
                <th className="p-3 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {compareRates.map(r => {
                const rev = 100 * r;
                const cost = 100 * activeCostPerUnit;
                const profit = rev - cost;
                const margin = (profit / rev) * 100;
                const isProfitable = profit > 0;
                const isZero = profit === 0;

                return (
                  <tr key={r} className="hover:bg-white/5 transition">
                    <td className="p-3 font-bold text-white text-sm">
                      Rp{r} / Robux
                    </td>
                    <td className="p-3 text-right text-white">{formatRupiah(rev)}</td>
                    <td className="p-3 text-right text-zinc-400">{formatRupiah(cost)}</td>
                    <td
                      className={`p-3 text-right font-bold ${
                        isProfitable ? 'text-emerald-400' : isZero ? 'text-zinc-400' : 'text-rose-400'
                      }`}
                    >
                      {formatRupiah(profit)}
                    </td>
                    <td className="p-3 text-right text-zinc-300">
                      {formatDecimal(margin, 1)}%
                    </td>
                    <td className="p-3 text-center font-sans">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          isProfitable
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : isZero
                            ? 'bg-[#18181b] text-zinc-400'
                            : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                        }`}
                      >
                        {isProfitable ? 'UNTUNG' : isZero ? 'IMPAS' : 'RUGI'}
                      </span>
                    </td>
                    <td className="p-3 text-center font-sans">
                      {compareRates.length > 2 && (
                        <button
                          onClick={() => setCompareRates(compareRates.filter(x => x !== r))}
                          className="text-zinc-500 hover:text-rose-400 text-xs"
                        >
                          ✕
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
