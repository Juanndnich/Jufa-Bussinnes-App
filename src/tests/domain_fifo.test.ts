import { describe, it, expect } from 'vitest';
import {
  calculateMoneyToRobux,
  calculateRobuxToMoney,
  allocateFifoCost,
  rollbackFifoBatch,
  calculateProfit,
  calculateBreakEvenRate,
  simulateProfitScenario,
  calculateRateFromRobuxAndPrice,
  parseRobuxOrMoneyShorthand,
  FifoBatchInput,
} from '../domain/calculations';

describe('JufaStore - Domain & FIFO Financial Engine Tests', () => {
  // Test 1: Mode 1 Kalkulator (Uang ke Robux)
  it('1. Mode 1: Uang Rp50.000 dengan rate Rp165 -> Math.floor = 303 Robux, sisa Rp5', () => {
    const res = calculateMoneyToRobux(50000, 165);
    expect(res.robuxDidapat).toBe(303);
    expect(res.uangTerpakai).toBe(49995); // 303 * 165
    expect(res.kembalianUang).toBe(5); // 50000 - 49995
  });

  // Test 2: Mode 2 Kalkulator (Robux ke Uang)
  it('2. Mode 2: 500 Robux dengan rate Rp165.5 -> Math.ceil = Rp82.750', () => {
    const res = calculateRobuxToMoney(500, 165.5);
    expect(res.totalHarga).toBe(82750); // Math.ceil(500 * 165.5) = 82750
    expect(res.rateEfektif).toBe(165.5);
  });

  // Test 3: Zero-Default State handling
  it('3. Input nol atau kosong menghasilkan keluaran aman tanpa NaN/Infinity', () => {
    const res1 = calculateMoneyToRobux(0, 0);
    expect(res1.robuxDidapat).toBe(0);
    expect(res1.uangTerpakai).toBe(0);
    expect(res1.kembalianUang).toBe(0);

    const res2 = calculateRobuxToMoney(0, 0);
    expect(res2.totalHarga).toBe(0);
    expect(res2.rateEfektif).toBe(0);

    const profit = calculateProfit(0, 0, 0);
    expect(profit.grossProfit).toBe(0);
    expect(profit.netProfit).toBe(0);
    expect(profit.marginPercentage).toBeNull(); // Tidak tersedia jika omzet 0
  });

  // Test 4: FIFO Integer Remainder Allocation - ZERO ROUNDING DRIFT
  it('4. Zero Rounding Drift: 300 R$ seharga Rp50.000 terjual 3x 100 R$, total HPP persis Rp50.000', () => {
    // 50.000 / 300 = 166.6666... (tidak habis dibagi)
    const batches: FifoBatchInput[] = [
      {
        id: 'BATCH-1',
        remainingRobux: 300,
        remainingCostRupiah: 50000,
      },
    ];

    // Penjualan 1: 100 Robux
    const alloc1 = allocateFifoCost(batches, 100);
    expect(alloc1.success).toBe(true);
    expect(alloc1.totalCogsRupiah).toBe(16667); // Math.round((100/300) * 50000)
    // Update batch
    batches[0].remainingRobux = alloc1.allocations[0].batchRemainingRobuxAfter; // 200
    batches[0].remainingCostRupiah = alloc1.allocations[0].batchRemainingCostAfter; // 33333

    // Penjualan 2: 100 Robux
    const alloc2 = allocateFifoCost(batches, 100);
    expect(alloc2.success).toBe(true);
    expect(alloc2.totalCogsRupiah).toBe(16667); // Math.round((100/200) * 33333) = 16666.5 -> 16667
    // Update batch
    batches[0].remainingRobux = alloc2.allocations[0].batchRemainingRobuxAfter; // 100
    batches[0].remainingCostRupiah = alloc2.allocations[0].batchRemainingCostAfter; // 16666

    // Penjualan 3: 100 Robux (menghabiskan sisa batch)
    const alloc3 = allocateFifoCost(batches, 100);
    expect(alloc3.success).toBe(true);
    // Karena sisa batch diambil semua, SELURUH remainingCostRupiah dialokasikan!
    expect(alloc3.totalCogsRupiah).toBe(16666);
    expect(alloc3.allocations[0].batchRemainingRobuxAfter).toBe(0);
    expect(alloc3.allocations[0].batchRemainingCostAfter).toBe(0);

    // Total HPP yang keluar dari 3 transaksi:
    const totalCogs = alloc1.totalCogsRupiah + alloc2.totalCogsRupiah + alloc3.totalCogsRupiah;
    expect(totalCogs).toBe(50000); // PERSIS 100% SAMA DENGAN Rp50.000 TANPA SELISIH RP1 PUN!
  });

  // Test 5: Multi-batch FIFO traversal
  it('5. Pengambilan Robux melewati lebih dari 1 batch secara berurutan (FIFO)', () => {
    const batches: FifoBatchInput[] = [
      { id: 'BATCH-A', remainingRobux: 50, remainingCostRupiah: 7500 }, // rate 150
      { id: 'BATCH-B', remainingRobux: 100, remainingCostRupiah: 16000 }, // rate 160
    ];

    // Minta 70 Robux -> harus habiskan BATCH-A (50 R$ = 7500) dan ambil 20 R$ dari BATCH-B (20/100 * 16000 = 3200)
    const res = allocateFifoCost(batches, 70);
    expect(res.success).toBe(true);
    expect(res.allocations.length).toBe(2);
    expect(res.allocations[0].batchId).toBe('BATCH-A');
    expect(res.allocations[0].robuxTaken).toBe(50);
    expect(res.allocations[0].costAllocatedRupiah).toBe(7500);

    expect(res.allocations[1].batchId).toBe('BATCH-B');
    expect(res.allocations[1].robuxTaken).toBe(20);
    expect(res.allocations[1].costAllocatedRupiah).toBe(3200);

    expect(res.totalCogsRupiah).toBe(10700);
  });

  // Test 6: Permintaan melebihi stok yang tersedia
  it('6. Stok tidak mencukupi mengembalikan success: false dengan info kekurangan', () => {
    const batches: FifoBatchInput[] = [
      { id: 'BATCH-A', remainingRobux: 100, remainingCostRupiah: 16000 },
    ];

    const res = allocateFifoCost(batches, 150);
    expect(res.success).toBe(false);
    expect(res.shortageRobux).toBe(50);
    expect(res.totalRobuxAllocated).toBe(100);
  });

  // Test 7: Rollback FIFO
  it('7. Rollback mengembalikan stok dan modal ke batch semula', () => {
    const batch: FifoBatchInput = {
      id: 'BATCH-1',
      remainingRobux: 150,
      remainingCostRupiah: 24000,
    };

    const restored = rollbackFifoBatch(batch, 50, 8000, 200, 32000);
    expect(restored.remainingRobux).toBe(200);
    expect(restored.remainingCostRupiah).toBe(32000);
  });

  // Test 8: Break-even rate & Scenario Simulator
  it('8. Break-even rate dan simulasi profit skenario berfungsi tepat', () => {
    const beRate = calculateBreakEvenRate(160000, 1000);
    expect(beRate).toBe(160);

    const emptyBe = calculateBreakEvenRate(0, 0);
    expect(emptyBe).toBeNull();

    const scenario = simulateProfitScenario(1000, 160000, 180, [100, 50]);
    // 100%: 1000 R$ * 180 = Rp180.000, modal Rp160.000 -> grossProfit Rp20.000
    expect(scenario[0].robuxSold).toBe(1000);
    expect(scenario[0].revenue).toBe(180000);
    expect(scenario[0].grossProfit).toBe(20000);

    // 50%: 500 R$ * 180 = Rp90.000, modal Rp80.000 -> grossProfit Rp10.000
    expect(scenario[1].robuxSold).toBe(500);
    expect(scenario[1].revenue).toBe(90000);
    expect(scenario[1].grossProfit).toBe(10000);
  });

  // Test 9: Mode 3 - Hitung / Temukan Rate Kompetitor & Pasar
  it('9. Mode 3: 1k Robux seharga Rp13k -> rate Rp13 / R$, 1k Robux seharga Rp150.000 -> rate Rp150 / R$', () => {
    // Skenario permintaan user: 1k robux harga 13k
    const r1 = calculateRateFromRobuxAndPrice(1000, 13000);
    expect(r1.ratePerRobux).toBe(13);
    expect(r1.ratePer100).toBe(1300);
    expect(r1.ratePer1k).toBe(13000);

    // Skenario rate 150: 1000 robux harga 150.000
    const r2 = calculateRateFromRobuxAndPrice(1000, 150000);
    expect(r2.ratePerRobux).toBe(150);
    expect(r2.ratePer100).toBe(15000);
    expect(r2.ratePer1k).toBe(150000);

    // Skenario retail: 50 robux harga Rp7.500
    const r3 = calculateRateFromRobuxAndPrice(50, 7500);
    expect(r3.ratePerRobux).toBe(150);

    // Input kosong / 0
    const r4 = calculateRateFromRobuxAndPrice(0, 0);
    expect(r4.ratePerRobux).toBe(0);
    expect(r4.ratePer1k).toBe(0);
  });

  // Test 10: Shorthand string parser ('1k' -> 1000, '13k' -> 13000, '1.5k' -> 1500)
  it('10. Parser shorthand mengenali notasi k, rb, jt, dan titik ribuan dengan benar', () => {
    expect(parseRobuxOrMoneyShorthand('1k')).toBe(1000);
    expect(parseRobuxOrMoneyShorthand('13k')).toBe(13000);
    expect(parseRobuxOrMoneyShorthand('130 ribu')).toBe(130000);
    expect(parseRobuxOrMoneyShorthand('13 rb')).toBe(13000);
    expect(parseRobuxOrMoneyShorthand('1.5 juta')).toBe(1500000);
    expect(parseRobuxOrMoneyShorthand('2.5k')).toBe(2500);
    expect(parseRobuxOrMoneyShorthand('10rb')).toBe(10000);
    expect(parseRobuxOrMoneyShorthand('13.000')).toBe(13000);
    expect(parseRobuxOrMoneyShorthand('Rp 150.000')).toBe(150000);
    expect(parseRobuxOrMoneyShorthand('1jt')).toBe(1000000);
    expect(parseRobuxOrMoneyShorthand('1.2m')).toBe(1200000);
    expect(parseRobuxOrMoneyShorthand('')).toBe(0);
  });
});
