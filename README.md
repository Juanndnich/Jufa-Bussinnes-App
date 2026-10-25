# JufaStore

Aplikasi internal dan kalkulator Robux 2 arah untuk pemilik bisnis Robux pribadi, dibangun dengan fokus pada presisi akuntansi FIFO, zero-default state, dan offline-first.

## Fitur Utama

1. **Dashboard Hasil & Ringkasan:**
   - Monitoring sisa stok Robux (R$), modal beli persediaan, omzet penjualan, dan laba bersih riil.
   - Valuasi persediaan FIFO dan tren penjualan 7 hari terakhir (Recharts).
   - Kinerja hari ini dan bulan ini.

2. **Kalkulator Robux 2 Arah & Catat Jual:**
   - **Mode 1 (Uang ke Robux):** Menghitung Robux yang didapat dan sisa uang kembalian dari budget pembeli.
   - **Mode 2 (Robux ke Uang):** Menghitung total harga Rupiah yang harus dibayar pembeli.
   - Simulasi alokasi FIFO secara real-time dengan status laba (Untung, Impas, Rugi) dan peringatan jika harga jual di bawah modal persediaan.
   - 1-klik untuk langsung mencatat transaksi penjualan ke antrean FIFO.

3. **Stok & Antrean Batch FIFO:**
   - Pencatatan Restock kulakan baru dengan sinkronisasi otomatis ke Buku Kas.
   - Alokasi HPP menggunakan metode integer remainder allocation (Zero Rounding Drift: selisih Rp0 saat batch habis terjual).
   - Pencatatan Sisa Robux Akun Roblox (rekonsiliasi stok non-kas).
   - Pemakaian Robux Pribadi (Prive Non-Kas yang memotong stok FIFO tanpa mengurangi laba bersih toko dan tanpa mengubah saldo kas).

4. **Buku Kas Harian:**
   - Pencatatan mutasi kas masuk dan kas keluar yang dikelompokkan per tanggal.
   - Proteksi kunci otomatis untuk entri yang berasal dari Penjualan dan Restock.
   - Kategori kustom dengan warna tag pilihan pengguna.

5. **Analisis & Laporan:**
   - Perhitungan Titik Impas (Break-Even Rate / BEP) per Robux.
   - Simulator skenario target keuntungan (100%, 75%, 50%, 25% stok terjual).
   - Ekspor laporan penjualan dan buku kas ke CSV dengan format UTF-8 BOM.

6. **Pengaturan & Cadangan Lokal:**
   - Tema Mode Gelap, Mode Terang, dan Mengikuti Sistem.
   - Pilihan warna aksen dan ukuran teks.
   - Kustomisasi logo toko dengan pemotong gambar lokal (`react-easy-crop`).
   - Ekspor dan impor cadangan JSON dengan validasi skema Zod.
   - Pengecekan pembaruan otomatis via GitHub Release.

## Standar & Aturan Bisnis

- **Strict Zero-Default State:** Aplikasi murni dimulai dari 0/kosong saat pertama kali dibuka, tanpa angka patokan atau data dummy.
- **Tanpa Diskon, Pajak Gamepass, Supplier, atau Kasbon:** Transaksi murni mencatat uang dan Robux riil yang berpindah tangan.
- **100% Offline & Lokal:** Semua data disimpan di IndexedDB perangkat pengguna melalui Dexie.js.

## Tech Stack

- React 18 + TypeScript (Strict Mode)
- Vite + Vite PWA Plugin
- Tailwind CSS
- Dexie.js (IndexedDB)
- Lucide React (Ikon murni tanpa emoji)
- SweetAlert2
- Recharts
- Vitest

## Menjalankan Proyek

```bash
# Menjalankan server pengembangan
npm run dev

# Menjalankan unit tests
npm test

# Membangun produksi (Web / PWA)
npm run build
```
