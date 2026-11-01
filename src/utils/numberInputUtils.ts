/**
 * Utilitas Parser & Formatter untuk Komponen NumberInput
 * Sesuai prinsip akuntansi AGENTS.md (Integer Rupiah & Presisi Numerik)
 */

import { parseRobuxOrMoneyShorthand } from '../domain/calculations';

export interface NumberFormatOptions {
  prefix?: string;
  suffix?: string;
  isCurrency?: boolean;
  allowDecimals?: boolean;
  maxDecimals?: number;
}

/**
 * Parsing string input mentah menjadi number atau string kosong ''
 * Mendukung input mentah, shorthand ('1k', '13rb', '1.5jt'),
 * paste format ribuan titik ("1.250.000"), paste dengan prefix ("Rp 1.250.000"),
 * dan format desimal lokal ("166,5" atau "166.5").
 */
export function parseNumberString(
  raw: string | number | null | undefined,
  options?: NumberFormatOptions
): number | '' {
  if (raw === undefined || raw === null) return '';
  if (typeof raw === 'number') {
    if (isNaN(raw)) return '';
    return options?.allowDecimals
      ? raw
      : Math.round(raw);
  }

  const str = String(raw).trim();
  if (str === '') return '';

  // Deteksi shorthand huruf seperti k, rb, jt, m
  if (/[a-zA-Z]/.test(str)) {
    const shorthandResult = parseRobuxOrMoneyShorthand(str);
    if (shorthandResult > 0) {
      return options?.allowDecimals
        ? shorthandResult
        : Math.round(shorthandResult);
    }
  }

  // Bersihkan karakter selain angka, minus, koma, dan titik
  const cleanStr = str.replace(/[^0-9.,-]/g, '');
  if (!cleanStr || cleanStr === '-') return '';

  if (options?.allowDecimals) {
    let normalized = cleanStr;
    const hasComma = cleanStr.includes(',');
    const hasDot = cleanStr.includes('.');

    if (hasComma && hasDot) {
      // Format Indonesia "1.250.000,50" -> titik dibuang, koma jadi titik desimal
      normalized = cleanStr.replace(/\./g, '').replace(',', '.');
    } else if (hasComma) {
      // Format koma tunggal "166,5" -> koma jadi titik desimal
      normalized = cleanStr.replace(',', '.');
    } else if (hasDot) {
      // Cek apakah titik merupakan pemisah ribuan (misal "1.250.000" atau "2.000")
      const parts = cleanStr.split('.');
      const isThousands = parts.length > 1 && parts.slice(1).every((p) => p.length === 3);
      if (isThousands) {
        normalized = cleanStr.replace(/\./g, '');
      } else {
        normalized = cleanStr;
      }
    }

    const parsed = parseFloat(normalized);
    if (isNaN(parsed)) return '';
    if (options.maxDecimals !== undefined) {
      const factor = Math.pow(10, options.maxDecimals);
      return Math.round(parsed * factor) / factor;
    }
    return parsed;
  } else {
    // Integer murni (Rupiah & Robux)
    const intStr = cleanStr.replace(/[^0-9-]/g, '');
    if (!intStr || intStr === '-') return '';
    const parsed = parseInt(intStr, 10);
    return isNaN(parsed) ? '' : parsed;
  }
}

/**
 * Format pratinjau angka di atas kolom input secara real-time
 * Contoh: 2000 -> "2.000" atau "Rp 2.000"
 * Jika kosong / tidak valid, kembalikan ''
 */
export function formatPreviewNumber(
  val: number | '' | null | undefined,
  options?: NumberFormatOptions
): string {
  if (val === '' || val === null || val === undefined || isNaN(Number(val))) {
    return '';
  }

  const num = Number(val);
  const formatted = num.toLocaleString('id-ID', {
    maximumFractionDigits: options?.allowDecimals ? (options.maxDecimals ?? 2) : 0,
    minimumFractionDigits: 0,
  });

  if (options?.isCurrency || options?.prefix?.trim().toUpperCase() === 'RP') {
    return `Rp ${formatted}`;
  }

  const prefix = options?.prefix ? `${options.prefix.trim()} ` : '';
  const suffix = options?.suffix ? ` ${options.suffix.trim()}` : '';
  return `${prefix}${formatted}${suffix}`;
}

/**
 * Format string tampilan untuk di dalam input field itu sendiri
 */
export function formatInputValue(
  val: number | '' | null | undefined,
  options?: NumberFormatOptions
): string {
  if (val === '' || val === null || val === undefined || isNaN(Number(val))) {
    return '';
  }

  const num = Number(val);
  if (options?.allowDecimals) {
    return String(num);
  }
  return num.toLocaleString('id-ID');
}
