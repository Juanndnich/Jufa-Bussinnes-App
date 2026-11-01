import { describe, it, expect } from 'vitest';
import { BackupSchema } from '../features/settings/SettingsView';

describe('JufaStore - Default Sell Rate & Backup Schema Tests', () => {
  it('1.1. BackupSchema menerima backup yang memiliki defaultSellRate', () => {
    const backupWithRate = {
      version: 1,
      exportedAt: new Date().toISOString(),
      settings: [
        {
          id: 'current',
          storeName: 'JufaStore',
          theme: 'dark',
          accentColor: '#10b981',
          textSize: 'base',
          customLogoUrl: null,
          schemaVersion: 1,
          defaultSellRate: 165.5,
        },
      ],
      stockBatches: [],
      stockMovements: [],
      sales: [],
    };

    const parseResult = BackupSchema.safeParse(backupWithRate);
    expect(parseResult.success).toBe(true);
    if (parseResult.success) {
      expect(parseResult.data.settings?.[0].defaultSellRate).toBe(165.5);
    }
  });

  it('1.2. BackupSchema tetap kompatibel penuh dengan backup lama tanpa defaultSellRate', () => {
    const legacyBackup = {
      version: 1,
      exportedAt: new Date().toISOString(),
      settings: [
        {
          id: 'current',
          storeName: 'JufaStore',
          theme: 'dark',
          accentColor: '#10b981',
          textSize: 'base',
          customLogoUrl: null,
          schemaVersion: 1,
        },
      ],
      stockBatches: [],
      stockMovements: [],
      sales: [],
    };

    const parseResult = BackupSchema.safeParse(legacyBackup);
    expect(parseResult.success).toBe(true);
    if (parseResult.success) {
      expect(parseResult.data.settings?.[0].defaultSellRate).toBeUndefined();
    }
  });
});
