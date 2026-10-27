import React from 'react';
import { Coins, Moon, Sun, BarChart3, Settings, Plus, Wifi, WifiOff } from 'lucide-react';
import { NavItem } from './Sidebar';
import { formatNumber } from '../utils/formatters';
import { playTapSound } from '../utils/sound';

interface HeaderProps {
  currentStock: number;
  currentTheme: 'system' | 'light' | 'dark';
  isOnline?: boolean;
  onToggleTheme: () => void;
  onNavigateTab: (tab: NavItem) => void;
  onOpenQuickSale?: () => void;
  storeName?: string;
  customLogoUrl?: string | null;
}

export const Header: React.FC<HeaderProps> = ({
  currentStock,
  currentTheme,
  isOnline = true,
  onToggleTheme,
  onNavigateTab,
  onOpenQuickSale,
  storeName = 'JufaStore',
  customLogoUrl,
}) => {
  return (
    <header className="sticky top-0 z-30 w-full theme-bg-surface/90 backdrop-blur-md border-b theme-border px-3 sm:px-6 py-2.5 select-none transition-colors duration-200">
      <div className="max-w-5xl mx-auto flex items-center justify-between">
        {/* Brand Logo & Name */}
        <button
          type="button"
          onClick={() => {
            playTapSound();
            onNavigateTab('dashboard');
          }}
          className="flex items-center gap-2.5 group text-left"
        >
          <img
            src={customLogoUrl || '/app-icon.png'}
            alt={storeName}
            className="w-8 h-8 rounded-xl object-cover border theme-border shadow-sm group-hover:scale-105 transition bg-black"
          />
          <div>
            <span className="font-heading font-bold text-sm tracking-tight theme-text-primary block leading-none">
              {storeName}
            </span>
            <span className="text-[10px] theme-text-muted font-mono tracking-wider block mt-0.5">
              ROBUX APP
            </span>
          </div>
        </button>

        {/* Right Info: Online/Offline Badge, Quick Jual, Stock Badge & Theme Toggle */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Status Online/Offline */}
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold border transition ${
              isOnline
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
            }`}
            title={isOnline ? 'Terhubung ke Internet (Mode Online)' : 'Mode Offline (Data tersimpan aman di perangkat)'}
          >
            {isOnline ? <Wifi size={11} className="text-emerald-400" /> : <WifiOff size={11} className="text-amber-400" />}
            <span>{isOnline ? 'Online' : 'Offline'}</span>
          </div>

          {/* Quick Sale Button */}
          {onOpenQuickSale && (
            <button
              type="button"
              onClick={() => {
                playTapSound();
                onOpenQuickSale();
              }}
              className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition active:scale-95 shadow-sm"
              title="Catat Penjualan Robux Cepat"
            >
              <Plus size={13} />
              <span>Jual</span>
            </button>
          )}

          {/* Quick Stock Indicator */}
          <button
            type="button"
            onClick={() => {
              playTapSound();
              onNavigateTab('stock');
            }}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl theme-bg-card border theme-border hover:theme-bg-card-hover transition"
            title="Sisa Stok Robux"
          >
            <Coins size={13} className="text-amber-500 dark:text-amber-400" />
            <span className="text-xs font-mono font-bold text-amber-500 dark:text-amber-400">
              {formatNumber(currentStock)}{' '}
              <span className="font-sans text-[10px] font-normal theme-text-muted hidden sm:inline">
                R$
              </span>
            </span>
          </button>

          {/* Theme Toggle Button */}
          <button
            type="button"
            onClick={onToggleTheme}
            className="p-2 rounded-xl theme-bg-card border theme-border theme-text-secondary hover:theme-text-primary hover:theme-bg-card-hover transition active:scale-95"
            title={currentTheme === 'dark' ? 'Ganti ke Mode Terang' : 'Ganti ke Mode Gelap'}
          >
            {currentTheme === 'dark' ? (
              <Sun size={15} className="text-amber-400" />
            ) : (
              <Moon size={15} className="text-indigo-600 dark:text-zinc-300" />
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
