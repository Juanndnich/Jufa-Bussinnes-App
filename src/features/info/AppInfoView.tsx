import React, { useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import {
  Info,
  ShieldCheck,
  Cpu,
  Database,
  Smartphone,
  CheckCircle2,
  HardDrive,
  FileSpreadsheet,
  Coins,
  Calculator,
  Tag,
  Layers,
  Users,
  BookOpen,
  ArrowRight,
  Sparkles,
  Landmark,
  FileCode,
  Lock,
  Globe,
  Receipt,
  Wallet,
  RefreshCw,
  Download,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { db } from '../../db/db';
import { formatNumber } from '../../utils/formatters';
import { playTapSound } from '../../utils/sound';
import {
  subscribeUpdateState,
  checkForUpdates,
  getInstalledVersion,
  promptUpdateDialog,
  UpdateInfo,
} from '../../services/updateChecker';
import { NavItem } from '../../components/Sidebar';

interface AppInfoViewProps {
  onNavigateTab?: (tab: NavItem) => void;
}

export const AppInfoView: React.FC<AppInfoViewProps> = ({ onNavigateTab }) => {
  const [stats, setStats] = useState({
    stockBatches: 0,
    sales: 0,
    cashLedger: 0,
    personalUsages: 0,
    investors: 0,
    loans: 0,
    auditLogs: 0,
  });

  const [currentVersion, setCurrentVersion] = useState<string>('2.1.0');
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);

  useEffect(() => {
    getInstalledVersion().then(setCurrentVersion);

    const unsubscribe = subscribeUpdateState((info) => {
      setUpdateInfo(info);
    });

    Promise.all([
      db.stockBatches.count(),
      db.sales.count(),
      db.cashLedger.count(),
      db.personalUsages.count(),
      db.investors.count(),
      db.loans.count(),
      db.auditLogs.count(),
    ])
      .then(([batches, sales, ledger, usages, investors, loans, logs]) => {
        setStats({
          stockBatches: batches,
          sales,
          cashLedger: ledger,
          personalUsages: usages,
          investors,
          loans,
          auditLogs: logs,
        });
      })
      .catch(() => {});

    return () => {
      unsubscribe();
    };
  }, []);

  const handleManualCheck = async () => {
    playTapSound();
    setIsCheckingUpdate(true);
    try {
      await checkForUpdates({
        manual: true,
        onNavigateToBackup: () => onNavigateTab?.('settings'),
      });
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  const isNative = Capacitor.isNativePlatform();

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-10">
      {/* Header View */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b theme-border">
        <div className="flex items-center gap-2.5">
          <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
            <Info size={20} />
          </div>
          <div>
            <h1 className="text-lg font-bold theme-text-primary tracking-tight">
              Tentang Aplikasi JufaStore
            </h1>
            <p className="text-xs theme-text-secondary">
              Informasi sistem pembukuan, prinsip akuntansi FIFO, lisensi resmi, & arsitektur lokal
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            v{currentVersion} • Rilis Resmi Siap Pakai
          </span>

          {isNative && updateInfo?.hasUpdate && (
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse flex items-center gap-1">
              <span>●</span> Update v{updateInfo.version} Tersedia
            </span>
          )}
        </div>
      </div>

      {/* Bagian Update Otomatis GitHub (Hanya Tampil di Native Android) */}
      {isNative && (
        <div className="p-4 sm:p-5 rounded-2xl theme-bg-card border theme-border space-y-3.5">
          <div className="flex items-center justify-between pb-2 border-b theme-border flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Smartphone size={18} className="text-emerald-500" />
              <h2 className="text-xs font-bold uppercase tracking-wider theme-text-primary">
                Pembaruan Aplikasi (Auto-Update)
              </h2>
            </div>
            <span className="text-[11px] theme-text-muted font-mono">
              GitHub Releases Official
            </span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-3.5 rounded-xl theme-bg-surface border theme-border">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold theme-text-primary">
                  Versi Terpasang: <span className="font-mono text-emerald-400">v{currentVersion}</span>
                </span>
                {updateInfo?.hasUpdate ? (
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    Versi Baru: v{updateInfo.version}
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-zinc-500/10 text-zinc-400 border theme-border">
                    Terbaru
                  </span>
                )}
              </div>
              <p className="text-[11px] theme-text-secondary leading-relaxed">
                JufaStore memeriksa pembaruan resmi langsung dari repositori publik GitHub tanpa pihak ketiga. Data bisnis Anda tetap 100% aman tersimpan di perangkat.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {updateInfo?.hasUpdate && (
                <button
                  type="button"
                  onClick={() => {
                    playTapSound();
                    promptUpdateDialog(updateInfo, () => onNavigateTab?.('settings'));
                  }}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-500 text-zinc-950 hover:bg-emerald-400 transition flex items-center gap-1.5 shadow-sm"
                >
                  <Download size={14} />
                  <span>Perbarui Sekarang</span>
                </button>
              )}

              <button
                type="button"
                disabled={isCheckingUpdate}
                onClick={handleManualCheck}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold theme-bg-card border theme-border hover:theme-border-strong theme-text-primary transition flex items-center gap-1.5 active:scale-[0.98] ${
                  isCheckingUpdate ? 'opacity-60 cursor-not-allowed' : ''
                }`}
              >
                <RefreshCw size={13} className={isCheckingUpdate ? 'animate-spin text-emerald-400' : ''} />
                <span>{isCheckingUpdate ? 'Memeriksa...' : 'Cek Pembaruan'}</span>
              </button>
            </div>
          </div>

          {updateInfo?.hasUpdate && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs theme-text-primary space-y-1.5">
              <div className="font-bold text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 size={14} />
                <span>Catatan Rilis v{updateInfo.version}:</span>
              </div>
              <p className="text-[11px] theme-text-secondary leading-relaxed whitespace-pre-line pl-5 font-sans">
                {updateInfo.releaseNotes}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Hero Badge Identity */}
      <div className="p-5 rounded-2xl theme-bg-card border theme-border space-y-3 relative overflow-hidden">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <span className="text-[11px] uppercase tracking-wider font-bold text-emerald-500 block">
              Sistem Manajemen Inventaris & Keuangan Mandiri
            </span>
            <h2 className="text-xl font-bold theme-text-primary">
              JufaStore
            </h2>
            <p className="text-xs theme-text-secondary leading-relaxed max-w-2xl">
              Aplikasi pembukuan dan kalkulator khusus pemilik bisnis Robux yang dirancang untuk
              mencatat persediaan modal FIFO presisi tanpa selisih desimal, menghitung penjualan fleksibel (rate maupun harga nego bebas),
              mengelola arus kas riil, melacak pinjaman modal restock otomatis, serta menyinkronkan data ke Google Spreadsheet secara aman.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
          <div className="p-2.5 rounded-xl theme-bg-surface border theme-border">
            <span className="text-[10px] theme-text-muted block">Arsitektur</span>
            <span className="text-xs font-bold theme-text-primary">Capacitor 6 Android</span>
          </div>
          <div className="p-2.5 rounded-xl theme-bg-surface border theme-border">
            <span className="text-[10px] theme-text-muted block">Metode Stok</span>
            <span className="text-xs font-bold text-amber-400">FIFO Presisi Rp0 Selisih</span>
          </div>
          <div className="p-2.5 rounded-xl theme-bg-surface border theme-border">
            <span className="text-[10px] theme-text-muted block">Privasi Data</span>
            <span className="text-xs font-bold text-emerald-400">Zero-Telemetry 100%</span>
          </div>
          <div className="p-2.5 rounded-xl theme-bg-surface border theme-border">
            <span className="text-[10px] theme-text-muted block">Format Nominal</span>
            <span className="text-xs font-bold theme-text-primary">Integer Rupiah Murni</span>
          </div>
        </div>
      </div>

      {/* Ringkasan Data Lokal yang Aktif di Perangkat */}
      <div className="p-5 rounded-2xl theme-bg-card border theme-border space-y-3">
        <div className="flex items-center justify-between pb-2 border-b theme-border">
          <div className="flex items-center gap-2">
            <Database size={18} className="text-emerald-500" />
            <h3 className="text-xs font-bold uppercase tracking-wider theme-text-primary">
              Status Data Aktif di Database Lokal Perangkat
            </h3>
          </div>
          <span className="text-[11px] theme-text-muted">IndexedDB (Dexie)</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
          <div className="p-3 rounded-xl theme-bg-surface border theme-border text-center">
            <span className="text-base font-mono font-bold text-amber-400">{formatNumber(stats.stockBatches)}</span>
            <span className="text-[10px] theme-text-muted block mt-0.5">Batch Stok</span>
          </div>
          <div className="p-3 rounded-xl theme-bg-surface border theme-border text-center">
            <span className="text-base font-mono font-bold text-emerald-400">{formatNumber(stats.sales)}</span>
            <span className="text-[10px] theme-text-muted block mt-0.5">Penjualan</span>
          </div>
          <div className="p-3 rounded-xl theme-bg-surface border theme-border text-center">
            <span className="text-base font-mono font-bold theme-text-primary">{formatNumber(stats.cashLedger)}</span>
            <span className="text-[10px] theme-text-muted block mt-0.5">Buku Kas</span>
          </div>
          <div className="p-3 rounded-xl theme-bg-surface border theme-border text-center">
            <span className="text-base font-mono font-bold text-amber-400">{formatNumber(stats.personalUsages)}</span>
            <span className="text-[10px] theme-text-muted block mt-0.5">Prive Pribadi</span>
          </div>
          <div className="p-3 rounded-xl theme-bg-surface border theme-border text-center">
            <span className="text-base font-mono font-bold text-purple-400">{formatNumber(stats.investors)}</span>
            <span className="text-[10px] theme-text-muted block mt-0.5">Investor</span>
          </div>
          <div className="p-3 rounded-xl theme-bg-surface border theme-border text-center">
            <span className="text-base font-mono font-bold text-amber-400">{formatNumber(stats.loans)}</span>
            <span className="text-[10px] theme-text-muted block mt-0.5">Pinjaman</span>
          </div>
          <div className="p-3 rounded-xl theme-bg-surface border theme-border text-center">
            <span className="text-base font-mono font-bold text-cyan-400">{formatNumber(stats.auditLogs)}</span>
            <span className="text-[10px] theme-text-muted block mt-0.5">Audit Log</span>
          </div>
        </div>
      </div>

      {/* Lisensi Resmi & Informasi Hak Cipta */}
      <div className="p-5 rounded-2xl theme-bg-card border theme-border space-y-3">
        <div className="flex items-center justify-between pb-2 border-b theme-border">
          <div className="flex items-center gap-2">
            <FileCode size={18} className="text-emerald-500" />
            <h3 className="text-xs font-bold uppercase tracking-wider theme-text-primary">
              Lisensi Perangkat Lunak Bebas (MIT License)
            </h3>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
            Open Source
          </span>
        </div>

        <p className="text-xs theme-text-secondary leading-relaxed">
          Hak Cipta &copy; 2026 <strong>JufaStore</strong>. Diterbitkan di bawah lisensi resmi <strong>MIT License</strong>.
          Memberikan kebebasan penuh kepada pemilik untuk menggunakan, memodifikasi, menggabungkan, dan mendistribusikan kode secara aman tanpa royalti.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs pt-1">
          <div className="p-2.5 rounded-xl theme-bg-surface border theme-border flex items-center justify-between">
            <span className="theme-text-secondary">Framework & Bahasa</span>
            <span className="font-mono font-semibold theme-text-primary">React 18 + TypeScript 5.7</span>
          </div>
          <div className="p-2.5 rounded-xl theme-bg-surface border theme-border flex items-center justify-between">
            <span className="theme-text-secondary">Bundler & Styling</span>
            <span className="font-mono font-semibold theme-text-primary">Vite 5 + Tailwind CSS 3.4</span>
          </div>
          <div className="p-2.5 rounded-xl theme-bg-surface border theme-border flex items-center justify-between">
            <span className="theme-text-secondary">Tipografi Lokal</span>
            <span className="font-mono font-semibold theme-text-primary">Inter, Poppins, JetBrains Mono</span>
          </div>
          <div className="p-2.5 rounded-xl theme-bg-surface border theme-border flex items-center justify-between">
            <span className="theme-text-secondary">Platform Android</span>
            <span className="font-mono font-semibold theme-text-primary">Capacitor 6 + PWA Service Worker</span>
          </div>
        </div>
      </div>
    </div>
  );
};
