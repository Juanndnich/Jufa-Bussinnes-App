import React, { useEffect, useState } from 'react';
import { ShieldCheck, Plus, ShoppingBag, Clock, Menu, Calendar, Bell } from 'lucide-react';
import Swal from 'sweetalert2';
import { Cashflow, Transaction } from '../types';
import { compute24HoursSummary } from '../utils/dailyJournal';
import { formatNumber, formatRupiah } from '../utils/formatters';

interface HeaderProps {
  onQuickSale: () => void;
  onQuickRestock: () => void;
  storeName: string;
  customLogo?: string;
  transactions?: Transaction[];
  cashflows?: Cashflow[];
  onToggleMobileMenu?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onQuickSale,
  onQuickRestock,
  storeName,
  customLogo,
  transactions = [],
  cashflows = [],
  onToggleMobileMenu,
}) => {
  const [currentTime, setCurrentTime] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const formatted = new Intl.DateTimeFormat('id-ID', {
        timeZone: 'Asia/Jakarta',
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }).format(now);
      setCurrentTime(formatted + ' WIB');
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Show 24-Hours Daily Financial Summary Notification
  const handleShow24HoursSummary = () => {
    const summary = compute24HoursSummary(transactions, cashflows);

    Swal.fire({
      title: 'Laporan Rekap 24 Jam Terakhir',
      html: `
        <div style="text-align: left; font-size: 12.5px; line-height: 1.6; font-family: 'Inter', sans-serif;">
          <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 12px; margin-bottom: 12px;">
            <div style="font-weight: 700; color: #fff; margin-bottom: 6px; font-size: 13px;">Hasil Penjualan Robux</div>
            <div style="display: flex; justify-content: space-between; color: #a1a1aa;">
              <span>Robux Terjual:</span>
              <strong style="color: #fff; font-family: monospace;">${formatNumber(summary.robuxSold)} R$</strong>
            </div>
            <div style="display: flex; justify-content: space-between; color: #a1a1aa;">
              <span>Jumlah Pesanan:</span>
              <strong style="color: #fff;">${summary.transactionCount} transaksi</strong>
            </div>
            <div style="display: flex; justify-content: space-between; color: #a1a1aa;">
              <span>Pendapatan Kotor:</span>
              <span style="color: #fff; font-family: monospace;">${formatRupiah(summary.grossRevenue)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; color: #a1a1aa;">
              <span>Diskon Diberikan:</span>
              <span style="color: #f59e0b; font-family: monospace;">-${formatRupiah(summary.discount)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; color: #fff; font-weight: 700; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 4px; margin-top: 4px;">
              <span>Pendapatan Bersih:</span>
              <span style="font-family: monospace;">${formatRupiah(summary.netRevenue)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; color: #a1a1aa;">
              <span>Modal HPP (FIFO):</span>
              <span style="color: #a1a1aa; font-family: monospace;">-${formatRupiah(summary.cogs)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; color: ${summary.grossProfit >= 0 ? '#34d399' : '#f87171'}; font-weight: 700;">
              <span>Laba Kotor Penjualan:</span>
              <span style="font-family: monospace;">${formatRupiah(summary.grossProfit)}</span>
            </div>
          </div>

          <div style="background: rgba(244, 63, 94, 0.05); border: 1px solid rgba(244, 63, 94, 0.2); border-radius: 12px; padding: 12px; margin-bottom: 12px;">
            <div style="font-weight: 700; color: #fb7185; margin-bottom: 6px; font-size: 13px;">Rincian Dana Terpakai / Keluar (24 Jam)</div>
            <div style="display: flex; justify-content: space-between; color: #a1a1aa;">
              <span>Pembelian Stok (Restock):</span>
              <span style="color: #fff; font-family: monospace;">${formatRupiah(summary.restockExpense)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; color: #a1a1aa;">
              <span>Biaya Operasional Toko:</span>
              <span style="color: #fff; font-family: monospace;">${formatRupiah(summary.operationalExpense)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; color: #a1a1aa;">
              <span>Biaya Fee / Admin Transaksi:</span>
              <span style="color: #fff; font-family: monospace;">${formatRupiah(summary.transactionFees)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; color: #a1a1aa;">
              <span>Prive / Penarikan Pemilik:</span>
              <span style="color: #fff; font-family: monospace;">${formatRupiah(summary.priveWithdrawal)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; color: #a1a1aa;">
              <span>Refund / Retur Dana:</span>
              <span style="color: #fff; font-family: monospace;">${formatRupiah(summary.refundExpense)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; color: #fb7185; font-weight: 700; border-top: 1px solid rgba(244, 63, 94, 0.2); padding-top: 4px; margin-top: 4px;">
              <span>Total Seluruh Dana Keluar:</span>
              <span style="font-family: monospace;">-${formatRupiah(summary.totalExpensesOut)}</span>
            </div>
          </div>

          <div style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.15); border-radius: 12px; padding: 12px;">
            <div style="display: flex; justify-content: space-between; font-size: 13px; font-weight: 800; color: #fff;">
              <span>Arus Kas Bersih (Cashflow):</span>
              <span style="font-family: monospace; color: ${summary.netCashFlow >= 0 ? '#34d399' : '#f87171'};">${formatRupiah(summary.netCashFlow)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 13px; font-weight: 800; color: #fff; margin-top: 4px;">
              <span>Laba Bersih Operasional:</span>
              <span style="font-family: monospace; color: ${summary.netDailyProfit >= 0 ? '#34d399' : '#f87171'};">${formatRupiah(summary.netDailyProfit)}</span>
            </div>
          </div>
        </div>
      `,
      confirmButtonText: 'Tutup Laporan',
      confirmButtonColor: '#ffffff',
      background: '#09090b',
      color: '#ffffff',
    });
  };

  return (
    <header className="h-14 sm:h-16 px-3 sm:px-6 bg-[#09090b] border-b border-white/10 flex items-center justify-between shrink-0 z-20">
      <div className="flex items-center gap-2 sm:gap-3.5 min-w-0">
        {/* Mobile Hamburger Menu Toggle */}
        <button
          onClick={onToggleMobileMenu}
          className="lg:hidden p-2 -ml-1 rounded-xl text-neutral-300 hover:text-white hover:bg-white/10 transition"
          aria-label="Buka Menu"
        >
          <Menu size={20} />
        </button>

        {/* Custom Logo in Header */}
        {customLogo && (
          <div className="w-8 h-8 rounded-lg bg-white/10 p-0.5 overflow-hidden shrink-0 hidden sm:flex items-center justify-center">
            <img src={customLogo} alt="Logo" className="w-full h-full object-contain rounded" />
          </div>
        )}

        <div className="truncate">
          <h2 className="text-sm sm:text-base font-poppins font-bold text-white tracking-tight flex items-center gap-2 truncate">
            <span className="truncate">{storeName}</span>
            <span className="hidden md:inline-flex text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-neutral-300 border border-white/15 font-mono shrink-0">
              FINANCIAL SUITE
            </span>
          </h2>
        </div>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
        {/* Real-time Clock (Desktop only) */}
        <div className="hidden xl:flex items-center gap-1.5 text-xs text-neutral-400 bg-[#111114] px-3 py-1.5 rounded-xl border border-white/10">
          <Clock size={13} className="text-neutral-400" />
          <span className="font-mono text-[11px]">{currentTime || 'Memuat...'}</span>
        </div>

        {/* Daily 24-Hours Summary Notification Pill */}
        <button
          onClick={handleShow24HoursSummary}
          className="flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-xl bg-[#111114] hover:bg-neutral-800 text-neutral-200 text-xs font-semibold border border-white/10 transition"
          title="Lihat Laporan Rekap 24 Jam"
        >
          <Bell size={13} className="text-amber-400" />
          <span className="hidden sm:inline">Rekap 24 Jam</span>
        </button>

        {/* Database Status */}
        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-xl bg-white/5 border border-white/15 text-neutral-200 text-[11px] sm:text-xs font-semibold">
          <ShieldCheck size={13} className="text-white" />
          <span>SQLite</span>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            onClick={onQuickRestock}
            className="flex items-center gap-1 px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-xl bg-[#111114] hover:bg-neutral-800 text-neutral-200 text-xs font-medium border border-white/15 transition"
            title="Tambah Restock"
          >
            <Plus size={13} />
            <span className="hidden sm:inline">Restock</span>
          </button>
          <button
            onClick={onQuickSale}
            className="flex items-center gap-1 px-3 py-1.5 sm:px-3.5 sm:py-1.5 rounded-xl bg-white hover:bg-neutral-200 text-black text-xs font-bold transition shadow-sm"
            title="Catat Penjualan"
          >
            <ShoppingBag size={13} />
            <span className="text-xs">+ Jual</span>
            <span className="hidden md:inline">Penjualan</span>
          </button>
        </div>
      </div>
    </header>
  );
};
