import { describe, it, expect } from 'vitest';
import { StockMovementBackupSchema, BackupSchema } from '../features/settings/SettingsView';
import { StockBatch, StockMovement } from '../db/schema';

describe('JufaStore - Stock History & Batch Edit Logic Tests', () => {
  // =========================================================================
  // 1. BACKUP & RESTORE SCHEMA TESTS
  // =========================================================================
  describe('1. Backup & Restore Schema Compatibility', () => {
    it('1.1. Backward Compatibility: Menerima mutasi lama tanpa EDIT, notes, atau balanceAfter', () => {
      const legacyMovement = {
        id: 'MOV-1001',
        batchId: 'BATCH-001',
        type: 'RESTOCK',
        robuxAmount: 1000,
        costAllocatedRupiah: 130000,
        referenceId: 'BATCH-001',
        createdAt: '2026-10-25T10:00:00.000Z',
      };

      const parsed = StockMovementBackupSchema.safeParse(legacyMovement);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.type).toBe('RESTOCK');
        expect(parsed.data.notes).toBeUndefined();
        expect(parsed.data.balanceAfter).toBeUndefined();
      }
    });

    it('1.2. Forward Compatibility: Menerima mutasi baru tipe EDIT dengan notes dan balanceAfter', () => {
      const newEditMovement = {
        id: 'MOV-1002',
        batchId: 'BATCH-001',
        type: 'EDIT',
        robuxAmount: -200,
        costAllocatedRupiah: 0,
        referenceId: 'EDIT-BATCH-001',
        createdAt: '2026-10-26T12:00:00.000Z',
        notes: 'Koreksi salah ketik dari supplier',
        balanceAfter: 800,
      };

      const parsed = StockMovementBackupSchema.safeParse(newEditMovement);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.type).toBe('EDIT');
        expect(parsed.data.notes).toBe('Koreksi salah ketik dari supplier');
        expect(parsed.data.balanceAfter).toBe(800);
      }
    });

    it('1.3. Validasi Backup File JSON Utuh dengan BackupSchema', () => {
      const backupPayload = {
        version: 4,
        exportedAt: '2026-10-26T12:00:00.000Z',
        stockBatches: [
          {
            id: 'BATCH-001',
            initialRobux: 1000,
            remainingRobux: 800,
            unitCostDisplay: 130,
            totalCostRupiah: 130000,
            remainingCostRupiah: 104000,
            sourceType: 'RESTOCK',
            fundingSource: 'OWN_FUNDS',
            createdAt: '2026-10-25T10:00:00.000Z',
          },
        ],
        stockMovements: [
          {
            id: 'MOV-1',
            batchId: 'BATCH-001',
            type: 'RESTOCK',
            robuxAmount: 1000,
            costAllocatedRupiah: 130000,
            referenceId: 'BATCH-001',
            createdAt: '2026-10-25T10:00:00.000Z',
          },
          {
            id: 'MOV-2',
            batchId: 'BATCH-001',
            type: 'EDIT',
            robuxAmount: -200,
            costAllocatedRupiah: 0,
            referenceId: 'EDIT-BATCH-001',
            createdAt: '2026-10-26T12:00:00.000Z',
            notes: 'Koreksi awal batch',
            balanceAfter: 800,
          },
        ],
      };

      const parsed = BackupSchema.safeParse(backupPayload);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.stockMovements?.length).toBe(2);
      }
    });
  });

  // =========================================================================
  // 2. ATURAN KEAMANAN & AKUNTANSI EDIT JUMLAH ROBUX BATCH
  // =========================================================================
  describe('2. Batch Edit Security Rules & Accounting Calculations', () => {
    // Fungsi simulasi logika murni domain edit batch
    function simulateBatchEdit(params: {
      batch: StockBatch;
      newInitialRobux: number;
      costMode: 'KEEP_TOTAL_COST' | 'KEEP_UNIT_COST';
      reason: string;
      hasCashLedgerEntry: boolean;
    }) {
      const { batch, newInitialRobux, costMode, reason, hasCashLedgerEntry } = params;

      if (!reason || !reason.trim()) {
        throw new Error('Alasan perubahan wajib diisi untuk menjaga akuntabilitas audit');
      }

      const usedRobux = batch.initialRobux - batch.remainingRobux;
      if (newInitialRobux < usedRobux) {
        throw new Error(
          `Jumlah Robux baru (${newInitialRobux.toLocaleString('id-ID')} R$) tidak boleh lebih kecil dari Robux yang sudah terpakai (${usedRobux.toLocaleString('id-ID')} R$)`
        );
      }

      const robuxDifference = newInitialRobux - batch.initialRobux;
      const newRemainingRobux = batch.remainingRobux + robuxDifference;

      let newTotalCost = batch.totalCostRupiah;
      let newCostPerRobux = batch.unitCostDisplay;
      let cashDiff = 0;

      if (costMode === 'KEEP_TOTAL_COST') {
        // Edge Case: Jika sisa robux menjadi 0, tetapi sisa modal masih > 0
        if (newRemainingRobux === 0 && batch.remainingCostRupiah > 0) {
          throw new Error(
            'Perubahan tidak dapat diproses: Jumlah Robux baru menghabiskan seluruh sisa stok batch, namun masih terdapat sisa modal batch yang belum teralokasi. Pilihan modal tetap akan menyebabkan selisih modal menggantung.'
          );
        }
        newCostPerRobux = newInitialRobux > 0 ? Math.round(batch.totalCostRupiah / newInitialRobux) : 0;
      } else {
        // Pilihan B: KEEP_UNIT_COST
        if (batch.sourceType === 'ACCOUNT_REMAINDER') {
          throw new Error('Batch dari Sisa Robux Akun tidak memiliki pengeluaran kas. Pilihan B tidak dapat digunakan.');
        }
        if (batch.fundingSource === 'LOAN') {
          throw new Error('Batch didanai dari Pinjaman Modal. Pilihan B dinonaktifkan.');
        }
        if (batch.fundingSource === 'COMBINED') {
          throw new Error('Batch didanai dari Modal Gabungan. Pilihan B dinonaktifkan.');
        }
        if (!hasCashLedgerEntry) {
          throw new Error('Batch tidak memiliki riwayat arus kas yang valid. Pilihan B dinonaktifkan.');
        }

        newTotalCost = Math.round(newInitialRobux * batch.unitCostDisplay);
        cashDiff = newTotalCost - batch.totalCostRupiah;
      }

      return {
        newInitialRobux,
        newRemainingRobux,
        newTotalCost,
        newCostPerRobux,
        robuxDifference,
        cashDiff,
      };
    }

    it('2.1. Validasi Keamanan: Menolak jika alasan perubahan kosong', () => {
      const batch: StockBatch = {
        id: 'BATCH-1',
        initialRobux: 1000,
        remainingRobux: 1000,
        unitCostDisplay: 150,
        totalCostRupiah: 150000,
        remainingCostRupiah: 150000,
        sourceType: 'RESTOCK',
        fundingSource: 'OWN_FUNDS',
        createdAt: '2026-10-25T10:00:00.000Z',
      };

      expect(() => {
        simulateBatchEdit({
          batch,
          newInitialRobux: 1200,
          costMode: 'KEEP_TOTAL_COST',
          reason: '   ',
          hasCashLedgerEntry: true,
        });
      }).toThrow('Alasan perubahan wajib diisi');
    });

    it('2.2. Validasi Keamanan: Menolak jika jumlah baru < Robux yang sudah terpakai', () => {
      const batch: StockBatch = {
        id: 'BATCH-2',
        initialRobux: 1000,
        remainingRobux: 400, // Terpakai: 600 Robux
        unitCostDisplay: 150,
        totalCostRupiah: 150000,
        remainingCostRupiah: 60000,
        sourceType: 'RESTOCK',
        fundingSource: 'OWN_FUNDS',
        createdAt: '2026-10-25T10:00:00.000Z',
      };

      // Mencoba ubah initial ke 500 (padahal sudah terpakai 600)
      expect(() => {
        simulateBatchEdit({
          batch,
          newInitialRobux: 500,
          costMode: 'KEEP_TOTAL_COST',
          reason: 'Koreksi stok',
          hasCashLedgerEntry: true,
        });
      }).toThrow('tidak boleh lebih kecil dari Robux yang sudah terpakai (600 R$)');
    });

    it('2.3. Pilihan A (KEEP_TOTAL_COST): Modal total tetap, unit cost per Robux dihitung ulang', () => {
      const batch: StockBatch = {
        id: 'BATCH-3',
        initialRobux: 1000,
        remainingRobux: 800, // Terpakai 200
        unitCostDisplay: 150,
        totalCostRupiah: 150000,
        remainingCostRupiah: 120000,
        sourceType: 'RESTOCK',
        fundingSource: 'OWN_FUNDS',
        createdAt: '2026-10-25T10:00:00.000Z',
      };

      // Tambah initial jadi 1.200 (selisih +200)
      const res = simulateBatchEdit({
        batch,
        newInitialRobux: 1200,
        costMode: 'KEEP_TOTAL_COST',
        reason: 'Bonus dari supplier',
        hasCashLedgerEntry: true,
      });

      expect(res.newInitialRobux).toBe(1200);
      expect(res.newRemainingRobux).toBe(1000); // 800 + 200
      expect(res.newTotalCost).toBe(150000); // Tetap Rp150.000
      expect(res.newCostPerRobux).toBe(125); // 150.000 / 1200 = 125
      expect(res.cashDiff).toBe(0); // Arus kas tidak tersentuh
    });

    it('2.4. Edge Case Pilihan A: Menolak jika sisa Robux menjadi 0 namun sisa modal > 0', () => {
      const batch: StockBatch = {
        id: 'BATCH-4',
        initialRobux: 1000,
        remainingRobux: 500, // Terpakai 500
        unitCostDisplay: 150,
        totalCostRupiah: 150000,
        remainingCostRupiah: 75000, // Masih ada sisa modal Rp75.000
        sourceType: 'RESTOCK',
        fundingSource: 'OWN_FUNDS',
        createdAt: '2026-10-25T10:00:00.000Z',
      };

      // Jika diubah menjadi 500 (persis sama dengan yang sudah terpakai), maka newRemaining = 0
      // Padahal sisa modal masih Rp75.000 -> Harus diblokir agar modal tidak menggantung
      expect(() => {
        simulateBatchEdit({
          batch,
          newInitialRobux: 500,
          costMode: 'KEEP_TOTAL_COST',
          reason: 'Pangkas batch ke jumlah terpakai',
          hasCashLedgerEntry: true,
        });
      }).toThrow('Pilihan modal tetap akan menyebabkan selisih modal menggantung');
    });

    it('2.5. Pilihan B (KEEP_UNIT_COST): Kas Mandiri boleh, modal bertambah proporsional', () => {
      const batch: StockBatch = {
        id: 'BATCH-5',
        initialRobux: 1000,
        remainingRobux: 1000,
        unitCostDisplay: 150,
        totalCostRupiah: 150000,
        remainingCostRupiah: 150000,
        sourceType: 'RESTOCK',
        fundingSource: 'OWN_FUNDS',
        createdAt: '2026-10-25T10:00:00.000Z',
      };

      const res = simulateBatchEdit({
        batch,
        newInitialRobux: 1500,
        costMode: 'KEEP_UNIT_COST',
        reason: 'Restock tambahan dengan harga per Robux sama',
        hasCashLedgerEntry: true,
      });

      expect(res.newInitialRobux).toBe(1500);
      expect(res.newRemainingRobux).toBe(1500);
      expect(res.newCostPerRobux).toBe(150); // Rate per R$ tetap
      expect(res.newTotalCost).toBe(225000); // 1.500 * 150 = Rp225.000
      expect(res.cashDiff).toBe(75000); // Pengeluaran kas bertambah Rp75.000
    });

    it('2.6. Matriks Pembatasan Pilihan B: Memblokir pinjaman modal, modal gabungan, dan sisa akun', () => {
      // 1. Batch Pinjaman
      const loanBatch: StockBatch = {
        id: 'BATCH-LOAN',
        initialRobux: 1000,
        remainingRobux: 1000,
        unitCostDisplay: 150,
        totalCostRupiah: 150000,
        remainingCostRupiah: 150000,
        sourceType: 'RESTOCK',
        fundingSource: 'LOAN',
        loanId: 'LOAN-1',
        createdAt: '2026-10-25T10:00:00.000Z',
      };
      expect(() => {
        simulateBatchEdit({
          batch: loanBatch,
          newInitialRobux: 1200,
          costMode: 'KEEP_UNIT_COST',
          reason: 'Coba ubah pinjaman',
          hasCashLedgerEntry: true,
        });
      }).toThrow('Batch didanai dari Pinjaman Modal. Pilihan B dinonaktifkan.');

      // 2. Batch Modal Gabungan
      const combinedBatch: StockBatch = {
        ...loanBatch,
        id: 'BATCH-COMBINED',
        fundingSource: 'COMBINED',
      };
      expect(() => {
        simulateBatchEdit({
          batch: combinedBatch,
          newInitialRobux: 1200,
          costMode: 'KEEP_UNIT_COST',
          reason: 'Coba ubah modal gabungan',
          hasCashLedgerEntry: true,
        });
      }).toThrow('Batch didanai dari Modal Gabungan. Pilihan B dinonaktifkan.');

      // 3. Batch Sisa Robux Akun
      const remainderBatch: StockBatch = {
        ...loanBatch,
        id: 'BATCH-REMAINDER',
        fundingSource: 'OWN_FUNDS',
        sourceType: 'ACCOUNT_REMAINDER',
      };
      expect(() => {
        simulateBatchEdit({
          batch: remainderBatch,
          newInitialRobux: 1200,
          costMode: 'KEEP_UNIT_COST',
          reason: 'Coba ubah sisa robux akun',
          hasCashLedgerEntry: false,
        });
      }).toThrow('Batch dari Sisa Robux Akun tidak memiliki pengeluaran kas');
    });
  });

  // =========================================================================
  // 3. LOGIKA SALDO BERJALAN DINAMIS (RUNNING BALANCE) RIWAYAT STOK
  // =========================================================================
  describe('3. Dynamic Running Balance Calculation Logic', () => {
    function computeRunningBalances(
      movements: StockMovement[],
      batches: StockBatch[]
    ) {
      const batchMap = new Map<string, StockBatch>();
      for (const b of batches) {
        batchMap.set(b.id, b);
      }

      // Kronologis stabil: createdAt ASC, tie-break id ASC
      const sorted = [...movements].sort((a, b) => {
        const timeA = new Date(a.createdAt).getTime();
        const timeB = new Date(b.createdAt).getTime();
        if (timeA !== timeB) return timeA - timeB;
        return a.id.localeCompare(b.id);
      });

      let runningTotal = 0;
      const runningPerBatch = new Map<string, number>();

      return sorted.map((m) => {
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
        } else if (m.type === 'RECONCILE_ADD') {
          deltaRobux = m.robuxAmount;
          const batch = batchMap.get(m.batchId);
          if (batch?.sourceType === 'ACCOUNT_REMAINDER' || m.referenceId?.startsWith('REMAINDER-')) {
            label = 'Sisa Robux Akun';
            categoryTag = 'ACCOUNT_REMAINDER';
          } else {
            label = 'Penyesuaian Manual';
            categoryTag = 'MANUAL_ADJUST';
          }
        } else if (m.type === 'VOID_RESTORE') {
          deltaRobux = Math.abs(m.robuxAmount);
          label = 'Pengembalian Void';
          categoryTag = 'VOID';
        } else if (m.type === 'EDIT') {
          deltaRobux = m.robuxAmount;
          label = m.robuxAmount >= 0 ? 'Koreksi Batch (+)' : 'Koreksi Batch (-)';
          categoryTag = 'EDIT';
        }

        runningTotal += deltaRobux;
        const newBatchBalance = currentBatchBalance + deltaRobux;
        runningPerBatch.set(m.batchId, newBatchBalance);

        return {
          ...m,
          deltaRobux,
          label,
          categoryTag,
          totalRunningBalance: runningTotal,
          batchRunningBalance: newBatchBalance,
        };
      });
    }

    it('3.1. Menghitung saldo berjalan per batch dan total toko secara presisi melewati berbagai mutasi', () => {
      const batches: StockBatch[] = [
        {
          id: 'BATCH-A',
          initialRobux: 1000,
          remainingRobux: 600,
          unitCostDisplay: 150,
          totalCostRupiah: 150000,
          remainingCostRupiah: 90000,
          sourceType: 'RESTOCK',
          fundingSource: 'OWN_FUNDS',
          createdAt: '2026-10-25T08:00:00.000Z',
        },
        {
          id: 'BATCH-B',
          initialRobux: 500,
          remainingRobux: 500,
          unitCostDisplay: 160,
          totalCostRupiah: 80000,
          remainingCostRupiah: 80000,
          sourceType: 'RESTOCK',
          fundingSource: 'OWN_FUNDS',
          createdAt: '2026-10-25T09:00:00.000Z',
        },
      ];

      const movements: StockMovement[] = [
        // 1. Restock Batch A: +1000
        {
          id: 'MOV-1',
          batchId: 'BATCH-A',
          type: 'RESTOCK',
          robuxAmount: 1000,
          costAllocatedRupiah: 150000,
          referenceId: 'BATCH-A',
          createdAt: '2026-10-25T08:00:00.000Z',
        },
        // 2. Restock Batch B: +500
        {
          id: 'MOV-2',
          batchId: 'BATCH-B',
          type: 'RESTOCK',
          robuxAmount: 500,
          costAllocatedRupiah: 80000,
          referenceId: 'BATCH-B',
          createdAt: '2026-10-25T09:00:00.000Z',
        },
        // 3. Penjualan dari Batch A: 300
        {
          id: 'MOV-3',
          batchId: 'BATCH-A',
          type: 'SALE',
          robuxAmount: 300,
          costAllocatedRupiah: 45000,
          referenceId: 'INV-001',
          createdAt: '2026-10-25T10:00:00.000Z',
        },
        // 4. Koreksi EDIT pada Batch A: +200 (diubah dari 1000 jadi 1200)
        {
          id: 'MOV-4',
          batchId: 'BATCH-A',
          type: 'EDIT',
          robuxAmount: 200,
          costAllocatedRupiah: 0,
          referenceId: 'EDIT-BATCH-A',
          createdAt: '2026-10-25T11:00:00.000Z',
          notes: 'Bonus dari supplier',
        },
        // 5. Pemakaian pribadi dari Batch A: 100
        {
          id: 'MOV-5',
          batchId: 'BATCH-A',
          type: 'PERSONAL_USE',
          robuxAmount: 100,
          costAllocatedRupiah: 12500,
          referenceId: 'PRIVE-001',
          createdAt: '2026-10-25T12:00:00.000Z',
        },
      ];

      const result = computeRunningBalances(movements, batches);

      // Cek Mov 1 (Restock A)
      expect(result[0].batchRunningBalance).toBe(1000);
      expect(result[0].totalRunningBalance).toBe(1000);

      // Cek Mov 2 (Restock B)
      expect(result[1].batchRunningBalance).toBe(500);
      expect(result[1].totalRunningBalance).toBe(1500);

      // Cek Mov 3 (Sale 300 dari Batch A)
      expect(result[2].deltaRobux).toBe(-300);
      expect(result[2].batchRunningBalance).toBe(700); // 1000 - 300
      expect(result[2].totalRunningBalance).toBe(1200); // 1500 - 300

      // Cek Mov 4 (Edit +200 pada Batch A)
      expect(result[3].deltaRobux).toBe(200);
      expect(result[3].batchRunningBalance).toBe(900); // 700 + 200
      expect(result[3].totalRunningBalance).toBe(1400); // 1200 + 200

      // Cek Mov 5 (Personal use 100 dari Batch A)
      expect(result[4].deltaRobux).toBe(-100);
      expect(result[4].batchRunningBalance).toBe(800); // 900 - 100
      expect(result[4].totalRunningBalance).toBe(1300); // 1400 - 100
    });

    it('3.2. Membedakan label Sisa Robux Akun vs Penyesuaian Manual (RECONCILE_ADD)', () => {
      const remainderBatch: StockBatch = {
        id: 'BATCH-REM',
        initialRobux: 50,
        remainingRobux: 50,
        unitCostDisplay: 0,
        totalCostRupiah: 0,
        remainingCostRupiah: 0,
        fundingSource: 'OWN_FUNDS',
        sourceType: 'ACCOUNT_REMAINDER',
        createdAt: '2026-10-25T08:00:00.000Z',
      };

      const manualBatch: StockBatch = {
        id: 'BATCH-MAN',
        initialRobux: 30,
        remainingRobux: 30,
        unitCostDisplay: 150,
        totalCostRupiah: 4500,
        remainingCostRupiah: 4500,
        fundingSource: 'OWN_FUNDS',
        sourceType: 'RESTOCK',
        createdAt: '2026-10-25T08:30:00.000Z',
      };

      const movements: StockMovement[] = [
        {
          id: 'MOV-REM',
          batchId: 'BATCH-REM',
          type: 'RECONCILE_ADD',
          robuxAmount: 50,
          costAllocatedRupiah: 0,
          referenceId: 'REMAINDER-001',
          createdAt: '2026-10-25T08:00:00.000Z',
        },
        {
          id: 'MOV-MAN',
          batchId: 'BATCH-MAN',
          type: 'RECONCILE_ADD',
          robuxAmount: 30,
          costAllocatedRupiah: 4500,
          referenceId: 'MANUAL_ADJUST',
          createdAt: '2026-10-25T08:30:00.000Z',
        },
      ];

      const result = computeRunningBalances(movements, [remainderBatch, manualBatch]);

      expect(result[0].label).toBe('Sisa Robux Akun');
      expect(result[0].categoryTag).toBe('ACCOUNT_REMAINDER');

      expect(result[1].label).toBe('Penyesuaian Manual');
      expect(result[1].categoryTag).toBe('MANUAL_ADJUST');
    });
  });

  // =========================================================================
  // 4. LIFECYCLE SEQUENCE TESTS (RESTOCK -> JUAL -> EDIT -> VOID -> DELETE)
  // =========================================================================
  describe('4. Lifecycle Sequence: Restock -> Sale -> Edit Batch -> Void Sale -> Delete Batch', () => {
    it('4.1. Urutan Siklus Pilihan A: Modal Tetap Rp100.000, 1.000 R$ -> Jual 200 R$ -> Edit ke 1.200 R$ -> Void -> Cek Konsistensi', () => {
      // 1. Restock awal: 1.000 Robux seharga Rp100.000 (Kas Sendiri)
      const batch: StockBatch = {
        id: 'BATCH-LIFECYCLE-A',
        createdAt: '2026-11-01T10:00:00.000Z',
        sourceType: 'RESTOCK',
        initialRobux: 1000,
        remainingRobux: 1000,
        totalCostRupiah: 100000,
        remainingCostRupiah: 100000,
        unitCostDisplay: 100,
        fundingSource: 'OWN_FUNDS',
        ownFundsRupiah: 100000,
      };

      let cashLedger: Array<{ id: string; type: 'IN' | 'OUT'; amountRupiah: number; sourceId: string; notes?: string }> = [
        {
          id: 'CASH-RESTOCK-1',
          type: 'OUT',
          amountRupiah: 100000,
          sourceId: batch.id,
          notes: 'Restock 1.000 R$',
        },
      ];

      // Verifikasi awal
      expect(batch.remainingRobux).toBe(1000);
      expect(batch.remainingCostRupiah).toBe(100000);
      expect(cashLedger[0].amountRupiah).toBe(100000);

      // 2. Transaksi Penjualan: Jual 200 Robux seharga Rp30.000 (rate 150)
      const robuxSold = 200;
      const saleRevenue = 30000;
      // Alokasi FIFO: 200 / 1000 * 100.000 = Rp20.000
      const cogsAllocated = Math.round((robuxSold / batch.remainingRobux) * batch.remainingCostRupiah);
      expect(cogsAllocated).toBe(20000);

      batch.remainingRobux -= robuxSold; // 800
      batch.remainingCostRupiah -= cogsAllocated; // 80.000

      // Catat penjualan dan kas masuk
      const sale = {
        id: 'INV-1001',
        robuxSold: 200,
        totalRevenueRupiah: saleRevenue,
        totalCogsRupiah: cogsAllocated,
        status: 'ACTIVE',
        allocations: [
          {
            batchId: batch.id,
            robuxTaken: robuxSold,
            costAllocatedRupiah: cogsAllocated,
          },
        ],
      };
      cashLedger.push({
        id: 'CASH-SALE-1',
        type: 'IN',
        amountRupiah: saleRevenue,
        sourceId: sale.id,
        notes: 'Penjualan 200 R$',
      });

      expect(batch.remainingRobux).toBe(800);
      expect(batch.remainingCostRupiah).toBe(80000);

      // 3. Edit Jumlah Robux dengan Pilihan A (KEEP_TOTAL_COST): Ubah initial dari 1.000 -> 1.200 (+200 R$)
      const newInitial = 1200;
      const deltaRobux = newInitial - batch.initialRobux; // +200
      const usedRobux = batch.initialRobux - batch.remainingRobux; // 200
      expect(newInitial).toBeGreaterThanOrEqual(usedRobux);

      const usedCostRupiah = batch.totalCostRupiah - batch.remainingCostRupiah; // 20.000
      batch.initialRobux = newInitial; // 1.200
      batch.remainingRobux = batch.remainingRobux + deltaRobux; // 800 + 200 = 1.000
      // Pilihan A: total modal tetap Rp100.000, remaining cost = 100.000 - 20.000 = Rp80.000
      batch.totalCostRupiah = 100000;
      batch.remainingCostRupiah = batch.totalCostRupiah - usedCostRupiah; // Rp80.000 eksak integer
      batch.unitCostDisplay = Math.round(batch.totalCostRupiah / newInitial); // 83

      // Verifikasi setelah Edit Pilihan A:
      expect(batch.initialRobux).toBe(1200);
      expect(batch.remainingRobux).toBe(1000);
      expect(batch.totalCostRupiah).toBe(100000);
      expect(batch.remainingCostRupiah).toBe(80000);
      // Entri kas tidak berubah sama sekali di Pilihan A
      expect(cashLedger.find((c) => c.sourceId === batch.id)?.amountRupiah).toBe(100000);

      // 4. Void Penjualan (voidSale): Rollback alokasi 200 Robux dan Rp20.000 kembali ke batch
      const alloc = sale.allocations[0];
      batch.remainingRobux = Math.min(batch.initialRobux, batch.remainingRobux + alloc.robuxTaken);
      batch.remainingCostRupiah = Math.min(batch.totalCostRupiah, batch.remainingCostRupiah + alloc.costAllocatedRupiah);
      sale.status = 'VOID';

      // Hapus entri kas terkait penjualan ini (sebagaimana logika di repository.ts voidSale)
      cashLedger = cashLedger.filter((c) => c.sourceId !== sale.id);

      // 5. Cek Konsistensi Total:
      // Sisa stok kembali 1.200 R$ utuh (100% dari initialRobux yang baru)
      expect(batch.remainingRobux).toBe(1200);
      // Sisa modal kembali Rp100.000 utuh (100% dari totalCost yang baru)
      expect(batch.remainingCostRupiah).toBe(100000);
      // Kas masuk penjualan terhapus, hanya tersisa pengeluaran restock Rp100.000
      expect(cashLedger.length).toBe(1);
      expect(cashLedger[0].type).toBe('OUT');
      expect(cashLedger[0].amountRupiah).toBe(100000);

      // 6. Uji Hapus Batch (deleteStockBatch) setelah siklus void:
      // Karena batch.remainingRobux === batch.initialRobux (1200 === 1200), batch boleh dihapus!
      const canDelete = batch.remainingRobux === batch.initialRobux;
      expect(canDelete).toBe(true);

      // Saat deleteStockBatch dijalankan, entri kas dengan sourceId === batch.id dihapus
      cashLedger = cashLedger.filter((c) => c.sourceId !== batch.id);
      expect(cashLedger.length).toBe(0); // Kas bersih kembali ke 0!
    });

    it('4.2. Urutan Siklus Pilihan B: Harga per R$ Tetap Rp100, 1.000 R$ -> Jual 200 R$ -> Edit ke 1.200 R$ -> Void -> Hapus Batch', () => {
      // 1. Restock awal: 1.000 Robux @ Rp100 = Rp100.000 (Kas Sendiri)
      const batch: StockBatch = {
        id: 'BATCH-LIFECYCLE-B',
        createdAt: '2026-11-01T10:00:00.000Z',
        sourceType: 'RESTOCK',
        initialRobux: 1000,
        remainingRobux: 1000,
        totalCostRupiah: 100000,
        remainingCostRupiah: 100000,
        unitCostDisplay: 100,
        fundingSource: 'OWN_FUNDS',
        ownFundsRupiah: 100000,
      };

      let cashLedger: Array<{ id: string; type: 'IN' | 'OUT'; amountRupiah: number; sourceId: string; notes?: string }> = [
        {
          id: 'CASH-RESTOCK-B',
          type: 'OUT',
          amountRupiah: 100000,
          sourceId: batch.id,
          notes: 'Restock 1.000 R$',
        },
      ];

      // 2. Jual 200 Robux seharga Rp30.000
      const robuxSold = 200;
      const cogsAllocated = Math.round((robuxSold / batch.remainingRobux) * batch.remainingCostRupiah); // 20.000
      batch.remainingRobux -= robuxSold; // 800
      batch.remainingCostRupiah -= cogsAllocated; // 80.000

      const sale = {
        id: 'INV-1002',
        robuxSold: 200,
        allocations: [{ batchId: batch.id, robuxTaken: robuxSold, costAllocatedRupiah: cogsAllocated }],
      };
      cashLedger.push({
        id: 'CASH-SALE-2',
        type: 'IN',
        amountRupiah: 30000,
        sourceId: sale.id,
      });

      // 3. Edit Jumlah Robux dengan Pilihan B (KEEP_UNIT_COST): Ubah initial dari 1.000 -> 1.200
      const newInitial = 1200;
      const unitCost = batch.unitCostDisplay; // 100
      const newTotalCost = Math.round(newInitial * unitCost); // 120.000
      const deltaCost = newTotalCost - batch.totalCostRupiah; // +20.000
      const deltaRobux = newInitial - batch.initialRobux; // +200

      const usedCostRupiah = batch.totalCostRupiah - batch.remainingCostRupiah; // 20.000
      batch.initialRobux = newInitial;
      batch.remainingRobux = batch.remainingRobux + deltaRobux; // 800 + 200 = 1.000
      batch.totalCostRupiah = newTotalCost; // Rp120.000
      batch.remainingCostRupiah = newTotalCost - usedCostRupiah; // 120.000 - 20.000 = Rp100.000

      // Di repository.ts: Entri cashLedger lama diubah in-place nominalnya (tidak ada entri ganda!)
      const restockCash = cashLedger.find((c) => c.sourceId === batch.id && c.type === 'OUT');
      expect(restockCash).toBeDefined();
      if (restockCash) {
        restockCash.amountRupiah += deltaCost; // 100.000 + 20.000 = 120.000
        restockCash.notes = `Restock ${newInitial} R$ (Koreksi Jumlah)`;
      }

      // Verifikasi setelah Edit Pilihan B:
      expect(batch.remainingRobux).toBe(1000);
      expect(batch.remainingCostRupiah).toBe(100000);
      expect(batch.totalCostRupiah).toBe(120000);
      expect(restockCash?.amountRupiah).toBe(120000);

      // 4. Void Penjualan
      const alloc = sale.allocations[0];
      batch.remainingRobux = Math.min(batch.initialRobux, batch.remainingRobux + alloc.robuxTaken); // 1.000 + 200 = 1.200
      batch.remainingCostRupiah = Math.min(batch.totalCostRupiah, batch.remainingCostRupiah + alloc.costAllocatedRupiah); // 100.000 + 20.000 = 120.000
      // Kas penjualan dihapus
      cashLedger = cashLedger.filter((c) => c.sourceId !== sale.id);

      // 5. Verifikasi Konsistensi:
      expect(batch.remainingRobux).toBe(1200);
      expect(batch.remainingCostRupiah).toBe(120000);
      expect(cashLedger.length).toBe(1);
      expect(cashLedger[0].amountRupiah).toBe(120000); // Kas keluar pas Rp120.000

      // 6. Hapus Batch Utuh (deleteStockBatch):
      expect(batch.remainingRobux).toBe(batch.initialRobux);
      cashLedger = cashLedger.filter((c) => c.sourceId !== batch.id);
      expect(cashLedger.length).toBe(0); // Kas terhapus bersih tanpa jejak atau selisih!
    });
  });
});
