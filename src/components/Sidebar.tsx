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
  X,
  Sparkles,
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
  customLogo?: string;
  storeName?: string;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  totalRobuxStock,
  stockAssetValue,
  minStockAlert,
  customLogo,
  storeName = 'JUFA STORE',
  isOpenMobile = false,
  onCloseMobile,
}) => {
  const isStockLow = totalRobuxStock <= minStockAlert;

  // Grouped Navigation for Professional Usability
  const navSections = [
    {
      groupTitle: 'OPERASIONAL UTAMA',
      items: [
        { id: 'dashboard' as NavItem, label: 'Dasbor Performa', icon: <LayoutDashboard size={17} /> },
        { id: 'sales' as NavItem, label: 'Pencatatan Penjualan', icon: <ShoppingCart size={17} /> },
        {
          id: 'stock' as NavItem,
          label: 'Inventaris Stok Robux',
          icon: <Package size={17} />,
          badge: isStockLow && totalRobuxStock > 0 ? 'Menipis' : undefined,
        },
        { id: 'finance' as NavItem, label: 'Buku Kas & Saldo', icon: <Wallet size={17} /> },
        { id: 'calculator' as NavItem, label: 'Kalkulator Cepat', icon: <Calculator size={17} /> },
      ],
    },
    {
      groupTitle: 'STRATEGIS & PERENCANAAN',
      items: [
        { id: 'restock' as NavItem, label: 'Restock & Supplier', icon: <Truck size={17} /> },
        { id: 'analysis' as NavItem, label: 'Analisis Tren Penjualan', icon: <BarChart3 size={17} /> },
        { id: 'simulator' as NavItem, label: 'Simulasi Kebijakan Harga', icon: <TrendingUp size={17} /> },
        { id: 'reports' as NavItem, label: 'Laporan Keuangan Resmi', icon: <FileText size={17} /> },
      ],
    },
    {
      groupTitle: 'SISTEM & KELOLA TOKO',
      items: [
        { id: 'settings' as NavItem, label: 'Pengaturan, Tema & Backup', icon: <Settings size={17} /> },
      ],
    },
  ];

  const handleItemClick = (id: NavItem) => {
    onSelectTab(id);
    if (onCloseMobile) {
      onCloseMobile();
    }
  };

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpenMobile && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40 lg:hidden transition-opacity"
        />
      )}

      {/* Sidebar Drawer */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-[#09090b] border-r border-white/10 flex flex-col justify-between select-none transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 lg:w-64 lg:z-auto ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="overflow-y-auto flex-1 no-scrollbar">
          {/* Brand Header */}
          <div className="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              {customLogo ? (
                <div className="w-9 h-9 rounded-xl bg-white/10 border border-white/20 p-1 flex items-center justify-center overflow-hidden shrink-0 shadow-md">
                  <img
                    src={customLogo}
                    alt="Logo"
                    className="w-full h-full object-contain rounded-lg"
                  />
                </div>
              ) : (
                <div className="w-9 h-9 rounded-xl bg-white text-black flex items-center justify-center font-black shadow-md shrink-0">
                  <Coins size={20} className="text-black" />
                </div>
              )}
              <div className="truncate">
                <h1 className="font-poppins font-bold text-sm tracking-wide text-white leading-tight truncate">
                  {storeName}
                </h1>
                <p className="text-[10px] font-mono tracking-widest text-neutral-400 uppercase">
                  Business Suite
                </p>
              </div>
            </div>

            {/* Mobile Close Button */}
            <button
              onClick={onCloseMobile}
              className="lg:hidden p-2 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 transition shrink-0"
              aria-label="Tutup Menu"
            >
              <X size={18} />
            </button>
          </div>

          {/* Grouped Navigation */}
          <div className="p-3 space-y-5">
            {navSections.map(section => (
              <div key={section.groupTitle} className="space-y-1">
                <div className="px-3 py-1 text-[10px] font-bold tracking-wider text-neutral-500 uppercase font-mono">
                  {section.groupTitle}
                </div>
                {section.items.map(item => {
                  const isActive = currentTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleItemClick(item.id)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                        isActive
                          ? 'bg-white text-black font-bold shadow-sm'
                          : 'text-neutral-400 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className={isActive ? 'text-black shrink-0' : 'text-neutral-400 shrink-0'}>
                          {item.icon}
                        </span>
                        <span className="truncate">{item.label}</span>
                      </div>
                      {item.badge && (
                        <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 shrink-0 ml-1">
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Stock Quick Card */}
        <div className="p-3.5 border-t border-white/10 bg-[#09090b]">
          <div
            className={`p-3 rounded-xl border ${
              isStockLow && totalRobuxStock > 0
                ? 'bg-rose-950/20 border-rose-500/30 text-rose-300'
                : 'bg-[#111114] border-white/10 text-neutral-300'
            }`}
          >
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="font-medium text-neutral-400 text-[11px]">Total Stok Robux</span>
              {isStockLow && totalRobuxStock > 0 && (
                <span className="flex items-center gap-1 text-rose-400 font-semibold text-[10px]">
                  <AlertTriangle size={11} /> Menipis
                </span>
              )}
            </div>
            <div className="text-xl font-bold font-mono text-white flex items-baseline gap-1">
              {formatNumber(totalRobuxStock)}
              <span className="text-xs font-normal text-neutral-400 font-sans">R$</span>
            </div>
            <div className="text-[11px] text-neutral-400 mt-1 flex justify-between font-mono">
              <span>Nilai Modal:</span>
              <span className="font-semibold text-white">{formatRupiah(stockAssetValue)}</span>
            </div>
          </div>
          <div className="mt-2 text-center text-[10px] text-neutral-500 font-mono">
            v1.1.0 • SQLite Persisten
          </div>
        </div>
      </aside>
    </>
  );
};
