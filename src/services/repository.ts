import { AppSettings, BatchAllocation, Cashflow, Investor, StockBatch, StockMovement, Transaction } from '../types';
import { allocateStockFIFO, calculateTransactionFinancials } from '../utils/calculations';
import { generateBatchCode, generateTransactionCode, getJakartaCurrentDate } from '../utils/formatters';
import { getDatabase, persistDatabase } from './db';

const DEFAULT_SETTINGS: AppSettings = {
  store_name: 'JUFA STORE',
  currency: 'IDR',
  default_rate: 165,
  small_pack_threshold: 100,
  small_pack_rate: 170,
  large_pack_rate: 160,
  min_stock_alert: 500,
  payment_methods: [], // Kosongkan agar pengguna menambah manual
  expense_categories: [
    'Biaya Admin Bank',
    'Biaya Marketplace',
    'Internet & Pulsa',
    'Promosi & Iklan',
    'Operasional Lainnya',
  ],
  suppliers: [], // Kosongkan agar pengguna menambah manual
  sales_sources: ['WhatsApp', 'Itemku', 'Shopee', 'Discord', 'Langsung/COD', 'Instagram'],
  stock_method: 'FIFO',
};

// ==========================================
// SETTINGS
// ==========================================
export async function getSettings(): Promise<AppSettings> {
  const db = await getDatabase();
  const res = db.exec("SELECT value FROM settings WHERE key = 'app_settings'");
  if (res.length > 0 && res[0].values.length > 0) {
    try {
      const parsed = JSON.parse(res[0].values[0][0] as string);
      return { ...DEFAULT_SETTINGS, ...parsed };
    } catch {
      return DEFAULT_SETTINGS;
    }
  }
  // Store defaults
  await saveSettings(DEFAULT_SETTINGS);
  return DEFAULT_SETTINGS;
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  const db = await getDatabase();
  const val = JSON.stringify(settings);
  db.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('app_settings', ?)", [val]);
  await persistDatabase();
}

/**
 * Reset and completely wipe all transactions, batches, stock movements, and cashflows
 * Leaving settings intact.
 */
export async function resetAllDataToEmpty(): Promise<void> {
  const db = await getDatabase();
  db.exec(`
    DELETE FROM transactions;
    DELETE FROM batches;
    DELETE FROM stock_movements;
    DELETE FROM cashflows;
  `);
  await persistDatabase();
}

// ==========================================
// BATCHES / RESTOCK
// ==========================================
export async function getAllBatches(): Promise<StockBatch[]> {
  const db = await getDatabase();
  const res = db.exec('SELECT * FROM batches ORDER BY date DESC, created_at DESC');
  if (res.length === 0) return [];
  const cols = res[0].columns;
  return res[0].values.map(row => {
    const obj: any = {};
    cols.forEach((col, i) => {
      obj[col] = row[i];
    });
    return obj as StockBatch;
  });
}

export async function addBatch(
  data: Omit<StockBatch, 'id' | 'batch_code' | 'created_at' | 'remaining_quantity'>
): Promise<StockBatch> {
  const db = await getDatabase();
  const id = 'batch_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
  const batch_code = generateBatchCode();
  const created_at = getJakartaCurrentDate();
  const remaining_quantity = data.initial_quantity;

  db.run(
    `INSERT INTO batches (
      id, batch_code, date, supplier, initial_quantity, remaining_quantity,
      purchase_cost, extra_cost, discount, total_cost, cost_per_unit,
      payment_method, payment_status, notes, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      batch_code,
      data.date,
      data.supplier,
      data.initial_quantity,
      remaining_quantity,
      data.purchase_cost,
      data.extra_cost,
      data.discount,
      data.total_cost,
      data.cost_per_unit,
      data.payment_method,
      data.payment_status,
      data.notes || '',
      created_at,
    ]
  );

  // Record Stock Movement
  const movId = 'mov_' + Date.now();
  db.run(
    `INSERT INTO stock_movements (id, date, type, quantity, batch_id, batch_code, reference_id, notes, created_at)
     VALUES (?, ?, 'PURCHASE', ?, ?, ?, ?, ?, ?)`,
    [
      movId,
      data.date,
      data.initial_quantity,
      id,
      batch_code,
      batch_code,
      `Pembelian stok dari ${data.supplier}`,
      created_at,
    ]
  );

  // Record Cashflow Out if payment is LUNAS
  if (data.payment_status === 'LUNAS' && data.total_cost > 0) {
    const cfId = 'cf_' + Date.now();
    db.run(
      `INSERT INTO cashflows (id, date, type, category, amount, payment_method, reference_id, notes, created_at)
       VALUES (?, ?, 'OUT', 'PEMBELIAN_STOK', ?, ?, ?, ?, ?)`,
      [
        cfId,
        data.date,
        data.total_cost,
        data.payment_method,
        id,
        `Restock Robux (${data.initial_quantity.toLocaleString('id-ID')} R$) batch ${batch_code}`,
        created_at,
      ]
    );
  }

  await persistDatabase();

  return {
    id,
    batch_code,
    remaining_quantity,
    created_at,
    ...data,
  };
}

// ==========================================
// TRANSACTIONS
// ==========================================
export async function getAllTransactions(): Promise<Transaction[]> {
  const db = await getDatabase();
  const res = db.exec('SELECT * FROM transactions ORDER BY date DESC, created_at DESC');
  if (res.length === 0) return [];
  const cols = res[0].columns;
  return res[0].values.map(row => {
    const obj: any = {};
    cols.forEach((col, i) => {
      obj[col] = row[i];
    });
    if (typeof obj.batch_allocations === 'string') {
      try {
        obj.batch_allocations = JSON.parse(obj.batch_allocations);
      } catch {
        obj.batch_allocations = [];
      }
    }
    return obj as Transaction;
  });
}

export interface TransactionInput {
  date: string;
  customer_name?: string;
  quantity: number;
  sell_rate: number;
  discount?: number;
  fee?: number;
  payment_method: string;
  payment_status?: 'LUNAS' | 'BELUM_LUNAS' | 'SEBAGIAN';
  amount_paid?: number;
  delivery_status?: 'SELESAI' | 'SEBAGIAN' | 'BELUM_DIKIRIM';
  notes?: string;
  source?: string;
}

/**
 * Save multiple transactions atomically in a single SQLite transaction
 */
export async function saveMultipleTransactions(inputs: TransactionInput[]): Promise<Transaction[]> {
  if (!inputs || inputs.length === 0) return [];
  const db = await getDatabase();

  // Load all batches to calculate FIFO
  const batches = await getAllBatches();
  const totalStockAvailable = batches.reduce((sum, b) => sum + b.remaining_quantity, 0);
  const totalQtyNeeded = inputs.reduce((sum, item) => sum + (item.quantity || 0), 0);

  if (totalQtyNeeded > totalStockAvailable) {
    throw new Error(
      `Stok tidak mencukupi! Dibutuhkan: ${totalQtyNeeded.toLocaleString('id-ID')} R$, Tersedia: ${totalStockAvailable.toLocaleString('id-ID')} R$`
    );
  }

  const createdTransactions: Transaction[] = [];
  const activeBatches = JSON.parse(JSON.stringify(batches)) as StockBatch[];

  db.exec('BEGIN TRANSACTION;');

  try {
    let index = 1;
    for (const input of inputs) {
      const fifo = allocateStockFIFO(input.quantity, activeBatches);
      if (!fifo.success) {
        throw new Error(`Gagal alokasi stok FIFO untuk transaksi ${index}`);
      }

      // Update in-memory activeBatches for next transaction in the batch
      fifo.updatedBatches.forEach(up => {
        const b = activeBatches.find(x => x.id === up.id);
        if (b) b.remaining_quantity = up.newRemainingQuantity;
      });

      const calculated = calculateTransactionFinancials(
        input.quantity,
        input.sell_rate,
        input.discount || 0,
        input.fee || 0,
        fifo.totalCogs,
        input.amount_paid
      );

      // Pastikan status pembayaran dan delivery menghormati pilihan eksplisit pengguna
      const payment_status = input.payment_status || (input.amount_paid !== undefined && input.amount_paid >= calculated.netRevenue ? 'LUNAS' : calculated.paymentStatus);
      const delivery_status = input.delivery_status || 'SELESAI';
      const actual_amount_paid = input.amount_paid !== undefined 
        ? input.amount_paid 
        : (payment_status === 'LUNAS' ? calculated.netRevenue : calculated.amountPaid);
      const accounts_receivable = payment_status === 'LUNAS' 
        ? 0 
        : Math.max(0, calculated.netRevenue - actual_amount_paid);

      const id = 'trx_' + Date.now() + '_' + index + '_' + Math.random().toString(36).substr(2, 4);
      const transaction_code = generateTransactionCode(index);
      const created_at = getJakartaCurrentDate();
      const notes = input.notes || '';
      const source = input.source || 'Langsung';
      const customer_name = input.customer_name || 'Pelanggan Umum';

      // Insert transaction dengan data yang presisi
      db.run(
        `INSERT INTO transactions (
          id, transaction_code, date, customer_name, quantity, sell_rate,
          gross_revenue, discount, net_revenue, cogs, fee, gross_profit, net_profit,
          margin_percentage, payment_method, payment_status, amount_paid, accounts_receivable,
          delivery_status, notes, source, batch_allocations, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?)`,
        [
          id,
          transaction_code,
          input.date,
          customer_name,
          input.quantity,
          input.sell_rate,
          calculated.grossRevenue,
          calculated.discount,
          calculated.netRevenue,
          calculated.cogs,
          calculated.fee,
          calculated.grossProfit,
          calculated.netProfit,
          calculated.marginPercentage,
          input.payment_method,
          payment_status,
          actual_amount_paid,
          accounts_receivable,
          delivery_status,
          notes,
          source,
          JSON.stringify(fifo.allocations),
          created_at,
          created_at,
        ]
      );

      // Deduct batches in database
      for (const alloc of fifo.allocations) {
        db.run('UPDATE batches SET remaining_quantity = remaining_quantity - ? WHERE id = ?', [
          alloc.quantity,
          alloc.batch_id,
        ]);

        // Record stock movement
        const movId = 'mov_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
        db.run(
          `INSERT INTO stock_movements (id, date, type, quantity, batch_id, batch_code, reference_id, notes, created_at)
           VALUES (?, ?, 'SALE', ?, ?, ?, ?, ?, ?)`,
          [
            movId,
            input.date,
            alloc.quantity,
            alloc.batch_id,
            alloc.batch_code,
            transaction_code,
            `Penjualan ke ${customer_name}`,
            created_at,
          ]
        );
      }

      // Record cashflow IN if actual_amount_paid > 0
      if (actual_amount_paid > 0) {
        const cfId = 'cf_' + Date.now() + '_' + index;
        db.run(
          `INSERT INTO cashflows (id, date, type, category, amount, payment_method, reference_id, notes, created_at)
           VALUES (?, ?, 'IN', 'PENDAPATAN_PENJUALAN', ?, ?, ?, ?, ?)`,
          [
            cfId,
            input.date,
            actual_amount_paid,
            input.payment_method,
            id,
            `Penjualan ${input.quantity.toLocaleString('id-ID')} R$ (${transaction_code})`,
            created_at,
          ]
        );
      }

      // Record fee as cashflow OUT if fee > 0
      if (calculated.fee > 0) {
        const feeCfId = 'cf_fee_' + Date.now() + '_' + index;
        db.run(
          `INSERT INTO cashflows (id, date, type, category, amount, payment_method, reference_id, notes, created_at)
           VALUES (?, ?, 'OUT', 'BIAYA_TRANSAKSI', ?, ?, ?, ?, ?)`,
          [
            feeCfId,
            input.date,
            calculated.fee,
            input.payment_method,
            id,
            `Biaya transaksi ${transaction_code}`,
            created_at,
          ]
        );
      }

      createdTransactions.push({
        id,
        transaction_code,
        date: input.date,
        customer_name,
        quantity: input.quantity,
        sell_rate: input.sell_rate,
        gross_revenue: calculated.grossRevenue,
        discount: calculated.discount,
        net_revenue: calculated.netRevenue,
        cogs: calculated.cogs,
        fee: calculated.fee,
        gross_profit: calculated.grossProfit,
        net_profit: calculated.netProfit,
        margin_percentage: calculated.marginPercentage,
        payment_method: input.payment_method,
        payment_status,
        amount_paid: actual_amount_paid,
        accounts_receivable,
        delivery_status,
        notes,
        source,
        batch_allocations: fifo.allocations,
        status: 'ACTIVE',
        created_at,
        updated_at: created_at,
      });

      index++;
    }

    db.exec('COMMIT;');
  } catch (err) {
    db.exec('ROLLBACK;');
    throw err;
  }

  await persistDatabase();
  return createdTransactions;
}

/**
 * Cancel Transaction safely
 * Restores remaining quantity to the original batches and logs CANCELLATION_RESTORE
 */
export async function cancelTransaction(id: string, reason = 'Dibatalkan'): Promise<void> {
  const db = await getDatabase();
  const trxs = await getAllTransactions();
  const trx = trxs.find(t => t.id === id);
  if (!trx) throw new Error('Transaksi tidak ditemukan!');
  if (trx.status !== 'ACTIVE') throw new Error('Hanya transaksi aktif yang dapat dibatalkan!');

  db.exec('BEGIN TRANSACTION;');
  try {
    const now = getJakartaCurrentDate();

    // 1. Restore stock to batches
    for (const alloc of trx.batch_allocations) {
      db.run('UPDATE batches SET remaining_quantity = remaining_quantity + ? WHERE id = ?', [
        alloc.quantity,
        alloc.batch_id,
      ]);

      const movId = 'mov_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
      db.run(
        `INSERT INTO stock_movements (id, date, type, quantity, batch_id, batch_code, reference_id, notes, created_at)
         VALUES (?, ?, 'CANCELLATION_RESTORE', ?, ?, ?, ?, ?, ?)`,
        [
          movId,
          now,
          alloc.quantity,
          alloc.batch_id,
          alloc.batch_code,
          trx.transaction_code,
          `Pembatalan transaksi ${trx.transaction_code}: ${reason}`,
          now,
        ]
      );
    }

    // 2. Adjust cashflow if amount was paid
    if (trx.amount_paid > 0) {
      const cfId = 'cf_cancel_' + Date.now();
      db.run(
        `INSERT INTO cashflows (id, date, type, category, amount, payment_method, reference_id, notes, created_at)
         VALUES (?, ?, 'OUT', 'PENGEMBALIAN_DANA', ?, ?, ?, ?, ?)`,
        [
          cfId,
          now,
          trx.amount_paid,
          trx.payment_method,
          trx.id,
          `Pengembalian dana pembatalan ${trx.transaction_code}`,
          now,
        ]
      );
    }

    // 3. Update transaction status
    db.run(
      "UPDATE transactions SET status = 'CANCELLED', notes = notes || ?, updated_at = ? WHERE id = ?",
      [` [DIBATALKAN: ${reason}]`, now, id]
    );

    db.exec('COMMIT;');
  } catch (err) {
    db.exec('ROLLBACK;');
    throw err;
  }

  await persistDatabase();
}

/**
 * Refund Transaction
 */
export async function refundTransaction(
  id: string,
  refundAmount: number,
  restoreStock = true,
  reason = 'Pengembalian Dana'
): Promise<void> {
  const db = await getDatabase();
  const trxs = await getAllTransactions();
  const trx = trxs.find(t => t.id === id);
  if (!trx) throw new Error('Transaksi tidak ditemukan!');

  db.exec('BEGIN TRANSACTION;');
  try {
    const now = getJakartaCurrentDate();

    if (restoreStock && trx.status === 'ACTIVE') {
      for (const alloc of trx.batch_allocations) {
        db.run('UPDATE batches SET remaining_quantity = remaining_quantity + ? WHERE id = ?', [
          alloc.quantity,
          alloc.batch_id,
        ]);

        const movId = 'mov_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
        db.run(
          `INSERT INTO stock_movements (id, date, type, quantity, batch_id, batch_code, reference_id, notes, created_at)
           VALUES (?, ?, 'REFUND_RESTORE', ?, ?, ?, ?, ?, ?)`,
          [
            movId,
            now,
            alloc.quantity,
            alloc.batch_id,
            alloc.batch_code,
            trx.transaction_code,
            `Refund stok ${trx.transaction_code}: ${reason}`,
            now,
          ]
        );
      }
    }

    // Record cashflow OUT
    if (refundAmount > 0) {
      const cfId = 'cf_ref_' + Date.now();
      db.run(
        `INSERT INTO cashflows (id, date, type, category, amount, payment_method, reference_id, notes, created_at)
         VALUES (?, ?, 'OUT', 'PENGEMBALIAN_DANA', ?, ?, ?, ?, ?)`,
        [
          cfId,
          now,
          refundAmount,
          trx.payment_method,
          trx.id,
          `Refund pelanggan untuk ${trx.transaction_code} (${reason})`,
          now,
        ]
      );
    }

    db.run(
      "UPDATE transactions SET status = 'REFUNDED', notes = notes || ?, updated_at = ? WHERE id = ?",
      [` [DI-REFUND Rp${refundAmount.toLocaleString('id-ID')}: ${reason}]`, now, id]
    );

    db.exec('COMMIT;');
  } catch (err) {
    db.exec('ROLLBACK;');
    throw err;
  }

  await persistDatabase();
}

/**
 * Record Stock Adjustment (Add or Sub)
 */
export async function addStockAdjustment(
  type: 'ADJUSTMENT_ADD' | 'ADJUSTMENT_SUB',
  quantity: number,
  reason: string,
  batchId?: string
): Promise<void> {
  const db = await getDatabase();
  const batches = await getAllBatches();
  const now = getJakartaCurrentDate();

  if (type === 'ADJUSTMENT_SUB') {
    const totalAvail = batches.reduce((sum, b) => sum + b.remaining_quantity, 0);
    if (quantity > totalAvail) {
      throw new Error(`Pengurangan stok (${quantity}) melebihi stok yang tersedia (${totalAvail})!`);
    }
  }

  db.exec('BEGIN TRANSACTION;');
  try {
    if (batchId) {
      const batch = batches.find(b => b.id === batchId);
      if (!batch) throw new Error('Batch tidak ditemukan!');
      const change = type === 'ADJUSTMENT_ADD' ? quantity : -quantity;
      if (batch.remaining_quantity + change < 0) {
        throw new Error('Penyesuaian membuat stok batch negatif!');
      }
      db.run('UPDATE batches SET remaining_quantity = remaining_quantity + ? WHERE id = ?', [
        change,
        batchId,
      ]);

      const movId = 'mov_' + Date.now();
      db.run(
        `INSERT INTO stock_movements (id, date, type, quantity, batch_id, batch_code, reference_id, notes, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [movId, now, type, quantity, batch.id, batch.batch_code, 'ADJUSTMENT', reason, now]
      );
    } else {
      if (type === 'ADJUSTMENT_SUB') {
        // Reduce from oldest batches
        let needed = quantity;
        const sorted = batches.filter(b => b.remaining_quantity > 0).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        for (const b of sorted) {
          if (needed <= 0) break;
          const take = Math.min(b.remaining_quantity, needed);
          db.run('UPDATE batches SET remaining_quantity = remaining_quantity - ? WHERE id = ?', [
            take,
            b.id,
          ]);
          needed -= take;

          const movId = 'mov_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
          db.run(
            `INSERT INTO stock_movements (id, date, type, quantity, batch_id, batch_code, reference_id, notes, created_at)
             VALUES (?, ?, 'ADJUSTMENT_SUB', ?, ?, ?, 'ADJUSTMENT', ?, ?)`,
            [movId, now, take, b.id, b.batch_code, reason, now]
          );
        }
      } else {
        // If adding stock without batch, create an adjustment batch with cost = 0 or latest cost
        const latestBatch = batches[0];
        const cost = latestBatch ? latestBatch.cost_per_unit : 0;
        const newBatchCode = generateBatchCode();
        const newBatchId = 'batch_adj_' + Date.now();
        db.run(
          `INSERT INTO batches (
            id, batch_code, date, supplier, initial_quantity, remaining_quantity,
            purchase_cost, extra_cost, discount, total_cost, cost_per_unit,
            payment_method, payment_status, notes, created_at
          ) VALUES (?, ?, ?, 'Penyesuaian Manual', ?, ?, 0, 0, 0, 0, ?, 'Manual', 'LUNAS', ?, ?)`,
          [newBatchId, newBatchCode, now, quantity, quantity, cost, reason, now]
        );
        const movId = 'mov_' + Date.now();
        db.run(
          `INSERT INTO stock_movements (id, date, type, quantity, batch_id, batch_code, reference_id, notes, created_at)
           VALUES (?, ?, 'ADJUSTMENT_ADD', ?, ?, ?, 'ADJUSTMENT', ?, ?)`,
          [movId, now, quantity, newBatchId, newBatchCode, reason, now]
        );
      }
    }
    db.exec('COMMIT;');
  } catch (err) {
    db.exec('ROLLBACK;');
    throw err;
  }

  await persistDatabase();
}

// ==========================================
// CASHFLOW & FINANCIAL
// ==========================================
export async function getAllCashflows(): Promise<Cashflow[]> {
  const db = await getDatabase();
  const res = db.exec('SELECT * FROM cashflows ORDER BY date DESC, created_at DESC');
  if (res.length === 0) return [];
  const cols = res[0].columns;
  return res[0].values.map(row => {
    const obj: any = {};
    cols.forEach((col, i) => {
      obj[col] = row[i];
    });
    return obj as Cashflow;
  });
}

export async function addCashflow(entry: Omit<Cashflow, 'id' | 'created_at'>): Promise<Cashflow> {
  const db = await getDatabase();
  const id = 'cf_manual_' + Date.now();
  const created_at = getJakartaCurrentDate();

  db.run(
    `INSERT INTO cashflows (id, date, type, category, amount, payment_method, reference_id, notes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      entry.date,
      entry.type,
      entry.category,
      entry.amount,
      entry.payment_method,
      entry.reference_id || 'MANUAL',
      entry.notes || '',
      created_at,
    ]
  );

  await persistDatabase();

  return {
    id,
    created_at,
    ...entry,
  };
}

export async function getAllStockMovements(): Promise<StockMovement[]> {
  const db = await getDatabase();
  const res = db.exec('SELECT * FROM stock_movements ORDER BY date DESC, created_at DESC');
  if (res.length === 0) return [];
  const cols = res[0].columns;
  return res[0].values.map(row => {
    const obj: any = {};
    cols.forEach((col, i) => {
      obj[col] = row[i];
    });
    return obj as StockMovement;
  });
}

// ==========================================
// INVESTORS & PROFIT SHARING
// ==========================================
export async function getAllInvestors(): Promise<Investor[]> {
  const db = await getDatabase();
  const res = db.exec('SELECT * FROM investors ORDER BY created_at DESC');
  if (res.length === 0) return [];
  const cols = res[0].columns;
  return res[0].values.map(row => {
    const obj: any = {};
    cols.forEach((col, i) => {
      obj[col] = row[i];
    });
    return obj as Investor;
  });
}

export async function addInvestor(
  data: Omit<Investor, 'id' | 'created_at'>
): Promise<Investor> {
  const db = await getDatabase();
  const id = 'inv_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
  const created_at = getJakartaCurrentDate();

  db.run(
    `INSERT INTO investors (
      id, name, invested_amount, share_percentage, duration_months,
      start_date, status, notes, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      data.name,
      data.invested_amount,
      data.share_percentage,
      data.duration_months,
      data.start_date,
      data.status || 'AKTIF',
      data.notes || '',
      created_at,
    ]
  );

  await persistDatabase();

  return {
    id,
    created_at,
    ...data,
  };
}

export async function updateInvestor(
  id: string,
  data: Partial<Omit<Investor, 'id' | 'created_at'>>
): Promise<void> {
  const db = await getDatabase();
  const fields: string[] = [];
  const values: any[] = [];

  Object.entries(data).forEach(([key, val]) => {
    fields.push(`${key} = ?`);
    values.push(val);
  });

  if (fields.length === 0) return;

  values.push(id);
  db.run(`UPDATE investors SET ${fields.join(', ')} WHERE id = ?`, values);
  await persistDatabase();
}

export async function deleteInvestor(id: string): Promise<void> {
  const db = await getDatabase();
  db.run('DELETE FROM investors WHERE id = ?', [id]);
  await persistDatabase();
}
