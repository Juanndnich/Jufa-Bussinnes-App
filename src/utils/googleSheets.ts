/**
 * JufaStore - Google Sheets Utility
 * Re-export dan kompatibilitas sistem sinkronisasi Google Sheets V2
 */

import {
  SHEETS_TABLES,
  SHEETS_CODE_GS_TEMPLATE,
  testSheetsConnection,
  requestSetupSheets,
  triggerFullSheetsSync,
  formatJakartaYmdHm,
} from '../services/sheetsSync';

export { SHEETS_TABLES, SHEETS_CODE_GS_TEMPLATE, formatJakartaYmdHm };

export const GOOGLE_APPS_SCRIPT_TEMPLATE = SHEETS_CODE_GS_TEMPLATE;

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

export const GOOGLE_SHEETS_TABLES = SHEETS_TABLES;

export function extractSpreadsheetId(url: string): string | null {
  if (!url) return null;
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : null;
}

export function getSpreadsheetOpenUrl(urlOrId: string): string {
  if (!urlOrId) return '';
  const clean = urlOrId.trim();
  if (clean.startsWith('http://') || clean.startsWith('https://')) {
    return clean;
  }
  return `https://docs.google.com/spreadsheets/d/${clean}/edit`;
}

export async function testGoogleSheetsUrl(
  url: string,
  secret?: string
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
  return testSheetsConnection(clean, secret || '');
}

export async function initializeGoogleSheetTable(
  url: string,
  secret?: string
): Promise<{ success: boolean; message: string }> {
  const res = await requestSetupSheets(url, secret || '');
  return { success: res.ok, message: res.message };
}

export async function syncAllDataToGoogleSheets(
  url: string,
  secret?: string
): Promise<{ success: boolean; message: string; syncedAt?: string }> {
  const res = await triggerFullSheetsSync();
  return {
    success: res.success,
    message: res.message,
    syncedAt: new Date().toISOString(),
  };
}
