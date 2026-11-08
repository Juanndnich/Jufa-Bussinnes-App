import { db } from './db';
import {
  StockBatch,
  StockMovement,
  Sale,
  PersonalUsage,
  CashLedgerEntry,
  RatePreset,
  Category,
  AuditLog,
  AppSettings,
  Investor,
  InvestorPayout,
  Loan,
  LoanPayment,
  SavingsEntry,
  SavingsCategory,
} from './schema';
import {
  allocateFifoCost,
  rollbackFifoBatch,
  calculateProfit,
  FifoBatchInput,
} from '../domain/calculations';
import {
  calculateSavingsSummary,
  validateSavingsWithdrawal,
  SavingsSummaryResult,
} from '../domain/savings';
import { generateTransactionCode, generateBatchCode } from '../utils/formatters';

export function getTodayKey(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export const repository = {
  // ===================== PENGATURAN (SETTINGS) =====================
  async getSettings(): Promise<AppSettings> {
    const s = await db.settings.get('current');
    if (!s) {
      const initial: AppSettings = {
        id: 'current',
        storeName: 'JufaStore',
        theme: 'dark',
        accentColor: '#10b981',
        textSize: 'base',
        customLogoUrl: null,
        schemaVersion: 1,
      };
      await db.settings.put(initial);
      return initial;
    }
    return s;
  },

  async updateSettings(updates: Partial<AppSettings>): Promise<void> {
    await db.settings.update('current', updates);
  },

  // ===================== RATE PRESETS =====================
  async getRatePresets(): Promise<RatePreset[]> {
    return db.ratePresets.orderBy('rate').toArray();
  },

  async addRatePreset(rate: number, label?: string): Promise<RatePreset> {
    const item: RatePreset = {
      id: `RATE-${Date.now()}`,
      rate: Number(rate),
      label: label?.trim() || undefined,
      createdAt: new Date().toISOString(),
    };
    await db.ratePresets.put(item);
    return item;
  },

  async deleteRatePreset(id: string): Promise<void> {
    await db.ratePresets.delete(id);
  },

  async updateRatePreset(id: string, updates: { rate?: number; label?: string }): Promise<void> {
    const preset = await db.ratePresets.get(id);
    if (!preset) throw new Error('Preset rate tidak ditemukan');
    if (updates.rate !== undefined) preset.rate = Number(updates.rate);
    if (updates.label !== undefined) preset.label = updates.label.trim() || undefined;
    await db.ratePresets.put(preset);
  },

  // ===================== STOK & FIFO BATCHES =====================
  async getAvailableBatches(): Promise<StockBatch[]> {
    // Diurutkan secara FIFO (paling lama masuk lebih dulu diambil)
    const batches = await db.stockBatches
      .where('remainingRobux')
      .above(0)
      .sortBy('createdAt');
    return batches;
  },

  async getAllBatches(): Promise<StockBatch[]> {
    return db.stockBatches.orderBy('createdAt').reverse().toArray();
  },

  async getTotalStockSummary(): Promise<{
    totalRemainingRobux: number;
    totalRemainingCostRupiah: number;
    activeBatchCount: number;
    averageCostPerRobux: number;
  }> {
    const batches = await this.getAvailableBatches();
    let totalRemainingRobux = 0;
    let totalRemainingCostRupiah = 0;

    for (const b of batches) {
      totalRemainingRobux += b.remainingRobux;
      totalRemainingCostRupiah += b.remainingCostRupiah;
    }

    return {
      totalRemainingRobux,
      totalRemainingCostRupiah,
      activeBatchCount: batches.length,
      averageCostPerRobux:
        totalRemainingRobux > 0
          ? totalRemainingCostRupiah / totalRemainingRobux
          : 0,
    };
  },

  /**
   * Catat Pembelian Stok Baru (Restock)
   * Mendukung sumber dana sendiri (Kas Toko) atau pinjaman (Utang Modal).
   */
  async createRestockBatch(params: {
    robux: number;
    totalCostRupiah: number;
    notes?: string;
    fundingSource?: 'OWN_FUNDS' | 'LOAN' | 'COMBINED';
    ownFundsRupiah?: number;
    loanFundsRupiah?: number;
    loanDetails?: {
      lenderName: string;
      dueDate: string; // YYYY-MM-DD
      notes?: string;
    };
  }): Promise<StockBatch> {
    const robux = Math.max(0, Math.floor(params.robux || 0));
    const totalCost = Math.max(0, Math.floor(params.totalCostRupiah || 0));

    if (robux <= 0) throw new Error('Jumlah Robux harus lebih besar dari 0');
    if (totalCost < 0) throw new Error('Biaya modal tidak valid');

    const now = new Date().toISOString();
    const batchId = generateBatchCode();
    const unitCostDisplay = robux > 0 ? totalCost / robux : 0;
    const fundingSource = params.fundingSource || 'OWN_FUNDS';

    let ownFunds = 0;
    let loanFunds = 0;

    if (fundingSource === 'OWN_FUNDS') {
      ownFunds = totalCost;
      loanFunds = 0;
    } else if (fundingSource === 'LOAN') {
      ownFunds = 0;
      loanFunds = totalCost;
    } else if (fundingSource === 'COMBINED') {
      ownFunds = Math.max(0, Math.floor(params.ownFundsRupiah ?? 0));
      loanFunds = Math.max(0, Math.floor(params.loanFundsRupiah ?? (totalCost - ownFunds)));
    }

    let loanId: string | undefined = undefined;

    const newBatch: StockBatch = {
      id: batchId,
      createdAt: now,
      sourceType: 'RESTOCK',
      initialRobux: robux,
      remainingRobux: robux,
      totalCostRupiah: totalCost,
      remainingCostRupiah: totalCost,
      unitCostDisplay,
      fundingSource,
      ownFundsRupiah: ownFunds,
      loanFundsRupiah: loanFunds,
      loanId: undefined,
      notes: params.notes?.trim() || undefined,
    };

    let newLoan: Loan | null = null;
    if (loanFunds > 0) {
      loanId = `LOAN-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      newBatch.loanId = loanId;
      newLoan = {
        id: loanId,
        batchId,
        borrowerOrLender: params.loanDetails?.lenderName.trim() || 'Pinjaman Modal',
        loanAmountRupiah: loanFunds,
        remainingLoanRupiah: loanFunds,
        dueDate: params.loanDetails?.dueDate || getTodayKey(),
        status: 'ACTIVE',
        notes: params.loanDetails?.notes?.trim() || params.notes?.trim() || undefined,
        createdAt: now,
        payments: [],
      };
    }

    const movement: StockMovement = {
      id: `MOV-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      batchId,
      type: 'RESTOCK',
      robuxAmount: robux,
      costAllocatedRupiah: totalCost,
      referenceId: batchId,
      createdAt: now,
    };

    const cashEntry: CashLedgerEntry = {
      id: `CASH-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      dateKey: getTodayKey(),
      createdAt: now,
      type: 'OUT',
      amountRupiah: ownFunds,
      sourceType: 'RESTOCK',
      sourceId: batchId,
      notes:
        fundingSource === 'COMBINED'
          ? `Restock ${robux.toLocaleString('id-ID')} R$ (Porsi Kas Sendiri Rp${ownFunds.toLocaleString('id-ID')})`
          : `Restock ${robux.toLocaleString('id-ID')} R$`,
    };

    const audit: AuditLog = {
      id: `LOG-${Date.now()}`,
      action: 'CREATE_RESTOCK',
      entity: 'stockBatches',
      entityId: batchId,
      details: `Restock ${robux} R$ modal Rp${totalCost.toLocaleString('id-ID')} (Sumber: ${
        fundingSource === 'COMBINED'
          ? `Gabungan Kas Rp${ownFunds.toLocaleString('id-ID')} + Utang Rp${loanFunds.toLocaleString('id-ID')}`
          : fundingSource === 'LOAN'
          ? 'Pinjaman'
          : 'Dana Sendiri'
      })`,
      createdAt: now,
    };

    await db.transaction('rw', [db.stockBatches, db.stockMovements, db.cashLedger, db.auditLogs, db.loans], async () => {
      await db.stockBatches.put(newBatch);
      await db.stockMovements.put(movement);
      if (newLoan) {
        await db.loans.put(newLoan);
      }
      if (ownFunds > 0) {
        // Hanya memotong kas toko untuk porsi uang sendiri
        await db.cashLedger.put(cashEntry);
      }
      await db.auditLogs.put(audit);
    });

    return newBatch;
  },

  /**
   * Catat Sisa Robux Akun Roblox (Tambahan di luar pencatatan)
   * TIDAK mengubah saldo kas dan BUKAN pendapatan (Rule 6.4).
   */
  async createAccountRemainderBatch(params: {
    robux: number;
    modalPerRobux: number;
    notes?: string;
  }): Promise<StockBatch> {
    const robux = Math.max(0, Math.floor(params.robux || 0));
    const modalPerRobux = Math.max(0, Number(params.modalPerRobux) || 0);

    if (robux <= 0) throw new Error('Jumlah Robux harus lebih besar dari 0');

    const totalCost = Math.round(robux * modalPerRobux);
    const now = new Date().toISOString();
    const batchId = generateBatchCode();

    const newBatch: StockBatch = {
      id: batchId,
      createdAt: now,
      sourceType: 'ACCOUNT_REMAINDER',
      initialRobux: robux,
      remainingRobux: robux,
      totalCostRupiah: totalCost,
      remainingCostRupiah: totalCost,
      unitCostDisplay: modalPerRobux,
      notes: params.notes?.trim() || 'Sisa Robux Akun',
    };

    const movement: StockMovement = {
      id: `MOV-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      batchId,
      type: 'RECONCILE_ADD',
      robuxAmount: robux,
      costAllocatedRupiah: totalCost,
      referenceId: batchId,
      createdAt: now,
    };

    const audit: AuditLog = {
      id: `LOG-${Date.now()}`,
      action: 'CREATE_ACCOUNT_REMAINDER',
      entity: 'stockBatches',
      entityId: batchId,
      details: `Sisa Robux Akun ${robux} R$ modal Rp${modalPerRobux}/R$`,
      createdAt: now,
    };

    await db.transaction('rw', [db.stockBatches, db.stockMovements, db.auditLogs], async () => {
      await db.stockBatches.put(newBatch);
      await db.stockMovements.put(movement);
      await db.auditLogs.put(audit);
    });

    return newBatch;
  },

  /**
   * Edit catatan / keterangan pada Batch Persediaan
   */
  async updateStockBatchNotes(batchId: string, notes: string): Promise<void> {
    const batch = await db.stockBatches.get(batchId);
    if (!batch) throw new Error('Batch tidak ditemukan');

    batch.notes = notes.trim() || undefined;
    await db.stockBatches.put(batch);

    const audit: AuditLog = {
      id: `LOG-${Date.now()}`,
      action: 'UPDATE_BATCH_NOTES',
      entity: 'stockBatches',
      entityId: batchId,
      details: `Ubah catatan batch ${batchId}`,
      createdAt: new Date().toISOString(),
    };
    await db.auditLogs.put(audit);
  },

  /**
   * Hapus batch persediaan (Hanya diizinkan jika stok batch masih 100% utuh / belum terpakai)
   * Jika batch bertipe RESTOCK, entri pengeluaran kas otomatis terkait akan dibatalkan/dihapus.
   */
  async deleteStockBatch(batchId: string): Promise<void> {
    await db.transaction('rw', [db.stockBatches, db.stockMovements, db.cashLedger, db.auditLogs, db.loans], async () => {
      const batch = await db.stockBatches.get(batchId);
      if (!batch) throw new Error('Batch tidak ditemukan');

      if (batch.remainingRobux !== batch.initialRobux) {
        throw new Error('Batch ini sudah terpakai sebagian dan tidak dapat dihapus demi menjaga integritas alokasi FIFO.');
      }

      // Jika ada pinjaman terkait batch ini, hapus juga pinjamannya
      if (batch.loanId) {
        await db.loans.delete(batch.loanId);
      }

      // Jika restock dengan dana sendiri atau gabungan, hapus juga pengeluaran kas terkait
      if (batch.sourceType === 'RESTOCK' && batch.fundingSource !== 'LOAN') {
        const relatedCash = await db.cashLedger
          .filter((c) => c.sourceId === batchId)
          .toArray();
        for (const c of relatedCash) {
          await db.cashLedger.delete(c.id);
        }
      }

      // Hapus movements terkait batch ini
      const movements = await db.stockMovements.where('batchId').equals(batchId).toArray();
      for (const m of movements) {
        await db.stockMovements.delete(m.id);
      }

      // Hapus batch
      await db.stockBatches.delete(batchId);

      // Audit Log
      const audit: AuditLog = {
        id: `LOG-${Date.now()}`,
        action: 'DELETE_BATCH',
        entity: 'stockBatches',
        entityId: batchId,
        details: `Hapus batch ${batchId} (${batch.initialRobux} R$ modal Rp${batch.totalCostRupiah})`,
        createdAt: new Date().toISOString(),
      };
      await db.auditLogs.put(audit);
    });
  },

  /**
   * Edit Jumlah Robux Awal pada Batch yang Sudah Ditambahkan
   * Mendukung Pilihan A (Total modal tetap) dan Pilihan B (Harga per Robux tetap).
   */
  async editBatchInitialRobux(params: {
    batchId: string;
    newInitialRobux: number;
    reason: string;
    costMode: 'KEEP_TOTAL_COST' | 'KEEP_UNIT_COST';
  }): Promise<{ batch: StockBatch; movement: StockMovement }> {
    const reasonClean = params.reason?.trim();
    if (!reasonClean) {
      throw new Error('Alasan perubahan jumlah batch wajib diisi.');
    }

    const newInitial = Math.max(0, Math.floor(params.newInitialRobux || 0));
    if (newInitial <= 0) {
      throw new Error('Jumlah Robux baru harus lebih besar dari 0.');
    }

    const now = new Date().toISOString();

    return await db.transaction('rw', [db.stockBatches, db.stockMovements, db.cashLedger, db.auditLogs, db.loans], async () => {
      const batch = await db.stockBatches.get(params.batchId);
      if (!batch) {
        throw new Error('Batch tidak ditemukan.');
      }

      const usedRobux = batch.initialRobux - batch.remainingRobux;
      if (newInitial < usedRobux) {
        throw new Error(
          `Jumlah Robux baru (${newInitial.toLocaleString('id-ID')} R$) tidak boleh lebih kecil dari Robux yang sudah terpakai/terjual (${usedRobux.toLocaleString('id-ID')} R$).`
        );
      }

      const oldInitial = batch.initialRobux;
      const oldRemaining = batch.remainingRobux;
      const deltaRobux = newInitial - oldInitial;
      const newRemainingRobux = oldRemaining + deltaRobux; // sama dengan newInitial - usedRobux

      const usedCostRupiah = batch.totalCostRupiah - batch.remainingCostRupiah;

      // EDGE CASE Pilihan A (Aturan 2):
      // Jika jumlah baru membuat sisa Robux = 0, tetapi sisa modal batch masih > 0
      if (params.costMode === 'KEEP_TOTAL_COST') {
        const remainingCostBefore = batch.totalCostRupiah - usedCostRupiah;
        if (newRemainingRobux === 0 && remainingCostBefore > 0) {
          throw new Error(
            `Jumlah Robux tidak dapat diubah tepat sejumlah yang sudah terpakai (${usedRobux.toLocaleString('id-ID')} R$) dengan Pilihan A karena masih ada sisa modal Rp${remainingCostBefore.toLocaleString('id-ID')} yang belum teralokasi. Sisakan minimal 1 R$ atau gunakan pilihan penyesuaian modal.`
          );
        }
      }

      // Validasi Matriks Pilihan B (Aturan 3):
      let relatedCash: CashLedgerEntry | undefined = undefined;

      if (params.costMode === 'KEEP_UNIT_COST') {
        if (batch.sourceType === 'ACCOUNT_REMAINDER') {
          throw new Error('Pilihan B tidak tersedia untuk Sisa Robux Akun karena tidak memiliki entri pengeluaran kas ril. Gunakan Pilihan A.');
        }
        if (batch.fundingSource === 'LOAN') {
          throw new Error('Pilihan B tidak tersedia untuk batch bersumber pinjaman modal demi mencegah inkonsistensi buku utang. Gunakan Pilihan A.');
        }
        if (batch.fundingSource === 'COMBINED') {
          throw new Error('Pilihan B tidak tersedia untuk batch bermodal gabungan kas dan pinjaman demi mencegah inkonsistensi porsi dana. Gunakan Pilihan A.');
        }

        // Cari entri kas keluar terkait
        relatedCash = await db.cashLedger
          .filter((c) => c.sourceId === params.batchId && c.sourceType === 'RESTOCK' && c.type === 'OUT')
          .first();

        if (!relatedCash) {
          throw new Error('Pilihan B tidak tersedia karena entri pengeluaran kas terkait tidak ditemukan di buku kas. Gunakan Pilihan A.');
        }
      }

      let newTotalCost = batch.totalCostRupiah;
      let newRemainingCost = batch.remainingCostRupiah;
      let newUnitCostDisplay = batch.unitCostDisplay;
      let deltaCost = 0;

      if (params.costMode === 'KEEP_TOTAL_COST') {
        // Pilihan A: Total modal tetap sama, harga satuan per Robux disesuaikan
        newTotalCost = batch.totalCostRupiah;
        newRemainingCost = Math.max(0, newTotalCost - usedCostRupiah);
        newUnitCostDisplay = newInitial > 0 ? newTotalCost / newInitial : 0;
        deltaCost = 0;
      } else {
        // Pilihan B: Harga satuan per Robux tetap sama, total modal berubah proporsional
        const unitCost = oldInitial > 0 ? batch.totalCostRupiah / oldInitial : 0;
        newTotalCost = Math.round(newInitial * unitCost);
        deltaCost = newTotalCost - batch.totalCostRupiah;
        newRemainingCost = Math.max(0, newTotalCost - usedCostRupiah);
        newUnitCostDisplay = unitCost;

        // Sesuaikan porsi kas sendiri pada batch jika ada
        if (batch.ownFundsRupiah !== undefined) {
          batch.ownFundsRupiah = Math.max(0, batch.ownFundsRupiah + deltaCost);
        }

        // Sesuaikan entri cashLedger
        if (relatedCash) {
          relatedCash.amountRupiah = Math.max(0, relatedCash.amountRupiah + deltaCost);
          relatedCash.notes = `Restock ${newInitial.toLocaleString('id-ID')} R$ (Koreksi Jumlah)`;
          await db.cashLedger.put(relatedCash);
        }
      }

      // Update data batch
      batch.initialRobux = newInitial;
      batch.remainingRobux = newRemainingRobux;
      batch.totalCostRupiah = newTotalCost;
      batch.remainingCostRupiah = newRemainingCost;
      batch.unitCostDisplay = newUnitCostDisplay;
      batch.notes = batch.notes ? `${batch.notes} | Koreksi: ${reasonClean}` : `Koreksi: ${reasonClean}`;

      await db.stockBatches.put(batch);

      // Catat mutasi di stockMovements
      const movement: StockMovement = {
        id: `MOV-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
        batchId: params.batchId,
        type: 'EDIT',
        robuxAmount: deltaRobux,
        costAllocatedRupiah: deltaCost,
        referenceId: params.batchId,
        createdAt: now,
        notes: `Koreksi jumlah: ${oldInitial} -> ${newInitial} R$ (${reasonClean})`,
        balanceAfter: newRemainingRobux,
      };
      await db.stockMovements.put(movement);

      // Catat di auditLogs
      const audit: AuditLog = {
        id: `LOG-${Date.now()}`,
        action: 'EDIT_BATCH_ROBUX',
        entity: 'stockBatches',
        entityId: params.batchId,
        details: `Koreksi batch ${params.batchId}: ${oldInitial} R$ -> ${newInitial} R$ (Sisa: ${newRemainingRobux} R$, Modal: Rp${batch.totalCostRupiah.toLocaleString('id-ID')} -> Rp${newTotalCost.toLocaleString('id-ID')}, Mode: ${params.costMode === 'KEEP_TOTAL_COST' ? 'Total modal tetap' : 'Harga/R$ tetap'}, Alasan: ${reasonClean})`,
        createdAt: now,
      };
      await db.auditLogs.put(audit);

      return { batch, movement };
    });
  },

  /**
   * Ambil Riwayat Mutasi Stok Lengkap dengan Perhitungan Saldo Berjalan (Running Balance) Dinamis
   */
  async getStockMovements(filter?: {
    batchId?: string;
    categoryTag?: 'ALL' | 'RESTOCK' | 'SALE' | 'PERSONAL_USE' | 'VOID' | 'ACCOUNT_REMAINDER' | 'MANUAL_ADJUST' | 'EDIT';
    startDate?: string;
    endDate?: string;
  }): Promise<{
    movements: Array<StockMovement & {
      batchSourceType?: string;
      batchFundingSource?: string;
      totalRunningBalance: number;
      batchRunningBalance: number;
      label: string;
      categoryTag: 'RESTOCK' | 'SALE' | 'PERSONAL_USE' | 'VOID' | 'ACCOUNT_REMAINDER' | 'MANUAL_ADJUST' | 'EDIT';
    }>;
    totalCount: number;
  }> {
    const [allMovements, allBatches] = await Promise.all([
      db.stockMovements.toArray(),
      db.stockBatches.toArray(),
    ]);

    const batchMap = new Map<string, StockBatch>();
    for (const b of allBatches) {
      batchMap.set(b.id, b);
    }

    // Urutkan secara kronologis stabil (createdAt ascending, tie-break id ascending)
    allMovements.sort((a, b) => {
      const timeA = new Date(a.createdAt).getTime();
      const timeB = new Date(b.createdAt).getTime();
      if (timeA !== timeB) return timeA - timeB;
      return a.id.localeCompare(b.id);
    });

    let runningTotal = 0;
    const runningPerBatch = new Map<string, number>();

    const enrichedList: Array<StockMovement & {
      batchSourceType?: string;
      batchFundingSource?: string;
      totalRunningBalance: number;
      batchRunningBalance: number;
      label: string;
      categoryTag: 'RESTOCK' | 'SALE' | 'PERSONAL_USE' | 'VOID' | 'ACCOUNT_REMAINDER' | 'MANUAL_ADJUST' | 'EDIT';
    }> = [];

    for (const m of allMovements) {
      const currentBatchBalance = runningPerBatch.get(m.batchId) || 0;
      let deltaRobux = 0;

      let label = 'Mutasi Stok';
      let categoryTag: 'RESTOCK' | 'SALE' | 'PERSONAL_USE' | 'VOID' | 'ACCOUNT_REMAINDER' | 'MANUAL_ADJUST' | 'EDIT' = 'RESTOCK';

      if (m.type === 'RESTOCK') {
        deltaRobux = m.robuxAmount;
        label = 'Restock Baru';
        categoryTag = 'RESTOCK';
      } else if (m.type === 'SALE') {
        deltaRobux = -Math.abs(m.robuxAmount);
        label = 'Penjualan';
        categoryTag = 'SALE';
      } else if (m.type === 'PERSONAL_USE') {
        deltaRobux = -Math.abs(m.robuxAmount);
        label = 'Pemakaian Pribadi';
        categoryTag = 'PERSONAL_USE';
      } else if (m.type === 'VOID_RESTORE') {
        deltaRobux = Math.abs(m.robuxAmount);
        label = 'Batal / Pengembalian';
        categoryTag = 'VOID';
      } else if (m.type === 'EDIT') {
        deltaRobux = m.robuxAmount;
        label = 'Koreksi Jumlah Batch';
        categoryTag = 'EDIT';
      } else if (m.type === 'RECONCILE_ADD') {
        const isManualAdjust = m.referenceId?.startsWith('ADJUST') || m.notes?.toLowerCase().includes('penyesuaian');
        if (isManualAdjust) {
          deltaRobux = m.robuxAmount;
          label = 'Penyesuaian Manual';
          categoryTag = 'MANUAL_ADJUST';
        } else {
          deltaRobux = m.robuxAmount;
          label = 'Sisa Robux Akun';
          categoryTag = 'ACCOUNT_REMAINDER';
        }
      }

      runningTotal += deltaRobux;
      const newBatchBalance = currentBatchBalance + deltaRobux;
      runningPerBatch.set(m.batchId, newBatchBalance);

      const batchInfo = batchMap.get(m.batchId);

      enrichedList.push({
        ...m,
        totalRunningBalance: runningTotal,
        batchRunningBalance: newBatchBalance,
        label,
        categoryTag,
        batchSourceType: batchInfo?.sourceType,
        batchFundingSource: batchInfo?.fundingSource,
      });
    }

    // Terapkan filter jika ada
    let filtered = enrichedList;

    if (filter?.batchId) {
      filtered = filtered.filter((m) => m.batchId === filter.batchId);
    }
    if (filter?.categoryTag && filter.categoryTag !== 'ALL') {
      filtered = filtered.filter((m) => m.categoryTag === filter.categoryTag);
    }
    if (filter?.startDate) {
      filtered = filtered.filter((m) => m.createdAt.substring(0, 10) >= filter.startDate!);
    }
    if (filter?.endDate) {
      filtered = filtered.filter((m) => m.createdAt.substring(0, 10) <= filter.endDate!);
    }

    // Urutkan terbaru di atas untuk tampilan UI
    filtered.reverse();

    return {
      movements: filtered,
      totalCount: filtered.length,
    };
  },

  /**
   * Sesuaikan sisa Robux batch yang masih ada di akun (misal sisa 50 R$)
   */
  async adjustBatchRemainingStock(batchId: string, newRemainingRobux: number, notes?: string): Promise<StockBatch> {
    const targetRobux = Math.max(0, Math.floor(newRemainingRobux || 0));

    return await db.transaction('rw', [db.stockBatches, db.stockMovements, db.auditLogs], async () => {
      const batch = await db.stockBatches.get(batchId);
      if (!batch) throw new Error('Batch tidak ditemukan');

      const oldRemaining = batch.remainingRobux;
      const oldCost = batch.remainingCostRupiah;
      batch.remainingRobux = targetRobux;

      // Jika targetRobux 0, habiskan modal tersisa
      if (targetRobux === 0) {
        batch.remainingCostRupiah = 0;
      } else if (oldRemaining > 0) {
        // Alokasi proporsional sisa modal
        batch.remainingCostRupiah = Math.round((targetRobux / oldRemaining) * oldCost);
      }

      if (notes) {
        batch.notes = batch.notes ? `${batch.notes} | ${notes}` : notes;
      }
      await db.stockBatches.put(batch);

      const movement: StockMovement = {
        id: `MOV-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        batchId,
        type: 'RECONCILE_ADD',
        robuxAmount: targetRobux - oldRemaining,
        costAllocatedRupiah: batch.remainingCostRupiah - oldCost,
        referenceId: `ADJUST-${Date.now()}`,
        createdAt: new Date().toISOString(),
      };
      await db.stockMovements.put(movement);

      const audit: AuditLog = {
        id: `LOG-${Date.now()}`,
        action: 'ADJUST_BATCH_STOCK',
        entity: 'stockBatches',
        entityId: batchId,
        details: `Penyesuaian stok batch ${batchId} dari ${oldRemaining} R$ menjadi ${targetRobux} R$`,
        createdAt: new Date().toISOString(),
      };
      await db.auditLogs.put(audit);

      return batch;
    });
  },

  /**
   * Tandai batch habis total (0 R$)
   */
  async closeBatchTotal(batchId: string, notes = 'Ditandai habis total'): Promise<StockBatch> {
    return this.adjustBatchRemainingStock(batchId, 0, notes);
  },

  // ===================== PENJUALAN (SALES) & FIFO =====================
  async recordSale(params: {
    robuxSold: number;
    rateUsed: number;
    totalRevenueRupiah: number;
    customerName?: string;
    notes?: string;
  }): Promise<Sale> {
    const robuxSold = Math.max(0, Math.floor(params.robuxSold || 0));
    const totalRevenue = Math.max(0, Math.floor(params.totalRevenueRupiah || 0));
    const rateUsed = Number(params.rateUsed) || 0;

    if (robuxSold <= 0) throw new Error('Jumlah Robux terjual harus lebih dari 0');
    if (totalRevenue <= 0) throw new Error('Total uang diterima harus lebih dari 0');

    const now = new Date().toISOString();
    const invoiceNumber = generateTransactionCode();

    return await db.transaction('rw', [db.stockBatches, db.stockMovements, db.sales, db.cashLedger, db.auditLogs, db.loans], async () => {
      // 1. Ambil antrean FIFO
      const activeBatches = await db.stockBatches
        .where('remainingRobux')
        .above(0)
        .sortBy('createdAt');

      const batchInputs: FifoBatchInput[] = activeBatches.map((b) => ({
        id: b.id,
        remainingRobux: b.remainingRobux,
        remainingCostRupiah: b.remainingCostRupiah,
      }));

      // 2. Alokasikan HPP dengan integer remainder allocation
      const allocationResult = allocateFifoCost(batchInputs, robuxSold);
      if (!allocationResult.success) {
        throw new Error(
          `Stok Robux tidak mencukupi! Kurang ${allocationResult.shortageRobux.toLocaleString('id-ID')} R$`
        );
      }

      // 3. Update setiap batch dan catat stockMovements
      for (const item of allocationResult.allocations) {
        const batch = activeBatches.find((b) => b.id === item.batchId);
        if (!batch) continue;

        batch.remainingRobux = item.batchRemainingRobuxAfter;
        batch.remainingCostRupiah = item.batchRemainingCostAfter;
        await db.stockBatches.put(batch);

        // Cicilan otomatis jika batch ini didanai pinjaman luar
        if ((batch.fundingSource === 'LOAN' || batch.fundingSource === 'COMBINED') && batch.loanId) {
          const loan = await db.loans.get(batch.loanId);
          if (loan && loan.remainingLoanRupiah > 0) {
            const payAmount = Math.min(item.costAllocatedRupiah, loan.remainingLoanRupiah);
            loan.remainingLoanRupiah = Math.max(0, loan.remainingLoanRupiah - payAmount);
            if (loan.remainingLoanRupiah === 0) {
              loan.status = 'PAID';
            }
            loan.payments.push({
              id: `PAY-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
              amountRupiah: payAmount,
              date: now,
              source: 'AUTO_SALE',
              notes: `Cicilan pokok dari penjualan ${robuxSold} R$ (${invoiceNumber})`,
            });
            await db.loans.put(loan);
          }
        }

        const movement: StockMovement = {
          id: `MOV-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
          batchId: item.batchId,
          type: 'SALE',
          robuxAmount: item.robuxTaken,
          costAllocatedRupiah: item.costAllocatedRupiah,
          referenceId: invoiceNumber,
          createdAt: now,
        };
        await db.stockMovements.put(movement);
      }

      // 4. Hitung Laba Kotor
      const totalCogsRupiah = allocationResult.totalCogsRupiah;
      const profitCalc = calculateProfit(totalRevenue, totalCogsRupiah);

      const sale: Sale = {
        id: invoiceNumber,
        invoiceNumber,
        createdAt: now,
        customerName: params.customerName?.trim() || undefined,
        robuxSold,
        rateUsed,
        totalRevenueRupiah: totalRevenue,
        totalCogsRupiah,
        grossProfitRupiah: profitCalc.grossProfit,
        notes: params.notes?.trim() || undefined,
        status: 'ACTIVE',
        allocations: allocationResult.allocations.map((a) => ({
          batchId: a.batchId,
          robuxTaken: a.robuxTaken,
          costAllocatedRupiah: a.costAllocatedRupiah,
        })),
      };

      await db.sales.put(sale);

      // 5. Catat Uang Masuk ke Buku Kas
      const cashEntry: CashLedgerEntry = {
        id: `CASH-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        dateKey: getTodayKey(),
        createdAt: now,
        type: 'IN',
        amountRupiah: totalRevenue,
        sourceType: 'SALE',
        sourceId: invoiceNumber,
        notes: `Penjualan ${robuxSold.toLocaleString('id-ID')} R$ (${invoiceNumber})`,
      };
      await db.cashLedger.put(cashEntry);

      // 6. Catat Audit Log
      const audit: AuditLog = {
        id: `LOG-${Date.now()}`,
        action: 'CREATE_SALE',
        entity: 'sales',
        entityId: invoiceNumber,
        details: `Jual ${robuxSold} R$ omzet Rp${totalRevenue} profit Rp${profitCalc.grossProfit}`,
        createdAt: now,
      };
      await db.auditLogs.put(audit);

      return sale;
    });
  },

  /**
   * Batalkan Transaksi Penjualan (VOID)
   * Kembalikan stok dan HPP ke batch masing-masing secara presisi!
   */
  async voidSale(saleId: string, reason = 'Pembatalan transaksi'): Promise<void> {
    await db.transaction('rw', [db.stockBatches, db.stockMovements, db.sales, db.cashLedger, db.auditLogs, db.loans], async () => {
      const sale = await db.sales.get(saleId);
      if (!sale) throw new Error('Data penjualan tidak ditemukan');
      if (sale.status === 'VOID') throw new Error('Transaksi ini sudah berstatus BATAL');

      const now = new Date().toISOString();

      // 1. Rollback setiap alokasi ke batch asalnya
      for (const alloc of sale.allocations) {
        const batch = await db.stockBatches.get(alloc.batchId);
        if (batch) {
          const restored = rollbackFifoBatch(
            {
              id: batch.id,
              remainingRobux: batch.remainingRobux,
              remainingCostRupiah: batch.remainingCostRupiah,
            },
            alloc.robuxTaken,
            alloc.costAllocatedRupiah,
            batch.initialRobux,
            batch.totalCostRupiah
          );

          batch.remainingRobux = restored.remainingRobux;
          batch.remainingCostRupiah = restored.remainingCostRupiah;
          await db.stockBatches.put(batch);

          // Rollback cicilan pinjaman jika batch ini didanai pinjaman
          if ((batch.fundingSource === 'LOAN' || batch.fundingSource === 'COMBINED') && batch.loanId) {
            const loan = await db.loans.get(batch.loanId);
            if (loan) {
              loan.remainingLoanRupiah = Math.min(
                loan.loanAmountRupiah,
                loan.remainingLoanRupiah + alloc.costAllocatedRupiah
              );
              loan.status = 'ACTIVE';
              loan.payments = loan.payments.filter((p) => !p.notes?.includes(sale.invoiceNumber));
              await db.loans.put(loan);
            }
          }

          // Catat pergerakan pembatalan
          const movement: StockMovement = {
            id: `MOV-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
            batchId: alloc.batchId,
            type: 'VOID_RESTORE',
            robuxAmount: alloc.robuxTaken,
            costAllocatedRupiah: alloc.costAllocatedRupiah,
            referenceId: saleId,
            createdAt: now,
          };
          await db.stockMovements.put(movement);
        }
      }

      // 2. Set status VOID
      sale.status = 'VOID';
      sale.notes = sale.notes ? `${sale.notes} [BATAL: ${reason}]` : `[BATAL: ${reason}]`;
      await db.sales.put(sale);

      // 3. Batalkan entri buku kas terkait penjualan ini (hapus entri kas terkait agar saldo kas ril sinkron)
      const relatedCash = await db.cashLedger
        .filter((c) => c.sourceId === saleId)
        .toArray();
      for (const c of relatedCash) {
        await db.cashLedger.delete(c.id);
      }

      // 4. Catat Audit Log
      const audit: AuditLog = {
        id: `LOG-${Date.now()}`,
        action: 'VOID_SALE',
        entity: 'sales',
        entityId: saleId,
        details: `Batalkan invoice ${saleId}: ${reason}`,
        createdAt: now,
      };
      await db.auditLogs.put(audit);
    });
  },

  /**
   * Edit detail informasi penjualan (Nama Pembeli / Catatan)
   */
  async updateSaleDetails(saleId: string, updates: { customerName?: string; notes?: string }): Promise<void> {
    const sale = await db.sales.get(saleId);
    if (!sale) throw new Error('Data penjualan tidak ditemukan');

    const updated = {
      ...sale,
      customerName: updates.customerName !== undefined ? updates.customerName.trim() || undefined : sale.customerName,
      notes: updates.notes !== undefined ? updates.notes.trim() || undefined : sale.notes,
    };

    await db.sales.put(updated);

    const audit: AuditLog = {
      id: `LOG-${Date.now()}`,
      action: 'UPDATE_SALE_DETAILS',
      entity: 'sales',
      entityId: saleId,
      details: `Ubah info penjualan ${saleId}`,
      createdAt: new Date().toISOString(),
    };
    await db.auditLogs.put(audit);
  },

  /**
   * Hapus permanen transaksi yang sudah berstatus VOID
   */
  async deleteSalePermanently(saleId: string): Promise<void> {
    const sale = await db.sales.get(saleId);
    if (!sale) return;
    if (sale.status !== 'VOID') {
      throw new Error('Hanya transaksi berstatus BATAL (VOID) yang dapat dihapus permanen.');
    }

    await db.transaction('rw', [db.sales, db.auditLogs], async () => {
      await db.sales.delete(saleId);
      const audit: AuditLog = {
        id: `LOG-${Date.now()}`,
        action: 'DELETE_SALE_PERMANENT',
        entity: 'sales',
        entityId: saleId,
        details: `Hapus permanen invoice VOID ${saleId}`,
        createdAt: new Date().toISOString(),
      };
      await db.auditLogs.put(audit);
    });
  },

  async getSales(status?: 'ACTIVE' | 'VOID'): Promise<Sale[]> {
    if (status) {
      return db.sales.where('status').equals(status).reverse().sortBy('createdAt');
    }
    return db.sales.orderBy('createdAt').reverse().toArray();
  },

  // ===================== PEMAKAIAN PRIBADI (PRIVE NON-KAS) =====================
  /**
   * Catat Pengambilan Robux Pribadi (Prive)
   * Memotong stok FIFO sebesar modal batch yang terpakai.
   * TIDAK mengurangi laba bersih toko dan TIDAK mengubah saldo kas (Rule 6.5).
   */
  async recordPersonalUsage(params: {
    robuxUsed: number;
    categoryId?: string;
    notes?: string;
  }): Promise<PersonalUsage> {
    const robuxUsed = Math.max(0, Math.floor(params.robuxUsed || 0));
    if (robuxUsed <= 0) throw new Error('Jumlah Robux harus lebih dari 0');

    const now = new Date().toISOString();
    const id = `PRIVE-${Date.now()}`;

    return await db.transaction('rw', [db.stockBatches, db.stockMovements, db.personalUsages, db.auditLogs], async () => {
      const activeBatches = await db.stockBatches
        .where('remainingRobux')
        .above(0)
        .sortBy('createdAt');

      const batchInputs: FifoBatchInput[] = activeBatches.map((b) => ({
        id: b.id,
        remainingRobux: b.remainingRobux,
        remainingCostRupiah: b.remainingCostRupiah,
      }));

      const allocationResult = allocateFifoCost(batchInputs, robuxUsed);
      if (!allocationResult.success) {
        throw new Error(
          `Stok Robux tidak cukup! Kurang ${allocationResult.shortageRobux.toLocaleString('id-ID')} R$`
        );
      }

      for (const item of allocationResult.allocations) {
        const batch = activeBatches.find((b) => b.id === item.batchId);
        if (!batch) continue;

        batch.remainingRobux = item.batchRemainingRobuxAfter;
        batch.remainingCostRupiah = item.batchRemainingCostAfter;
        await db.stockBatches.put(batch);

        const movement: StockMovement = {
          id: `MOV-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
          batchId: item.batchId,
          type: 'PERSONAL_USE',
          robuxAmount: item.robuxTaken,
          costAllocatedRupiah: item.costAllocatedRupiah,
          referenceId: id,
          createdAt: now,
        };
        await db.stockMovements.put(movement);
      }

      const usage: PersonalUsage = {
        id,
        createdAt: now,
        robuxUsed,
        totalCostRupiah: allocationResult.totalCogsRupiah,
        categoryId: params.categoryId || undefined,
        notes: params.notes?.trim() || undefined,
        allocations: allocationResult.allocations.map((a) => ({
          batchId: a.batchId,
          robuxTaken: a.robuxTaken,
          costAllocatedRupiah: a.costAllocatedRupiah,
        })),
      };

      await db.personalUsages.put(usage);

      const audit: AuditLog = {
        id: `LOG-${Date.now()}`,
        action: 'CREATE_PERSONAL_USAGE',
        entity: 'personalUsages',
        entityId: id,
        details: `Pakai pribadi ${robuxUsed} R$ modal Rp${allocationResult.totalCogsRupiah}`,
        createdAt: now,
      };
      await db.auditLogs.put(audit);

      return usage;
    });
  },

  async getPersonalUsages(): Promise<PersonalUsage[]> {
    return db.personalUsages.orderBy('createdAt').reverse().toArray();
  },

  /**
   * Batalkan pencatatan pemakaian pribadi (Prive)
   * Mengembalikan stok Robux dan modal HPP secara presisi ke batch FIFO asalnya.
   */
  async cancelPersonalUsage(usageId: string, reason = 'Pembatalan prive'): Promise<void> {
    await db.transaction('rw', [db.stockBatches, db.stockMovements, db.personalUsages, db.auditLogs], async () => {
      const usage = await db.personalUsages.get(usageId);
      if (!usage) throw new Error('Data pemakaian pribadi tidak ditemukan');

      const now = new Date().toISOString();

      if (usage.allocations && usage.allocations.length > 0) {
        for (const alloc of usage.allocations) {
          const batch = await db.stockBatches.get(alloc.batchId);
          if (batch) {
            const restored = rollbackFifoBatch(
              {
                id: batch.id,
                remainingRobux: batch.remainingRobux,
                remainingCostRupiah: batch.remainingCostRupiah,
              },
              alloc.robuxTaken,
              alloc.costAllocatedRupiah,
              batch.initialRobux,
              batch.totalCostRupiah
            );

            batch.remainingRobux = restored.remainingRobux;
            batch.remainingCostRupiah = restored.remainingCostRupiah;
            await db.stockBatches.put(batch);

            const movement: StockMovement = {
              id: `MOV-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
              batchId: alloc.batchId,
              type: 'VOID_RESTORE',
              robuxAmount: alloc.robuxTaken,
              costAllocatedRupiah: alloc.costAllocatedRupiah,
              referenceId: usageId,
              createdAt: now,
            };
            await db.stockMovements.put(movement);
          }
        }
      }

      await db.personalUsages.delete(usageId);

      const audit: AuditLog = {
        id: `LOG-${Date.now()}`,
        action: 'CANCEL_PERSONAL_USAGE',
        entity: 'personalUsages',
        entityId: usageId,
        details: `Batalkan & kembalikan prive ${usage.robuxUsed} R$ ke FIFO (${reason})`,
        createdAt: now,
      };
      await db.auditLogs.put(audit);
    });
  },

  /**
   * Edit catatan / keperluan pada riwayat prive
   */
  async updatePersonalUsageNotes(usageId: string, notes: string): Promise<void> {
    const usage = await db.personalUsages.get(usageId);
    if (!usage) throw new Error('Data pemakaian pribadi tidak ditemukan');

    usage.notes = notes.trim() || undefined;
    await db.personalUsages.put(usage);

    const audit: AuditLog = {
      id: `LOG-${Date.now()}`,
      action: 'UPDATE_PERSONAL_USAGE_NOTES',
      entity: 'personalUsages',
      entityId: usageId,
      details: `Ubah catatan prive ${usageId}`,
      createdAt: new Date().toISOString(),
    };
    await db.auditLogs.put(audit);
  },

  // ===================== BUKU KAS HARIAN (CASH LEDGER) =====================
  async getCashLedger(): Promise<CashLedgerEntry[]> {
    return db.cashLedger.orderBy('createdAt').reverse().toArray();
  },

  async addManualCashEntry(params: {
    type: 'IN' | 'OUT';
    amountRupiah: number;
    categoryId?: string;
    notes?: string;
    tags?: string[];
    dateKey?: string;
  }): Promise<CashLedgerEntry> {
    const amount = Math.max(0, Math.floor(params.amountRupiah || 0));
    if (amount <= 0) throw new Error('Nominal uang harus lebih dari 0');

    const now = new Date().toISOString();
    const entry: CashLedgerEntry = {
      id: `CASH-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      dateKey: params.dateKey || getTodayKey(),
      createdAt: now,
      type: params.type,
      amountRupiah: amount,
      categoryId: params.categoryId || undefined,
      notes: params.notes?.trim() || undefined,
      tags: params.tags || [],
      sourceType: 'MANUAL',
    };

    await db.cashLedger.put(entry);
    return entry;
  },

  async deleteManualCashEntry(id: string): Promise<void> {
    const entry = await db.cashLedger.get(id);
    if (!entry) return;
    if (entry.sourceType !== 'MANUAL') {
      throw new Error('Entri kas otomatis dari penjualan atau restock tidak dapat dihapus manual dari sini!');
    }
    await db.cashLedger.delete(id);
  },

  async updateManualCashEntry(id: string, updates: {
    amountRupiah?: number;
    notes?: string;
    categoryId?: string;
    dateKey?: string;
    type?: 'IN' | 'OUT';
  }): Promise<void> {
    const entry = await db.cashLedger.get(id);
    if (!entry) throw new Error('Data kas tidak ditemukan');
    if (entry.sourceType !== 'MANUAL') {
      throw new Error('Hanya transaksi kas manual yang dapat diedit di sini.');
    }

    if (updates.amountRupiah !== undefined) {
      const amt = Math.max(0, Math.floor(updates.amountRupiah));
      if (amt <= 0) throw new Error('Nominal kas harus lebih besar dari 0');
      entry.amountRupiah = amt;
    }
    if (updates.type) entry.type = updates.type;
    if (updates.notes !== undefined) entry.notes = updates.notes.trim() || undefined;
    if (updates.categoryId !== undefined) entry.categoryId = updates.categoryId || undefined;
    if (updates.dateKey) entry.dateKey = updates.dateKey;

    await db.cashLedger.put(entry);

    const audit: AuditLog = {
      id: `LOG-${Date.now()}`,
      action: 'UPDATE_MANUAL_CASH',
      entity: 'cashLedger',
      entityId: id,
      details: `Ubah entri kas manual ${id}`,
      createdAt: new Date().toISOString(),
    };
    await db.auditLogs.put(audit);
  },

  // ===================== KATEGORI =====================
  async getCategories(): Promise<Category[]> {
    return db.categories.orderBy('name').toArray();
  },

  async addCategory(name: string, color: string, type: 'EXPENSE' | 'INCOME' | 'PERSONAL'): Promise<Category> {
    const item: Category = {
      id: `CAT-${Date.now()}`,
      name: name.trim(),
      color: color || '#3b82f6',
      type,
      createdAt: new Date().toISOString(),
    };
    await db.categories.put(item);
    return item;
  },

  async updateCategory(id: string, updates: { name?: string; color?: string }): Promise<void> {
    const cat = await db.categories.get(id);
    if (!cat) throw new Error('Kategori tidak ditemukan');
    if (updates.name) cat.name = updates.name.trim();
    if (updates.color) cat.color = updates.color;
    await db.categories.put(cat);
  },

  async deleteCategory(id: string): Promise<void> {
    await db.categories.delete(id);
  },

  // ===================== AUDIT LOGS =====================
  async getAuditLogs(limit = 100): Promise<AuditLog[]> {
    return db.auditLogs.orderBy('createdAt').reverse().limit(limit).toArray();
  },

  // ===================== REKAP KESELURUHAN (DASHBOARD) =====================
  async getDashboardSummary() {
    const todayKey = getTodayKey();
    const currentMonthKey = todayKey.substring(0, 7); // YYYY-MM

    const [batches, sales, ledgerEntries] = await Promise.all([
      db.stockBatches.toArray(),
      db.sales.where('status').equals('ACTIVE').toArray(),
      db.cashLedger.toArray(),
    ]);

    // Stok
    let currentStockRobux = 0;
    let sisaNilaiModalStok = 0;
    let totalModalDikeluarkan = 0;

    for (const b of batches) {
      currentStockRobux += b.remainingRobux;
      sisaNilaiModalStok += b.remainingCostRupiah;
      totalModalDikeluarkan += b.totalCostRupiah;
    }

    // Penjualan
    let totalOmzet = 0;
    let totalGrossProfit = 0;
    let totalRobuxSold = 0;

    let todayRobuxSold = 0;
    let todayOmzet = 0;
    let todayProfit = 0;

    let monthRobuxSold = 0;
    let monthOmzet = 0;
    let monthProfit = 0;

    for (const s of sales) {
      totalOmzet += s.totalRevenueRupiah;
      totalGrossProfit += s.grossProfitRupiah;
      totalRobuxSold += s.robuxSold;

      const saleDate = s.createdAt.substring(0, 10);
      if (saleDate === todayKey) {
        todayRobuxSold += s.robuxSold;
        todayOmzet += s.totalRevenueRupiah;
        todayProfit += s.grossProfitRupiah;
      }
      if (saleDate.startsWith(currentMonthKey)) {
        monthRobuxSold += s.robuxSold;
        monthOmzet += s.totalRevenueRupiah;
        monthProfit += s.grossProfitRupiah;
      }
    }

    // Biaya Operasional Manual dari Buku Kas
    let totalManualExpense = 0;
    for (const entry of ledgerEntries) {
      if (entry.type === 'OUT' && entry.sourceType === 'MANUAL') {
        totalManualExpense += entry.amountRupiah;
      }
    }

    const netProfit = totalGrossProfit - totalManualExpense;

    return {
      currentStockRobux,
      sisaNilaiModalStok,
      totalModalDikeluarkan,
      totalOmzet,
      totalGrossProfit,
      totalManualExpense,
      netProfit,
      totalRobuxSold,
      todayRobuxSold,
      todayOmzet,
      todayProfit,
      monthRobuxSold,
      monthOmzet,
      monthProfit,
    };
  },

  // ===================== INVESTOR & BAGI HASIL =====================
  async getInvestors(): Promise<Investor[]> {
    return db.investors.orderBy('createdAt').reverse().toArray();
  },

  async addInvestor(data: Omit<Investor, 'id' | 'createdAt'>): Promise<string> {
    const id = `INV-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
    const now = new Date().toISOString();
    const investor: Investor = {
      ...data,
      id,
      createdAt: now,
    };
    await db.investors.put(investor);
    return id;
  },

  async updateInvestor(id: string, updates: Partial<Investor>): Promise<void> {
    await db.investors.update(id, updates);
  },

  async deleteInvestor(id: string): Promise<void> {
    await db.transaction('rw', [db.investors, db.investorPayouts], async () => {
      await db.investors.delete(id);
      await db.investorPayouts.where('investorId').equals(id).delete();
    });
  },

  async getInvestorPayouts(investorId?: string): Promise<InvestorPayout[]> {
    if (investorId) {
      return db.investorPayouts.where('investorId').equals(investorId).reverse().sortBy('createdAt');
    }
    return db.investorPayouts.orderBy('createdAt').reverse().toArray();
  },

  async recordInvestorPayout(data: Omit<InvestorPayout, 'id' | 'createdAt'>): Promise<string> {
    const id = `PAY-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
    const now = new Date().toISOString();
    const payout: InvestorPayout = {
      ...data,
      id,
      createdAt: now,
    };
    await db.investorPayouts.put(payout);
    return id;
  },

  async deleteInvestorPayout(id: string): Promise<void> {
    await db.investorPayouts.delete(id);
  },

  // ===================== PINJAMAN / UTANG MODAL RESTOCK =====================
  async getLoans(): Promise<Loan[]> {
    return db.loans.orderBy('createdAt').reverse().toArray();
  },

  async getLoanById(id: string): Promise<Loan | undefined> {
    return db.loans.get(id);
  },

  async payLoanManual(loanId: string, amountRupiah: number, notes?: string): Promise<Loan> {
    const amount = Math.max(0, Math.floor(amountRupiah || 0));
    if (amount <= 0) throw new Error('Nominal pembayaran cicilan harus lebih dari 0');

    return await db.transaction('rw', [db.loans, db.cashLedger, db.auditLogs], async () => {
      const loan = await db.loans.get(loanId);
      if (!loan) throw new Error('Data pinjaman tidak ditemukan');
      if (loan.status === 'PAID') throw new Error('Pinjaman ini sudah lunas');

      const payAmount = Math.min(amount, loan.remainingLoanRupiah);
      loan.remainingLoanRupiah = Math.max(0, loan.remainingLoanRupiah - payAmount);
      if (loan.remainingLoanRupiah === 0) {
        loan.status = 'PAID';
      }

      const now = new Date().toISOString();
      loan.payments.push({
        id: `PAY-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        amountRupiah: payAmount,
        date: now,
        source: 'MANUAL',
        notes: notes?.trim() || 'Pembayaran manual pokok pinjaman',
      });

      await db.loans.put(loan);

      // Catat pengeluaran kas pelunasan pinjaman
      const cashEntry: CashLedgerEntry = {
        id: `CASH-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        dateKey: getTodayKey(),
        createdAt: now,
        type: 'OUT',
        amountRupiah: payAmount,
        sourceType: 'MANUAL',
        notes: `Pelunasan Pinjaman: ${loan.borrowerOrLender} (${notes || 'Manual'})`,
      };
      await db.cashLedger.put(cashEntry);

      return loan;
    });
  },

  async deleteLoan(loanId: string): Promise<void> {
    await db.transaction('rw', [db.loans, db.stockBatches, db.auditLogs], async () => {
      const loan = await db.loans.get(loanId);
      if (!loan) throw new Error('Pinjaman tidak ditemukan');

      if (loan.batchId) {
        const batch = await db.stockBatches.get(loan.batchId);
        if (batch) {
          batch.fundingSource = 'OWN_FUNDS';
          batch.loanId = undefined;
          await db.stockBatches.put(batch);
        }
      }

      await db.loans.delete(loanId);
    });
  },

  // ===================== BUKU TABUNGAN PRIBADI (SAVINGS) =====================
  async getSavingsSummary(): Promise<SavingsSummaryResult> {
    const [entries, savedCategories] = await Promise.all([
      db.savingsEntries.toArray(),
      db.savingsCategories.toArray(),
    ]);
    return calculateSavingsSummary(entries, savedCategories);
  },

  async getSavingsEntries(filter?: {
    type?: 'ALL' | 'IN' | 'OUT';
    category?: string;
    search?: string;
  }): Promise<SavingsEntry[]> {
    let allEntries = await db.savingsEntries.toArray();

    allEntries.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    if (filter) {
      if (filter.type && filter.type !== 'ALL') {
        allEntries = allEntries.filter((e) => e.type === filter.type);
      }
      if (filter.category !== undefined && filter.category !== 'ALL') {
        if (!filter.category || filter.category === 'UNALLOCATED') {
          allEntries = allEntries.filter(
            (e) => !e.category || e.category.trim() === '' || e.category.toUpperCase() === 'UMUM' || e.category.toLowerCase() === 'tanpa kategori'
          );
        } else {
          allEntries = allEntries.filter((e) => e.category.trim().toLowerCase() === filter.category!.trim().toLowerCase());
        }
      }
      if (filter.search && filter.search.trim()) {
        const query = filter.search.trim().toLowerCase();
        allEntries = allEntries.filter(
          (e) =>
            (e.notes && e.notes.toLowerCase().includes(query)) ||
            (e.category && e.category.toLowerCase().includes(query)) ||
            e.amountRupiah.toString().includes(query)
        );
      }
    }

    return allEntries;
  },

  async getSavingsCategories(): Promise<SavingsCategory[]> {
    const list = await db.savingsCategories.toArray();
    return list.sort((a, b) => a.name.localeCompare(b.name));
  },

  async addSavingsCategory(name: string): Promise<SavingsCategory> {
    const cleanName = name.trim();
    if (!cleanName) throw new Error('Nama kategori tabungan tidak boleh kosong');

    const existing = await db.savingsCategories
      .filter((c) => c.name.toLowerCase() === cleanName.toLowerCase())
      .first();
    if (existing) return existing;

    const newCat: SavingsCategory = {
      id: `SAVCAT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      name: cleanName,
      createdAt: new Date().toISOString(),
    };
    await db.savingsCategories.put(newCat);
    return newCat;
  },

  async deleteSavingsCategory(identifier: string): Promise<void> {
    await db.transaction('rw', [db.savingsCategories, db.auditLogs], async () => {
      const clean = identifier.trim();
      const matching = await db.savingsCategories
        .filter((c) => c.id === clean || c.name.toLowerCase() === clean.toLowerCase())
        .toArray();
      for (const cat of matching) {
        await db.savingsCategories.delete(cat.id);
      }
      await db.auditLogs.put({
        id: `LOG-${Date.now()}`,
        action: 'SAVINGS_CAT_DELETE',
        entity: 'savingsCategories',
        entityId: clean,
        details: `Hapus pos kategori tabungan "${clean}"`,
        createdAt: new Date().toISOString(),
      });
    });
  },

  async addSavingsEntry(params: {
    type: 'IN' | 'OUT';
    amountRupiah: number;
    category?: string;
    notes?: string;
    dateKey?: string;
  }): Promise<SavingsEntry> {
    const amount = Math.round(Number(params.amountRupiah) || 0);
    if (amount <= 0) {
      throw new Error('Nominal uang tabungan harus lebih dari Rp0');
    }

    const cleanCategory = (params.category || '').trim();
    const isUnallocated = !cleanCategory || cleanCategory.toUpperCase() === 'UMUM' || cleanCategory.toLowerCase() === 'tanpa kategori';
    const now = new Date().toISOString();

    return await db.transaction('rw', [db.savingsEntries, db.savingsCategories, db.auditLogs], async () => {
      if (params.type === 'OUT') {
        const allEntries = await db.savingsEntries.toArray();
        const check = validateSavingsWithdrawal(amount, isUnallocated ? '' : cleanCategory, allEntries);
        if (!check.valid) {
          throw new Error(check.error || 'Saldo tabungan tidak mencukupi');
        }
      }

      if (!isUnallocated) {
        const existingCat = await db.savingsCategories
          .filter((c) => c.name.toLowerCase() === cleanCategory.toLowerCase())
          .first();
        if (!existingCat) {
          await db.savingsCategories.put({
            id: `SAVCAT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            name: cleanCategory,
            createdAt: now,
          });
        }
      }

      const newEntry: SavingsEntry = {
        id: `SAV-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
        type: params.type,
        amountRupiah: amount,
        category: isUnallocated ? '' : cleanCategory,
        notes: params.notes?.trim() || undefined,
        dateKey: params.dateKey || getTodayKey(),
        createdAt: now,
      };

      await db.savingsEntries.put(newEntry);

      await db.auditLogs.put({
        id: `LOG-${Date.now()}`,
        action: params.type === 'IN' ? 'SAVINGS_DEPOSIT' : 'SAVINGS_WITHDRAWAL',
        entity: 'savingsEntries',
        entityId: newEntry.id,
        details: `${params.type === 'IN' ? 'Setor' : 'Tarik'} tabungan Rp${amount.toLocaleString('id-ID')} (${isUnallocated ? 'Tanpa Kategori' : cleanCategory})${params.notes ? ` - ${params.notes}` : ''}`,
        createdAt: now,
      });

      return newEntry;
    });
  },

  async deleteSavingsEntry(id: string): Promise<void> {
    await db.transaction('rw', [db.savingsEntries, db.auditLogs], async () => {
      const entry = await db.savingsEntries.get(id);
      if (!entry) throw new Error('Data tabungan tidak ditemukan');

      await db.savingsEntries.delete(id);

      await db.auditLogs.put({
        id: `LOG-${Date.now()}`,
        action: 'SAVINGS_DELETE',
        entity: 'savingsEntries',
        entityId: id,
        details: `Hapus catatan tabungan ${entry.type === 'IN' ? 'Setor' : 'Tarik'} Rp${entry.amountRupiah.toLocaleString('id-ID')}`,
        createdAt: new Date().toISOString(),
      });
    });
  },
};
