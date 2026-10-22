import { describe, it, expect } from 'vitest';
import {
  calculateRestockCost,
  calculateTransactionFinancials,
  allocateStockFIFO,
  calculateQuickSales,
  calculateWeightedAverageRate,
  safeDivide,
} from '../utils/calculations';
import { StockBatch } from '../types';

describe('JUFA STORE - Financial & Accounting Accuracy Tests', () => {
  // =========================================================================
  // KASUS A
  // Pembelian 2.000 Robux seharga Rp320.000 -> Modal per Robux Rp160
  // Penjualan 100 Robux dengan rate Rp166
  // Pendapatan Rp16.600, Modal Rp16.000, Laba kotor Rp600
  // =========================================================================
  it('Kasus A: Penjualan untung 100 Robux @ Rp166 dengan modal Rp160', () => {
    const restock = calculateRestockCost(320000, 0, 0, 2000);
    expect(restock.totalCost).toBe(320000);
    expect(restock.costPerUnit).toBe(160);

    const financials = calculateTransactionFinancials(
      100, // qty
      166, // sell rate
      0,   // discount
      0,   // fee
      100 * restock.costPerUnit // cogs = 16000
    );

    expect(financials.grossRevenue).toBe(16600);
    expect(financials.cogs).toBe(16000);
    expect(financials.grossProfit).toBe(600);
    expect(financials.netProfit).toBe(600);
    expect(financials.marginPercentage).toBeCloseTo(3.61, 2);
  });

  // =========================================================================
  // KASUS B
  // Pembelian 2.000 Robux seharga Rp320.000 (modal Rp160)
  // Penjualan 200 Robux di rate Rp150
  // Pendapatan Rp30.000, Modal Rp32.000, Rugi kotor Rp2.000
  // =========================================================================
  it('Kasus B: Penjualan rugi 200 Robux @ Rp150 dengan modal Rp160', () => {
    const financials = calculateTransactionFinancials(200, 150, 0, 0, 200 * 160);

    expect(financials.grossRevenue).toBe(30000);
    expect(financials.cogs).toBe(32000);
    expect(financials.grossProfit).toBe(-2000);
    expect(financials.netProfit).toBe(-2000);
    expect(financials.marginPercentage).toBe(-6.67);
  });

  // =========================================================================
  // KASUS C
  // Pembelian stok Rp320.000 tanpa penjualan:
  // Kas keluar Rp320.000, nilai persediaan Rp320.000, Laba kotor/bersih Rp0 (bukan rugi 320k)
  // =========================================================================
  it('Kasus C: Pembelian stok adalah penukaran kas ke persediaan (bukan kerugian)', () => {
    const restock = calculateRestockCost(320000, 0, 0, 2000);
    expect(restock.totalCost).toBe(320000);
    expect(restock.costPerUnit).toBe(160);

    // Initial state: inventory value is initialQty * costPerUnit
    const inventoryValue = 2000 * restock.costPerUnit;
    expect(inventoryValue).toBe(320000);

    // Zero sales means zero COGS and zero revenue -> profit is 0
    const salesFinancials = calculateTransactionFinancials(0, 0, 0, 0, 0);
    expect(salesFinancials.grossRevenue).toBe(0);
    expect(salesFinancials.cogs).toBe(0);
    expect(salesFinancials.grossProfit).toBe(0);
    expect(salesFinancials.netProfit).toBe(0);
  });

  // =========================================================================
  // KASUS D
  // Dua transaksi: 100 Robux @ Rp166 dan 200 Robux @ Rp165
  // Total Pendapatan: Rp49.600, Total Robux: 300
  // Rata-rata tertimbang: 49.600 / 300 = 165.33
  // Modal: 300 * 160 = Rp48.000
  // Laba kotor: Rp1.600
  // =========================================================================
  it('Kasus D: Perhitungan multi-transaksi dengan rata-rata tertimbang', () => {
    const trx1 = calculateTransactionFinancials(100, 166, 0, 0, 100 * 160);
    const trx2 = calculateTransactionFinancials(200, 165, 0, 0, 200 * 160);

    const totalRevenue = trx1.netRevenue + trx2.netRevenue;
    const totalRobux = 100 + 200;
    const totalCogs = trx1.cogs + trx2.cogs;
    const totalGrossProfit = trx1.grossProfit + trx2.grossProfit;

    expect(totalRevenue).toBe(49600);
    expect(totalRobux).toBe(300);
    expect(totalCogs).toBe(48000);
    expect(totalGrossProfit).toBe(1600);

    const weightedAvgRate = calculateWeightedAverageRate(totalRevenue, totalRobux);
    expect(weightedAvgRate).toBe(165.33);
  });

  // =========================================================================
  // KASUS E
  // Pembayaran Sebagian:
  // Nilai pesanan, kas diterima, dan piutang berbeda secara benar
  // =========================================================================
  it('Kasus E: Pembayaran sebagian menghitung piutang dan kas diterima secara akurat', () => {
    const financials = calculateTransactionFinancials(
      500,  // qty
      165,  // rate -> net revenue = Rp82.500
      0,    // discount
      0,    // fee
      500 * 150, // cogs
      50000 // amountPaid = Rp50.000 (sebagian)
    );

    expect(financials.netRevenue).toBe(82500);
    expect(financials.amountPaid).toBe(50000);
    expect(financials.accountsReceivable).toBe(32500); // Rp82.500 - Rp50.000
    expect(financials.paymentStatus).toBe('SEBAGIAN');
  });

  // =========================================================================
  // KASUS F & FIFO:
  // Multi-batch FIFO allocation
  // Batch 1: 50 Robux @ Rp150
  // Batch 2: 100 Robux @ Rp160
  // Order 70 Robux -> 50 dari Batch 1 (@ Rp150) + 20 dari Batch 2 (@ Rp160)
  // Total COGS = 7.500 + 3.200 = Rp10.700
  // =========================================================================
  it('Kasus F: Alokasi stok FIFO mengambil batch terlama terlebih dahulu', () => {
    const dummyBatches: StockBatch[] = [
      {
        id: 'b1',
        batch_code: 'BATCH-001',
        date: '2026-10-01T10:00:00Z',
        supplier: 'Supplier A',
        initial_quantity: 50,
        remaining_quantity: 50,
        purchase_cost: 7500,
        extra_cost: 0,
        discount: 0,
        total_cost: 7500,
        cost_per_unit: 150,
        payment_method: 'BCA',
        payment_status: 'LUNAS',
        notes: '',
        created_at: '2026-10-01T10:00:00Z',
      },
      {
        id: 'b2',
        batch_code: 'BATCH-002',
        date: '2026-10-05T10:00:00Z',
        supplier: 'Supplier B',
        initial_quantity: 100,
        remaining_quantity: 100,
        purchase_cost: 16000,
        extra_cost: 0,
        discount: 0,
        total_cost: 16000,
        cost_per_unit: 160,
        payment_method: 'BCA',
        payment_status: 'LUNAS',
        notes: '',
        created_at: '2026-10-05T10:00:00Z',
      },
    ];

    const result = allocateStockFIFO(70, dummyBatches);
    expect(result.success).toBe(true);
    expect(result.allocations.length).toBe(2);

    expect(result.allocations[0].batch_id).toBe('b1');
    expect(result.allocations[0].quantity).toBe(50);
    expect(result.allocations[0].subtotal_cost).toBe(7500);

    expect(result.allocations[1].batch_id).toBe('b2');
    expect(result.allocations[1].quantity).toBe(20);
    expect(result.allocations[1].subtotal_cost).toBe(3200);

    expect(result.totalCogs).toBe(10700);

    // Verify updated quantities
    const b1Update = result.updatedBatches.find(u => u.id === 'b1');
    const b2Update = result.updatedBatches.find(u => u.id === 'b2');
    expect(b1Update?.newRemainingQuantity).toBe(0);
    expect(b2Update?.newRemainingQuantity).toBe(80);
  });

  // =========================================================================
  // KASUS J:
  // Penjualan melebihi stok harus gagal dan tidak membuat stok negatif
  // =========================================================================
  it('Kasus J: Penjualan melebihi stok terdeteksi dan tidak membuat alokasi parsial berhasil', () => {
    const dummyBatches: StockBatch[] = [
      {
        id: 'b1',
        batch_code: 'BATCH-001',
        date: '2026-10-01T10:00:00Z',
        supplier: 'Supplier A',
        initial_quantity: 50,
        remaining_quantity: 50,
        purchase_cost: 7500,
        extra_cost: 0,
        discount: 0,
        total_cost: 7500,
        cost_per_unit: 150,
        payment_method: 'BCA',
        payment_status: 'LUNAS',
        notes: '',
        created_at: '2026-10-01T10:00:00Z',
      },
    ];

    const result = allocateStockFIFO(100, dummyBatches);
    expect(result.success).toBe(false);
    expect(result.remainingShortage).toBe(50);
  });

  // =========================================================================
  // KASUS G:
  // Perlindungan Pembagian dengan Nol (Safe Division)
  // =========================================================================
  it('Kasus G: Menghindari NaN dan Infinity saat kuantitas atau pendapatan 0', () => {
    expect(safeDivide(100, 0, 0)).toBe(0);
    expect(calculateWeightedAverageRate(0, 0)).toBe(0);

    const calc = calculateQuickSales({
      quantity: 0,
      sell_rate: 0,
      cost_per_unit: 0,
      discount_nominal: 0,
      discount_percent: 0,
      fee_nominal: 0,
      fee_percent: 0,
    });
    expect(calc.finalPrice).toBe(0);
    expect(calc.marginPercentage).toBeNull();
    expect(calc.status).toBe('IMPAS');
  });
});
