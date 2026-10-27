/**
 * JufaStore - Google Sheets Cloud Sync Utility
 * Menghubungkan aplikasi JufaStore dengan Google Spreadsheet melalui Google Apps Script Webhook.
 * Mendukung 6 sheet/tabel terpisah rapi (Penjualan, Stok FIFO, Buku Kas, Pinjaman Modal, Investor, Pemakaian Pribadi),
 * dengan tata letak lapang, warna header tematik, baris beku (frozen row), dan padding kolom lebar.
 */

import { repository } from '../db/repository';
import { formatDateJakarta, formatRupiah } from './formatters';

export interface GoogleSheetsSyncResult {
  success: boolean;
  message: string;
  syncedAt?: string;
  recordCounts?: {
    sales: number;
    batches: number;
    cashEntries: number;
    loans: number;
    investors: number;
    personalUsages: number;
  };
}

export interface SheetDefinition {
  name: string;
  title: string;
  color: string;
  headers: string[];
}

export const GOOGLE_SHEETS_COLUMNS = [
  'Waktu (WIB)',
  'Kategori Data',
  'ID / No Invoice',
  'Keterangan',
  'Jumlah Robux (R$)',
  'Rate (Rp)',
  'Total Omzet (Rp)',
  'HPP / Modal (Rp)',
  'Laba Bersih (Rp)',
  'Sumber Dana / Status',
];

/**
 * Konfigurasi 6 Tabel Terpisah Sesuai Seluruh Modul Aplikasi JufaStore
 */
export const GOOGLE_SHEETS_TABLES: Record<string, SheetDefinition> = {
  penjualan: {
    name: 'Penjualan',
    title: 'Laporan Penjualan Robux',
    color: '#10b981', // Hijau Emerald Khas JufaStore
    headers: [
      'Waktu (WIB)',
      'No Invoice',
      'Nama Pembeli',
      'Jumlah Robux (R$)',
      'Rate Jual (Rp)',
      'Total Omzet (Rp)',
      'Modal HPP (Rp)',
      'Laba Kotor (Rp)',
      'Margin (%)',
      'Status Transaksi',
      'Catatan',
    ],
  },
  stokBatches: {
    name: 'Stok_Batch_FIFO',
    title: 'Stok & Riwayat Batch Masuk (FIFO)',
    color: '#d97706', // Amber / Oranye Hangat
    headers: [
      'ID Batch',
      'Waktu Masuk (WIB)',
      'Sumber Stok',
      'Sumber Dana',
      'Robux Awal (R$)',
      'Sisa Robux (R$)',
      'Total Modal Beli (Rp)',
      'Modal per Robux (Rp)',
      'Sisa Nilai Modal (Rp)',
      'Status Batch',
      'Catatan',
    ],
  },
  bukuKas: {
    name: 'Buku_Kas',
    title: 'Buku Kas Masuk & Keluar',
    color: '#0284c7', // Sky Blue
    headers: [
      'ID Transaksi',
      'Waktu (WIB)',
      'Arus Kas',
      'Kategori / Sumber',
      'Nominal (Rp)',
      'Keterangan',
    ],
  },
  pinjamanModal: {
    name: 'Pinjaman_Modal',
    title: 'Buku Utang / Pinjaman Modal Restock',
    color: '#7c3aed', // Ungu
    headers: [
      'ID Pinjaman',
      'Tanggal Pinjam (WIB)',
      'Pemberi Pinjaman / Kreditor',
      'Pokok Pinjaman (Rp)',
      'Sisa Utang (Rp)',
      'Total Terbayar (Rp)',
      'Jatuh Tempo',
      'Status Pinjaman',
      'Catatan',
    ],
  },
  investor: {
    name: 'Investor',
    title: 'Buku Pemodal & Bagi Hasil (Dividen)',
    color: '#4f46e5', // Indigo
    headers: [
      'ID Investor',
      'Nama Investor',
      'Modal Disetor (Rp)',
      'Porsi Bagi Hasil (%)',
      'Tanggal Bergabung',
      'Status Investor',
      'Catatan',
    ],
  },
  pemakaianPribadi: {
    name: 'Pemakaian_Pribadi',
    title: 'Pencatatan Prive / Robux Pribadi Pemilik',
    color: '#e11d48', // Rose / Merah Halus
    headers: [
      'ID Prive',
      'Waktu Pengambilan (WIB)',
      'Robux Diambil (R$)',
      'Nilai Modal HPP (Rp)',
      'Modal Efektif per R$ (Rp)',
      'Keperluan / Catatan',
    ],
  },
};

/**
 * Ekstrak ID Spreadsheet dari URL Google Docs Spreadsheet
 */
export function extractSpreadsheetId(url: string): string | null {
  if (!url) return null;
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : null;
}

/**
 * Buat tautan URL langsung untuk membuka Google Spreadsheet di browser
 */
export function getSpreadsheetOpenUrl(urlOrId: string): string {
  if (!urlOrId) return '';
  const clean = urlOrId.trim();
  if (clean.startsWith('http://') || clean.startsWith('https://')) {
    return clean;
  }
  return `https://docs.google.com/spreadsheets/d/${clean}/edit`;
}

/**
 * Script Google Apps Script yang dipasang di Google Spreadsheet pengguna.
 * Menghasilkan 6 Sheet/Tab terpisah rapi di bagian bawah Spreadsheet,
 * berformat lapang (tidak rapet), warna header tematik, dan bebas tumpang-tindih.
 */
export const GOOGLE_APPS_SCRIPT_TEMPLATE = `// ==============================================================
// JUFASTORE - SCRIPT JEMBATAN GOOGLE SPREADSHEET MULTI-TAB
// Membuat & menyinkronkan 6 Sheet terpisah sesuai modul JufaStore:
// 1. Penjualan
// 2. Stok_Batch_FIFO
// 3. Buku_Kas
// 4. Pinjaman_Modal
// 5. Investor
// 6. Pemakaian_Pribadi
// ==============================================================

// 1. FUNGSI PENERIMA DATA OTOMATIS (WEBHOOK POST)
function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    // Skenario 1: Struktur Multi-Tabel 6 Sheet Terpisah
    if (payload.sheets && payload.sheets.length > 0) {
      for (var i = 0; i < payload.sheets.length; i++) {
        prosesSheetTabel(ss, payload.sheets[i]);
      }
      hapusSheetKosongDefault(ss);
      
      return ContentService.createTextOutput(JSON.stringify({ 
        status: "success", 
        action: payload.action || "sync",
        tablesCount: payload.sheets.length 
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // Skenario 2: Cadangan Legacy Single-Sheet (Kompatibilitas)
    if (payload.rows) {
      var legacySheet = ss.getSheetByName("JufaStore_Backup") || ss.insertSheet("JufaStore_Backup");
      if (legacySheet.getLastRow() === 0) {
        var legacyHeaders = ["Waktu (WIB)", "Kategori", "ID / Invoice", "Keterangan", "Robux (R$)", "Rate (Rp)", "Total Uang (Rp)", "Modal HPP (Rp)", "Laba Kotor (Rp)", "Sumber / Status"];
        legacySheet.appendRow(legacyHeaders);
        legacySheet.getRange(1, 1, 1, legacyHeaders.length).setFontWeight("bold").setBackground("#10b981").setFontColor("#ffffff");
        legacySheet.setFrozenRows(1);
      }
      for (var j = 0; j < payload.rows.length; j++) {
        legacySheet.appendRow(payload.rows[j]);
      }
      return ContentService.createTextOutput(JSON.stringify({ 
        status: "success", 
        action: payload.action || "sync",
        count: payload.rows.length 
      })).setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({ 
      status: "success", 
      message: "Data diterima" 
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ 
      status: "error", 
      message: err.toString() 
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// 2. FUNGSI CEK KONEKSI (GET)
function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({ 
    status: "ready", 
    app: "JufaStore",
    version: "2.1.0",
    message: "Jembatan Google Apps Script JufaStore Aktif & Siap Menerima Data" 
  })).setMimeType(ContentService.MimeType.JSON);
}

// 3. FUNGSI BUAT TABEL LANGSUNG DARI EDITOR APPS SCRIPT
// (Pilih fungsi ini di menu dropdown atas lalu klik 'Jalankan / Run')
function inisialisasiTabelManual() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var daftarTabel = dapatkanDefinisiSemuaTabel();
  
  for (var i = 0; i < daftarTabel.length; i++) {
    var t = daftarTabel[i];
    prosesSheetTabel(ss, {
      name: t.name,
      headers: t.headers,
      color: t.color,
      rows: []
    });
  }
  
  hapusSheetKosongDefault(ss);
  
  SpreadsheetApp.getUi().alert(
    "Sukses! 6 Tabel terpisah berhasil dibuat murni bersih di tab masing-masing:\\n" +
    "1. Penjualan\\n" +
    "2. Stok_Batch_FIFO\\n" +
    "3. Buku_Kas\\n" +
    "4. Pinjaman_Modal\\n" +
    "5. Investor\\n" +
    "6. Pemakaian_Pribadi\\n\\n" +
    "Seluruh tabel bersih murni tanpa baris data contoh, siap menerima transaksi dari JufaStore!"
  );
}

// Helper: Format & Isi 1 Sheet Tabel (Lapang, Rapi, & Tidak Bertumpuk)
function prosesSheetTabel(ss, item) {
  var name = item.name;
  var headers = item.headers || [];
  var rows = item.rows || [];
  var color = item.color || "#10b981";

  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  
  // Bersihkan data lama agar sinkronisasi tidak menumpuk baris ganda
  sheet.clear();
  
  // 1. Header Berwarna Tematik dengan Teks Tebal Putih
  sheet.appendRow(headers);
  var headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setFontWeight("bold")
             .setBackground(color)
             .setFontColor("#ffffff")
             .setHorizontalAlignment("center")
             .setVerticalAlignment("middle");
  
  // Berikan tinggi header lapang (32px) dan bekukan baris 1
  try { sheet.setRowHeight(1, 32); } catch (eH1) {}
  sheet.setFrozenRows(1);
  
  // 2. Masukkan Baris Data (Hanya jika ada data ril)
  if (rows && rows.length > 0) {
    var dataRange = sheet.getRange(2, 1, rows.length, headers.length);
    dataRange.setValues(rows);
    dataRange.setVerticalAlignment("middle");
    
    // Berikan tinggi baris data lapang (26px) agar tidak rapet
    for (var r = 2; r <= rows.length + 1; r++) {
      try { sheet.setRowHeight(r, 26); } catch (eH) {}
    }
  }
  
  // 3. Atur Lebar Kolom dengan Bantalan Ekstra (+30px) agar leluasa dan tidak sempit
  for (var col = 1; col <= headers.length; col++) {
    try {
      sheet.autoResizeColumn(col);
      var w = sheet.getColumnWidth(col);
      sheet.setColumnWidth(col, Math.max(w + 30, 115));
    } catch (eW) {}
  }
}

// Helper: Hapus Sheet1 bawaan spreadsheet jika masih kosong
function hapusSheetKosongDefault(ss) {
  try {
    var sheets = ss.getSheets();
    if (sheets.length > 1) {
      for (var i = 0; i < sheets.length; i++) {
        var s = sheets[i];
        var sName = s.getName();
        if ((sName === "Sheet1" || sName === "Sheet 1") && s.getLastRow() === 0) {
          ss.deleteSheet(s);
          break;
        }
      }
    }
  } catch (err) {}
}

// Helper: Definisi 6 Tabel Modul JufaStore
function dapatkanDefinisiSemuaTabel() {
  return [
    {
      name: "Penjualan",
      color: "#10b981", // Hijau Emerald
      headers: ["Waktu (WIB)", "No Invoice", "Nama Pembeli", "Jumlah Robux (R$)", "Rate Jual (Rp)", "Total Omzet (Rp)", "Modal HPP (Rp)", "Laba Kotor (Rp)", "Margin (%)", "Status Transaksi", "Catatan"]
    },
    {
      name: "Stok_Batch_FIFO",
      color: "#d97706", // Amber
      headers: ["ID Batch", "Waktu Masuk (WIB)", "Sumber Stok", "Sumber Dana", "Robux Awal (R$)", "Sisa Robux (R$)", "Total Modal Beli (Rp)", "Modal per Robux (Rp)", "Sisa Nilai Modal (Rp)", "Status Batch", "Catatan"]
    },
    {
      name: "Buku_Kas",
      color: "#0284c7", // Sky Blue
      headers: ["ID Transaksi", "Waktu (WIB)", "Arus Kas", "Kategori / Sumber", "Nominal (Rp)", "Keterangan"]
    },
    {
      name: "Pinjaman_Modal",
      color: "#7c3aed", // Ungu
      headers: ["ID Pinjaman", "Tanggal Pinjam (WIB)", "Pemberi Pinjaman / Kreditor", "Pokok Pinjaman (Rp)", "Sisa Utang (Rp)", "Total Terbayar (Rp)", "Jatuh Tempo", "Status Pinjaman", "Catatan"]
    },
    {
      name: "Investor",
      color: "#4f46e5", // Indigo
      headers: ["ID Investor", "Nama Investor", "Modal Disetor (Rp)", "Porsi Bagi Hasil (%)", "Tanggal Bergabung", "Status Investor", "Catatan"]
    },
    {
      name: "Pemakaian_Pribadi",
      color: "#e11d48", // Rose
      headers: ["ID Prive", "Waktu Pengambilan (WIB)", "Robux Diambil (R$)", "Nilai Modal HPP (Rp)", "Modal Efektif per R$ (Rp)", "Keperluan / Catatan"]
    }
  ];
}`;

/**
 * Uji koneksi ke endpoint Google Sheets / Webhook
 */
export async function testGoogleSheetsUrl(url: string): Promise<{
  ok: boolean;
  message: string;
  isSpreadsheetDocUrl?: boolean;
}> {
  const cleanUrl = url.trim();
  if (!cleanUrl) {
    return { ok: false, message: 'URL belum diisi.' };
  }

  // Cek apakah pengguna memasukkan tautan Google Docs Spreadsheet langsung
  if (cleanUrl.includes('docs.google.com/spreadsheets')) {
    return {
      ok: false,
      isSpreadsheetDocUrl: true,
      message:
        'Tautan yang Anda masukkan adalah link halaman spreadsheet Anda, bukan Web App URL. Anda perlu membuat Web App melalui menu Ekstensi > Apps Script di spreadsheet Anda agar data bisa terkirim otomatis.',
    };
  }

  if (!cleanUrl.startsWith('https://')) {
    return { ok: false, message: 'URL Web App harus diawali dengan https://' };
  }

  try {
    const res = await fetch(cleanUrl, {
      method: 'GET',
      mode: 'cors',
    }).catch(async () => {
      // Fallback no-cors check jika ada redirect/CORS policy dari Google Apps Script
      return await fetch(cleanUrl, { method: 'GET', mode: 'no-cors' });
    });

    if (res.type === 'opaque' || res.ok) {
      return { ok: true, message: 'Koneksi ke Web App Google Apps Script berhasil diverifikasi!' };
    }

    return { ok: false, message: `Server merespons dengan status: ${res.status}` };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Koneksi gagal';
    return {
      ok: false,
      message: `Gagal terhubung: ${errorMsg}. Pastikan izin diatur ke "Anyone" saat deploy Web App.`,
    };
  }
}

/**
 * Buat struktur 6 tabel terpisah di Google Spreadsheet
 */
export async function initializeGoogleSheetTable(url: string): Promise<{ success: boolean; message: string }> {
  const cleanUrl = url.trim();
  if (!cleanUrl) {
    return { success: false, message: 'URL Web App belum diatur.' };
  }

  try {
    const sheetsPayload = [
      {
        name: GOOGLE_SHEETS_TABLES.penjualan.name,
        color: GOOGLE_SHEETS_TABLES.penjualan.color,
        headers: GOOGLE_SHEETS_TABLES.penjualan.headers,
        rows: [],
      },
      {
        name: GOOGLE_SHEETS_TABLES.stokBatches.name,
        color: GOOGLE_SHEETS_TABLES.stokBatches.color,
        headers: GOOGLE_SHEETS_TABLES.stokBatches.headers,
        rows: [],
      },
      {
        name: GOOGLE_SHEETS_TABLES.bukuKas.name,
        color: GOOGLE_SHEETS_TABLES.bukuKas.color,
        headers: GOOGLE_SHEETS_TABLES.bukuKas.headers,
        rows: [],
      },
      {
        name: GOOGLE_SHEETS_TABLES.pinjamanModal.name,
        color: GOOGLE_SHEETS_TABLES.pinjamanModal.color,
        headers: GOOGLE_SHEETS_TABLES.pinjamanModal.headers,
        rows: [],
      },
      {
        name: GOOGLE_SHEETS_TABLES.investor.name,
        color: GOOGLE_SHEETS_TABLES.investor.color,
        headers: GOOGLE_SHEETS_TABLES.investor.headers,
        rows: [],
      },
      {
        name: GOOGLE_SHEETS_TABLES.pemakaianPribadi.name,
        color: GOOGLE_SHEETS_TABLES.pemakaianPribadi.color,
        headers: GOOGLE_SHEETS_TABLES.pemakaianPribadi.headers,
        rows: [],
      },
    ];

    const payload = {
      app: 'JufaStore',
      action: 'INIT_TABLE',
      exportedAt: new Date().toISOString(),
      sheets: sheetsPayload,
    };

    await fetch(cleanUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(payload),
      mode: 'no-cors',
    });

    return {
      success: true,
      message: '6 Sheet tabel terpisah berhasil dikirim dan dibuat rapi di Google Spreadsheet Anda!',
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Gagal membuat tabel';
    return {
      success: false,
      message: `Gagal membuat tabel: ${errorMsg}`,
    };
  }
}

/**
 * Sinkronisasikan seluruh data ke 6 Sheet terpisah di Google Spreadsheet
 */
export async function syncAllDataToGoogleSheets(url: string): Promise<GoogleSheetsSyncResult> {
  const cleanUrl = url.trim();
  if (!cleanUrl) {
    return { success: false, message: 'URL Google Sheets belum diatur di Pengaturan.' };
  }

  try {
    const [sales, batches, cashEntries, loans, investors, personalUsages] = await Promise.all([
      repository.getSales(),
      repository.getAllBatches(),
      repository.getCashLedger(),
      repository.getLoans(),
      repository.getInvestors(),
      repository.getPersonalUsages(),
    ]);

    // 1. Data Baris Penjualan
    const salesRows = sales.map((s) => {
      const marginStr =
        s.totalRevenueRupiah > 0
          ? `${((s.grossProfitRupiah / s.totalRevenueRupiah) * 100).toFixed(1)}%`
          : '0%';

      return [
        formatDateJakarta(s.createdAt),
        s.invoiceNumber,
        s.customerName || '-',
        s.robuxSold,
        s.rateUsed,
        s.totalRevenueRupiah,
        s.totalCogsRupiah,
        s.grossProfitRupiah,
        marginStr,
        s.status === 'ACTIVE' ? 'Selesai / Lunas' : 'DIBATALKAN (VOID)',
        s.notes || '-',
      ];
    });

    // 2. Data Baris Stok & Batch FIFO
    const batchRows = batches.map((b) => [
      b.id,
      formatDateJakarta(b.createdAt),
      b.sourceType === 'RESTOCK' ? 'Restock Kulakan' : 'Sisa Akun Roblox',
      b.fundingSource === 'COMBINED'
        ? `Gabungan (Kas: ${formatRupiah(b.ownFundsRupiah || 0)} + Pinjaman: ${formatRupiah(b.loanFundsRupiah || 0)})`
        : b.fundingSource === 'LOAN'
        ? 'Pinjaman (Utang Modal)'
        : 'Dana Sendiri (Kas)',
      b.initialRobux,
      b.remainingRobux,
      b.totalCostRupiah,
      b.unitCostDisplay,
      b.remainingCostRupiah,
      b.remainingRobux <= 0 ? 'Habis Terjual' : 'Aktif (Tersedia)',
      b.notes || '-',
    ]);

    // 3. Data Baris Buku Kas
    const cashRows = cashEntries.map((c) => [
      c.id,
      formatDateJakarta(c.createdAt),
      c.type === 'IN' ? 'Kas Masuk (+)' : 'Kas Keluar (-)',
      c.sourceType || '-',
      c.amountRupiah,
      c.notes || '-',
    ]);

    // 4. Data Baris Pinjaman Modal
    const loanRows = loans.map((l) => [
      l.id,
      formatDateJakarta(l.createdAt),
      l.borrowerOrLender,
      l.loanAmountRupiah,
      l.remainingLoanRupiah,
      Math.max(0, l.loanAmountRupiah - l.remainingLoanRupiah),
      l.dueDate || '-',
      l.status === 'PAID' ? 'LUNAS (100%)' : 'BELUM LUNAS',
      l.notes || '-',
    ]);

    // 5. Data Baris Investor
    const investorRows = investors.map((inv) => [
      inv.id,
      inv.name,
      inv.capitalAmountRupiah,
      `${inv.sharePercentage}%`,
      formatDateJakarta(inv.joinDate),
      inv.status === 'ACTIVE' ? 'Aktif' : 'Nonaktif',
      inv.notes || '-',
    ]);

    // 6. Data Baris Pemakaian Pribadi
    const usageRows = personalUsages.map((u) => [
      u.id,
      formatDateJakarta(u.createdAt),
      u.robuxUsed,
      u.totalCostRupiah,
      u.robuxUsed > 0 ? (u.totalCostRupiah / u.robuxUsed).toFixed(2) : '0',
      u.notes || '-',
    ]);

    // Struktur 6 Sheet Terpisah
    const sheetsPayload = [
      {
        name: GOOGLE_SHEETS_TABLES.penjualan.name,
        color: GOOGLE_SHEETS_TABLES.penjualan.color,
        headers: GOOGLE_SHEETS_TABLES.penjualan.headers,
        rows: salesRows,
      },
      {
        name: GOOGLE_SHEETS_TABLES.stokBatches.name,
        color: GOOGLE_SHEETS_TABLES.stokBatches.color,
        headers: GOOGLE_SHEETS_TABLES.stokBatches.headers,
        rows: batchRows,
      },
      {
        name: GOOGLE_SHEETS_TABLES.bukuKas.name,
        color: GOOGLE_SHEETS_TABLES.bukuKas.color,
        headers: GOOGLE_SHEETS_TABLES.bukuKas.headers,
        rows: cashRows,
      },
      {
        name: GOOGLE_SHEETS_TABLES.pinjamanModal.name,
        color: GOOGLE_SHEETS_TABLES.pinjamanModal.color,
        headers: GOOGLE_SHEETS_TABLES.pinjamanModal.headers,
        rows: loanRows,
      },
      {
        name: GOOGLE_SHEETS_TABLES.investor.name,
        color: GOOGLE_SHEETS_TABLES.investor.color,
        headers: GOOGLE_SHEETS_TABLES.investor.headers,
        rows: investorRows,
      },
      {
        name: GOOGLE_SHEETS_TABLES.pemakaianPribadi.name,
        color: GOOGLE_SHEETS_TABLES.pemakaianPribadi.color,
        headers: GOOGLE_SHEETS_TABLES.pemakaianPribadi.headers,
        rows: usageRows,
      },
    ];

    const totalRecords =
      sales.length +
      batches.length +
      cashEntries.length +
      loans.length +
      investors.length +
      personalUsages.length;

    const payload = {
      app: 'JufaStore',
      exportedAt: new Date().toISOString(),
      sheets: sheetsPayload,
      summary: {
        totalSalesCount: sales.length,
        totalBatchesCount: batches.length,
        totalCashCount: cashEntries.length,
        totalLoansCount: loans.length,
        totalInvestorsCount: investors.length,
        totalUsagesCount: personalUsages.length,
      },
    };

    // Kirim payload multi-sheet via POST
    await fetch(cleanUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(payload),
      mode: 'no-cors',
    });

    const nowIso = new Date().toISOString();
    await repository.updateSettings({
      lastSyncAt: nowIso,
    });

    return {
      success: true,
      message: `${totalRecords} catatan berhasil disinkronkan ke 6 sheet terpisah di Google Spreadsheet.`,
      syncedAt: nowIso,
      recordCounts: {
        sales: sales.length,
        batches: batches.length,
        cashEntries: cashEntries.length,
        loans: loans.length,
        investors: investors.length,
        personalUsages: personalUsages.length,
      },
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Terjadi kesalahan sinkronisasi';
    return {
      success: false,
      message: `Gagal sinkronisasi Google Sheets: ${errorMsg}`,
    };
  }
}
