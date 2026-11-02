# Panduan Menghubungkan Google Spreadsheet (JufaStore Sync V2)

Dokumen ini menjelaskan langkah-langkah mudah menghubungkan aplikasi **JufaStore** ke Google Spreadsheet pribadi Anda. Sinkronisasi berjalan satu arah (dari aplikasi ke Spreadsheet) sebagai cermin cadangan (*backup mirror*) dan pelaporan online yang aman.

---

### Langkah 1: Buat Spreadsheet Baru di Google Drive
1. Buka [Google Sheets](https://sheets.new) di browser Anda untuk membuat dokumen spreadsheet kosong baru.
2. Beri nama spreadsheet Anda di pojok kiri atas, misalnya: `Pembukuan JufaStore`.

---

### Langkah 2: Buka Editor Apps Script & Tempel Kode
1. Pada menu atas spreadsheet, klik **Ekstensi** (*Extensions*) > pilih **Apps Script**.
2. Editor kode akan terbuka di tab baru.
3. Hapus seluruh kode bawaan yang ada di editor (misalnya `function myFunction() { ... }`).
4. Salin seluruh isi berkas `docs/google-apps-script/Code.gs` (atau tekan tombol **Salin Script** di aplikasi JufaStore), lalu tempelkan ke editor Apps Script.
5. Tekan tombol **Simpan** (*Save* / ikon disket) atau `Ctrl+S`.

---

### Langkah 3: Jalankan Fungsi `setup()` & Salin Kode Rahasia (Secret)
1. Pada bilah atas editor Apps Script, pastikan menu drop-down fungsi memilih **setup**.
2. Klik tombol **Run** (Jalankan / ikon segitiga putar).
3. Google akan meminta izin akses pertama kali:
   - Klik **Tinjau Izin** (*Review permissions*).
   - Pilih akun Google Anda.
   - Klik **Lanjutan** (*Advanced*) di kiri bawah > klik **Buka (nama proyek) (tidak aman)**.
   - Klik **Izinkan** (*Allow*).
4. Setelah fungsi selesai berjalan, periksa bagian **Log Eksekusi** (*Execution log*) di bawah editor.
5. Anda akan melihat baris:
   ```text
   Salin KODE RAHASIA (SECRET) berikut ke Pengaturan Google Sheets di aplikasi:
   <kode_hex_panjang_64_karakter>
   ```
6. Salin kode rahasia tersebut.

---

### Langkah 4: Deploy sebagai Web App
1. Di pojok kanan atas editor Apps Script, klik tombol biru **Deploy** (Terapkan) > pilih **New deployment** (Penerapan baru).
2. Di samping kiri tulisan *Select type*, klik ikon gerigi > pilih **Web app**.
3. Atur konfigurasi berikut:
   - **Description**: `JufaStore Sync V2`
   - **Execute as**: **Me** (`email.anda@gmail.com`)
   - **Who has access**: **Anyone** (Siapa saja)
     *(PENTING: Wajib memilih "Anyone" agar aplikasi JufaStore dapat mengirim data tanpa login Google pop-up).*
4. Klik **Deploy**.
5. Salin **Web app URL** yang muncul (berakhiran `/exec`).

---

### Langkah 5: Tempel ke Aplikasi JufaStore
1. Buka aplikasi **JufaStore** di HP atau browser Anda.
2. Masuk ke menu **Pengaturan** > bagian **Sinkronisasi Google Spreadsheet**.
3. Tempelkan **URL Web App** dan **Kode Rahasia (Secret)** pada kolom yang tersedia.
4. Klik tombol **Uji Koneksi**.
5. Jika berhasil terhubung, tekan tombol **Sinkron Penuh** satu kali untuk langsung mencerminkan seluruh transaksi dan stok Anda ke spreadsheet.

---

### Cara Memperbarui Script di Kemudian Hari
Jika terdapat pembaruan kode `Code.gs` di rilis mendatang:
1. Buka kembali spreadsheet Anda > **Ekstensi** > **Apps Script**.
2. Tempelkan kode terbaru.
3. Klik **Deploy** > **Manage deployments** (Kelola penerapan).
4. Klik ikon pensil (**Edit**) pada deployment aktif Anda.
5. Pada bagian *Version*, pilih **New version** (Versi baru).
6. Klik **Deploy**.
*(Dengan cara ini, URL Web App Anda tetap sama persis dan tidak perlu diatur ulang di aplikasi).*

---

### Cara Mengganti Kode Rahasia (Reset Secret)
Jika kode rahasia Anda tidak sengaja diketahui pihak lain:
1. Buka editor Apps Script.
2. Pilih fungsi **resetSecret** pada drop-down menu fungsi di toolbar.
3. Klik **Run**.
4. Kode rahasia baru akan dicetak pada Log Eksekusi. Salin dan perbarui di aplikasi JufaStore Anda.
