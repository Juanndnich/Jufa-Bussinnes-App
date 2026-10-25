import React from 'react';
import { Coins, Moon, Sun, BarChart3, Settings } from 'lucide-react';
import { NavItem } from './Sidebar';
import { formatNumber } from '../utils/formatters';
import { playTapSound } from '../utils/sound';

interface HeaderProps {
  currentStock: number;
  currentTheme: 'system' | 'light' | 'dark';
  onToggleTheme: () => void;
  onNavigateTab: (tab: NavItem) => void;
  storeName?: string;
  customLogoUrl?: string | null;
}

export const Header: React.FC<HeaderProps> = ({
  currentStock,
  currentTheme,
  onToggleTheme,
  onNavigateTab,
  storeName = 'JufaStore',
  customLogoUrl,
}) => {
  return (
    <header className="sticky top-0 z-30 w-full theme-bg-surface/90 backdrop-blur-md border-b theme-border px-4 sm:px-6 py-2.5 select-none transition-colors duration-200">
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

        {/* Right Info: Stock Badge & Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2">
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

          {/* Quick Access to Analysis */}
          <button
            type="button"
            onClick={() => {
              playTapSound();
              onNavigateTab('analysis');
            }}
            className="p-2 rounded-xl theme-bg-card border theme-border theme-text-secondary hover:theme-text-primary hover:theme-bg-card-hover transition active:scale-95"
            title="Analisis & Laporan"
          >
            <BarChart3 size={15} />
          </button>

          {/* Quick Access to Settings */}
          <button
            type="button"
            onClick={() => {
              playTapSound();
              onNavigateTab('settings');
            }}
            className="p-2 rounded-xl theme-bg-card border theme-border theme-text-secondary hover:theme-text-primary hover:theme-bg-card-hover transition active:scale-95"
            title="Pengaturan"
          >
            <Settings size={15} />
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
