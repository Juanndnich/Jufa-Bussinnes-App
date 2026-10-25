import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Settings,
  Moon,
  Sun,
  Monitor,
  Download,
  Upload,
  Trash2,
  Image as ImageIcon,
  Palette,
  Store,
  ShieldCheck,
  Volume2,
  VolumeX,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
  Clock,
  Database,
  Copy,
  FileCode,
} from 'lucide-react';
import Cropper from 'react-easy-crop';
import { z } from 'zod';
import { db } from '../../db/db';
import { repository } from '../../db/repository';
import { AppSettings } from '../../db/schema';
import { applyTheme } from '../../utils/theme';
import { isSoundEnabled, setSoundEnabled, playTapSound, playSuccessSound } from '../../utils/sound';
import { exportSalesToCsv, exportCashLedgerToCsv } from '../../utils/exportCsv';
import { formatDateJakarta } from '../../utils/formatters';
import {
  showSuccessAlert,
  showErrorAlert,
  showWarningAlert,
  showConfirmDialog,
} from '../../utils/alert';

const APP_VERSION = '2.1.0';

// Zod Schema untuk validasi file backup
const BackupSchema = z.object({
  version: z.number().optional(),
  exportedAt: z.string().optional(),
  settings: z.array(z.any()).optional(),
  ratePresets: z.array(z.any()).optional(),
  stockBatches: z.array(z.any()).optional(),
  stockMovements: z.array(z.any()).optional(),
  sales: z.array(z.any()).optional(),
  personalUsages: z.array(z.any()).optional(),
  cashLedger: z.array(z.any()).optional(),
  categories: z.array(z.any()).optional(),
  auditLogs: z.array(z.any()).optional(),
  investors: z.array(z.any()).optional(),
  investorPayouts: z.array(z.any()).optional(),
});

interface SettingsViewProps {
  onSettingsChanged?: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ onSettingsChanged }) => {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [storeName, setStoreName] = useState('JufaStore');
  const [themeMode, setThemeMode] = useState<'system' | 'light' | 'dark'>('dark');
  const [soundEnabled, setSoundActive] = useState<boolean>(() => isSoundEnabled());

  // Cropper state
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
  const [showCropModal, setShowCropModal] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const restoreInputRef = useRef<HTMLInputElement>(null);

  // State Modal Tempel Teks Database JSON
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [pasteJsonText, setPasteJsonText] = useState('');
  const [isRestoringText, setIsRestoringText] = useState(false);

  const loadSettings = async () => {
    try {
      const s = await repository.getSettings();
      setSettings(s);
      setStoreName(s.storeName || 'JufaStore');
      setThemeMode(s.theme || 'dark');
    } catch (err) {
      console.error('Failed to load settings:', err);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  // Status & Indikator Pengingat Cadangan Terakhir
  const backupStatus = useMemo(() => {
    if (!settings?.lastBackupAt) {
      return {
        hasBackup: false,
        isOutdated: true,
        label: 'Belum Pernah Dicadangkan',
        description:
          'Seluruh data bisnis disimpan 100% di perangkat ini. Disarankan mengunduh cadangan JSON secara berkala agar pembukuan aman jika riwayat browser/HP dibersihkan.',
      };
    }
    const diffDays = Math.floor(
      (Date.now() - new Date(settings.lastBackupAt).getTime()) / (1000 * 60 * 60 * 24)
    );
    const isOutdated = diffDays >= 7;
    return {
      hasBackup: true,
      isOutdated,
      label: isOutdated
        ? `Sudah ${diffDays} Hari Belum Dicadangkan`
        : 'Cadangan Data Terkini',
      description: `Terakhir dicadangkan: ${formatDateJakarta(settings.lastBackupAt)}. ${
        isOutdated
          ? 'Sudah lebih dari seminggu sejak pencadangan terakhir. Unduh cadangan terbaru untuk mencegah risiko kehilangan data.'
          : 'Data lokal Anda sudah dicadangkan dengan aman.'
      }`,
    };
  }, [settings?.lastBackupAt]);

  // Update theme
  const handleThemeChange = async (mode: 'system' | 'light' | 'dark') => {
    setThemeMode(mode);
    applyTheme(mode);
    await repository.updateSettings({ theme: mode });
    if (onSettingsChanged) onSettingsChanged();
  };

  // Save store name
  const handleSaveStoreName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeName.trim()) return;
    await repository.updateSettings({ storeName: storeName.trim() });
    await showSuccessAlert('Nama Toko Disimpan', `Identitas toko diperbarui menjadi "${storeName.trim()}".`);
    if (onSettingsChanged) onSettingsChanged();
  };

  // Handle Logo Upload
  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      if (!file.type.startsWith('image/')) {
        showWarningAlert('File Tidak Didukung', 'Silakan pilih file gambar (JPG, PNG, WebP).');
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        setImageSrc(reader.result as string);
        setShowCropModal(true);
      };
      reader.readAsDataURL(file);
    }
  };

  // Create cropped image
  const handleCropSave = async () => {
    if (!imageSrc || !croppedAreaPixels) return;

    try {
      const img = new Image();
      img.src = imageSrc;
      await new Promise((res) => (img.onload = res));

      const canvas = document.createElement('canvas');
      canvas.width = croppedAreaPixels.width;
      canvas.height = croppedAreaPixels.height;
      const ctx = canvas.getContext('2d');

      if (!ctx) return;
      ctx.drawImage(
        img,
        croppedAreaPixels.x,
        croppedAreaPixels.y,
        croppedAreaPixels.width,
        croppedAreaPixels.height,
        0,
        0,
        croppedAreaPixels.width,
        croppedAreaPixels.height
      );

      const base64 = canvas.toDataURL('image/png', 0.85);
      await repository.updateSettings({ customLogoUrl: base64 });
      setShowCropModal(false);
      setImageSrc(null);
      await loadSettings();
      await showSuccessAlert('Logo Disimpan', 'Logo toko berhasil diperbarui.');
      if (onSettingsChanged) onSettingsChanged();
    } catch (err) {
      console.error('Failed to crop logo:', err);
      await showErrorAlert('Gagal Memotong Gambar', 'Terjadi kesalahan saat memproses logo.');
    }
  };

  // Hapus Logo Kustom
  const handleRemoveLogo = async () => {
    await repository.updateSettings({ customLogoUrl: null });
    await loadSettings();
    await showSuccessAlert('Logo Dihapus', 'Logo kembali ke ikon default.');
    if (onSettingsChanged) onSettingsChanged();
  };

  // Ekspor Database Backup JSON
  const handleExportBackup = async () => {
    try {
      const [
        s,
        presets,
        batches,
        movements,
        sales,
        usages,
        ledger,
        cats,
        logs,
        invs,
        pays,
      ] = await Promise.all([
        db.settings.toArray(),
        db.ratePresets.toArray(),
        db.stockBatches.toArray(),
        db.stockMovements.toArray(),
        db.sales.toArray(),
        db.personalUsages.toArray(),
        db.cashLedger.toArray(),
        db.categories.toArray(),
        db.auditLogs.toArray(),
        db.investors.toArray(),
        db.investorPayouts.toArray(),
      ]);

      const backupData = {
        version: 2,
        exportedAt: new Date().toISOString(),
        settings: s,
        ratePresets: presets,
        stockBatches: batches,
        stockMovements: movements,
        sales,
        personalUsages: usages,
        cashLedger: ledger,
        categories: cats,
        auditLogs: logs,
        investors: invs,
        investorPayouts: pays,
      };

      const jsonStr = JSON.stringify(backupData, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `JufaStore_Backup_${Date.now()}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      const nowIso = new Date().toISOString();
      await repository.updateSettings({ lastBackupAt: nowIso });
      setSettings((prev) => (prev ? { ...prev, lastBackupAt: nowIso } : null));
      if (onSettingsChanged) onSettingsChanged();

      playSuccessSound();
      await showSuccessAlert('Ekspor Database Berhasil', 'File cadangan JSON berhasil diunduh ke perangkat Anda.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal membuat file cadangan';
      await showErrorAlert('Gagal Ekspor', msg);
    }
  };

  // Salin Teks Database JSON ke Clipboard
  const handleCopyBackupJson = async () => {
    try {
      playTapSound();
      const [
        s,
        presets,
        batches,
        movements,
        sales,
        usages,
        ledger,
        cats,
        logs,
        invs,
        pays,
      ] = await Promise.all([
        db.settings.toArray(),
        db.ratePresets.toArray(),
        db.stockBatches.toArray(),
        db.stockMovements.toArray(),
        db.sales.toArray(),
        db.personalUsages.toArray(),
        db.cashLedger.toArray(),
        db.categories.toArray(),
        db.auditLogs.toArray(),
        db.investors.toArray(),
        db.investorPayouts.toArray(),
      ]);

      const backupData = {
        version: 2,
        exportedAt: new Date().toISOString(),
        settings: s,
        ratePresets: presets,
        stockBatches: batches,
        stockMovements: movements,
        sales,
        personalUsages: usages,
        cashLedger: ledger,
        categories: cats,
        auditLogs: logs,
        investors: invs,
        investorPayouts: pays,
      };

      const jsonStr = JSON.stringify(backupData, null, 2);
      await navigator.clipboard.writeText(jsonStr);

      const nowIso = new Date().toISOString();
      await repository.updateSettings({ lastBackupAt: nowIso });
      setSettings((prev) => (prev ? { ...prev, lastBackupAt: nowIso } : null));
      if (onSettingsChanged) onSettingsChanged();

      playSuccessSound();
      await showSuccessAlert(
        'Teks Database Tersalin!',
        'Seluruh data JSON berhasil disalin ke clipboard. Anda bisa menyimpannya di catatan (Notes) atau mengirim ke perangkat lain.'
      );
    } catch (err: unknown) {
      console.error('Failed to copy backup json:', err);
      await showErrorAlert('Gagal Menyalin', 'Tidak dapat mengakses clipboard perangkat.');
    }
  };

  // Helper Pemulihan Data Bersama
  const executeRestore = async (data: z.infer<typeof BackupSchema>) => {
    await db.transaction(
      'rw',
      [
        db.settings,
        db.ratePresets,
        db.stockBatches,
        db.stockMovements,
        db.sales,
        db.personalUsages,
        db.cashLedger,
        db.categories,
        db.auditLogs,
        db.investors,
        db.investorPayouts,
      ],
      async () => {
        if (data.settings) {
          await db.settings.clear();
          await db.settings.bulkPut(data.settings);
        }
        if (data.ratePresets) {
          await db.ratePresets.clear();
          await db.ratePresets.bulkPut(data.ratePresets);
        }
        if (data.stockBatches) {
          await db.stockBatches.clear();
          await db.stockBatches.bulkPut(data.stockBatches);
        }
        if (data.stockMovements) {
          await db.stockMovements.clear();
          await db.stockMovements.bulkPut(data.stockMovements);
        }
        if (data.sales) {
          await db.sales.clear();
          await db.sales.bulkPut(data.sales);
        }
        if (data.personalUsages) {
          await db.personalUsages.clear();
          await db.personalUsages.bulkPut(data.personalUsages);
        }
        if (data.cashLedger) {
          await db.cashLedger.clear();
          await db.cashLedger.bulkPut(data.cashLedger);
        }
        if (data.categories) {
          await db.categories.clear();
          await db.categories.bulkPut(data.categories);
        }
        if (data.auditLogs) {
          await db.auditLogs.clear();
          await db.auditLogs.bulkPut(data.auditLogs);
        }
        if (data.investors) {
          await db.investors.clear();
          await db.investors.bulkPut(data.investors);
        }
        if (data.investorPayouts) {
          await db.investorPayouts.clear();
          await db.investorPayouts.bulkPut(data.investorPayouts);
        }
      }
    );

    const nowIso = new Date().toISOString();
    await repository.updateSettings({ lastBackupAt: nowIso });
    await loadSettings();
    if (onSettingsChanged) onSettingsChanged();

    playSuccessSound();
    await showSuccessAlert('Impor Berhasil', 'Seluruh data transaksi dan stok berhasil dipulihkan.');
  };

  // Impor / Pulihkan Database dari File JSON
  const handleRestoreBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const rawJson = JSON.parse(event.target?.result as string);
        const parsed = BackupSchema.safeParse(rawJson);

        if (!parsed.success) {
          throw new Error('Format file JSON tidak valid atau rusak!');
        }

        const ok = await showConfirmDialog({
          title: 'Impor & Pulihkan Database?',
          text: 'Data saat ini di aplikasi akan ditimpa dengan data dari file cadangan ini. Lanjutkan?',
          confirmButtonText: 'Ya, Pulihkan Sekarang',
          isDanger: true,
        });

        if (!ok) return;

        await executeRestore(parsed.data);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'File tidak dapat diproses';
        await showErrorAlert('Gagal Impor Data', msg);
      } finally {
        if (restoreInputRef.current) restoreInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  // Impor / Pulihkan Database dari Tempelan Teks JSON
  const handleRestoreFromText = async () => {
    if (!pasteJsonText.trim()) return;

    setIsRestoringText(true);
    try {
      const rawJson = JSON.parse(pasteJsonText.trim());
      const parsed = BackupSchema.safeParse(rawJson);

      if (!parsed.success) {
        throw new Error('Teks JSON tidak sesuai dengan skema backup JufaStore!');
      }

      const ok = await showConfirmDialog({
        title: 'Impor dari Teks JSON?',
        text: 'Data saat ini di aplikasi akan ditimpa dengan data JSON yang ditempel. Lanjutkan?',
        confirmButtonText: 'Ya, Pulihkan Data',
        isDanger: true,
      });

      if (!ok) {
        setIsRestoringText(false);
        return;
      }

      await executeRestore(parsed.data);
      setShowPasteModal(false);
      setPasteJsonText('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Format JSON tidak valid';
      await showErrorAlert('Gagal Memproses JSON', msg);
    } finally {
      setIsRestoringText(false);
    }
  };

  // Handler: Ekspor CSV Penjualan dari Pengaturan
  const handleExportSalesCsv = async () => {
    try {
      playTapSound();
      const allSales = await repository.getSales();
      if (allSales.length === 0) {
        await showWarningAlert('Data Kosong', 'Belum ada transaksi penjualan untuk diekspor.');
        return;
      }
      exportSalesToCsv(allSales);
    } catch (err: unknown) {
      console.error('Failed to export sales csv:', err);
    }
  };

  // Handler: Ekspor CSV Buku Kas dari Pengaturan
  const handleExportCashCsv = async () => {
    try {
      playTapSound();
      const [ledger, cats] = await Promise.all([
        repository.getCashLedger(),
        repository.getCategories(),
      ]);
      if (ledger.length === 0) {
        await showWarningAlert('Data Kosong', 'Buku kas masih kosong, belum ada transaksi untuk diekspor.');
        return;
      }
      exportCashLedgerToCsv(ledger, cats);
    } catch (err: unknown) {
      console.error('Failed to export cash csv:', err);
    }
  };

  // Reset Database Total ke NOL
  const handleResetDatabase = async () => {
    const ok = await showConfirmDialog({
      title: 'KOSONGKAN SELURUH DATA?',
      text: 'PERINGATAN: Semua stok Robux, riwayat penjualan, dan buku kas akan DIHAPUS PERMANEN dan dikembalikan ke 0 murni! Tindakan ini tidak dapat dibatalkan.',
      confirmButtonText: 'KOSONGKAN SEKARANG',
      isDanger: true,
    });

    if (ok) {
      await db.transaction(
        'rw',
        [
          db.stockBatches,
          db.stockMovements,
          db.sales,
          db.personalUsages,
          db.cashLedger,
          db.auditLogs,
          db.ratePresets,
          db.investors,
          db.investorPayouts,
        ],
        async () => {
          await db.stockBatches.clear();
          await db.stockMovements.clear();
          await db.sales.clear();
          await db.personalUsages.clear();
          await db.cashLedger.clear();
          await db.auditLogs.clear();
          await db.ratePresets.clear();
          await db.investors.clear();
          await db.investorPayouts.clear();
        }
      );

      if (onSettingsChanged) onSettingsChanged();
      await showSuccessAlert('Data Dikosongkan', 'Aplikasi kembali ke kondisi awal 0 murni.');
    }
  };

  return (
    <div className="space-y-4 max-w-4xl mx-auto pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b theme-border">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl theme-bg-card border theme-border theme-text-secondary">
            <Settings size={18} />
          </div>
          <div>
            <h1 className="text-base font-bold theme-text-primary tracking-tight">
              Pengaturan & Cadangan
            </h1>
            <p className="text-xs theme-text-muted">
              Pengaturan identitas toko, tema, cadangan data, & info aplikasi
            </p>
          </div>
        </div>

        {/* Versi Badge */}
        <div className="flex items-center gap-2 self-start sm:self-auto px-3 py-1 rounded-xl theme-bg-card border theme-border text-xs font-mono theme-text-secondary">
          <span>Versi:</span>
          <span className="font-bold text-emerald-500 dark:text-emerald-400">v{APP_VERSION}</span>
        </div>
      </div>

      {/* Bagian 1: Identitas Toko & Logo */}
      <div className="p-4 sm:p-5 rounded-2xl theme-bg-card border theme-border space-y-4">
        <h2 className="text-xs font-bold theme-text-secondary uppercase tracking-wider flex items-center gap-2">
          <Store size={14} className="theme-text-muted" />
          <span>Identitas & Logo Toko</span>
        </h2>

        <div className="flex flex-col sm:flex-row items-center gap-4">
          {/* Logo Preview */}
          <div className="relative group shrink-0">
            <div className="w-14 h-14 rounded-2xl overflow-hidden border theme-border theme-bg-surface flex items-center justify-center shadow-sm bg-black">
              <img
                src={settings?.customLogoUrl || '/app-icon.png'}
                alt="Logo Toko"
                className="w-full h-full object-cover"
              />
            </div>
          </div>

          <div className="space-y-2 flex-1 w-full">
            <form onSubmit={handleSaveStoreName} className="flex gap-2">
              <input
                type="text"
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                placeholder="Nama Toko"
                className="flex-1 px-3 py-2 rounded-xl theme-bg-input border theme-border text-xs theme-text-primary focus:outline-none focus:border-zinc-500 font-medium"
              />
              <button
                type="submit"
                className="px-4 py-2 rounded-xl theme-btn-primary hover:opacity-90 text-xs font-semibold transition"
              >
                Simpan
              </button>
            </form>

            <div className="flex items-center gap-2">
              <input
                type="file"
                ref={fileInputRef}
                onChange={onFileChange}
                accept="image/*"
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-1.5 rounded-lg theme-bg-surface border theme-border hover:theme-bg-card text-xs font-medium theme-text-secondary flex items-center gap-1.5 transition"
              >
                <ImageIcon size={13} />
                <span>Ganti Logo</span>
              </button>

              {settings?.customLogoUrl && (
                <button
                  type="button"
                  onClick={handleRemoveLogo}
                  className="px-3 py-1.5 rounded-lg theme-bg-surface border border-red-500/30 text-red-500 dark:text-red-400 hover:bg-red-500/10 text-xs font-medium transition"
                >
                  Kembali ke Default
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Bagian 2: Tampilan & Suara */}
      <div className="p-4 sm:p-5 rounded-2xl theme-bg-card border theme-border space-y-4">
        <h2 className="text-xs font-bold theme-text-secondary uppercase tracking-wider flex items-center gap-2">
          <Palette size={14} className="theme-text-muted" />
          <span>Tema & Efek Suara</span>
        </h2>

        {/* Pilihan Tema Terang / Gelap / Sistem */}
        <div className="grid grid-cols-3 gap-2 pt-1">
          <button
            type="button"
            onClick={() => handleThemeChange('dark')}
            className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition ${
              themeMode === 'dark'
                ? 'border-emerald-500 bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 font-semibold shadow-sm'
                : 'theme-border theme-bg-surface theme-text-muted hover:theme-text-primary hover:theme-bg-card'
            }`}
          >
            <Moon size={15} />
            <span className="text-xs font-medium">Mode Gelap</span>
          </button>

          <button
            type="button"
            onClick={() => handleThemeChange('light')}
            className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition ${
              themeMode === 'light'
                ? 'border-emerald-500 bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 font-semibold shadow-sm'
                : 'theme-border theme-bg-surface theme-text-muted hover:theme-text-primary hover:theme-bg-card'
            }`}
          >
            <Sun size={15} className="text-amber-500 dark:text-amber-400" />
            <span className="text-xs font-medium">Mode Terang</span>
          </button>

          <button
            type="button"
            onClick={() => handleThemeChange('system')}
            className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition ${
              themeMode === 'system'
                ? 'border-emerald-500 bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 font-semibold shadow-sm'
                : 'theme-border theme-bg-surface theme-text-muted hover:theme-text-primary hover:theme-bg-card'
            }`}
          >
            <Monitor size={15} className="text-blue-500 dark:text-blue-400" />
            <span className="text-xs font-medium">Ikuti Sistem</span>
          </button>
        </div>

        {/* Toggle Suara Tekan */}
        <div className="pt-2 border-t theme-border flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {soundEnabled ? (
              <Volume2 size={16} className="text-emerald-500 dark:text-emerald-400" />
            ) : (
              <VolumeX size={16} className="theme-text-muted" />
            )}
            <div>
              <span className="text-xs font-semibold theme-text-primary block">
                Efek Suara Tombol (Haptic Tap)
              </span>
              <span className="text-[10px] theme-text-muted">
                Suara klik halus saat menekan tombol & menu
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              const next = !soundEnabled;
              setSoundEnabled(next);
              setSoundActive(next);
              if (next) playTapSound();
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition border ${
              soundEnabled
                ? 'theme-bg-surface text-emerald-500 dark:text-emerald-400 theme-border'
                : 'theme-bg-input theme-text-muted theme-border'
            }`}
          >
            {soundEnabled ? 'Aktif' : 'Mati'}
          </button>
        </div>
      </div>

      {/* Bagian 3: Sistem Ekspor & Impor Database */}
      <div className="p-4 sm:p-5 rounded-2xl theme-bg-card border theme-border space-y-4">
        <div className="flex items-center gap-2.5 pb-2 border-b theme-border">
          <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
            <Database size={17} />
          </div>
          <div>
            <h2 className="text-sm font-bold theme-text-primary tracking-tight">
              Sistem Ekspor & Impor Database
            </h2>
            <p className="text-[11px] theme-text-secondary">
              Cadangkan dan pulihkan seluruh data bisnis (transaksi, stok, dan kas) secara aman
            </p>
          </div>
        </div>

        {/* Pengingat Status Cadangan Terakhir */}
        <div
          className={`p-3.5 rounded-xl border flex items-start gap-3 transition ${
            !backupStatus.hasBackup
              ? 'bg-amber-500/10 border-amber-500/25 text-amber-500 dark:text-amber-400'
              : backupStatus.isOutdated
              ? 'bg-red-500/10 border-red-500/25 text-red-500 dark:text-red-400'
              : 'bg-emerald-500/10 border-emerald-500/25 text-emerald-600 dark:text-emerald-400'
          }`}
        >
          {!backupStatus.hasBackup ? (
            <AlertCircle size={18} className="shrink-0 mt-0.5" />
          ) : backupStatus.isOutdated ? (
            <Clock size={18} className="shrink-0 mt-0.5" />
          ) : (
            <CheckCircle2 size={18} className="shrink-0 mt-0.5" />
          )}
          <div className="space-y-0.5">
            <span className="text-xs font-bold block">{backupStatus.label}</span>
            <p className="text-[11px] opacity-90 leading-relaxed">
              {backupStatus.description}
            </p>
          </div>
        </div>

        {/* Grid 4 Opsi Cadangan & Pemulihan Database JSON */}
        <div className="space-y-2">
          <span className="text-xs font-semibold theme-text-secondary block">
            Cadangan & Pemulihan Sistem Penuh (JSON)
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {/* Opsi 1: Ekspor File JSON */}
            <button
              type="button"
              onClick={handleExportBackup}
              className="p-3 rounded-xl theme-bg-surface border theme-border hover:theme-bg-card flex items-center gap-3 transition text-left shadow-sm"
            >
              <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                <Download size={16} />
              </div>
              <div>
                <span className="text-xs font-bold theme-text-primary block">
                  Ekspor Database (Unduh JSON)
                </span>
                <span className="text-[10px] theme-text-muted">
                  Simpan file backup database utuh
                </span>
              </div>
            </button>

            {/* Opsi 2: Impor File JSON */}
            <div>
              <input
                type="file"
                ref={restoreInputRef}
                onChange={handleRestoreBackup}
                accept="application/json,.json,text/plain,*/*"
                className="hidden"
              />
              <button
                type="button"
                onClick={() => restoreInputRef.current?.click()}
                className="w-full p-3 rounded-xl theme-bg-surface border theme-border hover:theme-bg-card flex items-center gap-3 transition text-left shadow-sm"
              >
                <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-500 border border-blue-500/20">
                  <Upload size={16} />
                </div>
                <div>
                  <span className="text-xs font-bold theme-text-primary block">
                    Impor Database (Pilih File JSON)
                  </span>
                  <span className="text-[10px] theme-text-muted">
                    Pulihkan data dari file cadangan
                  </span>
                </div>
              </button>
            </div>

            {/* Opsi 3: Salin Teks JSON ke Clipboard */}
            <button
              type="button"
              onClick={handleCopyBackupJson}
              className="p-3 rounded-xl theme-bg-surface border theme-border hover:theme-bg-card flex items-center gap-3 transition text-left"
            >
              <div className="p-2.5 rounded-xl theme-bg-card theme-text-secondary border theme-border">
                <Copy size={16} />
              </div>
              <div>
                <span className="text-xs font-semibold theme-text-primary block">
                  Salin Teks Database (Copy)
                </span>
                <span className="text-[10px] theme-text-muted">
                  Salin JSON ke clipboard / catatan
                </span>
              </div>
            </button>

            {/* Opsi 4: Tempel Teks JSON (Modal Input) */}
            <button
              type="button"
              onClick={() => {
                playTapSound();
                setShowPasteModal(true);
              }}
              className="p-3 rounded-xl theme-bg-surface border theme-border hover:theme-bg-card flex items-center gap-3 transition text-left"
            >
              <div className="p-2.5 rounded-xl theme-bg-card theme-text-secondary border theme-border">
                <FileCode size={16} />
              </div>
              <div>
                <span className="text-xs font-semibold theme-text-primary block">
                  Tempel Teks JSON (Paste)
                </span>
                <span className="text-[10px] theme-text-muted">
                  Impor data tanpa perlu milih file
                </span>
              </div>
            </button>
          </div>
        </div>

        {/* Ekspor Spreadsheet CSV (Excel) */}
        <div className="space-y-2 pt-2 border-t theme-border">
          <span className="text-xs font-semibold theme-text-secondary block">
            Ekspor Laporan ke Spreadsheet (CSV / Excel)
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={handleExportSalesCsv}
              className="p-3 rounded-xl theme-bg-surface border theme-border hover:theme-bg-card flex items-center gap-3 transition text-left"
            >
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                <FileSpreadsheet size={15} />
              </div>
              <div>
                <span className="text-xs font-semibold theme-text-primary block">
                  Ekspor Penjualan (.CSV)
                </span>
                <span className="text-[10px] theme-text-muted">
                  Buka riwayat invoice di Excel
                </span>
              </div>
            </button>

            <button
              type="button"
              onClick={handleExportCashCsv}
              className="p-3 rounded-xl theme-bg-surface border theme-border hover:theme-bg-card flex items-center gap-3 transition text-left"
            >
              <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500 border border-blue-500/20">
                <FileSpreadsheet size={15} />
              </div>
              <div>
                <span className="text-xs font-semibold theme-text-primary block">
                  Ekspor Buku Kas (.CSV)
                </span>
                <span className="text-[10px] theme-text-muted">
                  Arus kas masuk & keluar
                </span>
              </div>
            </button>
          </div>
        </div>

        {/* Reset Database */}
        <div className="pt-3 border-t theme-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <span className="text-xs font-semibold theme-text-primary block">
              Kosongkan Data (Reset ke 0)
            </span>
            <span className="text-[10px] theme-text-muted">
              Menghapus semua transaksi dan stok kembali bersih
            </span>
          </div>
          <button
            type="button"
            onClick={handleResetDatabase}
            className="px-3.5 py-1.5 rounded-xl theme-bg-surface border border-red-500/30 text-red-500 dark:text-red-400 hover:bg-red-500/10 text-xs font-medium transition flex items-center gap-1.5 self-start sm:self-auto"
          >
            <Trash2 size={12} />
            <span>Reset Data</span>
          </button>
        </div>
      </div>

      {/* Modal Cropper Logo */}
      {showCropModal && imageSrc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-2xl theme-bg-card border theme-border p-5 space-y-4 shadow-2xl">
            <h3 className="text-xs font-bold theme-text-primary uppercase tracking-wider">
              Sesuaikan Potongan Logo
            </h3>
            <div className="relative w-full h-60 bg-black rounded-xl overflow-hidden border theme-border">
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                aspect={1}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={(_, croppedPixels) => setCroppedAreaPixels(croppedPixels)}
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t theme-border">
              <button
                type="button"
                onClick={() => {
                  setShowCropModal(false);
                  setImageSrc(null);
                }}
                className="px-4 py-2 rounded-xl text-xs theme-text-muted hover:theme-text-primary"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleCropSave}
                className="px-4 py-2 rounded-xl theme-btn-primary hover:opacity-90 text-xs font-semibold transition shadow-sm"
              >
                Terapkan Logo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Tempel & Impor Teks Database JSON */}
      {showPasteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-2xl theme-bg-card border theme-border p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b theme-border">
              <div className="flex items-center gap-2">
                <FileCode size={18} className="text-emerald-500" />
                <h3 className="font-bold theme-text-primary text-sm">
                  Tempel & Impor Teks Database JSON
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  playTapSound();
                  setShowPasteModal(false);
                  setPasteJsonText('');
                }}
                className="text-xs theme-text-muted hover:theme-text-primary"
              >
                Tutup
              </button>
            </div>

            <p className="text-xs theme-text-secondary leading-relaxed">
              Tempelkan teks data cadangan JSON yang sebelumnya Anda salin. Sistem akan memvalidasi skema data secara otomatis sebelum memulihkan database.
            </p>

            <textarea
              rows={8}
              value={pasteJsonText}
              onChange={(e) => setPasteJsonText(e.target.value)}
              placeholder='Tempel teks JSON di sini (misal: {"version": 2, "settings": ...})'
              className="w-full p-3 rounded-xl theme-bg-input border theme-border text-xs font-mono theme-text-primary focus:outline-none focus:border-emerald-500"
            />

            <div className="flex items-center justify-end gap-2 pt-2 border-t theme-border">
              <button
                type="button"
                onClick={() => {
                  playTapSound();
                  setShowPasteModal(false);
                  setPasteJsonText('');
                }}
                disabled={isRestoringText}
                className="px-4 py-2 rounded-xl text-xs font-medium theme-text-secondary hover:theme-text-primary transition"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleRestoreFromText}
                disabled={!pasteJsonText.trim() || isRestoringText}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
              >
                <Upload size={14} />
                <span>{isRestoringText ? 'Memulihkan...' : 'Pulihkan Database Sekarang'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
