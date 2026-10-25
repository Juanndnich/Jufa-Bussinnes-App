import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { db } from '../../db/db';
import { formatNumber } from '../../utils/formatters';
import { playTapSound } from '../../utils/sound';

export const AppInfoView: React.FC = () => {
  const [stats, setStats] = useState({
    stockBatches: 0,
    sales: 0,
    cashLedger: 0,
    personalUsages: 0,
    investors: 0,
    auditLogs: 0,
  });

  useEffect(() => {
    Promise.all([
      db.stockBatches.count(),
      db.sales.count(),
      db.cashLedger.count(),
      db.personalUsages.count(),
      db.investors.count(),
      db.auditLogs.count(),
    ]).then(([batches, sales, ledger, usages, investors, logs]) => {
      setStats({
        stockBatches: batches,
        sales,
        cashLedger: ledger,
        personalUsages: usages,
        investors,
        auditLogs: logs,
      });
    }).catch(() => {});
  }, []);

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-10">
      {/* Header View */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b theme-border">
        <div className="flex items-center gap-2.5">
          <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <Info size={20} />
          </div>
          <div>
            <h1 className="text-lg font-bold theme-text-primary tracking-tight">
              Info Aplikasi JufaStore
            </h1>
            <p className="text-xs theme-text-secondary">
              Informasi sistem, arsitektur teknis, privasi data lokal, & panduan penggunaan
            </p>
          </div>
        </div>

        <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 self-start sm:self-auto">
          v2.1.0 • Produksi Siap Pakai
        </span>
      </div>

      {/* Hero Badge Identity */}
      <div className="p-5 rounded-2xl theme-bg-card border theme-border space-y-3 relative overflow-hidden">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <span className="text-[11px] uppercase tracking-wider font-bold text-indigo-400 block">
              Sistem Pembukuan & Kalkulator Pribadi
            </span>
            <h2 className="text-xl font-bold theme-text-primary">
              JufaStore
            </h2>
            <p className="text-xs theme-text-secondary leading-relaxed max-w-2xl">
              Aplikasi mandiri khusus pemilik bisnis Robux untuk mencatat persediaan modal FIFO,
              menghitung transaksi secara fleksibel (rate maupun harga kesepakatan nego), mengelola arus kas riil,
              dan memantau pembagian dividen pemodal internal tanpa ketergantungan server luar.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
          <div className="p-2.5 rounded-xl theme-bg-surface border theme-border">
            <span className="text-[10px] theme-text-muted block">Arsitektur</span>
            <span className="text-xs font-bold theme-text-primary">Offline-First PWA</span>
          </div>
          <div className="p-2.5 rounded-xl theme-bg-surface border theme-border">
            <span className="text-[10px] theme-text-muted block">Metode Stok</span>
            <span className="text-xs font-bold text-amber-400">FIFO Presisi Rp0</span>
          </div>
          <div className="p-2.5 rounded-xl theme-bg-surface border theme-border">
            <span className="text-[10px] theme-text-muted block">Privasi Data</span>
            <span className="text-xs font-bold text-emerald-400">Zero-Telemetry 100%</span>
          </div>
          <div className="p-2.5 rounded-xl theme-bg-surface border theme-border">
            <span className="text-[10px] theme-text-muted block">Format Nominal</span>
            <span className="text-xs font-bold text-cyan-400">Integer Rupiah Murni</span>
          </div>
        </div>
      </div>

      {/* Keamanan & Privasi Data Lokal */}
      <div className="p-5 rounded-2xl theme-bg-card border theme-border space-y-3">
        <div className="flex items-center gap-2 pb-2 border-b theme-border">
          <ShieldCheck size={18} className="text-emerald-400" />
          <h3 className="text-xs font-bold uppercase tracking-wider theme-text-primary">
            Keamanan Data & Privasi Terjamin
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="p-3 rounded-xl theme-bg-surface border theme-border space-y-1.5">
            <span className="font-bold theme-text-primary flex items-center gap-1.5">
              <HardDrive size={14} className="text-indigo-400" />
              100% Data di Perangkat
            </span>
            <p className="theme-text-secondary leading-relaxed text-[11px]">
              Semua database transaksi, stok, kas, dan investor tersimpan di IndexedDB browser perangkat Anda.
              Tidak ada data yang diunggah ke server cloud mana pun.
            </p>
          </div>

          <div className="p-3 rounded-xl theme-bg-surface border theme-border space-y-1.5">
            <span className="font-bold theme-text-primary flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-emerald-400" />
              Nol Telemetri & Bebas Iklan
            </span>
            <p className="theme-text-secondary leading-relaxed text-[11px]">
              Aplikasi ini tidak memiliki pelacak, analitik pihak ketiga, ataupun iklan. Kecepatan maksimal
              dan privasi finansial bisnis Anda terjaga seutuhnya.
            </p>
          </div>

          <div className="p-3 rounded-xl theme-bg-surface border theme-border space-y-1.5">
            <span className="font-bold theme-text-primary flex items-center gap-1.5">
              <Database size={14} className="text-cyan-400" />
              Cadangan Mandiri Kapan Saja
            </span>
            <p className="theme-text-secondary leading-relaxed text-[11px]">
              Anda dapat mencadangkan seluruh data kapan saja ke berkas JSON atau menyalin teks langsung,
              serta mengekspor transaksi ke format CSV untuk Microsoft Excel.
            </p>
          </div>
        </div>
      </div>

      {/* Ringkasan Data Lokal yang Aktif di Perangkat */}
      <div className="p-5 rounded-2xl theme-bg-card border theme-border space-y-3">
        <div className="flex items-center justify-between pb-2 border-b theme-border">
          <div className="flex items-center gap-2">
            <Database size={18} className="text-cyan-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider theme-text-primary">
              Status Penyimpanan Lokal Aktif
            </h3>
          </div>
          <span className="text-[11px] theme-text-muted">IndexedDB (Dexie v2)</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
          <div className="p-3 rounded-xl theme-bg-surface border theme-border text-center">
            <span className="text-base font-mono font-bold text-amber-400">{formatNumber(stats.stockBatches)}</span>
            <span className="text-[10px] theme-text-muted block mt-0.5">Batch Restock</span>
          </div>
          <div className="p-3 rounded-xl theme-bg-surface border theme-border text-center">
            <span className="text-base font-mono font-bold text-emerald-400">{formatNumber(stats.sales)}</span>
            <span className="text-[10px] theme-text-muted block mt-0.5">Penjualan</span>
          </div>
          <div className="p-3 rounded-xl theme-bg-surface border theme-border text-center">
            <span className="text-base font-mono font-bold text-cyan-400">{formatNumber(stats.cashLedger)}</span>
            <span className="text-[10px] theme-text-muted block mt-0.5">Buku Kas</span>
          </div>
          <div className="p-3 rounded-xl theme-bg-surface border theme-border text-center">
            <span className="text-base font-mono font-bold text-indigo-400">{formatNumber(stats.personalUsages)}</span>
            <span className="text-[10px] theme-text-muted block mt-0.5">Prive Pribadi</span>
          </div>
          <div className="p-3 rounded-xl theme-bg-surface border theme-border text-center">
            <span className="text-base font-mono font-bold text-purple-400">{formatNumber(stats.investors)}</span>
            <span className="text-[10px] theme-text-muted block mt-0.5">Investor</span>
          </div>
          <div className="p-3 rounded-xl theme-bg-surface border theme-border text-center">
            <span className="text-base font-mono font-bold theme-text-primary">{formatNumber(stats.auditLogs)}</span>
            <span className="text-[10px] theme-text-muted block mt-0.5">Log Audit</span>
          </div>
        </div>
      </div>

      {/* Panduan Alur Kerja Praktis */}
      <div className="p-5 rounded-2xl theme-bg-card border theme-border space-y-3">
        <div className="flex items-center gap-2 pb-2 border-b theme-border">
          <BookOpen size={18} className="text-amber-400" />
          <h3 className="text-xs font-bold uppercase tracking-wider theme-text-primary">
            Panduan Singkat Alur Kerja Pemilik Toko
          </h3>
        </div>

        <div className="space-y-2 text-xs">
          <div className="p-3 rounded-xl theme-bg-surface border theme-border flex items-start gap-3">
            <div className="w-6 h-6 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0 font-mono font-bold text-xs mt-0.5">
              1
            </div>
            <div>
              <span className="font-bold theme-text-primary block">
                Catat Kulakan di Menu "Stok & Batch"
              </span>
              <p className="theme-text-secondary text-[11px] mt-0.5 leading-relaxed">
                Setiap kali membeli Robux dari supplier, masukkan jumlah Robux dan total uang ril yang dibayar.
                Sistem akan membuat batch FIFO baru dan memotong saldo kas secara otomatis tanpa sisa desimal pembulatan.
              </p>
            </div>
          </div>

          <div className="p-3 rounded-xl theme-bg-surface border theme-border flex items-start gap-3">
            <div className="w-6 h-6 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center shrink-0 font-mono font-bold text-xs mt-0.5">
              2
            </div>
            <div>
              <span className="font-bold theme-text-primary block">
                Hitung & Catat Penjualan di "Kalkulator Robux"
              </span>
              <p className="theme-text-secondary text-[11px] mt-0.5 leading-relaxed">
                Gunakan mode Robux ke Uang atau Uang ke Robux. Jika menjual dengan harga negosiasi khusus, ketik langsung total uang di kolom <em>Total Uang Bayar (Ketik Bebas / Nego)</em>.
                Klik simpan penjualan untuk otomatis memotong stok FIFO dan menambah kas masuk toko.
              </p>
            </div>
          </div>

          <div className="p-3 rounded-xl theme-bg-surface border theme-border flex items-start gap-3">
            <div className="w-6 h-6 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center shrink-0 font-mono font-bold text-xs mt-0.5">
              3
            </div>
            <div>
              <span className="font-bold theme-text-primary block">
                Buat Daftar Harga di Menu "Pricelist"
              </span>
              <p className="theme-text-secondary text-[11px] mt-0.5 leading-relaxed">
                Tentukan rate yang diinginkan, pilih paket nominal atau ketik nominal sendiri. Salin teks daftar harga dengan 1 klik untuk promosi atau catatan pribadi.
              </p>
            </div>
          </div>

          <div className="p-3 rounded-xl theme-bg-surface border theme-border flex items-start gap-3">
            <div className="w-6 h-6 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center shrink-0 font-mono font-bold text-xs mt-0.5">
              4
            </div>
            <div>
              <span className="font-bold theme-text-primary block">
                Lakukan Cadangan Rutin di Menu "Pengaturan"
              </span>
              <p className="theme-text-secondary text-[11px] mt-0.5 leading-relaxed">
                Cadangkan data secara berkala (minimal 1 minggu sekali) dengan mengunduh file JSON atau menyalin teks database ke tempat aman.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Spesifikasi Teknis / Komponen */}
      <div className="p-5 rounded-2xl theme-bg-card border theme-border space-y-3">
        <div className="flex items-center gap-2 pb-2 border-b theme-border">
          <Cpu size={18} className="text-indigo-400" />
          <h3 className="text-xs font-bold uppercase tracking-wider theme-text-primary">
            Spesifikasi & Fondasi Teknologi
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
          <div className="p-2.5 rounded-xl theme-bg-surface border theme-border flex items-center justify-between">
            <span className="theme-text-secondary">Framework & Bahasa</span>
            <span className="font-mono font-semibold theme-text-primary">React 18 + TypeScript 5.9</span>
          </div>
          <div className="p-2.5 rounded-xl theme-bg-surface border theme-border flex items-center justify-between">
            <span className="theme-text-secondary">Bundler & Styling</span>
            <span className="font-mono font-semibold theme-text-primary">Vite 5 + Tailwind CSS 3.4</span>
          </div>
          <div className="p-2.5 rounded-xl theme-bg-surface border theme-border flex items-center justify-between">
            <span className="theme-text-secondary">Tipografi Terintegrasi</span>
            <span className="font-mono font-semibold theme-text-primary">Inter, Poppins & JetBrains Mono</span>
          </div>
          <div className="p-2.5 rounded-xl theme-bg-surface border theme-border flex items-center justify-between">
            <span className="theme-text-secondary">Platform Mobile</span>
            <span className="font-mono font-semibold theme-text-primary">PWA + Capacitor Android</span>
          </div>
        </div>
      </div>
    </div>
  );
};
