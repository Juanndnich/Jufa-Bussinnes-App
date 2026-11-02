// ==============================================================
// JUFASTORE — GOOGLE APPS SCRIPT WEBHOOK & SHEET MIRROR (V2 RESMI)
// Dokumen: docs/google-apps-script/Code.gs
// Lisensi: Hak Cipta JufaStore (Offline-First Robux Business App)
// ==============================================================

var JUFASTORE_SCHEMA_VERSION = 1;

// 1. DAFTAR RESMI DEFINISI TABEL & KOLOM
function dapatkanDefinisiTabel() {
  return {
    ringkasan: {
      name: "Ringkasan",
      color: "#059669",
      headers: ["Metrik KPI", "Nilai", "Keterangan", "Waktu Pembaruan"]
    },
    penjualan: {
      name: "Penjualan",
      color: "#10b981",
      headers: [
        "Waktu (WIB)",
        "No Invoice",
        "Nama Pembeli",
        "Jumlah Robux (R$)",
        "Rate Jual (Rp)",
        "Total Omzet (Rp)",
        "Modal HPP (Rp)",
        "Laba Kotor (Rp)",
        "Margin",
        "Status Transaksi",
        "Catatan"
      ]
    },
    stockBatches: {
      name: "Batch_Stok",
      color: "#d97706",
      headers: [
        "ID Batch",
        "Waktu Masuk (WIB)",
        "Sumber Stok",
        "Sumber Dana",
        "Robux Awal (R$)",
        "Sisa Robux (R$)",
        "Total Modal Beli (Rp)",
        "Modal per Robux (Rp)",
        "Sisa Nilai Modal (Rp)",
        "Status Batch",
        "Catatan"
      ]
    },
    stockMovements: {
      name: "Mutasi_Stok",
      color: "#f59e0b",
      headers: [
        "ID Mutasi",
        "ID Batch",
        "Waktu (WIB)",
        "Jenis Mutasi",
        "Jumlah Robux (R$)",
        "Alokasi Modal (Rp)",
        "Sisa Robux Setelah Mutasi",
        "Referensi Transaksi",
        "Catatan"
      ]
    },
    cashLedger: {
      name: "Buku_Kas",
      color: "#0284c7",
      headers: [
        "ID Transaksi",
        "Tanggal (WIB)",
        "Waktu Lengkap",
        "Arus Kas",
        "Kategori / Sumber",
        "Nominal (Rp)",
        "Keterangan"
      ]
    },
    loans: {
      name: "Pinjaman",
      color: "#7c3aed",
      headers: [
        "ID Pinjaman",
        "Tanggal Pinjam (WIB)",
        "Pemberi Pinjaman / Kreditor",
        "Pokok Utang (Rp)",
        "Sisa Utang (Rp)",
        "Total Terbayar (Rp)",
        "Jatuh Tempo",
        "Status Pinjaman",
        "Catatan"
      ]
    },
    investors: {
      name: "Investor",
      color: "#4f46e5",
      headers: [
        "ID Investor",
        "Nama Investor",
        "Modal Disetor (Rp)",
        "Porsi Bagi Hasil (%)",
        "Tanggal Bergabung",
        "Status Investor",
        "Catatan"
      ]
    },
    investorPayouts: {
      name: "Pembayaran_Investor",
      color: "#6366f1",
      headers: [
        "ID Pembayaran",
        "ID Investor",
        "Nama Investor",
        "Waktu Pembayaran (WIB)",
        "Nominal Dividen (Rp)",
        "Catatan Periode"
      ]
    },
    personalUsages: {
      name: "Pemakaian_Pribadi",
      color: "#e11d48",
      headers: [
        "ID Prive",
        "Waktu Pengambilan (WIB)",
        "Robux Diambil (R$)",
        "Nilai Modal HPP (Rp)",
        "Modal per Robux (Rp)",
        "Keperluan / Catatan"
      ]
    },
    categories: {
      name: "Kategori",
      color: "#64748b",
      headers: [
        "ID Kategori",
        "Nama Kategori",
        "Jenis Kategori",
        "Waktu Dibuat (WIB)"
      ]
    }
  };
}

// 2. FUNGSI SETUP UTAMA (Dijalankan manual 1 kali oleh pengguna)
function setup() {
  var props = PropertiesService.getScriptProperties();
  var secret = props.getProperty("JUFASTORE_SYNC_SECRET");

  if (!secret) {
    // Sumber acak aman menggunakan Utilities.getUuid() dua kali (64 karakter heksadesimal)
    var uuid1 = Utilities.getUuid().replace(/-/g, "").toLowerCase();
    var uuid2 = Utilities.getUuid().replace(/-/g, "").toLowerCase();
    secret = uuid1 + uuid2;
    props.setProperty("JUFASTORE_SYNC_SECRET", secret);
  }

  setupSemuaSheet();

  Logger.log("==================================================================");
  Logger.log("JUFASTORE SYNC BERHASIL DIKONFIGURASI!");
  Logger.log("Salin KODE RAHASIA (SECRET) berikut ke Pengaturan Google Sheets di aplikasi:");
  Logger.log(secret);
  Logger.log("==================================================================");
}

// 3. FUNGSI RESET SECRET (Jika secret pernah bocor atau ingin diganti)
function resetSecret() {
  var props = PropertiesService.getScriptProperties();
  props.deleteProperty("JUFASTORE_SYNC_SECRET");
  setup();
}

// 4. FORMAT TAMPILAN SHEET LENGKAP & RAPI (Hanya dijalankan di setup / setup-sheets)
function setupSemuaSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var defs = dapatkanDefinisiTabel();

  // 1. Format Sheet Ringkasan
  setupSheetRingkasan(ss, defs.ringkasan);

  // 2. Format 9 Sheet Data
  var sheetKeys = [
    "penjualan",
    "stockBatches",
    "stockMovements",
    "cashLedger",
    "loans",
    "investors",
    "investorPayouts",
    "personalUsages",
    "categories"
  ];

  for (var k = 0; k < sheetKeys.length; k++) {
    var def = defs[sheetKeys[k]];
    var s = ss.getSheetByName(def.name);
    if (!s) {
      s = ss.insertSheet(def.name);
    }
    s.setTabColor(def.color);
    formatHeaderDataSheet(s, def.headers, def.color);
    terapkanFormatKolomKhusus(s, sheetKeys[k]);
  }

  // Hapus Sheet1 kosong bawaan jika ada
  hapusSheet1Bawaan(ss);
}

function setupSheetRingkasan(ss, def) {
  var s = ss.getSheetByName(def.name);
  if (!s) {
    s = ss.insertSheet(def.name, 0);
  }
  s.setTabColor(def.color);
  s.setHiddenGridlines(true);

  // Buat Header Ringkasan
  if (s.getLastRow() === 0) {
    s.appendRow(["JUFASTORE — DASBOR RINGKASAN BISNIS", "", "", ""]);
    s.getRange("A1:D1").merge()
      .setBackground("#064e3b")
      .setFontColor("#ffffff")
      .setFontWeight("bold")
      .setFontSize(13)
      .setVerticalAlignment("middle");
    s.setRowHeight(1, 40);

    s.appendRow(["Metrik", "Nilai", "Keterangan", "Waktu Diperbarui"]);
    var headerRange = s.getRange("A2:D2");
    headerRange.setBackground("#059669")
      .setFontColor("#ffffff")
      .setFontWeight("bold")
      .setFontSize(10)
      .setHorizontalAlignment("center")
      .setVerticalAlignment("middle");
    s.setRowHeight(2, 28);
    s.setFrozenRows(2);

    var rowsKpi = [
      ["Saldo Kas Toko Saat Ini", 0, "Uang kas riil tersedia di buku kas", "-"],
      ["Sisa Modal Stok FIFO", 0, "Nilai modal Robux yang belum terjual", "-"],
      ["Sisa Stok Robux Toko", 0, "Jumlah stok Robux saat ini (R$)", "-"],
      ["Total Omzet Penjualan", 0, "Total penjualan Robux terbayar", "-"],
      ["Total Laba Kotor", 0, "Omzet riil dikurangi modal HPP FIFO", "-"],
      ["Total Laba Bersih", 0, "Laba kotor dikurangi biaya operasional kas", "-"],
      ["Versi Aplikasi Terhubung", "JufaStore v2.1.28", "Aplikasi pencatatan internal Robux", "-"]
    ];

    s.getRange(3, 1, rowsKpi.length, 4).setValues(rowsKpi);
    s.getRange("B3:B4").setNumberFormat('"Rp " #,##0');
    s.getRange("B5:B5").setNumberFormat('#,##0 " R$"');
    s.getRange("B6:B8").setNumberFormat('"Rp " #,##0');

    // Desain blok tren bulanan di bawah KPI
    var startTren = 12;
    s.getRange(startTren, 1, 1, 3).merge()
      .setValue("TREN KINERJA PENJUALAN BULANAN (12 BULAN TERAKHIR)")
      .setBackground("#0f766e")
      .setFontColor("#ffffff")
      .setFontWeight("bold")
      .setFontSize(10)
      .setVerticalAlignment("middle");
    s.setRowHeight(startTren, 30);

    s.getRange(startTren + 1, 1, 1, 3).setValues([["Bulan (YYYY-MM)", "Omzet (Rp)", "Laba Kotor (Rp)"]])
      .setBackground("#115e59")
      .setFontColor("#ffffff")
      .setFontWeight("bold")
      .setFontSize(9)
      .setHorizontalAlignment("center");
    s.setRowHeight(startTren + 1, 26);

    // Otomatisasi lebar kolom ringkasan
    s.setColumnWidth(1, 240);
    s.setColumnWidth(2, 170);
    s.setColumnWidth(3, 280);
    s.setColumnWidth(4, 160);
  }

  // Buat Grafik Garis Tren Omzet vs Laba Kotor SEKALI di setup (jangan duplikat jika dijalankan ulang)
  var charts = s.getCharts();
  if (!charts || charts.length === 0) {
    try {
      var startTren = 12;
      var chartRange = s.getRange(startTren + 1, 1, 13, 3); // Header baris 13 + 12 baris data
      var chart = s.newChart()
        .setChartType(Charts.ChartType.LINE)
        .addRange(chartRange)
        .setPosition(3, 5, 15, 10) // Kolom E, Baris 3 di samping tabel KPI
        .setOption("title", "Tren Omzet vs Laba Kotor (12 Bulan)")
        .setOption("legend", { position: "bottom" })
        .setOption("colors", ["#059669", "#d97706"])
        .setOption("width", 540)
        .setOption("height", 300)
        .build();
      s.insertChart(chart);
    } catch (eChart) {}
  }

  pasangProteksiPeringatan(s);
}

function formatHeaderDataSheet(sheet, headers, color) {
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
  } else {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }

  var headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setFontWeight("bold")
    .setFontSize(10)
    .setBackground(color || "#10b981")
    .setFontColor("#ffffff")
    .setHorizontalAlignment("center")
    .setVerticalAlignment("middle");
  try { sheet.setRowHeight(1, 34); } catch (e) {}
  sheet.setFrozenRows(1);

  // Atur lebar awal lapang
  for (var col = 1; col <= headers.length; col++) {
    try {
      sheet.autoResizeColumn(col);
      var w = sheet.getColumnWidth(col);
      sheet.setColumnWidth(col, Math.max(w + 35, 125));
    } catch (e2) {}
  }

  // Terapkan baris selang-seling (banding) di sheet data SEKALI di setup
  try {
    var bandings = sheet.getBandings();
    if (!bandings || bandings.length === 0) {
      var bandingRange = sheet.getRange(1, 1, Math.max(sheet.getMaxRows(), 500), headers.length);
      bandingRange.applyRowBanding(SpreadsheetApp.BandingTheme.LIGHT_GREY, true, false);
    }
  } catch (eBanding) {}

  pasangProteksiPeringatan(sheet);
}

function terapkanFormatKolomKhusus(sheet, key) {
  var maxRows = Math.max(sheet.getMaxRows(), 500);

  // Format kolom angka rupiah, robux, dan tanggal berlaku sampai baris akhir kolom
  if (key === "penjualan") {
    sheet.getRange(2, 4, maxRows - 1, 1).setNumberFormat('#,##0'); // Robux
    sheet.getRange(2, 5, maxRows - 1, 4).setNumberFormat('"Rp " #,##0'); // Rate, Omzet, HPP, Laba
    // Pewarnaan bersyarat kolom 10 (Status Transaksi)
    pasangPewarnaanStatus(sheet, 10, [
      { text: "Selesai", bg: "#d1fae5", fg: "#065f46" },
      { text: "Dibatalkan (VOID)", bg: "#fee2e2", fg: "#991b1b" }
    ]);
  } else if (key === "stockBatches") {
    sheet.getRange(2, 5, maxRows - 1, 2).setNumberFormat('#,##0'); // Robux awal & sisa
    sheet.getRange(2, 7, maxRows - 1, 3).setNumberFormat('"Rp " #,##0'); // Modal beli, unit cost, sisa modal
    // Pewarnaan bersyarat kolom 10 (Status Batch)
    pasangPewarnaanStatus(sheet, 10, [
      { text: "Aktif (Tersedia)", bg: "#d1fae5", fg: "#065f46" },
      { text: "Habis Terjual", bg: "#f3f4f6", fg: "#6b7280" }
    ]);
  } else if (key === "stockMovements") {
    sheet.getRange(2, 5, maxRows - 1, 1).setNumberFormat('#,##0'); // Robux
    sheet.getRange(2, 6, maxRows - 1, 1).setNumberFormat('"Rp " #,##0'); // Alokasi modal
    sheet.getRange(2, 7, maxRows - 1, 1).setNumberFormat('#,##0'); // Sisa robux
  } else if (key === "cashLedger") {
    sheet.getRange(2, 6, maxRows - 1, 1).setNumberFormat('"Rp " #,##0'); // Nominal kas
  } else if (key === "loans") {
    sheet.getRange(2, 4, maxRows - 1, 3).setNumberFormat('"Rp " #,##0'); // Pokok, Sisa, Terbayar
    // Pewarnaan bersyarat kolom 8 (Status Pinjaman)
    pasangPewarnaanStatus(sheet, 8, [
      { text: "Lunas", bg: "#d1fae5", fg: "#065f46" },
      { text: "Belum Lunas", bg: "#fef3c7", fg: "#92400e" }
    ]);
  } else if (key === "investors") {
    sheet.getRange(2, 3, maxRows - 1, 1).setNumberFormat('"Rp " #,##0'); // Modal disetor
    sheet.getRange(2, 4, maxRows - 1, 1).setNumberFormat('0"%"'); // Porsi bagi hasil
    // Pewarnaan bersyarat kolom 6 (Status Investor)
    pasangPewarnaanStatus(sheet, 6, [
      { text: "Aktif", bg: "#d1fae5", fg: "#065f46" },
      { text: "Nonaktif", bg: "#f3f4f6", fg: "#6b7280" }
    ]);
  } else if (key === "investorPayouts") {
    sheet.getRange(2, 5, maxRows - 1, 1).setNumberFormat('"Rp " #,##0'); // Dividen
  } else if (key === "personalUsages") {
    sheet.getRange(2, 3, maxRows - 1, 1).setNumberFormat('#,##0'); // Robux prive
    sheet.getRange(2, 4, maxRows - 1, 2).setNumberFormat('"Rp " #,##0'); // Modal total & per Robux
  }
}

// HELPER: Pasang Pewarnaan Bersyarat pada Kolom Status Tertentu
function pasangPewarnaanStatus(sheet, colIndex, aturanList) {
  try {
    var maxRows = Math.max(sheet.getMaxRows(), 500);
    var range = sheet.getRange(2, colIndex, maxRows - 1, 1);
    var currentRules = sheet.getConditionalFormatRules();

    var filteredRules = [];
    for (var i = 0; i < currentRules.length; i++) {
      var r = currentRules[i];
      var rRanges = r.getRanges();
      var isSameCol = false;
      for (var j = 0; j < rRanges.length; j++) {
        if (rRanges[j].getColumn() === colIndex) {
          isSameCol = true;
          break;
        }
      }
      if (!isSameCol) filteredRules.push(r);
    }

    for (var k = 0; k < aturanList.length; k++) {
      var a = aturanList[k];
      var rule = SpreadsheetApp.newConditionalFormatRule()
        .whenTextEqualTo(a.text)
        .setBackground(a.bg)
        .setFontColor(a.fg)
        .setRanges([range])
        .build();
      filteredRules.push(rule);
    }

    sheet.setConditionalFormatRules(filteredRules);
  } catch (eRule) {}
}

function pasangProteksiPeringatan(sheet) {
  try {
    var protections = sheet.getProtections(SpreadsheetApp.ProtectionType.SHEET);
    if (!protections || protections.length === 0) {
      var p = sheet.protect().setDescription("Sheet ini dicerminkan otomatis oleh JufaStore. Jangan mengedit struktur kolom manual.");
      p.setWarningOnly(true);
    }
  } catch (e) {}
}

function hapusSheet1Bawaan(ss) {
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

// 5. PENERIMA WEBHOOK (doPost)
function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
  } catch (lockErr) {
    return createJsonResponse({
      ok: false,
      error: "Server Spreadsheet sedang sibuk memproses data lain. Silakan coba sesaat lagi."
    });
  }

  try {
    var rawText = e && e.postData && e.postData.contents;
    if (!rawText) {
      return createJsonResponse({ ok: false, error: "Isi payload permintaan kosong." });
    }

    // Batasi ukuran payload body (maksimal 2 MB)
    if (rawText.length > 2 * 1024 * 1024) {
      return createJsonResponse({ ok: false, error: "Ukuran payload melebihi batas maksimal (2 MB)." });
    }

    var packet;
    try {
      packet = JSON.parse(rawText);
    } catch (parseErr) {
      return createJsonResponse({ ok: false, error: "Format JSON tidak valid." });
    }

    // 1. Validasi Keberadaan Secret di Script Properties
    var props = PropertiesService.getScriptProperties();
    var secret = props.getProperty("JUFASTORE_SYNC_SECRET");
    if (!secret) {
      return createJsonResponse({
        ok: false,
        error: "Script belum diatur. Buka Extensions > Apps Script, lalu jalankan fungsi setup() terlebih dahulu."
      });
    }

    // 2. Validasi Timestamp (Maksimal selisih 5 menit dari waktu server Google)
    var nowMs = Date.now();
    var reqTime = packet.timestamp || 0;
    if (Math.abs(nowMs - reqTime) > 5 * 60 * 1000) {
      return createJsonResponse({
        ok: false,
        error: "Waktu permintaan kedaluwarsa atau jam perangkat tidak sinkron (maksimal selisih 5 menit)."
      });
    }

    // 3. Validasi Nonce (Wajib string 8-64 karakter)
    var nonce = packet.nonce;
    if (!nonce || typeof nonce !== "string" || nonce.length < 8 || nonce.length > 64) {
      return createJsonResponse({ ok: false, error: "Nonce acak tidak valid (wajib 8-64 karakter)." });
    }

    var cache = CacheService.getScriptCache();
    var nonceKey = "JUFA_NONCE_" + nonce;
    if (cache.get(nonceKey)) {
      return createJsonResponse({ ok: false, error: "Permintaan ditolak: nonce sudah pernah digunakan." });
    }
    // Simpan nonce selama 10 menit untuk mencegah replay attack
    cache.put(nonceKey, "1", 600);

    // 4. Validasi Tanda Tangan Digital HMAC-SHA256
    var bodyString = typeof packet.body === "string" ? packet.body : JSON.stringify(packet.body || {});
    var expectedMessage = reqTime + "." + nonce + "." + bodyString;
    var expectedSigBytes = Utilities.computeHmacSha256Signature(expectedMessage, secret);
    var expectedSig = expectedSigBytes.map(function(b) {
      var v = (b < 0 ? b + 256 : b).toString(16);
      return v.length === 1 ? "0" + v : v;
    }).join("");

    if (!constantTimeCompare(packet.signature, expectedSig)) {
      return createJsonResponse({
        ok: false,
        error: "Autentikasi tanda tangan digital gagal. Pastikan Kode Rahasia (Secret) di aplikasi cocok."
      });
    }

    // 5. Eksekusi Aksi yang Diminta
    var body = typeof packet.body === "string" ? JSON.parse(packet.body) : packet.body;
    var action = body.action;

    if (action === "ping") {
      return createJsonResponse({
        ok: true,
        message: "Koneksi ke JufaStore Web App berhasil terverifikasi!",
        serverTime: nowMs,
        version: JUFASTORE_SCHEMA_VERSION
      });
    }

    if (action === "setup-sheets") {
      setupSemuaSheet();
      return createJsonResponse({
        ok: true,
        message: "Seluruh struktur 10 sheet berhasil dirapikan.",
        serverTime: nowMs
      });
    }

    if (action === "replace-chunk") {
      var resChunk = eksekusiReplaceChunk(body);
      return createJsonResponse(resChunk);
    }

    if (action === "update-summary") {
      var resSummary = eksekusiUpdateSummary(body);
      return createJsonResponse(resSummary);
    }

    return createJsonResponse({
      ok: false,
      error: "Aksi tidak dikenali atau tidak didukung."
    });

  } catch (err) {
    return createJsonResponse({
      ok: false,
      error: "Terjadi kesalahan internal saat memproses data di spreadsheet."
    });
  } finally {
    try {
      lock.releaseLock();
    } catch (eLock) {}
  }
}

// 6. PROSES EKSEKUSI REPLACE-CHUNK PER TABEL (Idempoten, Cepat, & Anti-Rumus)
function eksekusiReplaceChunk(payload) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var tableName = payload.table;
  var defs = dapatkanDefinisiTabel();

  // Validasi nama tabel terhadap daftar putih
  var def = defs[tableName];
  if (!def) {
    return { ok: false, error: "Nama tabel tidak terdaftar dalam skema resmi JufaStore." };
  }

  var sheet = ss.getSheetByName(def.name);
  if (!sheet) {
    sheet = ss.insertSheet(def.name);
    sheet.setTabColor(def.color);
    formatHeaderDataSheet(sheet, def.headers, def.color);
  }

  var headers = payload.headers || def.headers;
  var startRow = Number(payload.startRow) || 0;
  var totalRows = Number(payload.totalRows) || 0;
  var rows = payload.rows || [];

  var firstDataRowIndex = 2; // Baris 1 adalah header tetap
  var targetRow = firstDataRowIndex + startRow;

  // Kasus tabel kosong murni
  if (totalRows === 0) {
    var lastRowNow = sheet.getLastRow();
    if (lastRowNow >= firstDataRowIndex) {
      sheet.getRange(firstDataRowIndex, 1, lastRowNow - firstDataRowIndex + 1, headers.length).clearContent();
    }
    return { ok: true, table: tableName, written: 0, totalRows: 0, isComplete: true };
  }

  // Tulis potongan baris data dengan sanitasi anti-formula injection
  if (rows.length > 0) {
    for (var r = 0; r < rows.length; r++) {
      var row = rows[r];
      for (var c = 0; c < row.length; c++) {
        var val = row[c];
        if (typeof val === "string" && val.length > 0) {
          var firstChar = val.charAt(0);
          if (firstChar === "=" || firstChar === "+" || firstChar === "-" || firstChar === "@") {
            row[c] = "'" + val;
          }
        }
      }
    }

    var neededRows = targetRow + rows.length - 1;
    if (neededRows > sheet.getMaxRows()) {
      sheet.insertRowsAfter(sheet.getMaxRows(), neededRows - sheet.getMaxRows() + 50);
    }

    // Hanya menulis nilai tanpa operasi formatting agar performa cepat
    var range = sheet.getRange(targetRow, 1, rows.length, headers.length);
    range.setValues(rows);
    range.setVerticalAlignment("middle");
  }

  // Jika potongan terakhir: pangkas sisa baris lama yang ada di bawah totalRows
  var isLastChunk = (startRow + rows.length) >= totalRows;
  if (isLastChunk) {
    var finalDataRow = firstDataRowIndex + totalRows - 1;
    var currentLastRow = sheet.getLastRow();
    if (currentLastRow > finalDataRow) {
      var rowsToClear = currentLastRow - finalDataRow;
      sheet.getRange(finalDataRow + 1, 1, rowsToClear, headers.length).clearContent();
    }
  }

  return {
    ok: true,
    table: tableName,
    startRow: startRow,
    written: rows.length,
    totalRows: totalRows,
    isComplete: isLastChunk
  };
}

// 7. PROSES PEMBARUAN SHEET DASBOR RINGKASAN
function eksekusiUpdateSummary(payload) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Ringkasan");
  if (!sheet) {
    setupSheetRingkasan(ss, dapatkanDefinisiTabel().ringkasan);
    sheet = ss.getSheetByName("Ringkasan");
  }

  var kpi = payload.kpi || {};
  var syncTime = payload.syncTime || "-";
  var appVersion = payload.appVersion || "JufaStore v2.1.28";

  var rowsValues = [
    [kpi.saldoKas || 0, "Uang kas riil tersedia di buku kas", syncTime],
    [kpi.sisaModalStok || 0, "Nilai modal Robux yang belum terjual", syncTime],
    [kpi.sisaStokRobux || 0, "Jumlah stok Robux saat ini (R$)", syncTime],
    [kpi.totalOmzet || 0, "Total omzet penjualan Robux lunas", syncTime],
    [kpi.totalLabaKotor || 0, "Omzet riil dikurangi modal HPP FIFO", syncTime],
    [kpi.totalLabaBersih || 0, "Laba kotor dikurangi biaya operasional kas", syncTime],
    [appVersion, "Aplikasi pencatatan internal Robux", syncTime]
  ];

  sheet.getRange(3, 2, rowsValues.length, 3).setValues(rowsValues);

  // Perbarui blok tren bulanan jika disediakan
  var monthlyTrends = payload.monthlyTrends || [];
  if (monthlyTrends.length > 0) {
    var startTren = 14;
    var trendRows = [];
    for (var m = 0; m < monthlyTrends.length; m++) {
      var item = monthlyTrends[m];
      trendRows.push([item.month, item.omzet || 0, item.laba || 0]);
    }
    // Bersihkan rentang tren bulanan lama sebelum menulis data baru
    sheet.getRange(startTren, 1, 12, 3).clearContent();
    sheet.getRange(startTren, 1, trendRows.length, 3).setValues(trendRows);
    sheet.getRange(startTren, 2, trendRows.length, 2).setNumberFormat('"Rp " #,##0');
  }

  return { ok: true, message: "Dasbor ringkasan berhasil diperbarui." };
}

// 8. FUNGSI GET (Respons status ramah)
function doGet(e) {
  return ContentService.createTextOutput("JufaStore Google Sheets Mirror Sync V2 aktif & siap melayani.")
    .setMimeType(ContentService.MimeType.TEXT);
}

// HELPER: Perbandingan String Timing-Safe (Cegah Timing Attack)
function constantTimeCompare(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length !== b.length) return false;
  var mismatch = 0;
  for (var i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

// HELPER: Format Output JSON
function createJsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
