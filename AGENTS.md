# JufaStore — Aturan Permanen & Arsitektur Project (AGENTS.md)

Dokumen ini adalah hukum tertinggi untuk SEMUA tugas di project **JufaStore**. Baca dan patuhi sepenuhnya sebelum menulis atau mengubah kode apa pun.

## 1. Identitas & Ruang Lingkup Aplikasi
- **Nama Aplikasi:** `JufaStore` (hanya itu, tanpa embel-embel). Gunakan secara konsisten di UI, `<title>`, `manifest.webmanifest`, `capacitor.config.json`, dan `README.md`.
- **Target Pengguna:** Satu pemilik bisnis Robux (pencatatan internal & kalkulator pribadi). BUKAN marketplace, TANPA login pelanggan, TANPA fitur share ke WhatsApp, TANPA perhitungan pajak Gamepass 30%.
- **Bahasa & Lokalisasi:** Seluruh UI, label, pesan validasi, dan laporan wajib menggunakan Bahasa Indonesia yang rapi.
- **Format Angka & Waktu:** Format Rupiah: `Rp320.000` (tanpa desimal untuk tampilan kas/harga). Zona waktu: `Asia/Jakarta` (WIB).

## 2. Prinsip Mutlak: NOL DATA BAWAAN (STRICT ZERO-DEFAULT STATE)
- Aplikasi WAJIB dimulai dari `0` / KOSONG murni saat pertama kali dijalankan.
- **DILARANG KERAS** menaruh angka bisnis bawaan (misalnya rate `150`, `160`, `166`, `171`, saldo awal, kategori dummy, atau transaksi contoh) di logika aplikasi, nilai default state/form, placeholder yang terlihat seperti nilai isi, ataupun seed database.
- Jika data belum ada (misal: stok masih `0` atau rate belum diketik), tampilkan *Empty State* yang bersih dan menuntun pengguna untuk mengisi data pertamanya.
- Angka contoh (`fixture`) HANYA diizinkan berada di dalam folder `src/tests/` untuk keperluan *unit test*.

## 3. Batasan Fitur (Apa yang DILARANG Ada)
Agar aplikasi fokus, cepat, dan tidak membebani pengguna:
- **TANPA Diskon / Promo:** Tidak ada kolom diskon, voucher, atau potongan harga di penjualan maupun restock.
- **TANPA Biaya Admin / Layanan:** Harga yang diketik pengguna adalah harga ril bersih yang diterima atau dikeluarkan.
- **TANPA Sumber Stok / Supplier:** Saat restock, pengguna hanya memasukkan jumlah Robux dan total uang ril yang dikeluarkan.
- **TANPA Sistem Kasbon / Pelanggan / Investor:** Semua transaksi dicatat berdasarkan uang ril yang masuk dan keluar.

## 4. Tech Stack & Keamanan Supply-Chain (Minimal & Terkunci)
Sebelum menginstal paket, cek versi stabil terbaru (`npm view <paket> version`), hindari versi beta/rc, pin versi eksak di `package.json`, dan pastikan `npm audit` bersih dari celah High/Critical:
- **Core:** React + TypeScript (Strict Mode) + Vite + Capacitor (kompatibel dengan `.github/workflows/build-apk.yml`).
- **Styling & UI:** Tailwind CSS + komponen berbasis Radix UI / shadcn/ui.
- **Tipografi Lokal:** `@fontsource/poppins` sebagai font utama aplikasi (dibundel 100% lokal, tanpa Google Fonts CDN).
- **Notifikasi & Konfirmasi:** `sweetalert2` (dikustomisasi agar mengikuti tema Terang/Gelap aplikasi) untuk konfirmasi hapus, peringatan stok kurang, dan popup update kode terbaru.
- **Ikon:** `lucide-react` untuk SEMUA ikon (DILARANG KERAS menggunakan emoji di seluruh UI).
- **Animasi:** `motion` (Framer Motion) dengan penghormatan penuh pada `prefers-reduced-motion`.
- **Database Lokal:** `dexie` (IndexedDB wrapper) dengan transaksi atomik dan sistem migrasi versi skema.
- **Validasi & Form:** `zod` + `react-hook-form`.
- **Visualisasi & Utilitas:** `recharts` (grafik laporan), `react-easy-crop` (crop logo toko lokal), `vite-plugin-pwa` (offline-first).
- **Testing & Quality:** `vitest` + `@testing-library/react` + ESLint + Prettier.

## 5. Keamanan Aplikasi (Offline-First & Zero Telemetry)
- **100% Data Lokal:** Seluruh database berada di perangkat pengguna (IndexedDB). Dilarang mengirim data bisnis ke server mana pun.
- **Satu-satunya Koneksi Keluar:** Hanya untuk mengecek dan mengunduh pembaruan kode/aplikasi (`version.json` / GitHub Releases API milik repositori ini). Wajib gagal dengan tenang (*graceful degradation*) tanpa memunculkan error mengganggu saat perangkat offline.
- **Sanitasi & Validasi:** Dilarang menggunakan `eval()`, `new Function()`, atau `dangerouslySetInnerHTML`. Semua file impor backup JSON dan unggahan gambar ikon wajib divalidasi skema Zod serta ukuran/tipe MIME-nya.

## 6. Aturan Akuntansi, Stok FIFO, & Matematika Uang (Wajib Presisi)
1. **Integer Rupiah:** Semua nominal uang disimpan sebagai `INTEGER` Rupiah. Cegah pembagian dengan nol (`NaN` / `Infinity`). Jika omzet `0`, tampilkan margin sebagai `"Tidak tersedia"`.
2. **Alokasi HPP Metode FIFO & Sisa Pembulatan:**
   - Setiap pembelian stok (*Restock*) membuat **Batch Baru** berisi `jumlahRobux` dan `totalHargaBayar` (uang ril yang keluar).
   - Pembelian stok **BUKAN biaya/pengeluaran rugi-laba**, melainkan konversi aset: *Kas Berkurang, Persediaan Bertambah*.
   - Jika `totalHargaBayar ÷ jumlahRobux` menghasilkan desimal (tidak habis dibagi), simpan `totalHargaBayar` secara utuh pada batch dan gunakan rumus alokasi sisa pembulatan (*integer remainder allocation*) saat menghitung HPP per unit yang keluar agar ketika seluruh Robux dalam batch tersebut habis terjual, **Total HPP yang tercatat sama persis 100% dengan `totalHargaBayar` (selisih Rp0)**.
3. **Rumus Laba:**
   - `Laba Kotor = Total Harga Jual Ril − HPP (dari batch FIFO yang terpakai)`.
   - `Laba Bersih = Laba Kotor − Biaya Operasional Manual (jika ada di buku kas)`.
4. **Sisa Robux Akun Roblox:**
   - Memiliki sumber batch khusus `"Sisa Robux Akun"`. Tidak mengubah saldo kas dan bukan pendapatan.
   - Pengguna memilih apakah ini **(a) Koreksi stok tercatat** (hanya sesuaikan angka stok) atau **(b) Tambahan stok di luar pencatatan** (membuat batch baru dengan modal per Robux yang diisi pengguna, boleh `Rp0` dengan peringatan bahwa margin laba dari batch ini akan terlihat 100%).
5. **Pemakaian Robux Pribadi:**
   - Memotong stok Robux menggunakan antrean FIFO.
   - Dicatat sebagai *Pengambilan Pribadi Pemilik (Prive Non-Kas)* sebesar nilai modal batch yang terpakai: **TIDAK mengurangi laba bersih toko** dan **TIDAK mengubah saldo kas**.

## 7. Standar Kode & Definisi Selesai
- Struktur modular: `src/domain/` (logika & rumus murni tanpa UI), `src/db/` (skema Dexie & repository), `src/features/<fitur>/` (komponen, hooks, validasi).
- Komponen UI dilarang memanggil Dexie secara langsung; wajib melewati *service/repository layer* dengan transaksi atomik (`db.transaction('rw', ...)`).
- Setiap tugas hanya dianggap selesai jika `npm run lint`, `npm run test`, dan `npm run build` berjalan lulus 100% tanpa error.