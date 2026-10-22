import React, { useMemo, useState } from 'react';
import {
  FileText,
  Printer,
  Calendar,
  Layers,
  Database,
  FileSpreadsheet,
} from 'lucide-react';
import Swal from 'sweetalert2';
import { AppSettings, Cashflow, StockBatch, Transaction } from '../types';
import { exportSqliteBinary } from '../services/db';
import { formatNumber, formatRupiah } from '../utils/formatters';

interface ReportsViewProps {
  transactions: Transaction[];
  batches: StockBatch[];
  cashflows: Cashflow[];
  settings: AppSettings;
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  transactions,
  batches,
  cashflows,
  settings,
}) => {
  const [reportType, setReportType] = useState<
    'sales' | 'profit_loss' | 'cashflow' | 'inventory' | 'receivables'
  >('sales');

  const [dateFilter, setDateFilter] = useState<'30days' | 'thisMonth' | 'all'>('thisMonth');

  // Filtered transactions for report
  const filteredData = useMemo(() => {
    const now = new Date();
    let startDate = new Date(1970, 0, 1);
    let endDate = new Date(2099, 11, 31);

    if (dateFilter === '30days') {
      startDate = new Date();
      startDate.setDate(now.getDate() - 30);
    } else if (dateFilter === 'thisMonth') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    }

    const trxs = transactions.filter(t => {
      const d = new Date(t.date);
      return d >= startDate && d <= endDate;
    });

    const cfs = cashflows.filter(c => {
      const d = new Date(c.date);
      return d >= startDate && d <= endDate;
    });

    return { trxs, cfs, startDate, endDate };
  }, [transactions, cashflows, dateFilter]);

  // Aggregate Figures
  const summary = useMemo(() => {
    const validTrxs = filteredData.trxs.filter(t => t.status === 'ACTIVE');
    const grossRev = validTrxs.reduce((sum, t) => sum + t.gross_revenue, 0);
    const disc = validTrxs.reduce((sum, t) => sum + t.discount, 0);
    const netRev = validTrxs.reduce((sum, t) => sum + t.net_revenue, 0);
    const cogs = validTrxs.reduce((sum, t) => sum + t.cogs, 0);
    const grossProfit = netRev - cogs;
    const fees = validTrxs.reduce((sum, t) => sum + t.fee, 0);

    const opExpenses = filteredData.cfs
      .filter(c => c.type === 'OUT' && c.category === 'BIAYA_OPERASIONAL')
      .reduce((sum, c) => sum + c.amount, 0);

    const netProfit = grossProfit - fees - opExpenses;
    const totalRobux = validTrxs.reduce((sum, t) => sum + t.quantity, 0);

    const cashIn = filteredData.cfs.filter(c => c.type === 'IN').reduce((sum, c) => sum + c.amount, 0);
    const cashOut = filteredData.cfs.filter(c => c.type === 'OUT').reduce((sum, c) => sum + c.amount, 0);

    const receivables = validTrxs.reduce((sum, t) => sum + t.accounts_receivable, 0);

    return {
      grossRev,
      disc,
      netRev,
      cogs,
      grossProfit,
      fees,
      opExpenses,
      netProfit,
      totalRobux,
      cashIn,
      cashOut,
      receivables,
    };
  }, [filteredData]);

  // Export CSV Helper
  const handleExportCSV = () => {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    let csvContent = '\uFEFF'; // UTF-8 BOM
    let filename = `JUFA_STORE_Laporan_${reportType}_${dateStr}.csv`;

    if (reportType === 'sales') {
      csvContent += 'Kode Transaksi;Tanggal;Pelanggan;Robux;Rate;Pendapatan Bersih;HPP Modal;Laba Bersih;Status Bayar;Metode;Status\n';
      filteredData.trxs.forEach(t => {
        csvContent += `"${t.transaction_code}";"${t.date.slice(0, 10)}";"${t.customer_name}";${t.quantity};${t.sell_rate};${t.net_revenue};${t.cogs};${t.net_profit};"${t.payment_status}";"${t.payment_method}";"${t.status}"\n`;
      });
    } else if (reportType === 'cashflow') {
      csvContent += 'Tanggal;Jenis;Kategori;Nominal;Metode;Catatan\n';
      filteredData.cfs.forEach(c => {
        csvContent += `"${c.date.slice(0, 10)}";"${c.type}";"${c.category}";${c.amount};"${c.payment_method}";"${c.notes}"\n`;
      });
    } else if (reportType === 'inventory') {
      csvContent += 'Kode Batch;Tanggal Restock;Supplier;Robux Awal;Sisa Robux;Modal/Unit (HPP);Total Biaya;Nilai Sisa\n';
      batches.forEach(b => {
        csvContent += `"${b.batch_code}";"${b.date.slice(0, 10)}";"${b.supplier}";${b.initial_quantity};${b.remaining_quantity};${b.cost_per_unit};${b.total_cost};${b.remaining_quantity * b.cost_per_unit}\n`;
      });
    } else {
      csvContent += 'Pos Laporan;Nilai (Rp)\n';
      csvContent += `Pendapatan Kotor;${summary.grossRev}\n`;
      csvContent += `Diskon Penjualan;${summary.disc}\n`;
      csvContent += `Pendapatan Bersih;${summary.netRev}\n`;
      csvContent += `Harga Pokok Penjualan (HPP);${summary.cogs}\n`;
      csvContent += `Laba Kotor;${summary.grossProfit}\n`;
      csvContent += `Biaya Transaksi / Layanan;${summary.fees}\n`;
      csvContent += `Biaya Operasional;${summary.opExpenses}\n`;
      csvContent += `Laba Bersih;${summary.netProfit}\n`;
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export SQLite Binary
  const handleExportSQLite = async () => {
    try {
      const binary = await exportSqliteBinary();
      const blob = new Blob([binary as unknown as BlobPart], { type: 'application/x-sqlite3' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `jufa_store_database_${new Date().toISOString().slice(0, 10)}.sqlite`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      Swal.fire({
        icon: 'success',
        title: 'Database SQLite Diekspor',
        text: 'File binary database SQLite nyata berhasil diunduh.',
        timer: 1600,
        showConfirmButton: false,
      });
    } catch (err: any) {
      Swal.fire({
        icon: 'error',
        title: 'Ekspor Gagal',
        text: err.message,
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#09090b] p-5 rounded-2xl border border-white/10">
        <div>
          <h2 className="text-xl font-poppins font-bold text-white flex items-center gap-2">
            <FileText className="text-white" size={22} />
            <span>Laporan Keuangan & Ekspor Data</span>
          </h2>
          <p className="text-xs text-neutral-400 mt-1">
            Pembukuan resmi, ringkasan laba rugi, ekspor CSV, backup SQLite, dan cetak PDF.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#111114] hover:bg-neutral-800 text-neutral-200 text-xs font-semibold border border-white/10 hover:border-white/20 transition"
          >
            <FileSpreadsheet size={14} className="text-emerald-400" />
            <span>Ekspor CSV</span>
          </button>
          <button
            onClick={handleExportSQLite}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#111114] hover:bg-neutral-800 text-neutral-200 text-xs font-semibold border border-white/10 hover:border-white/20 transition"
          >
            <Database size={14} className="text-white" />
            <span>Unduh File .SQLite</span>
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white hover:bg-neutral-200 text-black text-xs font-bold transition"
          >
            <Printer size={15} />
            <span>Cetak / PDF</span>
          </button>
        </div>
      </div>

      {/* Report Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#09090b] p-3 rounded-2xl border border-white/10">
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            ['sales', 'Laporan Penjualan'],
            ['profit_loss', 'Laba Rugi'],
            ['cashflow', 'Arus Kas'],
            ['inventory', 'Persediaan Stok'],
            ['receivables', 'Piutang & Utang'],
          ].map(([k, label]) => (
            <button
              key={k}
              onClick={() => setReportType(k as any)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                reportType === k
                  ? 'bg-white text-black font-bold'
                  : 'text-neutral-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-neutral-400">Periode:</span>
          <select
            value={dateFilter}
            onChange={e => setDateFilter(e.target.value as any)}
            className="bg-[#111114] border border-white/10 rounded-xl px-2.5 py-1 text-xs text-white focus:outline-none focus:border-white/30"
          >
            <option value="thisMonth">Bulan Ini</option>
            <option value="30days">30 Hari Terakhir</option>
            <option value="all">Semua Data</option>
          </select>
        </div>
      </div>

      {/* Main Report Printable Content */}
      <div className="bg-[#09090b] p-8 rounded-2xl border border-white/10 space-y-6 print:bg-white print:text-black">
        {/* Printable Header */}
        <div className="border-b border-white/10 pb-5 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-poppins font-black text-white print:text-black">{settings.store_name}</h1>
            <p className="text-xs text-neutral-400 print:text-neutral-700 font-semibold uppercase tracking-wider mt-0.5">
              Laporan Keuangan & Operasional — Robux Business
            </p>
          </div>
          <div className="text-right text-xs text-neutral-400 print:text-neutral-600 font-mono">
            <div>Dicetak: {new Date().toLocaleString('id-ID')} WIB</div>
            <div>Mata Uang: IDR (Rupiah)</div>
          </div>
        </div>

        {/* 1. Profit & Loss Statement */}
        {reportType === 'profit_loss' && (
          <div className="space-y-4">
            <h3 className="font-poppins font-bold text-white text-base print:text-black">
              Laporan Laba Rugi (Income Statement)
            </h3>
            <div className="overflow-x-auto border border-white/10 rounded-xl">
              <table className="w-full text-left text-xs">
                <tbody className="divide-y divide-white/5">
                  <tr className="hover:bg-white/[0.02]">
                    <td className="p-3 text-neutral-300">Pendapatan Kotor Penjualan</td>
                    <td className="p-3 text-right font-mono font-bold text-white">
                      {formatRupiah(summary.grossRev)}
                    </td>
                  </tr>
                  <tr className="hover:bg-white/[0.02]">
                    <td className="p-3 text-amber-400">Dikurangi: Diskon Penjualan</td>
                    <td className="p-3 text-right font-mono text-amber-400">
                      -{formatRupiah(summary.disc)}
                    </td>
                  </tr>
                  <tr className="bg-white/[0.03] font-bold">
                    <td className="p-3 text-white">Pendapatan Bersih Penjualan</td>
                    <td className="p-3 text-right font-mono text-white">
                      {formatRupiah(summary.netRev)}
                    </td>
                  </tr>
                  <tr className="hover:bg-white/[0.02]">
                    <td className="p-3 text-neutral-400">Dikurangi: Modal Barang Terjual (HPP / FIFO)</td>
                    <td className="p-3 text-right font-mono text-neutral-400">
                      -{formatRupiah(summary.cogs)}
                    </td>
                  </tr>
                  <tr className="bg-white/[0.03] font-bold">
                    <td className="p-3 text-white">Laba Kotor (Gross Profit)</td>
                    <td className="p-3 text-right font-mono text-white">
                      {formatRupiah(summary.grossProfit)}
                    </td>
                  </tr>
                  <tr className="hover:bg-white/[0.02]">
                    <td className="p-3 text-neutral-400">Dikurangi: Biaya Layanan / Fee Transaksi</td>
                    <td className="p-3 text-right font-mono text-neutral-400">
                      -{formatRupiah(summary.fees)}
                    </td>
                  </tr>
                  <tr className="hover:bg-white/[0.02]">
                    <td className="p-3 text-neutral-400">Dikurangi: Biaya Operasional Bisnis</td>
                    <td className="p-3 text-right font-mono text-neutral-400">
                      -{formatRupiah(summary.opExpenses)}
                    </td>
                  </tr>
                  <tr className="bg-white/[0.06] font-extrabold text-sm border-t border-white/15">
                    <td className="p-3 text-white font-poppins">LABA BERSIH (NET PROFIT)</td>
                    <td
                      className={`p-3 text-right font-mono ${
                        summary.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {formatRupiah(summary.netProfit)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 2. Sales Report */}
        {reportType === 'sales' && (
          <div className="space-y-4">
            <h3 className="font-poppins font-bold text-white text-base print:text-black">
              Laporan Rincian Penjualan ({filteredData.trxs.length} Transaksi)
            </h3>
            <div className="overflow-x-auto border border-white/10 rounded-xl">
              <table className="w-full text-left text-xs min-w-[700px]">
                <thead className="bg-[#111114] text-neutral-400 border-b border-white/10 font-medium">
                  <tr>
                    <th className="p-2.5">Kode Transaksi</th>
                    <th className="p-2.5">Tanggal</th>
                    <th className="p-2.5">Pelanggan</th>
                    <th className="p-2.5 text-right">Robux</th>
                    <th className="p-2.5 text-right">Rate</th>
                    <th className="p-2.5 text-right">Omzet</th>
                    <th className="p-2.5 text-right">HPP</th>
                    <th className="p-2.5 text-right">Laba Bersih</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredData.trxs.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-6 text-center text-neutral-500">
                        Tidak ada data transaksi pada periode yang dipilih.
                      </td>
                    </tr>
                  ) : (
                    filteredData.trxs.map(t => (
                      <tr key={t.id} className="hover:bg-white/[0.02]">
                        <td className="p-2.5 font-mono text-neutral-300">{t.transaction_code}</td>
                        <td className="p-2.5 text-neutral-400">{t.date.slice(0, 10)}</td>
                        <td className="p-2.5 font-medium text-white">{t.customer_name}</td>
                        <td className="p-2.5 text-right font-mono text-white">
                          {formatNumber(t.quantity)} R$
                        </td>
                        <td className="p-2.5 text-right font-mono text-neutral-300">Rp{t.sell_rate}</td>
                        <td className="p-2.5 text-right font-mono font-bold text-white">
                          {formatRupiah(t.net_revenue)}
                        </td>
                        <td className="p-2.5 text-right font-mono text-neutral-400">
                          {formatRupiah(t.cogs)}
                        </td>
                        <td
                          className={`p-2.5 text-right font-mono font-bold ${
                            t.net_profit >= 0 ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {formatRupiah(t.net_profit)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 3. Cashflow Report */}
        {reportType === 'cashflow' && (
          <div className="space-y-4">
            <h3 className="font-poppins font-bold text-white text-base print:text-black">
              Laporan Arus Kas Masuk & Keluar
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
              <div className="p-3 bg-[#111114] border border-white/10 rounded-xl text-xs">
                <span className="text-neutral-400 block mb-1">Total Kas Masuk:</span>
                <span className="font-mono font-bold text-emerald-400 text-base">
                  {formatRupiah(summary.cashIn)}
                </span>
              </div>
              <div className="p-3 bg-[#111114] border border-white/10 rounded-xl text-xs">
                <span className="text-neutral-400 block mb-1">Total Kas Keluar:</span>
                <span className="font-mono font-bold text-rose-400 text-base">
                  {formatRupiah(summary.cashOut)}
                </span>
              </div>
              <div className="p-3 bg-[#111114] border border-white/10 rounded-xl text-xs">
                <span className="text-neutral-400 block mb-1">Arus Kas Bersih:</span>
                <span className="font-mono font-bold text-white text-base">
                  {formatRupiah(summary.cashIn - summary.cashOut)}
                </span>
              </div>
            </div>

            <div className="overflow-x-auto border border-white/10 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#111114] text-neutral-400 border-b border-white/10 font-medium">
                  <tr>
                    <th className="p-2.5">Tanggal</th>
                    <th className="p-2.5">Arah</th>
                    <th className="p-2.5">Kategori</th>
                    <th className="p-2.5 text-right">Nominal</th>
                    <th className="p-2.5">Metode</th>
                    <th className="p-2.5">Keterangan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredData.cfs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-neutral-500">
                        Tidak ada catatan arus kas pada periode yang dipilih.
                      </td>
                    </tr>
                  ) : (
                    filteredData.cfs.map(c => (
                      <tr key={c.id} className="hover:bg-white/[0.02]">
                        <td className="p-2.5 text-neutral-400">{c.date.slice(0, 10)}</td>
                        <td className="p-2.5 font-bold">
                          <span
                            className={c.type === 'IN' ? 'text-emerald-400' : 'text-rose-400'}
                          >
                            {c.type}
                          </span>
                        </td>
                        <td className="p-2.5 text-white">{c.category}</td>
                        <td
                          className={`p-2.5 text-right font-mono font-bold ${
                            c.type === 'IN' ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {formatRupiah(c.amount)}
                        </td>
                        <td className="p-2.5 text-neutral-300">{c.payment_method}</td>
                        <td className="p-2.5 text-neutral-400">{c.notes}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 4. Inventory Report */}
        {reportType === 'inventory' && (
          <div className="space-y-4">
            <h3 className="font-poppins font-bold text-white text-base print:text-black">
              Laporan Saldo Persediaan Stok per Batch (FIFO)
            </h3>
            <div className="overflow-x-auto border border-white/10 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#111114] text-neutral-400 border-b border-white/10 font-medium">
                  <tr>
                    <th className="p-2.5">Kode Batch</th>
                    <th className="p-2.5">Supplier</th>
                    <th className="p-2.5 text-right">Robux Awal</th>
                    <th className="p-2.5 text-right">Sisa Stok</th>
                    <th className="p-2.5 text-right">Modal / Unit</th>
                    <th className="p-2.5 text-right">Nilai Sisa Aset</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {batches.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-neutral-500">
                        Belum ada batch persediaan stok tercatat.
                      </td>
                    </tr>
                  ) : (
                    batches.map(b => (
                      <tr key={b.id} className="hover:bg-white/[0.02]">
                        <td className="p-2.5 font-mono text-neutral-300">{b.batch_code}</td>
                        <td className="p-2.5 text-white">{b.supplier}</td>
                        <td className="p-2.5 text-right font-mono text-neutral-300">
                          {formatNumber(b.initial_quantity)} R$
                        </td>
                        <td className="p-2.5 text-right font-mono font-bold text-white">
                          {formatNumber(b.remaining_quantity)} R$
                        </td>
                        <td className="p-2.5 text-right font-mono text-neutral-400">
                          Rp{b.cost_per_unit}
                        </td>
                        <td className="p-2.5 text-right font-mono font-bold text-emerald-400">
                          {formatRupiah(b.remaining_quantity * b.cost_per_unit)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 5. Receivables Report */}
        {reportType === 'receivables' && (
          <div className="space-y-4">
            <h3 className="font-poppins font-bold text-white text-base print:text-black">
              Laporan Piutang Pelanggan Belum Lunas
            </h3>
            <div className="overflow-x-auto border border-white/10 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#111114] text-neutral-400 border-b border-white/10 font-medium">
                  <tr>
                    <th className="p-2.5">Kode</th>
                    <th className="p-2.5">Tanggal</th>
                    <th className="p-2.5">Pelanggan</th>
                    <th className="p-2.5 text-right">Total Tagihan</th>
                    <th className="p-2.5 text-right">Uang Diterima</th>
                    <th className="p-2.5 text-right">Sisa Piutang</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredData.trxs.filter(t => t.accounts_receivable > 0).length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-neutral-500">
                        Tidak ada piutang yang tertunggak pada periode ini.
                      </td>
                    </tr>
                  ) : (
                    filteredData.trxs
                      .filter(t => t.accounts_receivable > 0)
                      .map(t => (
                        <tr key={t.id} className="hover:bg-white/[0.02]">
                          <td className="p-2.5 font-mono text-neutral-300">{t.transaction_code}</td>
                          <td className="p-2.5 text-neutral-400">{t.date.slice(0, 10)}</td>
                          <td className="p-2.5 font-medium text-white">{t.customer_name}</td>
                          <td className="p-2.5 text-right font-mono">{formatRupiah(t.net_revenue)}</td>
                          <td className="p-2.5 text-right font-mono text-emerald-400">
                            {formatRupiah(t.amount_paid)}
                          </td>
                          <td className="p-2.5 text-right font-mono font-bold text-amber-400">
                            {formatRupiah(t.accounts_receivable)}
                          </td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
