import { describe, it, expect } from 'vitest';
import {
  parseNumberString,
  formatPreviewNumber,
  formatInputValue,
} from '../utils/numberInputUtils';

describe('JufaStore - NumberInput & Parser Utility Tests', () => {
  describe('1. Parsing Angka Integer & Desimal', () => {
    it('1.1. Parsing angka bulat mentah (2000, 1500000)', () => {
      expect(parseNumberString('2000')).toBe(2000);
      expect(parseNumberString('1500000')).toBe(1500000);
    });

    it('1.2. Parsing paste angka berformat titik ribuan ("1.250.000")', () => {
      expect(parseNumberString('1.250.000')).toBe(1250000);
      expect(parseNumberString('2.500.000')).toBe(2500000);
    });

    it('1.3. Parsing paste angka dengan awalan rupiah ("Rp 1.250.000" / "Rp1.250.000")', () => {
      expect(parseNumberString('Rp 1.250.000')).toBe(1250000);
      expect(parseNumberString('Rp1.250.000')).toBe(1250000);
    });

    it('1.4. Parsing angka desimal (166.5 dan 166,5)', () => {
      expect(parseNumberString('166.5', { allowDecimals: true })).toBe(166.5);
      expect(parseNumberString('166,5', { allowDecimals: true })).toBe(166.5);
      expect(parseNumberString('1.250,75', { allowDecimals: true })).toBe(1250.75);
    });

    it('1.5. Membulatkan integer jika allowDecimals = false (aturan rupiah AGENTS.md)', () => {
      expect(parseNumberString('166.75', { allowDecimals: false })).toBe(16675); // Titik dibuang sebagai ribuan/integer
    });

    it('1.6. Menangani input kosong, null, undefined, dan nol', () => {
      expect(parseNumberString('')).toBe('');
      expect(parseNumberString('   ')).toBe('');
      expect(parseNumberString(null as any)).toBe('');
      expect(parseNumberString(undefined as any)).toBe('');
      expect(parseNumberString('0')).toBe(0);
      expect(parseNumberString(0)).toBe(0);
    });

    it('1.7. Mendukung shorthand k, rb, jt seperti 10k atau 1.5jt', () => {
      expect(parseNumberString('10k')).toBe(10000);
      expect(parseNumberString('250rb')).toBe(250000);
      expect(parseNumberString('1.5jt')).toBe(1500000);
    });
  });

  describe('2. Pratinjau Terformat Real-Time (formatPreviewNumber)', () => {
    it('2.1. Menampilkan format ribuan titik Indonesia untuk 2000 ("2.000")', () => {
      expect(formatPreviewNumber(2000)).toBe('2.000');
      expect(formatPreviewNumber(1500000)).toBe('1.500.000');
    });

    it('2.2. Menampilkan format Rupiah jika isCurrency = true ("Rp 2.000")', () => {
      expect(formatPreviewNumber(2000, { isCurrency: true })).toBe('Rp 2.000');
      expect(formatPreviewNumber(1500000, { isCurrency: true })).toBe('Rp 1.500.000');
    });

    it('2.3. Menampilkan prefix atau suffix kustom (misal "2.000 R$")', () => {
      expect(formatPreviewNumber(2000, { suffix: 'R$' })).toBe('2.000 R$');
      expect(formatPreviewNumber(1000, { suffix: 'Robux' })).toBe('1.000 Robux');
    });

    it('2.4. Menampilkan pratinjau desimal dengan koma lokal', () => {
      expect(formatPreviewNumber(166.5, { allowDecimals: true })).toBe('166,5');
    });

    it('2.5. Mengembalikan string kosong jika nilai kosong, null, atau undefined', () => {
      expect(formatPreviewNumber('')).toBe('');
      expect(formatPreviewNumber(null)).toBe('');
      expect(formatPreviewNumber(undefined)).toBe('');
    });

    it('2.6. Menampilkan nol dengan benar ("0" / "Rp 0")', () => {
      expect(formatPreviewNumber(0)).toBe('0');
      expect(formatPreviewNumber(0, { isCurrency: true })).toBe('Rp 0');
    });
  });

  describe('3. Nilai Input Display (formatInputValue)', () => {
    it('3.1. Memformat nilai input dengan titik ribuan untuk integer', () => {
      expect(formatInputValue(2000)).toBe('2.000');
      expect(formatInputValue(1500000)).toBe('1.500.000');
    });

    it('3.2. Mengembalikan string kosong untuk nilai kosong', () => {
      expect(formatInputValue('')).toBe('');
      expect(formatInputValue(null)).toBe('');
    });
  });
});
