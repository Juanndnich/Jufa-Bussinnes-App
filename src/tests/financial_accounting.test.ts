import { describe, it, expect } from 'vitest';
import { formatRupiah, formatNumber, formatDecimal } from '../utils/formatters';
import { isSoundEnabled, setSoundEnabled } from '../utils/sound';

describe('JufaStore - System & Utility Verification Tests', () => {
  it('1. Format Rupiah: Integer tanpa desimal dan menangani negatif dengan rapi', () => {
    expect(formatRupiah(320000)).toBe('Rp320.000');
    expect(formatRupiah(0)).toBe('Rp0');
    expect(formatRupiah(-5000)).toBe('-Rp5.000');
    expect(formatRupiah(null)).toBe('Rp0');
  });

  it('2. Format Angka: Pemisah ribuan rapi', () => {
    expect(formatNumber(1500)).toBe('1.500');
    expect(formatNumber(0)).toBe('0');
  });

  it('3. Format Desimal: Presisi desimal rate kustom tanpa koma jika bilangan bulat', () => {
    expect(formatDecimal(163.3333, 2)).toBe('163,33');
    expect(formatDecimal(130, 2)).toBe('130');
    expect(formatDecimal(13, 2)).toBe('13');
  });

  it('4. Sound Preferences: Toggle pengaturan suara berjalan dengan baik', () => {
    setSoundEnabled(true);
    expect(isSoundEnabled()).toBe(true);
    setSoundEnabled(false);
    expect(isSoundEnabled()).toBe(false);
    setSoundEnabled(true);
  });

  it('5. Rekomendasi Rate Jual Cerdas Berdasarkan Modal Restock', () => {
    // Simulasi modal kulakan Rp130/R$
    const modal = 130;
    const robux = 1000;
    const totalCost = 130000;

    const competitiveRate = Math.max(Math.ceil(modal + 3), Math.round(modal * 1.06));
    const standardRate = Math.max(Math.ceil(modal + 8), Math.round(modal * 1.14));
    const optimalRate = Math.max(Math.ceil(modal + 15), Math.round(modal * 1.22));

    expect(competitiveRate).toBe(138); // +Rp8/R$, cepat laku
    expect(standardRate).toBe(148);    // +Rp18/R$, seimbang
    expect(optimalRate).toBe(159);     // +Rp29/R$, margin lebih

    // Pastikan semua rate menghasilkan laba positif
    expect(competitiveRate * robux - totalCost).toBeGreaterThan(0);
    expect(standardRate * robux - totalCost).toBeGreaterThan(competitiveRate * robux - totalCost);
    expect(optimalRate * robux - totalCost).toBeGreaterThan(standardRate * robux - totalCost);
  });
});
