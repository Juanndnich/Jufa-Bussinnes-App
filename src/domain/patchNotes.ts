/**
 * JufaStore - Pusat Informasi Catatan Rilis & Pembaruan (Play Store Style)
 * Menyediakan rincian patch pembaruan versi saat ini, peta jalan fitur mendatang,
 * dan riwayat rilis terdahulu.
 */

export const CURRENT_APP_VERSION = '2.1.29';

export interface PatchCategory {
  categoryName: string;
  items: string[];
}

export interface PatchNoteItem {
  version: string;
  releaseDate: string;
  title: string;
  badge?: string;
  summary: string;
  highlights: string[];
  categories: PatchCategory[];
}

export interface UpcomingFeatureItem {
  id: string;
  title: string;
  status: 'Dalam Pengerjaan' | 'Direncanakan' | 'Eksplorasi';
  targetVersion: string;
  description: string;
  benefits: string[];
}

/**
 * Catatan Rilis Resmi Versi Terpasang Saat Ini (v2.1.29)
 */
export const CURRENT_PATCH_NOTE: PatchNoteItem = {
  version: CURRENT_APP_VERSION,
  releaseDate: 'November 2026',
  title: 'Dukungan Desktop Windows & Pusat Catatan Pembaruan',
  badge: 'Versi Rilis Terbaru',
  summary:
    'Pembaruan besar ini menghadirkan dukungan aplikasi desktop mandiri (.exe) untuk PC/laptop Windows berbasis arsitektur Tauri v2 yang sangat ringan dan hemat memori, dilengkapi pusat informasi catatan pembaruan resmi (Play Store style) dan optimasi tata letak layar lebar.',
  highlights: [
    'Edisi Desktop PC/Laptop Windows: Installer mandiri (.exe) berukuran sangat ramping (~5 MB) dan hemat RAM.',
    'Pusat Catatan Pembaruan: Rincian patch pembaruan, riwayat perubahan, dan peta jalan fitur mendatang dapat dibaca langsung di aplikasi.',
    'Pengecekan Pembaruan Lintas Platform: Auto-update kini mendeteksi berkas installer Android (.apk) maupun Windows (.exe) secara cerdas.',
    'Optimasi Layar Lebar: Tampilan antarmuka disesuaikan dengan nyaman untuk monitor PC/laptop tanpa distorsi layout.',
    'Audit & Pengerasan Keamanan: Sanitasi formula injection, audit skema data, dan pengamanan transaksi IndexedDB.',
  ],
  categories: [
    {
      categoryName: 'Fitur Baru',
      items: [
        'Dukungan penuh installer desktop Windows (JufaStore-Setup.exe) melalui workflow otomatis GitHub Actions.',
        'Pusat informasi Catatan Pembaruan interaktif di menu Tentang Aplikasi dengan 3 tab: Versi Ini, Pembaruan Mendatang, dan Riwayat Rilis.',
        'Dialog pemberitahuan pembaruan baru yang menampilkan poin perubahan lengkap layaknya toko aplikasi resmi.',
        'Deteksi platform otomatis (Android, Windows Desktop, Web) pada ringkasan sistem.',
      ],
    },
    {
      categoryName: 'Peningkatan Antarmuka & Layar Lebar',
      items: [
        'Penataan kontainer responsif agar komponen tidak melebar berlebihan di layar monitor PC/laptop.',
        'Sidebar navigasi desktop terkategori tetap kokoh di sisi kiri dengan animasi transisi yang mulus.',
        'Status platform dan arsitektur aktif ditampilkan secara transparan di panel Info Aplikasi.',
        'Penyempurnaan kontras elemen form, tabel data, dan grafik analitik pada layar beresolusi tinggi.',
      ],
    },
    {
      categoryName: 'Keamanan, Audit, & Stabilitas',
      items: [
        'Sanitasi proteksi formula injection otomatis (karakter =, +, -, @) pada sinkronisasi Google Sheets.',
        'Pencegahan kebocoran token dan rahasia aplikasi dengan validasi skema Zod ketat pada ekspor/impor cadangan.',
        'Audit kode menyeluruh: 0 celah keamanan, 0 manipulasi memori, dan zero telemetry data bisnis.',
        'Penyelarasan parsing SemVer multi-digit untuk menjamin keakuratan deteksi versi rilis.',
      ],
    },
  ],
};

/**
 * Peta Jalan Pembaruan Mendatang (Upcoming Features / Roadmap)
 */
export const UPCOMING_ROADMAP: UpcomingFeatureItem[] = [
  {
    id: 'desktop-shortcuts',
    title: 'Shortcut Navigasi Keyboard Desktop',
    status: 'Dalam Pengerjaan',
    targetVersion: 'v2.1.30',
    description:
      'Dukungan kombinasi tombol pintas keyboard untuk mempercepat operasional di laptop/PC (misalnya: Ctrl+N untuk transaksi baru, Ctrl+K untuk kalkulator, Ctrl+S untuk simpan, dan Esc untuk menutup dialog).',
    benefits: [
      'Mempercepat pencatatan puluhan pesanan Robux secara beruntun.',
      'Operasional tanpa harus selalu menggunakan mouse.',
    ],
  },
  {
    id: 'pdf-receipt-export',
    title: 'Ekspor Kuitansi & Laporan PDF Lokal',
    status: 'Direncanakan',
    targetVersion: 'v2.2.0',
    description:
      'Fitur mencetak bukti transaksi penjualan digital dan laporan rekapitulasi laba rugi berkala ke dalam format PDF resmi langsung dari perangkat pengguna tanpa koneksi internet.',
    benefits: [
      'Bukti transaksi formal yang dapat disimpan atau diarsipkan pemilik.',
      'Format rapi siap cetak untuk dokumentasi keuangan.',
    ],
  },
  {
    id: 'high-contrast-theme',
    title: 'Pilihan Palet Visual Kontras Tinggi',
    status: 'Direncanakan',
    targetVersion: 'v2.2.0',
    description:
      'Opsi palet visual tema tambahan yang dirancang khusus untuk kenyamanan mata saat input data berjam-jam pada monitor laptop di ruangan dengan intensitas cahaya bervariasi.',
    benefits: [
      'Keterbacaan angka dan status transaksi lebih tajam.',
      'Mengurangi kelelahan mata pemilik bisnis saat rekap malam hari.',
    ],
  },
];

/**
 * Riwayat Catatan Rilis Versi-Versi Sebelumnya
 */
export const HISTORICAL_PATCH_NOTES: PatchNoteItem[] = [
  {
    version: '2.1.28',
    releaseDate: 'November 2026',
    title: 'Pengerasan Keamanan Google Sheets Apps Script',
    badge: 'Stabil',
    summary:
      'Peningkatan keamanan Apps Script menggunakan secret UUID 64 hex kriptografis, sanitasi anti-formula injection, pewarnaan baris selang-seling, dan grafik tren bulanan otomatis.',
    highlights: [
      'Secret aman berbasis Utilities.getUuid() ganda (64 karakter heksadesimal acak).',
      'Anti-formula injection pada sel teks yang diawali =, +, -, atau @.',
      'Pewarnaan baris selang-seling (banding) dan conditional formatting status transaksi.',
      'Grafik garis tren omzet vs laba kotor dibuat otomatis pada setup Google Spreadsheet.',
      'Penghapusan mekanisme penguncian 15 menit dengan pembatasan ukuran payload (2 MB) dan nonce.',
    ],
    categories: [
      {
        categoryName: 'Pembaruan & Perbaikan',
        items: [
          'Sinkronisasi 100% identik antara template Code.gs lokal dan dokumentasi.',
          'Format angka Rupiah dan tanggal WIB otomatis hingga batas baris penuh sheet.',
          'Pembaruan aksi update-summary setelah sinkronisasi tabel data selesai.',
        ],
      },
    ],
  },
  {
    version: '2.1.27',
    releaseDate: 'Oktober 2026',
    title: 'Arsitektur Google Sheets Table Mirror V2',
    badge: 'Pembaruan Besar',
    summary:
      'Rombak total integrasi Google Sheets menjadi sistem pencerminan tabel satu arah (aplikasi -> Sheets) yang aman dengan tanda tangan HMAC-SHA256, self-healing, dan chunk atomik.',
    highlights: [
      'Pencerminan tabel satu arah yang tidak mengganggu alur transaksi lokal.',
      'Autentikasi permintaan menggunakan HMAC-SHA256 timestamp dan nonce anti-replay.',
      'Penghapusan tabel syncQueue lama lewat Dexie version 6 tanpa menghapus data bisnis.',
    ],
    categories: [
      {
        categoryName: 'Pembaruan Arsitektur',
        items: [
          'Penggantian data chunk atomik yang mencegah duplikasi baris di Google Sheets.',
          'Pemulihan cadangan JSON otomatis memicu sinkronisasi ulang penuh.',
        ],
      },
    ],
  },
  {
    version: '2.1.26',
    releaseDate: 'Oktober 2026',
    title: 'Deteksi Jaringan Global & Verifikasi Koneksi Nyata',
    badge: 'Stabil',
    summary:
      'Sistem deteksi status online/offline global dengan verifikasi konektivitas nyata menggunakan ping ringan tanpa mengganggu header aplikasi.',
    highlights: [
      'Deteksi perubahan status jaringan hanya melalui toast yang bersih saat status berubah.',
      'Verifikasi ping nyata mencegah false-positive jaringan Wifi tanpa akses internet.',
    ],
    categories: [
      {
        categoryName: 'Jaringan & Konektivitas',
        items: [
          'Integrasi @capacitor/network dengan fallback event browser.',
          'Sinkronisasi Google Sheets otomatis menunggu perangkat benar-benar terhubung ke internet.',
        ],
      },
    ],
  },
  {
    version: '2.1.25',
    releaseDate: 'Oktober 2026',
    title: 'Alur Update Tombol GitHub & Restrukturisasi Menu Stok',
    badge: 'Pembaruan Fitur',
    summary:
      'Peralihan mekanisme update ke tombol unduh langsung di browser untuk mencegah galat parsing paket Android, penataan 3 sub-menu stok, konfigurasi rate jual standar toko, dan sound engine lokal.',
    highlights: [
      'Pembaruan APK melalui alur tombol langsung ke browser sistem yang bebas dari galat penguraian paket OS.',
      'Restrukturisasi menu stok menjadi 3 tab terfokus: Stok Aktif, Riwayat Restock, dan Pengambilan Pribadi.',
      'Pengaturan rate jual standar toko untuk pengisian cepat di kalkulator.',
      'Sound effect tap lokal berbasis Web Audio API tanpa berkas audio eksternal.',
      'Visualisasi grafik tren omzet dan laba bulanan interaktif Recharts.',
    ],
    categories: [
      {
        categoryName: 'Fitur & Antarmuka',
        items: [
          'Pembersihan sisa file unduhan lama secara otomatis pada startup.',
          'Pengecekan live preview pemformatan angka pada seluruh form input nominal.',
        ],
      },
    ],
  },
  {
    version: '2.1.24',
    releaseDate: 'Oktober 2026',
    title: 'Riwayat Stok Dinamis & Audit Mutasi FIFO',
    badge: 'Stabil',
    summary:
      'Pencatatan riwayat mutasi stok dinamis per batch, fitur edit jumlah Robux sisa dengan validasi akuntansi ketat, dan kunci signing rilis Android permanen.',
    highlights: [
      'Pelacakan setiap pengurangan stok per transaksi penjualan, prive, dan koreksi.',
      'Penguncian identitas rilis (keystore SHA-256) permanen untuk pembaruan berkelanjutan tanpa risiko hilang data.',
    ],
    categories: [
      {
        categoryName: 'Inventaris & Akuntansi',
        items: [
          'Audit log mutasi persediaan barang secara otomatis dan atomik.',
          'Perlindungan integritas saldo kas saat dilakukan penyesuaian stok Robux.',
        ],
      },
    ],
  },
];
