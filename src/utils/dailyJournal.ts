import { Cashflow, DailyBreakdown, Transaction } from '../types';

export function computeDailyBreakdowns(
  transactions: Transaction[],
  cashflows: Cashflow[]
): DailyBreakdown[] {
  const map: Record<string, DailyBreakdown> = {};

  // Process Transactions
  transactions.forEach(t => {
    if (t.status === 'CANCELLED') return;
    const dateKey = t.date.slice(0, 10);
    if (!map[dateKey]) {
      map[dateKey] = createEmptyBreakdown(dateKey);
    }
    const b = map[dateKey];
    b.transactionCount += 1;
    b.robuxSold += t.quantity || 0;
    b.grossRevenue += t.gross_revenue || 0;
    b.discount += t.discount || 0;
    b.netRevenue += t.net_revenue || 0;
    b.cogs += t.cogs || 0;
    b.grossProfit += (t.net_revenue || 0) - (t.cogs || 0);
    b.transactionFees += t.fee || 0;
  });

  // Process Cashflows
  cashflows.forEach(c => {
    const dateKey = c.date.slice(0, 10);
    if (!map[dateKey]) {
      map[dateKey] = createEmptyBreakdown(dateKey);
    }
    const b = map[dateKey];

    if (c.type === 'IN') {
      b.totalCashIn += c.amount || 0;
    } else {
      b.totalExpensesOut += c.amount || 0;
      const cat = (c.category || '').toUpperCase();
      if (cat.includes('PEMBELIAN_STOK') || cat.includes('RESTOCK')) {
        b.restockExpense += c.amount || 0;
      } else if (cat.includes('OPERASIONAL') || cat.includes('LISTRIK') || cat.includes('INTERNET') || cat.includes('IKLAN')) {
        b.operationalExpense += c.amount || 0;
      } else if (cat.includes('FEE') || cat.includes('TRANSAKSI')) {
        b.transactionFees += c.amount || 0;
      } else if (cat.includes('PRIVE')) {
        b.priveWithdrawal += c.amount || 0;
      } else if (cat.includes('REFUND') || cat.includes('PENGEMBALIAN')) {
        b.refundExpense += c.amount || 0;
      } else {
        b.otherExpense += c.amount || 0;
      }
    }
  });

  // Finalize Net Values & Sort Descending by Date
  const results = Object.values(map).map(b => {
    b.netCashFlow = b.totalCashIn - b.totalExpensesOut;
    b.netDailyProfit = b.grossProfit - b.transactionFees - b.operationalExpense;
    b.dayLabel = formatDayLabel(b.date);
    return b;
  });

  results.sort((a, b) => b.date.localeCompare(a.date));
  return results;
}

export function compute24HoursSummary(
  transactions: Transaction[],
  cashflows: Cashflow[]
): DailyBreakdown {
  const now = new Date();
  const past24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const breakdown = createEmptyBreakdown('24-hours');
  breakdown.dayLabel = '24 Jam Terakhir';

  transactions.forEach(t => {
    if (t.status === 'CANCELLED') return;
    const d = new Date(t.date);
    if (d >= past24h && d <= now) {
      breakdown.transactionCount += 1;
      breakdown.robuxSold += t.quantity || 0;
      breakdown.grossRevenue += t.gross_revenue || 0;
      breakdown.discount += t.discount || 0;
      breakdown.netRevenue += t.net_revenue || 0;
      breakdown.cogs += t.cogs || 0;
      breakdown.grossProfit += (t.net_revenue || 0) - (t.cogs || 0);
      breakdown.transactionFees += t.fee || 0;
    }
  });

  cashflows.forEach(c => {
    const d = new Date(c.date);
    if (d >= past24h && d <= now) {
      if (c.type === 'IN') {
        breakdown.totalCashIn += c.amount || 0;
      } else {
        breakdown.totalExpensesOut += c.amount || 0;
        const cat = (c.category || '').toUpperCase();
        if (cat.includes('PEMBELIAN_STOK') || cat.includes('RESTOCK')) {
          breakdown.restockExpense += c.amount || 0;
        } else if (cat.includes('OPERASIONAL') || cat.includes('LISTRIK') || cat.includes('INTERNET') || cat.includes('IKLAN')) {
          breakdown.operationalExpense += c.amount || 0;
        } else if (cat.includes('FEE') || cat.includes('TRANSAKSI')) {
          breakdown.transactionFees += c.amount || 0;
        } else if (cat.includes('PRIVE')) {
          breakdown.priveWithdrawal += c.amount || 0;
        } else if (cat.includes('REFUND') || cat.includes('PENGEMBALIAN')) {
          breakdown.refundExpense += c.amount || 0;
        } else {
          breakdown.otherExpense += c.amount || 0;
        }
      }
    }
  });

  breakdown.netCashFlow = breakdown.totalCashIn - breakdown.totalExpensesOut;
  breakdown.netDailyProfit = breakdown.grossProfit - breakdown.transactionFees - breakdown.operationalExpense;
  return breakdown;
}

function createEmptyBreakdown(date: string): DailyBreakdown {
  return {
    date,
    dayLabel: date,
    robuxSold: 0,
    grossRevenue: 0,
    discount: 0,
    netRevenue: 0,
    cogs: 0,
    grossProfit: 0,
    transactionCount: 0,
    restockExpense: 0,
    operationalExpense: 0,
    transactionFees: 0,
    priveWithdrawal: 0,
    refundExpense: 0,
    otherExpense: 0,
    totalExpensesOut: 0,
    totalCashIn: 0,
    netCashFlow: 0,
    netDailyProfit: 0,
  };
}

function formatDayLabel(dateStr: string): string {
  try {
    const [y, m, d] = dateStr.split('-').map(Number);
    const target = new Date(y, m - 1, d);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const diffDays = Math.round((today.getTime() - target.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Hari Ini';
    if (diffDays === 1) return 'Kemarin';
    if (diffDays === 2) return '2 Hari Lalu';

    return new Intl.DateTimeFormat('id-ID', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(target);
  } catch {
    return dateStr;
  }
}
