import React from 'react';
import {
  Download,
  ShieldCheck,
  Smartphone,
  Database,
  ExternalLink,
  Sparkles,
  Coins,
  CheckCircle2,
} from 'lucide-react';

export const CURRENT_APP_VERSION = 'v1.0.10';
export const GITHUB_RELEASES_URL = 'https://github.com/Juanndnich/Jufa-Bussinnes-App/releases/latest';
export const DIRECT_APK_DOWNLOAD_URL = 'https://github.com/Juanndnich/Jufa-Bussinnes-App/releases/latest/download/JUFA-STORE.apk';

export const AboutView: React.FC = () => {
  const changelog = [
    {
      version: 'v1.0.10 (Versi Terkini)',
      date: 'Oktober 2026',
      items: [
        '🎃 Edisi Spesial Halloween: Tema tampilan Halloween langsung aktif dengan nuansa labu mistis dan palet ungu-oranye.',
        '🎃 Ikon aplikasi edisi Halloween (Labu Jack-o\'-Lantern & Koin Emas Robux) untuk Android dan web.',
        '🎃 Layar pembuka (Loading Screen) animasi masuk bertema Halloween yang cepat, mulus, dan responsif.',
        'Penyatuan laporan penjualan, laba rugi, arus kas, persediaan stok, dan piutang ke dalam 1 dropdown filter rapi.',
        'Penghapusan kolom sumber penjualan di menu pencatatan penjualan agar lebih ringkas dan mudah dipahami.',
        'Penghapusan kolom diskon pembelian dan biaya admin di formulir restock supplier agar perhitungan modal murni.',
        'Penyempurnaan CRUD lengkap: pratinjau detail dan edit data untuk transaksi penjualan serta riwayat batch restock.',
        'Penyederhanaan sistem update: tombol langsung menuju halaman rilis GitHub resmi untuk unduh APK terbaru secara andal.',
      ],
    },
    {
      version: 'v1.0.9',
      date: 'Oktober 2026',
      items: [
        'Header bersih minimalis dengan dropdown menu aksi cepat (notifikasi, restock cepat, jual cepat).',
        'Pemindahan informasi status SQLite lokal dan teknis sistem ke menu Tentang Aplikasi.',
      ],
    },
    {
      version: 'v1.0.8',
      date: 'Oktober 2026',
      items: [
        'Penetapan nama aplikasi menjadi JufaStore pada Android dan web.',
        'Pemeriksaan dan optimalisasi integritas basis data.',
      ],
    },
    {
      version: 'v1.0.7',
      date: 'Oktober 2026',
      items: [
        'Menu baru "Tentang Aplikasi" yang memuat informasi versi, status rilis, dan keamanan database.',
        'Penggabungan kalkulasi sisa stok Robux lama saat melakukan restock pembelian baru.',
        'Pencatatan pemakaian Robux pribadi untuk game/avatar dengan pengurangan stok otomatis.',
      ],
    },
    {
      version: 'v1.0.6',
      date: 'Oktober 2026',
      items: [
        'Konfigurasi rilis otomatis GitHub Actions untuk kompilasi APK Android.',
        'Perbaikan rasio diagram statistik dasbor agar pas dalam batas kartu.',
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
                Solusi pembukuan kas, stok FIFO, dan rekap keuangan resmi tanpa ketergantungan internet.
              </p>
            </div>
          </div>

          <a
            href={GITHUB_RELEASES_URL}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white hover:bg-neutral-200 text-black font-bold text-xs shadow transition active:scale-95 shrink-0"
          >
            <Download size={14} />
            <span>Download Versi Terbaru ↗</span>
          </a>
        </div>
      </div>

      {/* Rilis & Unduhan APK Resmi */}
      <div className="theme-bg-surface p-6 rounded-3xl border theme-border space-y-4">
        <div className="flex items-center justify-between border-b theme-border pb-3">
          <h2 className="text-base font-heading font-bold theme-text-primary flex items-center gap-2">
            <Download size={18} className="text-emerald-400" />
            <span>Unduh & Pembaruan APK Resmi</span>
          </h2>
          <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
            GitHub Releases
          </span>
        </div>

        <p className="text-xs theme-text-secondary leading-relaxed">
          Setiap pembaruan fitur atau perbaikan kode diunggah langsung ke GitHub Releases resmi toko.
          Anda dapat mengunduh file APK versi terbaru kapan saja melalui tautan langsung di bawah ini.
          Memasang APK versi baru tidak akan menghapus data transaksi dan stok yang tersimpan di HP Anda.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
          <a
            href={GITHUB_RELEASES_URL}
            target="_blank"
            rel="noreferrer"
            className="p-4 rounded-2xl theme-bg-card hover:theme-bg-card-hover border theme-border flex items-center justify-between transition group"
          >
            <div className="space-y-0.5">
              <span className="text-xs font-bold theme-text-primary group-hover:text-emerald-400 flex items-center gap-1.5 transition">
                <span>Halaman Rilis GitHub Resmi</span>
                <ExternalLink size={12} />
              </span>
              <p className="text-[11px] theme-text-muted">
                Lihat daftar seluruh rilis dan catatan perbaikan terbaru
              </p>
            </div>
          </a>

          <a
            href={DIRECT_APK_DOWNLOAD_URL}
            target="_blank"
            rel="noreferrer"
            className="p-4 rounded-2xl bg-emerald-500/10 hover:bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-between transition group"
          >
            <div className="space-y-0.5">
              <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                <Download size={13} />
                <span>Unduh File JUFA-STORE.apk Langsung</span>
              </span>
              <p className="text-[11px] text-emerald-300/70">
                Tautan unduh langsung file instalasi APK Android
              </p>
            </div>
          </a>
        </div>
      </div>

      {/* Changelog Card */}
      <div className="theme-bg-surface p-6 rounded-3xl border theme-border space-y-4">
        <h2 className="text-base font-heading font-bold theme-text-primary flex items-center gap-2 border-b theme-border pb-3">
          <Sparkles size={18} className="text-cyan-400" />
          <span>Daftar Fitur & Riwayat Pembaruan</span>
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

      {/* Technical, Database SQLite & Offline Security Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="theme-bg-surface p-5 rounded-3xl border theme-border space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold theme-text-primary text-xs sm:text-sm">
              <Database size={16} className="text-emerald-400" />
              <span>Database SQLite Lokal</span>
            </div>
            <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/25">
              Aktif
            </span>
          </div>
          <p className="text-xs theme-text-secondary leading-relaxed">
            Engine SQLite 3 WASM berjalan 100% offline di perangkat lokal Anda tanpa ketergantungan server cloud.
          </p>
        </div>

        <div className="theme-bg-surface p-5 rounded-3xl border theme-border space-y-2.5">
          <div className="flex items-center gap-2 font-bold theme-text-primary text-xs sm:text-sm">
            <ShieldCheck size={16} className="text-cyan-400" />
            <span>Privasi (Zero Leakage)</span>
          </div>
          <p className="text-xs theme-text-secondary leading-relaxed">
            Semua catatan keuangan, modal, dan laba Anda tersimpan privat tanpa risiko kebocoran ke pihak ketiga.
          </p>
        </div>

        <div className="theme-bg-surface p-5 rounded-3xl border theme-border space-y-2.5">
          <div className="flex items-center gap-2 font-bold theme-text-primary text-xs sm:text-sm">
            <Smartphone size={16} className="text-amber-400" />
            <span>Sandbox Android</span>
          </div>
          <p className="text-xs theme-text-secondary leading-relaxed">
            Data tersimpan di direktori aman <code className="font-mono text-[10px] text-zinc-300">/data/user/0/com.jufastore.app/</code> dan persisten saat HP dimatikan.
          </p>
        </div>
      </div>

      {/* Footer Info */}
      <div className="text-center py-4 space-y-1 text-xs theme-text-muted">
        <p className="flex items-center justify-center gap-1">
          Dibuat khusus untuk <strong className="theme-text-primary">JufaStore</strong>
        </p>
        <p className="text-[11px]">© 2026 JufaStore. Seluruh Hak Cipta Dilindungi.</p>
      </div>
    </div>
  );
};
