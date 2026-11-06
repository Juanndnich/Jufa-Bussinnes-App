import { describe, it, expect } from 'vitest';
import {
  calculateSavingsSummary,
  validateSavingsWithdrawal,
} from '../domain/savings';
import { BackupSchema } from '../services/backupService';

describe('JufaStore - Buku Tabungan Pribadi (Savings Domain & Schema Tests)', () => {
  it('1. Memulai dengan saldo nol murni (Strict Zero-Default State)', () => {
    const summary = calculateSavingsSummary([], []);
    expect(summary.totalBalance).toBe(0);
    expect(summary.totalIn).toBe(0);
    expect(summary.totalOut).toBe(0);
    expect(summary.unallocatedBalance).toBe(0);
    expect(summary.categories).toEqual([]);
  });

  it('2. Menyetor tabungan tanpa kategori (Uang Biasa / Umum)', () => {
    const entries = [
      {
        type: 'IN' as const,
        amountRupiah: 150000,
        category: '',
      },
    ];

    const summary = calculateSavingsSummary(entries, []);
    expect(summary.totalBalance).toBe(150000);
    expect(summary.totalIn).toBe(150000);
    expect(summary.totalOut).toBe(0);
    expect(summary.unallocatedBalance).toBe(150000);
    expect(summary.categories).toHaveLength(0);
  });

  it('3. Menyetor tabungan ke kategori bebas (Makan, Mainan) dan menghitung saldo per kategori', () => {
    const savedCategories = [{ name: 'Makan' }, { name: 'Mainan' }, { name: 'Liburan' }];
    const entries = [
      { type: 'IN' as const, amountRupiah: 100000, category: 'Makan' },
      { type: 'IN' as const, amountRupiah: 200000, category: 'Mainan' },
      { type: 'IN' as const, amountRupiah: 50000, category: '' }, // Uang Biasa
    ];

    const summary = calculateSavingsSummary(entries, savedCategories);
    expect(summary.totalBalance).toBe(350000);
    expect(summary.totalIn).toBe(350000);
    expect(summary.totalOut).toBe(0);
    expect(summary.unallocatedBalance).toBe(50000);

    // Semua kategori tersimpan harus ada, termasuk Liburan dengan saldo 0
    expect(summary.categories).toHaveLength(3);

    const makan = summary.categories.find((c) => c.name === 'Makan');
    const mainan = summary.categories.find((c) => c.name === 'Mainan');
    const liburan = summary.categories.find((c) => c.name === 'Liburan');

    expect(makan?.balance).toBe(100000);
    expect(makan?.totalIn).toBe(100000);
    expect(makan?.totalOut).toBe(0);

    expect(mainan?.balance).toBe(200000);
    expect(mainan?.totalIn).toBe(200000);

    expect(liburan?.balance).toBe(0);
    expect(liburan?.totalIn).toBe(0);
  });

  it('4. Memakai tabungan (OUT) dan memvalidasi pengurangan saldo per pos', () => {
    const entries = [
      { type: 'IN' as const, amountRupiah: 100000, category: 'Makan' },
      { type: 'IN' as const, amountRupiah: 50000, category: '' },
      { type: 'OUT' as const, amountRupiah: 40000, category: 'Makan' },
      { type: 'OUT' as const, amountRupiah: 20000, category: '' },
    ];

    const summary = calculateSavingsSummary(entries);
    expect(summary.totalBalance).toBe(90000); // 150k in - 60k out
    expect(summary.totalIn).toBe(150000);
    expect(summary.totalOut).toBe(60000);
    expect(summary.unallocatedBalance).toBe(30000); // 50k - 20k

    const makan = summary.categories.find((c) => c.name === 'Makan');
    expect(makan?.balance).toBe(60000); // 100k - 40k
    expect(makan?.totalIn).toBe(100000);
    expect(makan?.totalOut).toBe(40000);
  });

  it('5. Validasi kecukupan saldo (validateSavingsWithdrawal)', () => {
    const entries = [
      { type: 'IN' as const, amountRupiah: 50000, category: 'Makan' },
      { type: 'IN' as const, amountRupiah: 100000, category: '' },
    ];

    // Penarikan valid pada pos Makan
    const validMakan = validateSavingsWithdrawal(40000, 'Makan', entries);
    expect(validMakan.valid).toBe(true);
    expect(validMakan.availableBalance).toBe(50000);

    // Penarikan berlebih pada pos Makan
    const invalidMakan = validateSavingsWithdrawal(60000, 'Makan', entries);
    expect(invalidMakan.valid).toBe(false);
    expect(invalidMakan.error).toMatch(/tidak mencukupi/i);

    // Penarikan valid pada Uang Biasa
    const validUnallocated = validateSavingsWithdrawal(70000, '', entries);
    expect(validUnallocated.valid).toBe(true);
    expect(validUnallocated.availableBalance).toBe(100000);

    // Penarikan berlebih pada Uang Biasa
    const invalidUnallocated = validateSavingsWithdrawal(150000, '', entries);
    expect(invalidUnallocated.valid).toBe(false);
    expect(invalidUnallocated.error).toMatch(/tidak mencukupi/i);

    // Penarikan nol atau negatif
    expect(validateSavingsWithdrawal(0, 'Makan', entries).valid).toBe(false);
    expect(validateSavingsWithdrawal(-5000, 'Makan', entries).valid).toBe(false);
  });

  it('6. BackupSchema memvalidasi keberadaan tabel savingsEntries dan savingsCategories', () => {
    const sampleBackup = {
      version: 3,
      exportedAt: new Date().toISOString(),
      savingsEntries: [
        {
          id: 'SAV-001',
          type: 'IN',
          amountRupiah: 100000,
          category: 'Mainan',
          dateKey: '2026-11-07',
          createdAt: new Date().toISOString(),
          notes: 'Nabung gundam',
        },
      ],
      savingsCategories: [
        {
          id: 'SAVCAT-001',
          name: 'Mainan',
          createdAt: new Date().toISOString(),
        },
      ],
    };

    const parsed = BackupSchema.safeParse(sampleBackup);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.savingsEntries).toHaveLength(1);
      expect(parsed.data.savingsCategories).toHaveLength(1);
    }
  });

  it('7. BackupSchema tetap kompatibel penuh jika cadangan lama tidak memiliki savingsEntries', () => {
    const legacyBackup = {
      version: 2,
      exportedAt: new Date().toISOString(),
      settings: [],
      stockBatches: [],
    };

    const parsed = BackupSchema.safeParse(legacyBackup);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.savingsEntries).toBeUndefined();
      expect(parsed.data.savingsCategories).toBeUndefined();
    }
  });
});
