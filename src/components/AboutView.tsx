import React, { useState } from 'react';
import {
  Info,
  Rocket,
  RefreshCw,
  Download,
  ShieldCheck,
  Smartphone,
  Database,
  ExternalLink,
  CheckCircle2,
  Sparkles,
  Heart,
  Coins,
} from 'lucide-react';
import { checkAppUpdate, APK_DOWNLOAD_URL, RELEASES_PAGE_URL } from '../services/updater';

export const CURRENT_APP_VERSION = 'v1.0.7';

export const AboutView: React.FC = () => {
  const [isChecking, setIsChecking] = useState(false);

  const handleCheckUpdate = async () => {
    setIsChecking(true);
    try {
      await checkAppUpdate(true);
    } finally {
      setIsChecking(false);
    }
  };

  const changelog = [
    {
      version: 'v1.0.7 (Rilis Terbaru)',
      date: 'Oktober 2026',
      items: [
        'Menu baru "Tentang Aplikasi" berisi info versi, status rilis, dan tombol pembaruan.',
        'Sistem notifikasi pembaruan otomatis (Auto-Update APK) 1-klik langsung dari server GitHub.',
        'Penggabungan kalkulasi stok Robux lama yang belum terjual saat melakukan restock baru.',
        'Pencatatan pemakaian Robux pribadi untuk game/item avatar dengan pengurangan stok rapi.',
        'Penyederhanaan bahasa menu Simulasi & Tier Harga dengan kalkulator laba kasir instan.',
      ],
    },
    {
      version: 'v1.0.6',
      date: 'Oktober 2026',
      items: [
        'Integrasi workflow rilis GitHub Actions otomatis untuk pembuatan file JUFA-STORE.apk.',
        'Optimasi transisi animasi menu yang halus dan responsif.',
        'Perbaikan rasio dan pembatasan border grafik dasbor.',
      ],
    },
  ];

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Hero Header Card */}
      <div className="theme-bg-surface p-6 sm:p-8 rounded-3xl border theme-border relative overflow-hidden">
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-gradient-to-br from-amber-500/10 via-emerald-500/10 to-transparent rounded-full blur-2xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 relative z-10">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white text-black flex items-center justify-center shadow-lg shrink-0">
              <Coins size={38} className="text-black" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-heading font-extrabold theme-text-primary tracking-tight">
                  JufaStore
                </h1>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-mono text-xs font-bold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  {CURRENT_APP_VERSION}
                </span>
              </div>
              <p className="text-xs sm:text-sm theme-text-secondary mt-1">
                Aplikasi Manajemen Keuangan & Inventaris Robux Profesional (Offline-First)
              </p>
              <p className="text-[11px] theme-text-muted mt-0.5">
                Dikembangkan khusus untuk operasional toko JUFA STORE dengan pembukuan akuntansi baku (FIFO).
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleCheckUpdate}
            disabled={isChecking}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white hover:bg-neutral-200 text-black font-bold text-xs shadow transition active:scale-95 disabled:opacity-50 shrink-0"
          >
            <RefreshCw size={14} className={isChecking ? 'animate-spin' : ''} />
            <span>{isChecking ? 'Memeriksa...' : 'Periksa Pembaruan'}</span>
          </button>
        </div>
      </div>

      {/* Auto-Update & Rilis Status Card */}
      <div className="theme-bg-surface p-6 rounded-3xl border theme-border space-y-5">
        <div className="flex items-center justify-between border-b theme-border pb-3">
          <h2 className="text-base font-heading font-bold theme-text-primary flex items-center gap-2">
            <Rocket size={18} className="text-amber-400" />
            <span>Pusat Pembaruan Aplikasi (Auto-Update APK)</span>
          </h2>
          <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
            Status: Terkoneksi
          </span>
        </div>

        <p className="text-xs theme-text-secondary leading-relaxed">
          Aplikasi JUFA STORE dilengkapi sistem pembaruan otomatis. Setiap kali ada update kode yang di-push ke repositori GitHub,
          sistem GitHub Actions akan membuatkan file APK baru. Aplikasi Anda di HP akan otomatis mendeteksi dan menampilkan notifikasi
          unduh pembaruan langsung tanpa kehilangan catatan transaksi yang sudah Anda buat.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-2xl theme-bg-card border theme-border space-y-1">
            <span className="text-[11px] theme-text-muted block">Versi Terpasang Saat Ini</span>
            <span className="text-sm font-mono font-bold theme-text-primary">{CURRENT_APP_VERSION}</span>
            <p className="text-[10px] theme-text-muted">Siap menerima notifikasi update otomatis</p>
          </div>

          <div className="p-4 rounded-2xl theme-bg-card border theme-border space-y-1">
            <span className="text-[11px] theme-text-muted block">Repositori GitHub</span>
            <a
              href="https://github.com/Juanndnich/Jufa-Bussinnes-App"
              target="_blank"
              rel="noreferrer"
              className="text-xs font-mono font-bold text-sky-400 hover:underline flex items-center gap-1 truncate"
            >
              <span>Juanndnich/Jufa-Bussinnes-App</span>
              <ExternalLink size={11} className="shrink-0" />
            </a>
            <p className="text-[10px] theme-text-muted">Status: Repositori Publik & Rilis Aktif</p>
          </div>

          <div className="p-4 rounded-2xl theme-bg-card border theme-border space-y-1 flex flex-col justify-between">
            <div>
              <span className="text-[11px] theme-text-muted block">File Rilis APK</span>
              <span className="text-xs font-mono font-bold text-emerald-400">JUFA-STORE.apk</span>
            </div>
            <a
              href={APK_DOWNLOAD_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-white/10 hover:bg-white/15 px-3 py-1.5 rounded-lg border border-white/20 transition mt-2 justify-center"
            >
              <Download size={13} />
              <span>Unduh APK Langsung</span>
            </a>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#111114] border border-white/10 text-xs text-zinc-300 space-y-2">
          <div className="flex items-center gap-2 font-bold text-white">
            <CheckCircle2 size={15} className="text-emerald-400" />
            <span>Bagaimana Cara Kerja Update Otomatis?</span>
          </div>
          <ol className="list-decimal list-inside space-y-1 text-zinc-400 text-[11px] pl-1">
            <li>Saat ada rilis versi baru di GitHub, aplikasi di HP Anda akan mendeteksinya saat dibuka.</li>
            <li>Pop-up notifikasi pembaruan akan muncul secara instan di layar.</li>
            <li>Tekan tombol <strong>"Unduh & Pasang APK"</strong>. Browser/HP Anda akan langsung mengunduh dan memperbarui aplikasi.</li>
            <li>Seluruh database SQLite lokal (transaksi, batch stok, saldo kas) tetap <strong>100% aman dan tidak terhapus</strong>.</li>
          </ol>
        </div>
      </div>

      {/* Changelog Card */}
      <div className="theme-bg-surface p-6 rounded-3xl border theme-border space-y-4">
        <h2 className="text-base font-heading font-bold theme-text-primary flex items-center gap-2 border-b theme-border pb-3">
          <Sparkles size={18} className="text-cyan-400" />
          <span>Catatan Pembaruan & Riwayat Fitur</span>
        </h2>

        <div className="space-y-4">
          {changelog.map((c, idx) => (
            <div key={idx} className="p-4 rounded-2xl theme-bg-card border theme-border space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-heading font-bold text-xs sm:text-sm theme-text-primary flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-cyan-400" />
                  {c.version}
                </span>
                <span className="text-[11px] font-mono theme-text-muted">{c.date}</span>
              </div>
              <ul className="space-y-1.5 text-xs theme-text-secondary pl-4 list-disc">
                {c.items.map((item, i) => (
                  <li key={i} className="leading-relaxed">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Technical & Offline Security Card */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="theme-bg-surface p-5 sm:p-6 rounded-3xl border theme-border space-y-3">
          <div className="flex items-center gap-2 font-bold theme-text-primary text-sm">
            <ShieldCheck size={18} className="text-emerald-400" />
            <span>Keamanan & Privasi (Zero Leakage)</span>
          </div>
          <p className="text-xs theme-text-secondary leading-relaxed">
            Aplikasi ini dibangun dengan arsitektur <strong>Offline-First</strong>. Semua data keuangan, laba rugi, dan daftar supplier disimpan di database SQLite lokal perangkat Anda. Tidak ada data yang dikirim atau dibocorkan ke server eksternal.
          </p>
        </div>

        <div className="theme-bg-surface p-5 sm:p-6 rounded-3xl border theme-border space-y-3">
          <div className="flex items-center gap-2 font-bold theme-text-primary text-sm">
            <Smartphone size={18} className="text-sky-400" />
            <span>Penyimpanan Sandboxed Android</span>
          </div>
          <p className="text-xs theme-text-secondary leading-relaxed">
            Di HP Android, database biner tersimpan di ruang penyimpanan privat aplikasi (<code className="font-mono text-[11px] text-zinc-300">/data/user/0/com.jufastore.app/</code>) yang terlindungi dari aplikasi lain dan persisten saat HP dimatikan.
          </p>
        </div>
      </div>

      {/* Footer Info */}
      <div className="text-center py-4 space-y-1 text-xs theme-text-muted">
        <p className="flex items-center justify-center gap-1">
          Dibuat khusus untuk <strong className="theme-text-primary">JUFA STORE</strong>
        </p>
        <p className="text-[11px]">© 2026 JUFA STORE. Seluruh Hak Cipta Dilindungi.</p>
      </div>
    </div>
  );
};
