import React, { useState, useRef, useEffect } from 'react';
import { Menu, Coins, ChevronDown, ShoppingBag, Plus, Bell } from 'lucide-react';
import Swal from 'sweetalert2';
import { cleanupSwalLocks } from '../utils/alert';
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
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Tutup dropdown saat klik di luar area
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Tampilkan notifikasi rekap finansial 24 jam
  const handleShow24HoursSummary = () => {
    setIsDropdownOpen(false);
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
      didClose: () => cleanupSwalLocks(),
    });
  };

  return (
    <header className="h-14 sm:h-16 px-4 sm:px-6 theme-bg-surface border-b theme-border flex items-center justify-between shrink-0 z-20">
      {/* Sisi Kiri: Menu Mobile, Logo, dan Judul Aplikasi Saja */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onToggleMobileMenu}
          className="lg:hidden p-1.5 -ml-1 rounded-xl theme-text-secondary hover:theme-text-primary hover:theme-bg-card transition"
          aria-label="Buka Menu"
        >
          <Menu size={20} />
        </button>

        <div className="w-8 h-8 rounded-xl bg-white text-black flex items-center justify-center shadow-sm shrink-0">
          <Coins size={18} className="text-black" />
        </div>

        <h1 className="text-base sm:text-lg font-heading font-bold theme-text-primary tracking-tight truncate">
          {storeName || 'JufaStore'}
        </h1>
      </div>

      {/* Sisi Kanan: Satu Dropdown Ringkas & Rapi */}
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setIsDropdownOpen(prev => !prev)}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl theme-bg-card hover:theme-bg-card-hover border theme-border text-xs font-bold theme-text-primary transition shadow-sm active:scale-95"
          aria-expanded={isDropdownOpen}
        >
          <span>Aksi Cepat</span>
          <ChevronDown
            size={14}
            className={`theme-text-muted transition-transform duration-200 ${
              isDropdownOpen ? 'rotate-180' : ''
            }`}
          />
        </button>

        {isDropdownOpen && (
          <div className="absolute right-0 top-full mt-2 w-56 rounded-2xl theme-bg-surface border theme-border shadow-2xl p-1.5 space-y-1 z-50 animate-in fade-in zoom-in-95 duration-150">
            <button
              onClick={() => {
                setIsDropdownOpen(false);
                onQuickSale();
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:theme-bg-card text-left text-xs font-semibold theme-text-primary transition group"
            >
              <div className="w-7 h-7 rounded-lg bg-emerald-500/15 text-emerald-400 flex items-center justify-center group-hover:bg-emerald-500/25 transition">
                <ShoppingBag size={14} />
              </div>
              <div className="truncate">
                <div className="font-bold text-xs">+ Catat Penjualan</div>
                <div className="text-[10px] theme-text-muted">Input transaksi pembeli</div>
              </div>
            </button>

            <button
              onClick={() => {
                setIsDropdownOpen(false);
                onQuickRestock();
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:theme-bg-card text-left text-xs font-semibold theme-text-primary transition group"
            >
              <div className="w-7 h-7 rounded-lg bg-sky-500/15 text-sky-400 flex items-center justify-center group-hover:bg-sky-500/25 transition">
                <Plus size={14} />
              </div>
              <div className="truncate">
                <div className="font-bold text-xs">+ Restock Pembelian</div>
                <div className="text-[10px] theme-text-muted">Tambah stok dari supplier</div>
              </div>
            </button>

            <div className="border-t theme-border my-1" />

            <button
              onClick={handleShow24HoursSummary}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:theme-bg-card text-left text-xs font-semibold theme-text-primary transition group"
            >
              <div className="w-7 h-7 rounded-lg bg-amber-500/15 text-amber-400 flex items-center justify-center group-hover:bg-amber-500/25 transition">
                <Bell size={14} />
              </div>
              <div className="truncate">
                <div className="font-bold text-xs">Rekap 24 Jam</div>
                <div className="text-[10px] theme-text-muted">Ringkasan harian toko</div>
              </div>
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
