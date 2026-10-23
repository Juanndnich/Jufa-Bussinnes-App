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
  Users,
  Info,
} from 'lucide-react';
import { formatNumber, formatRupiah } from '../utils/formatters';

export type NavItem =
  | 'dashboard'
  | 'sales'
  | 'calculator'
  | 'stock'
  | 'restock'
  | 'finance'
  | 'investors'
  | 'analysis'
  | 'simulator'
  | 'reports'
  | 'settings'
  | 'about';

interface SidebarProps {
  currentTab: NavItem;
  onSelectTab: (tab: NavItem) => void;
  totalRobuxStock: number;
  stockAssetValue: number;
  minStockAlert: number;
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
        { id: 'investors' as NavItem, label: 'Investor & Bagi Hasil', icon: <Users size={17} /> },
        { id: 'analysis' as NavItem, label: 'Analisis Tren Penjualan', icon: <BarChart3 size={17} /> },
        { id: 'simulator' as NavItem, label: 'Simulasi & Tier Harga', icon: <TrendingUp size={17} /> },
        { id: 'reports' as NavItem, label: 'Laporan Keuangan Resmi', icon: <FileText size={17} /> },
      ],
    },
    {
      groupTitle: 'SISTEM & KELOLA TOKO',
      items: [
        { id: 'settings' as NavItem, label: 'Pengaturan & Backup', icon: <Settings size={17} /> },
        { id: 'about' as NavItem, label: 'Tentang Aplikasi', icon: <Info size={17} /> },
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
      {/* Mobile Backdrop Overlay with smooth fade */}
      {isOpenMobile && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 bg-black/75 z-40 lg:hidden animate-backdrop cursor-pointer"
        />
      )}

      {/* Sidebar Drawer with ultra-smooth cubic-bezier transition */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 theme-bg-surface border-r theme-border flex flex-col justify-between select-none transition-transform duration-250 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-transform lg:static lg:translate-x-0 lg:w-64 lg:z-auto shadow-2xl lg:shadow-none ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="overflow-y-auto flex-1 no-scrollbar">
          {/* Brand Header */}
          <div className="p-4 sm:p-5 border-b theme-border flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-white text-black flex items-center justify-center font-black shadow-md shrink-0">
                <Coins size={20} className="text-black" />
              </div>
              <div className="truncate">
                <h1 className="font-heading font-bold text-sm tracking-wide theme-text-primary leading-tight truncate">
                  {storeName}
                </h1>
                <p className="text-[10px] font-mono tracking-widest theme-text-muted uppercase">
                  Robux Manager
                </p>
              </div>
            </div>

            {/* Close Button on Mobile */}
            <button
              onClick={onCloseMobile}
              className="lg:hidden p-1.5 rounded-lg theme-text-muted hover:theme-text-primary theme-bg-card border theme-border"
              aria-label="Tutup Menu"
            >
              <X size={16} />
            </button>
          </div>

          {/* Grouped Nav Items */}
          <div className="p-3 space-y-5">
            {navSections.map((sec, secIdx) => (
              <div key={secIdx} className="space-y-1">
                <div className="px-3 py-1 text-[10px] font-bold font-mono tracking-wider theme-text-muted uppercase">
                  {sec.groupTitle}
                </div>
                <nav className="space-y-0.5">
                  {sec.items.map(item => {
                    const isActive = currentTab === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => handleItemClick(item.id)}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-150 active:scale-[0.98] group ${
                          isActive
                            ? 'theme-btn-primary font-bold shadow-sm'
                            : 'theme-text-secondary hover:theme-text-primary hover:theme-bg-card'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 truncate">
                          <span
                            className={`shrink-0 transition-colors ${
                              isActive ? 'text-black' : 'theme-text-muted group-hover:theme-text-primary'
                            }`}
                          >
                            {item.icon}
                          </span>
                          <span className="truncate">{item.label}</span>
                        </div>
                        {item.badge && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-500 border border-amber-500/30">
                            {item.badge}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </nav>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom Persistent Live Stock Card */}
        <div className="p-3 border-t theme-border theme-bg-card/50">
          <div
            onClick={() => handleItemClick('stock')}
            className="p-3 rounded-xl theme-bg-card border theme-border cursor-pointer hover:theme-border transition"
          >
            <div className="flex items-center justify-between text-xs">
              <span className="theme-text-secondary font-medium flex items-center gap-1.5">
                <Package size={13} className="theme-text-muted" /> Stok Tersedia
              </span>
              {isStockLow && (
                <span className="flex items-center gap-1 text-[10px] text-amber-500 font-bold">
                  <AlertTriangle size={11} /> Menipis
                </span>
              )}
            </div>
            <div className="text-base font-bold theme-text-primary font-mono mt-1">
              {formatNumber(totalRobuxStock)} <span className="text-xs font-normal theme-text-muted">R$</span>
            </div>
            <div className="text-[10px] theme-text-muted font-mono mt-0.5">
              Nilai: {formatRupiah(stockAssetValue)}
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};
