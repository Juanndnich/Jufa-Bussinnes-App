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
  Landmark,
  FileCode,
  Lock,
  Globe,
  Receipt,
  Wallet,
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
    loans: 0,
    auditLogs: 0,
  });

  useEffect(() => {
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
  }, []);

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

        <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 self-start sm:self-auto">
          v2.1.0 • Rilis Resmi Siap Pakai
        </span>
      </div>

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
            <span className="text-xs font-bold theme-text-primary">Offline-First PWA</span>
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
          <span className="text-[11px] theme-text-muted">IndexedDB (Dexie v3)</span>
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
            <span className="text-base font-mono font-bold theme-text-secondary">{formatNumber(stats.auditLogs)}</span>
            <span className="text-[10px] theme-text-muted block mt-0.5">Log Audit</span>
          </div>
        </div>
      </div>

      {/* 4 Pilar Utama JufaStore */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Pilar 1: Zero-Default Principle */}
        <div className="p-5 rounded-2xl theme-bg-card border theme-border space-y-2">
          <div className="flex items-center gap-2 text-emerald-500 font-bold text-xs uppercase tracking-wider">
            <ShieldCheck size={16} />
            <span>1. Prinsip Nol Data Bawaan (Strict Zero-Default)</span>
          </div>
          <p className="text-xs theme-text-secondary leading-relaxed">
            Aplikasi selalu dimulai dari <strong>0 murni</strong> tanpa ada angka dummy bawaan, tanpa preset rate palsu, dan tanpa saldo awal fiktif. Seluruh angka yang tampil adalah fakta riil dari input operasional Anda sendiri.
          </p>
        </div>

        {/* Pilar 2: FIFO Accounting Precision */}
        <div className="p-5 rounded-2xl theme-bg-card border theme-border space-y-2">
          <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-wider">
            <Layers size={16} />
            <span>2. Akuntansi FIFO & Integer Rupiah Murni</span>
          </div>
          <p className="text-xs theme-text-secondary leading-relaxed">
            Setiap restock membentuk antrean batch tersendiri. Ketika Robux dijual, modal HPP dialokasikan dengan rumus sisa pembulatan bilangan bulat (*integer remainder allocation*) sehingga saat batch habis, selisih modal adalah <strong>tepat Rp0</strong>.
          </p>
        </div>

        {/* Pilar 3: Sumber Dana Sendiri vs Pinjaman Modal */}
        <div className="p-5 rounded-2xl theme-bg-card border theme-border space-y-2">
          <div className="flex items-center gap-2 text-emerald-500 font-bold text-xs uppercase tracking-wider">
            <Landmark size={16} />
            <span>3. Fleksibilitas Restock & Utang Modal</span>
          </div>
          <p className="text-xs theme-text-secondary leading-relaxed">
            Dukung pembelian restock menggunakan <strong>Dana Sendiri</strong> (memotong kas toko) maupun <strong>Pinjaman Modal</strong>. Saat Robux dari batch pinjaman terjual, bagian modal HPP otomatis dialokasikan melunasi pokok utang kreditor hingga Rp0.
          </p>
        </div>

        {/* Pilar 4: Privasi & Cloud Sync Bebas Terputus */}
        <div className="p-5 rounded-2xl theme-bg-card border theme-border space-y-2">
          <div className="flex items-center gap-2 text-purple-400 font-bold text-xs uppercase tracking-wider">
            <Globe size={16} />
            <span>4. Offline-First & Sinkronisasi Spreadsheet</span>
          </div>
          <p className="text-xs theme-text-secondary leading-relaxed">
            Bekerja 100% tanpa internet. Jika perangkat online, Anda dapat menyinkronkan data langsung ke Google Spreadsheet Anda secara realtime, harian, atau bulanan melalui jembatan Web App Apps Script mandiri.
          </p>
        </div>
      </div>

      {/* Panduan Alur Kerja Praktis */}
      <div className="p-5 rounded-2xl theme-bg-card border theme-border space-y-3">
        <div className="flex items-center gap-2 pb-2 border-b theme-border">
          <BookOpen size={18} className="text-emerald-500" />
          <h3 className="text-xs font-bold uppercase tracking-wider theme-text-primary">
            Panduan Alur Kerja Operasional Toko
          </h3>
        </div>

        <div className="space-y-2.5 text-xs">
          <div className="p-3 rounded-xl theme-bg-surface border theme-border flex items-start gap-3">
            <div className="w-6 h-6 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0 font-mono font-bold text-xs mt-0.5">
              1
            </div>
            <div>
              <span className="font-bold theme-text-primary block">
                Catat Kulakan di Menu "Stok & Batch FIFO"
              </span>
              <p className="theme-text-secondary text-[11px] mt-0.5 leading-relaxed">
                Pilih sumber dana: Kas Sendiri atau Pinjaman Modal. Masukkan jumlah Robux dan total modal beli. Sistem otomatis menghitung modal per 1 Robux dan menyediakan simulasi proyeksi keuntungan sebelum disimpan.
              </p>
            </div>
          </div>

          <div className="p-3 rounded-xl theme-bg-surface border theme-border flex items-start gap-3">
            <div className="w-6 h-6 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0 font-mono font-bold text-xs mt-0.5">
              2
            </div>
            <div>
              <span className="font-bold theme-text-primary block">
                Hitung Transaksi atau Cek Rate di "Kalkulator Robux"
              </span>
              <p className="theme-text-secondary text-[11px] mt-0.5 leading-relaxed">
                Gunakan Mode Robux ke Uang, Uang ke Robux, atau <strong>Cari Rate Pasar</strong> untuk membedah penawaran orang lain (misal: 1k Robux seharga Rp13k = Rate Rp13/R$). Anda juga bisa menjual langsung dengan harga nego manual.
              </p>
            </div>
          </div>

          <div className="p-3 rounded-xl theme-bg-surface border theme-border flex items-start gap-3">
            <div className="w-6 h-6 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0 font-mono font-bold text-xs mt-0.5">
              3
            </div>
            <div>
              <span className="font-bold theme-text-primary block">
                Catat Penjualan Langsung via Tombol "Jual"
              </span>
              <p className="theme-text-secondary text-[11px] mt-0.5 leading-relaxed">
                Klik tombol <strong>Jual</strong> di bilah atas aplikasi kapan saja untuk mencatat penjualan baru tanpa harus membuka kalkulator. Stok Robux langsung terpotong urut dari batch FIFO terlama.
              </p>
            </div>
          </div>

          <div className="p-3 rounded-xl theme-bg-surface border theme-border flex items-start gap-3">
            <div className="w-6 h-6 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0 font-mono font-bold text-xs mt-0.5">
              4
            </div>
            <div>
              <span className="font-bold theme-text-primary block">
                Buat Pricelist & Pantau Laporan Keuangan
              </span>
              <p className="theme-text-secondary text-[11px] mt-0.5 leading-relaxed">
                Susun daftar harga promosi di menu <strong>Pricelist</strong>, kelola investor di menu <strong>Investor</strong>, dan pantau grafik laba bersih serta arus kas di menu <strong>Analisis & Laporan</strong>.
              </p>
            </div>
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
