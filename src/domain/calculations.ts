/**
 * JufaStore - Pure Domain Financial & Accounting Calculations
 * Strictly integer Rupiah for monetary values.
 * Zero-default state compliant.
 */

export interface MoneyToRobuxResult {
  nominalUang: number;
  rateJual: number;
  robuxDidapat: number;
  uangTerpakai: number;
  kembalianUang: number;
}

export interface RobuxToMoneyResult {
  jumlahRobux: number;
  rateJual: number;
  totalHarga: number;
  rateEfektif: number;
}

export interface CompetitorRateResult {
  jumlahRobux: number;
  totalHarga: number;
  ratePerRobux: number;
  ratePer100: number;
  ratePer1k: number;
}

export interface FifoBatchInput {
  id: string;
  remainingRobux: number;
  remainingCostRupiah: number;
}

export interface FifoAllocationItem {
  batchId: string;
  robuxTaken: number;
  costAllocatedRupiah: number;
  batchRemainingRobuxAfter: number;
  batchRemainingCostAfter: number;
}

export interface FifoAllocationResult {
  success: boolean;
  totalRobuxRequested: number;
  totalRobuxAllocated: number;
  totalCogsRupiah: number;
  allocations: FifoAllocationItem[];
  shortageRobux: number;
  averageCogsPerRobux: number;
}

/**
 * Mode 1: Convert Money to Robux
 * Pembeli punya budget uang Rp X, hitung Robux yang didapat.
 */
export function calculateMoneyToRobux(nominalUang: number, rateJual: number): MoneyToRobuxResult {
  const safeUang = Math.max(0, Math.floor(nominalUang || 0));
  const safeRate = Number(rateJual) || 0;

  if (safeRate <= 0 || safeUang <= 0) {
    return {
      nominalUang: safeUang,
      rateJual: safeRate,
      robuxDidapat: 0,
      uangTerpakai: 0,
      kembalianUang: safeUang,
    };
  }

  const robuxDidapat = Math.floor(safeUang / safeRate);
  const uangTerpakai = Math.round(robuxDidapat * safeRate);
  const kembalianUang = safeUang - uangTerpakai;

  return {
    nominalUang: safeUang,
    rateJual: safeRate,
    robuxDidapat,
    uangTerpakai,
    kembalianUang,
  };
}

/**
 * Mode 2: Convert Robux to Money
 * Pembeli butuh R$ X, hitung uang yang harus dibayar.
 */
export function calculateRobuxToMoney(jumlahRobux: number, rateJual: number): RobuxToMoneyResult {
  const safeRobux = Math.max(0, Math.floor(jumlahRobux || 0));
  const safeRate = Number(rateJual) || 0;

  if (safeRate <= 0 || safeRobux <= 0) {
    return {
      jumlahRobux: safeRobux,
      rateJual: safeRate,
      totalHarga: 0,
      rateEfektif: 0,
    };
  }

  // Math.ceil agar hasil uang bulat dan menguntungkan toko
  const totalHarga = Math.ceil(safeRobux * safeRate);
  const rateEfektif = safeRobux > 0 ? totalHarga / safeRobux : 0;

  return {
    jumlahRobux: safeRobux,
    rateJual: safeRate,
    totalHarga,
    rateEfektif,
  };
}

/**
 * Parsing input angka dengan dukungan format shorthand (cth: '1k' -> 1000, '13k' -> 13000, '1.5m' -> 1500000)
 */
export function parseRobuxOrMoneyShorthand(input: string | number): number {
  if (typeof input === 'number') return Math.max(0, input);
  if (!input) return 0;

  const clean = input
    .trim()
    .toLowerCase()
    .replace(/rp\.?\s*/g, '')
    .replace(/r\$\.?\s*/g, '')
    .replace(/\s+/g, '')
    .replace(/ribu/g, 'rb')
    .replace(/juta/g, 'jt')
    .replace(/,/g, '.');

  if (clean.endsWith('k') || clean.endsWith('rb')) {
    const numPart = parseFloat(clean.replace(/k|rb/g, ''));
    return isNaN(numPart) ? 0 : Math.round(numPart * 1000);
  }
  if (clean.endsWith('m') || clean.endsWith('jt')) {
    const numPart = parseFloat(clean.replace(/m|jt/g, ''));
    return isNaN(numPart) ? 0 : Math.round(numPart * 1000000);
  }

  // Handle titik pemisah ribuan (misal 13.000 atau 1.000.000)
  const dotCount = (clean.match(/\./g) || []).length;
  if (dotCount === 1) {
    const parts = clean.split('.');
    if (parts[1].length === 3 && parseFloat(parts[0]) >= 1) {
      return Math.round(parseFloat(clean.replace(/\./g, '')) || 0);
    }
  } else if (dotCount > 1) {
    return Math.round(parseFloat(clean.replace(/\./g, '')) || 0);
  }

  const num = parseFloat(clean);
  return isNaN(num) ? 0 : Math.max(0, num);
}

/**
 * Mode 3: Hitung / Temukan Rate dari Jumlah Robux dan Total Harga Jual
 * Berguna untuk menganalisis rate kompetitor/orang lain (misal 1k Robux seharga Rp13k -> rate Rp13 / R$)
 */
export function calculateRateFromRobuxAndPrice(
  jumlahRobux: number,
  totalHarga: number
): CompetitorRateResult {
  const safeRobux = Math.max(0, Math.floor(jumlahRobux || 0));
  const safePrice = Math.max(0, Math.floor(totalHarga || 0));

  if (safeRobux <= 0 || safePrice <= 0) {
    return {
      jumlahRobux: safeRobux,
      totalHarga: safePrice,
      ratePerRobux: 0,
      ratePer100: 0,
      ratePer1k: 0,
    };
  }

  const ratePerRobux = safePrice / safeRobux;
  const ratePer100 = ratePerRobux * 100;
  const ratePer1k = ratePerRobux * 1000;

  return {
    jumlahRobux: safeRobux,
    totalHarga: safePrice,
    ratePerRobux,
    ratePer100,
    ratePer1k,
  };
}

/**
 * FIFO Cost of Goods Sold (COGS / HPP) Allocation
 * Menggunakan Integer Remainder Allocation agar saat seluruh batch habis terjual,
 * total HPP teralokasi persis sama 100% dengan modal batch awal (selisih Rp0).
 */
export function allocateFifoCost(
  batches: FifoBatchInput[],
  robuxToTake: number
): FifoAllocationResult {
  const requested = Math.max(0, Math.floor(robuxToTake || 0));
  if (requested <= 0) {
    return {
      success: true,
      totalRobuxRequested: 0,
      totalRobuxAllocated: 0,
      totalCogsRupiah: 0,
      allocations: [],
      shortageRobux: 0,
      averageCogsPerRobux: 0,
    };
  }

  let remainingToTake = requested;
  let totalCogsRupiah = 0;
  const allocations: FifoAllocationItem[] = [];

  for (const batch of batches) {
    if (remainingToTake <= 0) break;
    if (batch.remainingRobux <= 0) continue;

    const takeFromBatch = Math.min(batch.remainingRobux, remainingToTake);

    let costAllocated: number;
    // Jika seluruh sisa Robux dalam batch diambil, alokasikan SELURUH sisa modal
    // Ini menjamin Zero Rounding Drift (Rp0 selisih)!
    if (takeFromBatch === batch.remainingRobux) {
      costAllocated = batch.remainingCostRupiah;
    } else {
      // Alokasi proporsional bulat ke integer terdekat
      costAllocated = Math.round(
        (takeFromBatch / batch.remainingRobux) * batch.remainingCostRupiah
      );
      // Cegah alokasi melebihi sisa modal batch
      costAllocated = Math.min(costAllocated, batch.remainingCostRupiah);
      costAllocated = Math.max(0, costAllocated);
    }

    const batchRemainingRobuxAfter = batch.remainingRobux - takeFromBatch;
    const batchRemainingCostAfter = batch.remainingCostRupiah - costAllocated;

    allocations.push({
      batchId: batch.id,
      robuxTaken: takeFromBatch,
      costAllocatedRupiah: costAllocated,
      batchRemainingRobuxAfter,
      batchRemainingCostAfter,
    });

    totalCogsRupiah += costAllocated;
    remainingToTake -= takeFromBatch;
  }

  const allocated = requested - remainingToTake;
  const success = remainingToTake === 0;

  return {
    success,
    totalRobuxRequested: requested,
    totalRobuxAllocated: allocated,
    totalCogsRupiah,
    allocations,
    shortageRobux: remainingToTake,
    averageCogsPerRobux: allocated > 0 ? totalCogsRupiah / allocated : 0,
  };
}

/**
 * Rollback FIFO allocation when a sale or usage is cancelled or voided.
 * Restores the exact stock and cost back to the respective batches.
 */
export function rollbackFifoBatch(
  batch: FifoBatchInput,
  robuxToRestore: number,
  costToRestore: number,
  initialMaxRobux?: number,
  initialMaxCost?: number
): FifoBatchInput {
  const newRobux = batch.remainingRobux + robuxToRestore;
  const newCost = batch.remainingCostRupiah + costToRestore;

  return {
    id: batch.id,
    remainingRobux: initialMaxRobux !== undefined ? Math.min(newRobux, initialMaxRobux) : newRobux,
    remainingCostRupiah: initialMaxCost !== undefined ? Math.min(newCost, initialMaxCost) : newCost,
  };
}

/**
 * Profit Calculation
 */
export function calculateProfit(totalRevenueRupiah: number, totalCogsRupiah: number, operationalExpensesRupiah = 0) {
  const grossProfit = Math.round((totalRevenueRupiah || 0) - (totalCogsRupiah || 0));
  const netProfit = Math.round(grossProfit - (operationalExpensesRupiah || 0));
  const revenue = totalRevenueRupiah || 0;
  
  const marginPercentage = revenue > 0 ? (grossProfit / revenue) * 100 : null;

  return {
    grossProfit,
    netProfit,
    marginPercentage, // null if revenue === 0
  };
}

/**
 * Calculate Break-Even Rate for current inventory
 */
export function calculateBreakEvenRate(totalRemainingCostRupiah: number, totalRemainingRobux: number): number | null {
  if (!totalRemainingRobux || totalRemainingRobux <= 0) {
    return null;
  }
  return totalRemainingCostRupiah / totalRemainingRobux;
}

/**
 * Scenario Simulator (e.g. 100%, 75%, 50% stock sold at target rate)
 */
export function simulateProfitScenario(
  totalRemainingRobux: number,
  totalRemainingCostRupiah: number,
  targetRate: number,
  percentages: number[] = [100, 75, 50]
) {
  const safeRobux = Math.max(0, totalRemainingRobux || 0);
  const safeCost = Math.max(0, totalRemainingCostRupiah || 0);
  const safeRate = Number(targetRate) || 0;

  return percentages.map((percent) => {
    const robuxSold = Math.floor((safeRobux * percent) / 100);
    const revenue = Math.ceil(robuxSold * safeRate);
    const cogs = safeRobux > 0 ? Math.round((robuxSold / safeRobux) * safeCost) : 0;
    const grossProfit = revenue - cogs;
    const margin = revenue > 0 ? (grossProfit / revenue) * 100 : null;

    return {
      percentage: percent,
      robuxSold,
      revenue,
      cogs,
      grossProfit,
      margin,
    };
  });
}
