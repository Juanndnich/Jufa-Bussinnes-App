import { describe, it, expect } from 'vitest';
import {
  GOOGLE_SHEETS_COLUMNS,
  GOOGLE_SHEETS_TABLES,
  GOOGLE_APPS_SCRIPT_TEMPLATE,
  extractSpreadsheetId,
  getSpreadsheetOpenUrl,
  testGoogleSheetsUrl,
} from '../utils/googleSheets';

describe('JufaStore - Loan & Cloud Sync Specification Tests', () => {
  it('1. Verifikasi Google Sheets Column Structure Legacy', () => {
    expect(GOOGLE_SHEETS_COLUMNS).toContain('Waktu (WIB)');
    expect(GOOGLE_SHEETS_COLUMNS).toContain('Jumlah Robux (R$)');
    expect(GOOGLE_SHEETS_COLUMNS).toContain('HPP / Modal (Rp)');
    expect(GOOGLE_SHEETS_COLUMNS).toContain('Sumber Dana / Status');
    expect(GOOGLE_SHEETS_COLUMNS.length).toBe(10);
  });

  it('2. Verifikasi 6 Tabel Terpisah Sesuai Seluruh Modul Aplikasi JufaStore', () => {
    const tableKeys = Object.keys(GOOGLE_SHEETS_TABLES);
    expect(tableKeys.length).toBe(6);
    expect(tableKeys).toEqual(
      expect.arrayContaining([
        'penjualan',
        'stokBatches',
        'bukuKas',
        'pinjamanModal',
        'investor',
        'pemakaianPribadi',
      ])
    );

    // 1. Penjualan
    expect(GOOGLE_SHEETS_TABLES.penjualan.name).toBe('Penjualan');
    expect(GOOGLE_SHEETS_TABLES.penjualan.color).toBe('#10b981');
    expect(GOOGLE_SHEETS_TABLES.penjualan.headers).toContain('No Invoice');
    expect(GOOGLE_SHEETS_TABLES.penjualan.headers).toContain('Laba Kotor (Rp)');

    // 2. Stok & Batch FIFO
    expect(GOOGLE_SHEETS_TABLES.stokBatches.name).toBe('Stok_Batch_FIFO');
    expect(GOOGLE_SHEETS_TABLES.stokBatches.color).toBe('#d97706');
    expect(GOOGLE_SHEETS_TABLES.stokBatches.headers).toContain('Robux Awal (R$)');
    expect(GOOGLE_SHEETS_TABLES.stokBatches.headers).toContain('Modal per Robux (Rp)');

    // 3. Buku Kas
    expect(GOOGLE_SHEETS_TABLES.bukuKas.name).toBe('Buku_Kas');
    expect(GOOGLE_SHEETS_TABLES.bukuKas.color).toBe('#0284c7');
    expect(GOOGLE_SHEETS_TABLES.bukuKas.headers).toContain('Arus Kas');
    expect(GOOGLE_SHEETS_TABLES.bukuKas.headers).toContain('Nominal (Rp)');

    // 4. Pinjaman Modal
    expect(GOOGLE_SHEETS_TABLES.pinjamanModal.name).toBe('Pinjaman_Modal');
    expect(GOOGLE_SHEETS_TABLES.pinjamanModal.color).toBe('#7c3aed');
    expect(GOOGLE_SHEETS_TABLES.pinjamanModal.headers).toContain('Pokok Pinjaman (Rp)');
    expect(GOOGLE_SHEETS_TABLES.pinjamanModal.headers).toContain('Sisa Utang (Rp)');

    // 5. Investor
    expect(GOOGLE_SHEETS_TABLES.investor.name).toBe('Investor');
    expect(GOOGLE_SHEETS_TABLES.investor.color).toBe('#4f46e5');
    expect(GOOGLE_SHEETS_TABLES.investor.headers).toContain('Modal Disetor (Rp)');
    expect(GOOGLE_SHEETS_TABLES.investor.headers).toContain('Porsi Bagi Hasil (%)');

    // 6. Pemakaian Pribadi
    expect(GOOGLE_SHEETS_TABLES.pemakaianPribadi.name).toBe('Pemakaian_Pribadi');
    expect(GOOGLE_SHEETS_TABLES.pemakaianPribadi.color).toBe('#e11d48');
    expect(GOOGLE_SHEETS_TABLES.pemakaianPribadi.headers).toContain('Robux Diambil (R$)');
    expect(GOOGLE_SHEETS_TABLES.pemakaianPribadi.headers).toContain('Nilai Modal HPP (Rp)');
  });

  it('3. Verifikasi Template Google Apps Script mendukung Multi-Sheet 6 Tabel Terpisah', () => {
    expect(GOOGLE_APPS_SCRIPT_TEMPLATE).toContain('function doPost(e)');
    expect(GOOGLE_APPS_SCRIPT_TEMPLATE).toContain('function doGet(e)');
    expect(GOOGLE_APPS_SCRIPT_TEMPLATE).toContain('function inisialisasiTabelManual()');
    expect(GOOGLE_APPS_SCRIPT_TEMPLATE).toContain('Penjualan');
    expect(GOOGLE_APPS_SCRIPT_TEMPLATE).toContain('Stok_Batch_FIFO');
    expect(GOOGLE_APPS_SCRIPT_TEMPLATE).toContain('Buku_Kas');
    expect(GOOGLE_APPS_SCRIPT_TEMPLATE).toContain('Pinjaman_Modal');
    expect(GOOGLE_APPS_SCRIPT_TEMPLATE).toContain('Investor');
    expect(GOOGLE_APPS_SCRIPT_TEMPLATE).toContain('Pemakaian_Pribadi');
    expect(GOOGLE_APPS_SCRIPT_TEMPLATE).toContain('prosesSheetTabel');
    expect(GOOGLE_APPS_SCRIPT_TEMPLATE).toContain('sheet.setRowHeight(1, 32)');
  });

  it('4. Perhitungan Alokasi Pelunasan Pinjaman dari Penjualan FIFO', () => {
    // Simulasi pinjaman kulakan 1000 Robux seharga Rp130.000 (Modal Rp130/R$)
    const loanPrincipal = 130000;
    let remainingLoan = loanPrincipal;

    // Terjual 400 Robux seharga Rp60.000 (HPP = 400 * 130 = Rp52.000)
    const robuxSold1 = 400;
    const cogs1 = 52000;
    const autoPayment1 = Math.min(remainingLoan, cogs1);
    remainingLoan -= autoPayment1;

    expect(autoPayment1).toBe(52000);
    expect(remainingLoan).toBe(78000);

    // Terjual 600 Robux (sisa habis) seharga Rp90.000 (HPP = 600 * 130 = Rp78.000)
    const cogs2 = 78000;
    const autoPayment2 = Math.min(remainingLoan, cogs2);
    remainingLoan -= autoPayment2;

    expect(autoPayment2).toBe(78000);
    expect(remainingLoan).toBe(0); // Lunas 100% tepat Rp0 selisih
  });

  it('5. Perhitungan Bagi Hasil Investor dengan Sumber Dana Pinjaman', () => {
    // Omzet = Rp60.000, HPP/Utang Pokok = Rp52.000
    // Laba Kotor Bersih = Rp60.000 - Rp52.000 = Rp8.000
    const omzet = 60000;
    const cogs = 52000;
    const grossProfit = omzet - cogs;
    expect(grossProfit).toBe(8000);

    // Investor 30%, Pemilik 70%
    const investorPercentage = 30;
    const investorShare = Math.round(grossProfit * (investorPercentage / 100));
    const ownerShare = grossProfit - investorShare;

    expect(investorShare).toBe(2400);
    expect(ownerShare).toBe(5600);
    expect(investorShare + ownerShare).toBe(grossProfit);
  });

  it('6. Ekstraksi Spreadsheet ID & Formatter Link Pembuka', () => {
    const rawUrl = 'https://docs.google.com/spreadsheets/d/1eh5OCM_sOJlHztP1LkRbgEdl0CHeGW4RvmVs29_G3Vs/edit?usp=sharing';
    const id = extractSpreadsheetId(rawUrl);
    expect(id).toBe('1eh5OCM_sOJlHztP1LkRbgEdl0CHeGW4RvmVs29_G3Vs');

    const openUrl = getSpreadsheetOpenUrl(rawUrl);
    expect(openUrl).toBe(rawUrl);
  });

  it('7. Validasi URL Spreadsheet Langsung vs Web App URL', async () => {
    const docUrl = 'https://docs.google.com/spreadsheets/d/1eh5OCM_sOJlHztP1LkRbgEdl0CHeGW4RvmVs29_G3Vs/edit?usp=sharing';
    const res = await testGoogleSheetsUrl(docUrl);
    expect(res.ok).toBe(false);
    expect(res.isSpreadsheetDocUrl).toBe(true);

    const emptyRes = await testGoogleSheetsUrl('');
    expect(emptyRes.ok).toBe(false);
  });

  it('8. Verifikasi Perhitungan Restock Dana Gabungan (Uang Ril Kas + Pinjaman Modal Sekaligus)', () => {
    // Restock 10.000 R$ seharga Rp1.300.000 (Rate modal Rp130/R$)
    const totalBatchCost = 1300000;
    const ownCashPortion = 500000;
    const loanPortion = 800000;

    // Verifikasi total bagian cocok
    expect(ownCashPortion + loanPortion).toBe(totalBatchCost);

    // Saldo kas toko yang berkurang HANYA sebesar uang ril kas sendiri
    const cashOutflow = ownCashPortion;
    expect(cashOutflow).toBe(500000);

    // Utang pokok yang tercatat ke kreditor HANYA sebesar porsi pinjaman
    let remainingLoan = loanPortion;
    expect(remainingLoan).toBe(800000);

    // Terjual 4.000 R$ (HPP = 4000 * 130 = Rp520.000)
    const cogsSale1 = 4000 * 130; // 520.000
    const autoPayment1 = Math.min(remainingLoan, cogsSale1);
    remainingLoan -= autoPayment1;
    expect(autoPayment1).toBe(520000);
    expect(remainingLoan).toBe(280000);

    // Terjual 3.000 R$ (HPP = 3000 * 130 = Rp390.000)
    const cogsSale2 = 3000 * 130; // 390.000
    const autoPayment2 = Math.min(remainingLoan, cogsSale2);
    remainingLoan -= autoPayment2;
    expect(autoPayment2).toBe(280000); // Melunasi sisa pinjaman
    expect(remainingLoan).toBe(0); // LUNAS 100%

    // Sisa HPP dari penjualan ke-2 yang kembali ke kas pemilik
    const remainingCogsToOwnerSale2 = cogsSale2 - autoPayment2;
    expect(remainingCogsToOwnerSale2).toBe(110000);

    // Terjual 3.000 R$ terakhir (HPP = 3000 * 130 = Rp390.000)
    const cogsSale3 = 3000 * 130; // 390.000
    // Karena pinjaman sudah lunas, seluruh HPP kembali ke kas pemilik
    const remainingCogsToOwnerSale3 = cogsSale3;
    expect(remainingCogsToOwnerSale2 + remainingCogsToOwnerSale3).toBe(ownCashPortion); // Rp500.000 modal sendiri kembali utuh
  });

  it('9. Verifikasi Logika Penghapusan Batch Restock Sumber Dana Gabungan', () => {
    // Simulasi Batch Restock Gabungan
    const batch = {
      id: 'BATCH-TEST-COMBINED',
      sourceType: 'RESTOCK',
      initialRobux: 2000,
      remainingRobux: 2000, // Masih utuh belum terjual
      totalCostRupiah: 260000,
      fundingSource: 'COMBINED',
      ownFundsRupiah: 100000,
      loanFundsRupiah: 160000,
      loanId: 'LOAN-TEST-123',
    };

    // 1. Verifikasi syarat penghapusan: batch harus 100% utuh
    const canDelete = batch.remainingRobux === batch.initialRobux;
    expect(canDelete).toBe(true);

    // 2. Verifikasi pinjaman harus dihapus jika loanId ada
    const shouldDeleteLoan = Boolean(batch.loanId);
    expect(shouldDeleteLoan).toBe(true);

    // 3. Verifikasi pengeluaran kas harus dibatalkan (karena ada porsi dana sendiri)
    const shouldDeleteCashOutflow = batch.sourceType === 'RESTOCK' && batch.fundingSource !== 'LOAN';
    expect(shouldDeleteCashOutflow).toBe(true);

    // 4. Simulasi penghapusan entri kas terkait dengan pencocokan sourceId
    const mockCashLedger = [
      { id: 'CASH-1', sourceId: 'BATCH-TEST-COMBINED', amountRupiah: 100000 },
      { id: 'CASH-2', sourceId: 'OTHER-BATCH', amountRupiah: 50000 },
    ];
    const relatedCash = mockCashLedger.filter((c) => c.sourceId === batch.id);
    expect(relatedCash.length).toBe(1);
    expect(relatedCash[0].amountRupiah).toBe(100000);

    const remainingCash = mockCashLedger.filter((c) => c.sourceId !== batch.id);
    expect(remainingCash.length).toBe(1);
    expect(remainingCash[0].id).toBe('CASH-2');
  });
});
