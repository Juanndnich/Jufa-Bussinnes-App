/**
 * JufaStore - Pusat Informasi Catatan Rilis & Pembaruan (Play Store Style)
 * Menyediakan rincian patch pembaruan versi saat ini dan riwayat rilis terdahulu.
 */

export const CURRENT_APP_VERSION = '2.1.30';

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

/**
 * Catatan Rilis Resmi Versi Terpasang Saat Ini (v2.1.30)
 */
export const CURRENT_PATCH_NOTE: PatchNoteItem = {
  version: CURRENT_APP_VERSION,
  releaseDate: 'November 2026',
  title: 'Buku Tabungan Pribadi & Penyatuan Rilis Multi-Platform',
  badge: 'Versi Rilis Terbaru',
  summary:
    'Pembaruan versi 2.1.30 menghadirkan modul mandiri Buku Tabungan Pribadi untuk memantau dana mandiri dan pengeluaran pos kebutuhan tanpa mempengaruhi persediaan stok Robux dan kas toko, perbaikan aksen warna hijau emerald pada tabel pricelist, serta penyatuan rilis resmi GitHub Releases.',
  highlights: [
    'Buku Tabungan Pribadi: Pencatatan setor dan pemakaian uang tabungan dengan alokasi pos kategori bebas (Makan, Mainan, Liburan, dll.) atau Uang Biasa.',
    'Pilihan Pos Sumber Saat Tarik: Pengguna bebas memilih apakah uang keluar diambil dari dana umum tanpa kategori atau pos kategori tertentu dengan validasi saldo.',
    'Penyelarasan Warna Pricelist: Seluruh aksen warna cyan/biru pada tabel harga Robux diganti menjadi tema hijau emerald yang elegan.',
    'Penyatuan Rilis Multi-Platform: Berkas Android APK (JufaStore.apk) dan Windows Desktop Installer (JufaStore-Setup.exe) dipublikasikan bersamaan dalam satu rilis resmi.',
    'Antarmuka Bersih & Rapi: Penghapusan tab roadmap mendatang agar panel Tentang Aplikasi lebih fokus dan nyaman dibaca.',
  ],
  categories: [
    {
      categoryName: 'Fitur Baru',
      items: [
        'Modul Buku Tabungan Pribadi (Savings) dengan kalkulasi saldo dinamis integer Rupiah.',
        'Sistem kategori bebas untuk pos alokasi tabungan dengan penambahan instan.',
        'Penyatuan workflow rilis resmi GitHub Actions untuk Android dan Windows Desktop.',
        'Dukungan ekspor dan impor cadangan data tabungan ke berkas cadangan JSON.',
      ],
    },
    {
      categoryName: 'Penyempurnaan Tampilan & Antarmuka',
      items: [
        'Penyelarasan palet warna Emerald pada kartu dan tabel kalkulator pricelist Robux.',
        'Penyederhanaan tab Tentang Aplikasi menjadi 2 tab bersih: Versi Ini dan Riwayat Rilis.',
        'Navigasi sidebar dan laci menu ponsel diperbarui dengan ikon Buku Tabungan Pribadi.',
        'Empty State informatif yang menuntun pengisian tabungan pertama pengguna.',
      ],
    },
    {
      categoryName: 'Integritas Sistem & Keamanan',
      items: [
        'Migrasi skema database Dexie versi 7 yang aman tanpa mengubah struktur data bisnis terdahulu.',
        'Validasi transaksi atomik (db.transaction) untuk seluruh operasi mutasi tabungan.',
        'Pemberlakuan aturan baku zero telemetry dan 100% penyimpanan data lokal perangkat.',
      ],
    },
  ],
};

/**
 * Riwayat Catatan Rilis Versi-Versi Sebelumnya
 */
export const HISTORICAL_PATCH_NOTES: PatchNoteItem[] = [
  {
    version: '2.1.29',
    releaseDate: 'November 2026',
    title: 'Dukungan Desktop Windows & Pusat Catatan Pembaruan',
    badge: 'Stabil',
    summary:
      'Menghadirkan dukungan aplikasi desktop mandiri (.exe) untuk PC/laptop Windows berbasis arsitektur Tauri v2 yang sangat ringan, pusat informasi catatan pembaruan resmi (Play Store style), dan optimasi tata letak layar lebar.',
    highlights: [
      'Edisi Desktop PC/Laptop Windows: Installer mandiri (.exe) berukuran sangat ramping (~5 MB) dan hemat RAM.',
      'Pusat Catatan Pembaruan: Rincian patch pembaruan dan riwayat perubahan dapat dibaca langsung di aplikasi.',
      'Pengecekan Pembaruan Lintas Platform: Auto-update mendeteksi berkas installer Android (.apk) maupun Windows (.exe).',
      'Optimasi Layar Lebar: Tampilan antarmuka disesuaikan dengan nyaman untuk monitor PC/laptop tanpa distorsi layout.',
    ],
    categories: [
      {
        categoryName: 'Pembaruan & Perbaikan',
        items: [
          'Dukungan penuh installer desktop Windows (JufaStore-Setup.exe) melalui workflow GitHub Actions.',
          'Pusat informasi Catatan Pembaruan interaktif di menu Tentang Aplikasi.',
          'Dialog notifikasi pembaruan baru dengan detail perubahan layaknya toko aplikasi resmi.',
        ],
      },
    ],
  },
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
      'Header aplikasi tetap bersih dari ikon sinyal wifi yang tidak perlu.',
    ],
    categories: [
      {
        categoryName: 'Peningkatan Sistem',
        items: [
          'Verifikasi endpoint acak untuk mencegah caching status offline pada browser.',
          'Peningkatan performa hook jaringan dengan debounce.',
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
