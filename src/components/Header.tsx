import React, { useEffect, useState } from 'react';
import { ShieldCheck, Plus, ShoppingBag, Clock, Menu, Bell, Coins } from 'lucide-react';
import Swal from 'sweetalert2';
import { Cashflow, Transaction } from '../types';
import { compute24HoursSummary } from '../utils/dailyJournal';
import { formatNumber, formatRupiah } from '../utils/formatters';

interface HeaderProps {
  onQuickSale: () => void;
  onQuickRestock: () => void;
  storeName: string;
  transactions?: Transaction[];
  cashflows?: Cashflow[];
  onToggleMobileMenu?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onQuickSale,
  onQuickRestock,
  storeName,
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
            <div style="font-weight: 700; color: inherit; margin-bottom: 6px; font-size: 13px;">Hasil Penjualan Robux</div>
            <div style="display: flex; justify-content: space-between; opacity: 0.8;">
              <span>Robux Terjual:</span>
              <strong style="font-family: monospace;">${formatNumber(summary.robuxSold)} R$</strong>
            </div>
            <div style="display: flex; justify-content: space-between; opacity: 0.8;">
              <span>Jumlah Pesanan:</span>
              <strong>${summary.transactionCount} transaksi</strong>
            </div>
            <div style="display: flex; justify-content: space-between; opacity: 0.8;">
              <span>Pendapatan Penjualan:</span>
              <span style="font-family: monospace;">${formatRupiah(summary.netRevenue)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; opacity: 0.8;">
              <span>Modal HPP (FIFO):</span>
              <span style="font-family: monospace; color: #f87171;">-${formatRupiah(summary.cogs)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; font-weight: 700; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 4px; margin-top: 4px;">
              <span>Laba Kotor Penjualan:</span>
              <span style="font-family: monospace; color: #34d399;">${formatRupiah(summary.grossProfit)}</span>
            </div>
          </div>

          <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 12px;">
            <div style="font-weight: 700; color: inherit; margin-bottom: 6px; font-size: 13px;">Ringkasan Kas Riil</div>
            <div style="display: flex; justify-content: space-between; opacity: 0.8;">
              <span>Total Uang Masuk:</span>
              <span style="font-family: monospace; color: #34d399;">+${formatRupiah(summary.totalCashIn)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; opacity: 0.8;">
              <span>Total Uang Keluar:</span>
              <span style="font-family: monospace; color: #f87171;">-${formatRupiah(summary.totalExpensesOut)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; font-weight: 700; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 4px; margin-top: 4px;">
              <span>Arus Kas Bersih:</span>
              <span style="font-family: monospace; color: ${summary.netCashFlow >= 0 ? '#34d399' : '#f87171'};">${formatRupiah(summary.netCashFlow)}</span>
            </div>
          </div>
        </div>
      `,
      confirmButtonText: 'Tutup Laporan',
    });
  };

  return (
    <header className="h-14 sm:h-16 px-3 sm:px-6 theme-bg-surface border-b theme-border flex items-center justify-between shrink-0 z-20">
      <div className="flex items-center gap-2 sm:gap-3.5 min-w-0">
        {/* Mobile Hamburger Menu Toggle */}
        <button
          onClick={onToggleMobileMenu}
          className="lg:hidden p-2 -ml-1 rounded-xl theme-text-secondary hover:theme-text-primary hover:theme-bg-card transition"
          aria-label="Buka Menu"
        >
          <Menu size={20} />
        </button>

        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-white text-black flex items-center justify-center shadow-sm shrink-0">
          <Coins size={16} className="text-black" />
        </div>

        <div className="truncate">
          <h2 className="text-sm sm:text-base font-heading font-bold theme-text-primary tracking-tight flex items-center gap-2 truncate">
            <span className="truncate">{storeName}</span>
            <span className="hidden md:inline-flex text-[10px] px-2 py-0.5 rounded-full theme-bg-card theme-text-secondary border theme-border font-mono shrink-0">
              ROBUX MANAGER
            </span>
          </h2>
        </div>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
        {/* Real-time Clock (Desktop only) */}
        <div className="hidden xl:flex items-center gap-1.5 text-xs theme-text-secondary theme-bg-card px-3 py-1.5 rounded-xl border theme-border">
          <Clock size={13} className="theme-text-muted" />
          <span className="font-mono text-[11px]">{currentTime || 'Memuat...'}</span>
        </div>

        {/* Daily 24-Hours Summary Notification Pill */}
        <button
          onClick={handleShow24HoursSummary}
          className="flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-xl theme-bg-card hover:theme-bg-card-hover theme-text-primary text-xs font-semibold border theme-border transition"
          title="Lihat Laporan Rekap 24 Jam"
        >
          <Bell size={13} className="text-amber-400" />
          <span className="hidden sm:inline">Rekap 24 Jam</span>
        </button>

        {/* Database Status */}
        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-xl theme-bg-card border theme-border theme-text-primary text-[11px] sm:text-xs font-semibold">
          <ShieldCheck size={13} />
          <span>SQLite Lokal</span>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            onClick={onQuickRestock}
            className="flex items-center gap-1 px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-xl theme-bg-card hover:theme-bg-card-hover theme-text-primary text-xs font-medium border theme-border transition"
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
          </button>
        </div>
      </div>
    </header>
  );
};
