import React from 'react';
import {
  LayoutDashboard,
  ShoppingCart,
  Calculator,
  Package,
  Truck,
  Wallet,
  BarChart3,
  TrendingUp,
  FileText,
  Settings,
  AlertTriangle,
  Coins,
} from 'lucide-react';
import { formatNumber, formatRupiah } from '../utils/formatters';

export type NavItem =
  | 'dashboard'
  | 'sales'
  | 'calculator'
  | 'stock'
  | 'restock'
  | 'finance'
  | 'analysis'
  | 'simulator'
  | 'reports'
  | 'settings';

interface SidebarProps {
  currentTab: NavItem;
  onSelectTab: (tab: NavItem) => void;
  totalRobuxStock: number;
  stockAssetValue: number;
  minStockAlert: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  totalRobuxStock,
  stockAssetValue,
  minStockAlert,
}) => {
  const isStockLow = totalRobuxStock <= minStockAlert;

  const navItems: { id: NavItem; label: string; icon: React.ReactNode; badge?: string }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
    { id: 'sales', label: 'Penjualan', icon: <ShoppingCart size={18} /> },
    { id: 'calculator', label: 'Kalkulator Cepat', icon: <Calculator size={18} /> },
    {
      id: 'stock',
      label: 'Stok Robux',
      icon: <Package size={18} />,
      badge: isStockLow && totalRobuxStock > 0 ? 'Menipis' : undefined,
    },
    { id: 'restock', label: 'Restock & Supplier', icon: <Truck size={18} /> },
    { id: 'finance', label: 'Buku Kas & Saldo', icon: <Wallet size={18} /> },
    { id: 'analysis', label: 'Analisis Penjualan', icon: <BarChart3 size={18} /> },
    { id: 'simulator', label: 'Simulasi Harga', icon: <TrendingUp size={18} /> },
    { id: 'reports', label: 'Laporan Bisnis', icon: <FileText size={18} /> },
    { id: 'settings', label: 'Pengaturan & Backup', icon: <Settings size={18} /> },
  ];

  return (
    <aside className="w-64 bg-[#09090b] border-r border-white/10 flex flex-col justify-between select-none">
      <div>
        {/* Brand Header */}
        <div className="p-5 border-b border-white/10 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-white text-black flex items-center justify-center font-black shadow-md">
            <Coins size={20} className="text-black" />
          </div>
          <div>
            <h1 className="font-heading font-extrabold text-sm tracking-wide text-white leading-tight">
              JUFA STORE
            </h1>
            <p className="text-[10px] font-mono tracking-widest text-zinc-400 uppercase">
              Business Suite
            </p>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="p-3 space-y-1">
          {navItems.map(item => {
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-white text-black font-bold shadow-sm'
                    : 'text-zinc-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={isActive ? 'text-black' : 'text-zinc-400'}>
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Stock Quick Card */}
      <div className="p-4 border-t border-white/10">
        <div
          className={`p-3.5 rounded-xl border ${
            isStockLow && totalRobuxStock > 0
              ? 'bg-rose-950/20 border-rose-500/30 text-rose-300'
              : 'bg-[#111114] border-white/10 text-zinc-300'
          }`}
        >
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="font-medium text-zinc-400 text-[11px]">Total Stok Robux</span>
            {isStockLow && totalRobuxStock > 0 && (
              <span className="flex items-center gap-1 text-rose-400 font-semibold text-[10px]">
                <AlertTriangle size={11} /> Menipis
              </span>
            )}
          </div>
          <div className="text-xl font-bold font-mono text-white flex items-baseline gap-1">
            {formatNumber(totalRobuxStock)}
            <span className="text-xs font-normal text-zinc-400 font-sans">R$</span>
          </div>
          <div className="text-[11px] text-zinc-400 mt-1 flex justify-between font-mono">
            <span>Nilai Modal:</span>
            <span className="font-semibold text-white">{formatRupiah(stockAssetValue)}</span>
          </div>
        </div>
        <div className="mt-2 text-center text-[10px] text-zinc-500 font-mono">
          v1.0.0 • SQLite Persisten
        </div>
      </div>
    </aside>
  );
};
