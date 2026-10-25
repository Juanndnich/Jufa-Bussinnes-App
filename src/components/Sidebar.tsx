import React, { useState } from 'react';
import {
  LayoutDashboard,
  Calculator,
  Package,
  Receipt,
  Wallet,
  BarChart3,
  Settings,
  Coins,
  LucideIcon,
  Menu,
  X,
  ChevronRight,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { formatNumber } from '../utils/formatters';
import { playTapSound } from '../utils/sound';

export type NavItem =
  | 'dashboard'
  | 'calculator'
  | 'stock'
  | 'sales'
  | 'finance'
  | 'analysis'
  | 'settings';

export interface NavItemConfig {
  id: NavItem;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
  badge?: string;
}

export interface NavCategory {
  title: string;
  items: NavItemConfig[];
}

export const CATEGORIZED_NAV: NavCategory[] = [
  {
    title: 'Operasional',
    items: [
      {
        id: 'dashboard',
        label: 'Dashboard Ringkasan',
        shortLabel: 'Dashboard',
        icon: LayoutDashboard,
      },
      {
        id: 'calculator',
        label: 'Kalkulator Robux',
        shortLabel: 'Kalkulator',
        icon: Calculator,
      },
      {
        id: 'sales',
        label: 'Riwayat Penjualan',
        shortLabel: 'Penjualan',
        icon: Receipt,
      },
    ],
  },
  {
    title: 'Inventaris & Kas',
    items: [
      {
        id: 'stock',
        label: 'Stok & Batch FIFO',
        shortLabel: 'Stok',
        icon: Package,
      },
      {
        id: 'finance',
        label: 'Buku Kas Harian',
        shortLabel: 'Kas',
        icon: Wallet,
      },
    ],
  },
  {
    title: 'Laporan & Sistem',
    items: [
      {
        id: 'analysis',
        label: 'Analisis & Laporan',
        shortLabel: 'Analisis',
        icon: BarChart3,
      },
      {
        id: 'settings',
        label: 'Pengaturan & Backup',
        shortLabel: 'Pengaturan',
        icon: Settings,
      },
    ],
  },
];

interface SidebarProps {
  currentTab: NavItem;
  onSelectTab: (tab: NavItem) => void;
  currentStock: number;
  customLogoUrl?: string | null;
  storeName?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  currentStock,
  customLogoUrl,
  storeName = 'JufaStore',
}) => {
  return (
    <aside className="hidden lg:flex flex-col w-64 theme-bg-surface border-r theme-border h-screen sticky top-0 shrink-0 p-3.5 select-none theme-text-primary transition-colors duration-200">
      {/* Brand Header */}
      <div className="flex items-center gap-3 px-2 py-3 border-b theme-border mb-3">
        <img
          src={customLogoUrl || '/app-icon.png'}
          alt={storeName}
          className="w-9 h-9 rounded-xl object-cover border theme-border shadow-sm bg-black shrink-0"
        />
        <div className="overflow-hidden">
          <h1 className="font-heading font-bold text-sm tracking-tight theme-text-primary leading-tight truncate">
            {storeName}
          </h1>
          <p className="text-[10px] theme-text-muted font-mono tracking-wider uppercase mt-0.5">
            Internal Bookkeeper
          </p>
        </div>
      </div>

      {/* Navigation List Terkategori */}
      <nav className="space-y-4 flex-1 overflow-y-auto pr-1">
        {CATEGORIZED_NAV.map((group) => (
          <div key={group.title} className="space-y-1">
            <span className="text-[10px] font-semibold tracking-wider theme-text-muted uppercase px-2.5 block">
              {group.title}
            </span>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = currentTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      playTapSound();
                      onSelectTab(item.id);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition active:scale-[0.99] ${
                      isActive
                        ? 'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400 font-semibold border border-emerald-500/30 shadow-sm'
                        : 'theme-text-secondary hover:theme-text-primary hover:theme-bg-card border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon
                        size={15}
                        className={isActive ? 'text-emerald-400' : 'theme-text-muted'}
                      />
                      <span>{item.label}</span>
                    </div>
                    {isActive && (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Quick Stock Indicator Bottom Card */}
      <div className="p-3 rounded-xl theme-bg-card border theme-border mt-auto">
        <div className="flex items-center justify-between text-xs">
          <span className="theme-text-muted flex items-center gap-1.5 font-medium text-[11px]">
            <Coins size={13} className="text-amber-500 dark:text-amber-400" />
            <span>Sisa Stok:</span>
          </span>
          <span className="font-mono font-bold text-amber-500 dark:text-amber-400 text-xs">
            {formatNumber(currentStock)}{' '}
            <span className="text-[10px] font-normal theme-text-muted">R$</span>
          </span>
        </div>
      </div>
    </aside>
  );
};

interface MobileBottomNavProps {
  currentTab: NavItem;
  onSelectTab: (tab: NavItem) => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  currentTab,
  onSelectTab,
}) => {
  const [showDrawer, setShowDrawer] = useState(false);

  // 4 Primary Mobile Shortcuts + 1 Menu Drawer Button
  const primaryShortcuts: NavItemConfig[] = [
    { id: 'dashboard', label: 'Dashboard', shortLabel: 'Beranda', icon: LayoutDashboard },
    { id: 'calculator', label: 'Kalkulator', shortLabel: 'Kalkulator', icon: Calculator },
    { id: 'stock', label: 'Stok FIFO', shortLabel: 'Stok', icon: Package },
    { id: 'sales', label: 'Penjualan', shortLabel: 'Jual', icon: Receipt },
  ];

  const handleSelect = (tab: NavItem) => {
    playTapSound();
    onSelectTab(tab);
    setShowDrawer(false);
  };

  return (
    <>
      {/* Mobile Bottom Navigation Bar */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 theme-bg-surface/95 backdrop-blur-md border-t theme-border py-1.5 px-3 flex items-center justify-around select-none transition-colors duration-200">
        {primaryShortcuts.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleSelect(item.id)}
              className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition ${
                isActive ? 'text-emerald-500 dark:text-emerald-400 font-bold' : 'theme-text-muted hover:theme-text-secondary'
              }`}
            >
              <Icon size={17} className={isActive ? 'text-emerald-500 dark:text-emerald-400' : 'theme-text-muted'} />
              <span className="text-[10px] mt-0.5 tracking-tight">{item.shortLabel}</span>
            </button>
          );
        })}

        {/* Tombol Menu Terkategori Lengkap */}
        <button
          type="button"
          onClick={() => {
            playTapSound();
            setShowDrawer(true);
          }}
          className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition ${
            currentTab === 'finance' || currentTab === 'analysis' || currentTab === 'settings'
              ? 'text-emerald-500 dark:text-emerald-400 font-bold'
              : 'theme-text-muted hover:theme-text-secondary'
          }`}
        >
          <Menu size={17} className="theme-text-muted" />
          <span className="text-[10px] mt-0.5 tracking-tight">Semua</span>
        </button>
      </nav>

      {/* Categorized Drawer Sheet on Mobile with Motion */}
      <AnimatePresence>
        {showDrawer && (
          <div className="lg:hidden fixed inset-0 z-50 flex flex-col justify-end bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ duration: 0.22, ease: [0.25, 1, 0.5, 1] }}
              className="w-full theme-bg-surface border-t theme-border rounded-t-3xl p-5 max-h-[85vh] overflow-y-auto space-y-4 shadow-2xl"
            >
              {/* Header Drawer */}
              <div className="flex items-center justify-between pb-3 border-b theme-border">
                <div>
                  <h3 className="text-sm font-bold theme-text-primary">Kategori Menu JufaStore</h3>
                  <p className="text-[11px] theme-text-muted">Pilih modul navigasi yang ingin dibuka</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    playTapSound();
                    setShowDrawer(false);
                  }}
                  className="p-1.5 rounded-xl theme-bg-card theme-text-muted hover:theme-text-primary border theme-border"
                >
                  <X size={16} />
                </button>
              </div>

              {/* List Menu Terkategori */}
              <div className="space-y-4">
                {CATEGORIZED_NAV.map((group) => (
                  <div key={group.title} className="space-y-1.5">
                    <span className="text-[10px] font-semibold tracking-wider theme-text-muted uppercase px-1 block">
                      {group.title}
                    </span>
                    <div className="grid grid-cols-1 gap-1">
                      {group.items.map((item) => {
                        const Icon = item.icon;
                        const isActive = currentTab === item.id;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => handleSelect(item.id)}
                            className={`w-full flex items-center justify-between p-3 rounded-xl text-xs transition ${
                              isActive
                                ? 'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400 font-semibold border border-emerald-500/30 shadow-sm'
                                : 'theme-bg-card theme-text-secondary hover:theme-text-primary border theme-border'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <Icon
                                size={16}
                                className={isActive ? 'text-emerald-500 dark:text-emerald-400' : 'theme-text-muted'}
                              />
                              <span>{item.label}</span>
                            </div>
                            <ChevronRight
                              size={14}
                              className={isActive ? 'text-emerald-500 dark:text-emerald-400' : 'theme-text-muted'}
                            />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
