import { BatchAllocation, SalesCalculatorInput, SalesCalculatorResult, StockBatch } from '../types';

/**
 * Safe division to prevent division by zero or NaN/Infinity
 */
export function safeDivide(numerator: number, denominator: number, fallback = 0): number {
  if (!denominator || isNaN(denominator) || !isFinite(denominator) || denominator === 0) {
    return fallback;
  }
  const result = numerator / denominator;
  return isFinite(result) && !isNaN(result) ? result : fallback;
}

/**
 * Calculate Restock Unit Cost
 * Total Cost = purchase_cost + extra_cost - discount
 * Unit Cost = Total Cost / initial_quantity
 */
export function calculateRestockCost(
  purchaseCost: number,
  extraCost: number,
  discount: number,
  quantity: number
): { totalCost: number; costPerUnit: number } {
  const totalCost = Math.max(0, (purchaseCost || 0) + (extraCost || 0) - (discount || 0));
  const costPerUnit = safeDivide(totalCost, quantity, 0);
  return {
    totalCost: Math.round(totalCost),
    costPerUnit: Number(costPerUnit.toFixed(4)),
  };
}

/**
 * Calculate Single Transaction Financials given COGS
 */
export function calculateTransactionFinancials(
  quantity: number,
  sellRate: number,
  discount = 0,
  fee = 0,
  cogs = 0,
  amountPaid?: number
) {
  const safeQty = Math.max(0, quantity || 0);
  const safeRate = Math.max(0, sellRate || 0);
  const grossRevenue = Math.round(safeQty * safeRate);
  const safeDiscount = Math.max(0, Math.min(grossRevenue, discount || 0));
  const netRevenue = Math.round(grossRevenue - safeDiscount);
  const safeFee = Math.max(0, fee || 0);
  const safeCogs = Math.max(0, cogs || 0);

  const grossProfit = Math.round(netRevenue - safeCogs);
  const netProfit = Math.round(grossProfit - safeFee);

  const marginPercentage = netRevenue > 0
    ? Number(((netProfit / netRevenue) * 100).toFixed(2))
    : 0;

  // Partial payment handling
  const paid = amountPaid !== undefined ? Math.max(0, amountPaid) : netRevenue;
  const accountsReceivable = Math.max(0, Math.round(netRevenue - paid));

  let paymentStatus: 'LUNAS' | 'BELUM_LUNAS' | 'SEBAGIAN' = 'LUNAS';
  if (paid <= 0 && netRevenue > 0) {
    paymentStatus = 'BELUM_LUNAS';
  } else if (paid < netRevenue) {
    paymentStatus = 'SEBAGIAN';
  }

  return {
    grossRevenue,
    discount: safeDiscount,
    netRevenue,
    cogs: safeCogs,
    fee: safeFee,
    grossProfit,
    netProfit,
    marginPercentage,
    amountPaid: paid,
    accountsReceivable,
    paymentStatus,
  };
}

/**
 * FIFO Stock Allocation Engine
 * Given required quantity and available stock batches (sorted ascending by date/id),
 * allocate stock and calculate accurate COGS without mutating original array directly.
 */
export function allocateStockFIFO(
  requiredQty: number,
  availableBatches: StockBatch[]
): {
  success: boolean;
  allocations: BatchAllocation[];
  totalCogs: number;
  remainingShortage: number;
  updatedBatches: { id: string; newRemainingQuantity: number }[];
} {
  let needed = Math.max(0, requiredQty);
  let totalCogs = 0;
  const allocations: BatchAllocation[] = [];
  const updatedBatches: { id: string; newRemainingQuantity: number }[] = [];

  // Filter only batches that have remaining stock > 0
  const sorted = [...availableBatches]
    .filter(b => b.remaining_quantity > 0)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  for (const batch of sorted) {
    if (needed <= 0) break;

    const take = Math.min(batch.remaining_quantity, needed);
    if (take > 0) {
      const subtotal = Math.round(take * batch.cost_per_unit);
      allocations.push({
        batch_id: batch.id,
        batch_code: batch.batch_code,
        quantity: take,
        cost_per_unit: batch.cost_per_unit,
        subtotal_cost: subtotal,
      });
      totalCogs += subtotal;
      needed -= take;
      updatedBatches.push({
        id: batch.id,
        newRemainingQuantity: batch.remaining_quantity - take,
      });
    }
  }

  return {
    success: needed === 0,
    allocations,
    totalCogs,
    remainingShortage: needed,
    updatedBatches,
  };
}

/**
 * Quick Sales Calculator
 */
export function calculateQuickSales(input: SalesCalculatorInput): SalesCalculatorResult {
  const qty = Math.max(0, input.quantity || 0);
  const rate = Math.max(0, input.sell_rate || 0);
  const cost = Math.max(0, input.cost_per_unit || 0);

  const normalPrice = Math.round(qty * rate);

  // Discount: nominal + percent
  let discount = Math.max(0, input.discount_nominal || 0);
  if (input.discount_percent > 0) {
    discount += Math.round((normalPrice * input.discount_percent) / 100);
  }
  discount = Math.min(normalPrice, discount);
  const finalPrice = Math.round(normalPrice - discount);

  const totalCogs = Math.round(qty * cost);

  // Fee: nominal + percent of final price
  let fee = Math.max(0, input.fee_nominal || 0);
  if (input.fee_percent > 0) {
    fee += Math.round((finalPrice * input.fee_percent) / 100);
  }

  const grossProfit = Math.round(finalPrice - totalCogs);
  const netProfit = Math.round(grossProfit - fee);

  const marginPercentage = finalPrice > 0 ? Number(((netProfit / finalPrice) * 100).toFixed(2)) : null;

  // Break-even price total and rate per unit:
  // Break-even requires: finalPrice - totalCogs - fee = 0
  // If fee is purely fixed: finalPrice = totalCogs + fee
  // Break-even per unit rate:
  const breakEvenPrice = qty > 0 ? Number(((totalCogs + fee) / qty).toFixed(2)) : 0;

  let status: 'UNTUNG' | 'IMPAS' | 'RUGI' = 'IMPAS';
  if (netProfit > 0) status = 'UNTUNG';
  else if (netProfit < 0) status = 'RUGI';

  return {
    normal_price: normalPrice,
    normalPrice,
    discount,
    final_price: finalPrice,
    finalPrice,
    total_cogs: totalCogs,
    totalCogs,
    fee,
    gross_profit: grossProfit,
    grossProfit,
    net_profit: netProfit,
    netProfit,
    margin_percentage: marginPercentage,
    marginPercentage,
    break_even_price: breakEvenPrice,
    breakEvenPrice,
    status,
  };
}

/**
 * Weighted Average Selling Price:
 * Total Net Revenue / Total Robux Sold
 */
export function calculateWeightedAverageRate(totalNetRevenue: number, totalRobux: number): number {
  return Number(safeDivide(totalNetRevenue, totalRobux, 0).toFixed(2));
}

/**
 * Daily Sales Average:
 * Mode 1: Divided by all calendar days in range
 * Mode 2: Divided only by active sales days
 */
export function calculateDailyAverage(
  totalValue: number,
  calendarDays: number,
  activeSalesDays: number,
  mode: 'CALENDAR_DAYS' | 'ACTIVE_DAYS' = 'CALENDAR_DAYS'
): number {
  const days = mode === 'CALENDAR_DAYS' ? calendarDays : activeSalesDays;
  return Math.round(safeDivide(totalValue, Math.max(1, days), 0));
}
