/**
 * JufaStore - Google Sheets Cloud Sync Utility & Apps Script Template V2
 * Menghubungkan aplikasi JufaStore dengan Google Spreadsheet melalui Webhook Google Apps Script.
 * Mendukung 6 sheet/tabel terpisah rapi (Penjualan, Stok_Batch_FIFO, Buku_Kas, Pinjaman_Modal, Investor, Pemakaian_Pribadi),
 * dengan antrean inkremental, upsert idempoten berbasis ID, penghapusan baris, dan proteksi token Script Properties.
 */

import { repository } from '../db/repository';
import { formatDateJakarta, formatRupiah } from './formatters';

export interface SheetDefinition {
  name: string;
  title: string;
  color: string;
  headers: string[];
  idColumnIndex: number; // 0-based index of ID column in headers
}

/**
 * Konfigurasi 6 Tabel Terpisah Sesuai Seluruh Modul Aplikasi JufaStore
 */
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

export interface GoogleSheetsSyncResult {
  success: boolean;
  message: string;
  syncedAt?: string;
  recordCounts?: {
    sales: number;
    batches: number;
    cashEntries: number;
    pinjamanModal: number;
    investor: number;
    pemakaianPribadi: number;
  };
}

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
    idColumnIndex: 1, // Kolom B: No Invoice
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
    idColumnIndex: 0, // Kolom A: ID Batch
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
    idColumnIndex: 0, // Kolom A: ID Transaksi
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
    idColumnIndex: 0, // Kolom A: ID Pinjaman
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
    idColumnIndex: 0, // Kolom A: ID Investor
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
    idColumnIndex: 0, // Kolom A: ID Prive
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
 * Script Google Apps Script V2 (Lengkap & Idempoten)
 * Dipasang di Editor Apps Script Google Spreadsheet Anda.
 */
export const GOOGLE_APPS_SCRIPT_TEMPLATE = `// ==============================================================
// JUFASTORE - GOOGLE APPS SCRIPT SYNC WEBHOOK (V2 RESMI)
// 1. Validasi Token Rahasia via Script Properties
// 2. LockService anti-konkurensi & anti-tabrakan data
// 3. Sinkronisasi Idempoten (Upsert & Delete berbasis ID kolom)
// 4. Struktur 6 Sheet Otomatis (Penjualan, Stok, Kas, Utang, Investor, Prive)
// ==============================================================

// 1. WEBHOOK POST (Menerima Antrean Batch & Sinkron Penuh)
function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
  } catch (lockErr) {
    return ContentService.createTextOutput(JSON.stringify({
      ok: false,
      message: "Server Google Spreadsheet sedang sibuk, silakan coba sesaat lagi."
    })).setMimeType(ContentService.MimeType.JSON);
  }

  try {
    var rawContents = e.postData.contents;
    var payload = JSON.parse(rawContents);

    // Validasi Token Rahasia dari Script Properties
    var props = PropertiesService.getScriptProperties();
    var storedToken = props.getProperty("JUFASTORE_SYNC_TOKEN");

    if (storedToken && storedToken.trim() !== "") {
      if (!payload.token || payload.token.trim() !== storedToken.trim()) {
        return ContentService.createTextOutput(JSON.stringify({
          ok: false,
          message: "Token autentikasi tidak valid atau tidak cocok!"
        })).setMimeType(ContentService.MimeType.JSON);
      }
    } else if (payload.token && payload.token.trim() !== "") {
      // Jika token di properties belum disetel, simpan token pertama yang dikirim
      props.setProperty("JUFASTORE_SYNC_TOKEN", payload.token.trim());
    }

    // Aksi 1: PING (Tes Koneksi Cepat)
    if (payload.action === "PING") {
      return ContentService.createTextOutput(JSON.stringify({
        ok: true,
        message: "Koneksi ke Web App Google Apps Script berhasil terverifikasi!",
        timestamp: new Date().toISOString()
      })).setMimeType(ContentService.MimeType.JSON);
    }

    var ss = SpreadsheetApp.getActiveSpreadsheet();

    // Aksi 2: SYNC_BATCH (Antrean Inkremental Idempoten)
    if (payload.action === "SYNC_BATCH" && payload.items && payload.items.length > 0) {
      var results = [];
      for (var i = 0; i < payload.items.length; i++) {
        var item = payload.items[i];
        var itemRes = prosesItemSync(ss, item);
        results.push(itemRes);
      }
      return ContentService.createTextOutput(JSON.stringify({
        ok: true,
        processedCount: payload.items.length,
        results: results
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // Aksi 3: INIT_TABLE / FULL_SYNC (Struktur Multi-Sheet Terpadu)
    if (payload.sheets && payload.sheets.length > 0) {
      for (var j = 0; j < payload.sheets.length; j++) {
        prosesSheetTabel(ss, payload.sheets[j]);
      }
      hapusSheetKosongDefault(ss);
      return ContentService.createTextOutput(JSON.stringify({
        ok: true,
        action: payload.action || "FULL_SYNC",
        tablesCount: payload.sheets.length
      })).setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({
      ok: true,
      message: "Data diterima"
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      ok: false,
      message: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

// 2. CEK STATUS GET
function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    ok: true,
    status: "ready",
    app: "JufaStore",
    version: "2.1.26",
    message: "Google Apps Script JufaStore Siap Menerima Data"
  })).setMimeType(ContentService.MimeType.JSON);
}

// Helper: Proses 1 Item Antrean (Upsert atau Delete berbasis ID)
function prosesItemSync(ss, item) {
  var sheetName = item.sheetName;
  var operation = item.operation || "upsert";
  var recordId = String(item.id);
  var rowData = item.row;

  var sheet = ss.getSheetByName(sheetName);
  var tableDefs = dapatkanDefinisiSemuaTabel();
  var currentDef = null;

  for (var k = 0; k < tableDefs.length; k++) {
    if (tableDefs[k].name === sheetName) {
      currentDef = tableDefs[k];
      break;
    }
  }

  // Jika sheet belum ada, buat baru lengkap dengan header
  if (!sheet) {
    if (currentDef) {
      sheet = ss.insertSheet(sheetName);
      buatHeaderSheet(sheet, currentDef.headers, currentDef.color);
    } else {
      sheet = ss.insertSheet(sheetName);
    }
  }

  // Tentukan kolom ID: 'Penjualan' ada di Kolom B (index 1), tabel lain Kolom A (index 0)
  var idColIdx = (sheetName === "Penjualan") ? 1 : 0;
  var idColNumber = idColIdx + 1; // 1-based column

  var lastRow = sheet.getLastRow();
  var foundRowIndex = -1;

  if (lastRow > 1) {
    var idValues = sheet.getRange(2, idColNumber, lastRow - 1, 1).getValues();
    for (var r = 0; r < idValues.length; r++) {
      if (String(idValues[r][0]) === recordId) {
        foundRowIndex = r + 2; // baris ke-2 dst
        break;
      }
    }
  }

  if (operation === "delete") {
    if (foundRowIndex !== -1) {
      sheet.deleteRow(foundRowIndex);
      return { id: recordId, operation: "delete", success: true, action: "deleted" };
    }
    return { id: recordId, operation: "delete", success: true, action: "not_found" };
  }

  // Operasi Upsert (Update jika ada, Append jika belum ada)
  if (rowData && rowData.length > 0) {
    if (foundRowIndex !== -1) {
      // Update baris yang sudah ada
      sheet.getRange(foundRowIndex, 1, 1, rowData.length).setValues([rowData]);
      try { sheet.setRowHeight(foundRowIndex, 26); } catch (eH) {}
      return { id: recordId, operation: "upsert", success: true, action: "updated", row: foundRowIndex };
    } else {
      // Tambahkan baris baru di akhir
      sheet.appendRow(rowData);
      var newLastRow = sheet.getLastRow();
      try { sheet.setRowHeight(newLastRow, 26); } catch (eH2) {}
      return { id: recordId, operation: "upsert", success: true, action: "inserted", row: newLastRow };
    }
  }

  return { id: recordId, operation: operation, success: false, message: "Data baris kosong" };
}

// Helper: Format Header Sheet
function buatHeaderSheet(sheet, headers, color) {
  sheet.appendRow(headers);
  var headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setFontWeight("bold")
             .setBackground(color || "#10b981")
             .setFontColor("#ffffff")
             .setHorizontalAlignment("center")
             .setVerticalAlignment("middle");
  try { sheet.setRowHeight(1, 32); } catch (e) {}
  sheet.setFrozenRows(1);

  for (var col = 1; col <= headers.length; col++) {
    try {
      sheet.autoResizeColumn(col);
      var w = sheet.getColumnWidth(col);
      sheet.setColumnWidth(col, Math.max(w + 30, 115));
    } catch (e2) {}
  }
}

// Helper: Format & Ganti Total 1 Sheet Tabel (Full Sync)
function prosesSheetTabel(ss, item) {
  var name = item.name;
  var headers = item.headers || [];
  var rows = item.rows || [];
  var color = item.color || "#10b981";

  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  sheet.clear();

  buatHeaderSheet(sheet, headers, color);

  if (rows && rows.length > 0) {
    var dataRange = sheet.getRange(2, 1, rows.length, headers.length);
    dataRange.setValues(rows);
    dataRange.setVerticalAlignment("middle");
    for (var r = 2; r <= rows.length + 1; r++) {
      try { sheet.setRowHeight(r, 26); } catch (eH) {}
    }
  }
}

// Helper: Hapus Sheet1 bawaan spreadsheet jika kosong
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


// Helper: Tombol Inisialisasi Manual dari Menu / Toolbar Editor Apps Script
function inisialisasiTabelManual() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var daftar = dapatkanDefinisiSemuaTabel();
  for (var i = 0; i < daftar.length; i++) {
    var def = daftar[i];
    var sheet = ss.getSheetByName(def.name);
    if (!sheet) {
      sheet = ss.insertSheet(def.name);
    }
    sheet.clear();
    buatHeaderSheet(sheet, def.headers, def.color);
  }
  hapusSheetKosongDefault(ss);
}

// Helper: Definisi 6 Tabel Modul JufaStore
function dapatkanDefinisiSemuaTabel() {
  return [
    {
      name: "Penjualan",
      color: "#10b981",
      headers: ["Waktu (WIB)", "No Invoice", "Nama Pembeli", "Jumlah Robux (R$)", "Rate Jual (Rp)", "Total Omzet (Rp)", "Modal HPP (Rp)", "Laba Kotor (Rp)", "Margin (%)", "Status Transaksi", "Catatan"]
    },
    {
      name: "Stok_Batch_FIFO",
      color: "#d97706",
      headers: ["ID Batch", "Waktu Masuk (WIB)", "Sumber Stok", "Sumber Dana", "Robux Awal (R$)", "Sisa Robux (R$)", "Total Modal Beli (Rp)", "Modal per Robux (Rp)", "Sisa Nilai Modal (Rp)", "Status Batch", "Catatan"]
    },
    {
      name: "Buku_Kas",
      color: "#0284c7",
      headers: ["ID Transaksi", "Waktu (WIB)", "Arus Kas", "Kategori / Sumber", "Nominal (Rp)", "Keterangan"]
    },
    {
      name: "Pinjaman_Modal",
      color: "#7c3aed",
      headers: ["ID Pinjaman", "Tanggal Pinjam (WIB)", "Pemberi Pinjaman / Kreditor", "Pokok Pinjaman (Rp)", "Sisa Utang (Rp)", "Total Terbayar (Rp)", "Jatuh Tempo", "Status Pinjaman", "Catatan"]
    },
    {
      name: "Investor",
      color: "#4f46e5",
      headers: ["ID Investor", "Nama Investor", "Modal Disetor (Rp)", "Porsi Bagi Hasil (%)", "Tanggal Bergabung", "Status Investor", "Catatan"]
    },
    {
      name: "Pemakaian_Pribadi",
      color: "#e11d48",
      headers: ["ID Prive", "Waktu Pengambilan (WIB)", "Robux Diambil (R$)", "Nilai Modal HPP (Rp)", "Modal Efektif per R$ (Rp)", "Keperluan / Catatan"]
    }
  ];
}
`;

/**
 * Uji Koneksi Web App Apps Script
 */
export async function testGoogleSheetsUrl(
  url: string,
  token?: string
): Promise<{ ok: boolean; message: string; isSpreadsheetDocUrl?: boolean }> {
  const clean = url.trim();
  if (!clean) return { ok: false, message: 'URL Google Apps Script belum diisi.' };
  if (clean.includes('docs.google.com/spreadsheets')) {
    return {
      ok: false,
      isSpreadsheetDocUrl: true,
      message: 'Tautan yang dimasukkan adalah link dokumen spreadsheet, bukan Web App Apps Script (/exec).',
    };
  }
  if (!clean.startsWith('https://')) return { ok: false, message: 'URL harus diawali dengan https://' };

  try {
    const payload = {
      app: 'JufaStore',
      action: 'PING',
      token: token?.trim() || '',
      timestamp: new Date().toISOString(),
    };
    const res = await fetch(clean, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
    });
    let json: any = null;
    try { json = await res.json(); } catch {}
    if (json && json.ok === true) {
      return { ok: true, message: json.message || 'Koneksi ke Google Apps Script berhasil terverifikasi!' };
    }
    if (json && json.ok === false) {
      return { ok: false, message: json.message || 'Koneksi ditolak oleh Apps Script' };
    }
    if (res.ok || res.type === 'opaque') {
      return { ok: true, message: 'Koneksi berhasil terhubung ke server Google Apps Script.' };
    }
    return { ok: false, message: `Server merespons dengan status: ${res.status}` };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Koneksi gagal';
    return { ok: false, message: `Gagal terhubung: ${msg}` };
  }
}

/**
 * Buat struktur tabel kolom di Spreadsheet
 */
export async function initializeGoogleSheetTable(
  url: string,
  token?: string
): Promise<{ success: boolean; message: string }> {
  const clean = url.trim();
  if (!clean) return { success: false, message: 'URL Web App belum diisi.' };
  try {
    const payload = {
      app: 'JufaStore',
      action: 'INITIALIZE',
      token: token?.trim() || '',
      timestamp: new Date().toISOString(),
    };
    await fetch(clean, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
      mode: 'no-cors',
    });
    return {
      success: true,
      message: 'Permintaan inisialisasi tabel terkirim ke Google Spreadsheet.',
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Gagal mengirim inisialisasi';
    return { success: false, message: msg };
  }
}

/**
 * Kompatibilitas sinkronisasi penuh
 */
export async function syncAllDataToGoogleSheets(
  url: string,
  token?: string
): Promise<GoogleSheetsSyncResult> {
  const count = await repository.queueFullSync();
  const nowIso = new Date().toISOString();
  await repository.updateSettings({ lastSyncAt: nowIso });
  return {
    success: true,
    message: `${count} catatan berhasil dimasukkan ke antrean sinkronisasi Google Spreadsheet.`,
    syncedAt: nowIso,
  };
}
