import React, { useState, useEffect, useRef } from 'react';
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
} from 'lucide-react';
import Cropper from 'react-easy-crop';
import { z } from 'zod';
import { db } from '../../db/db';
import { repository } from '../../db/repository';
import { AppSettings } from '../../db/schema';
import { applyTheme } from '../../utils/theme';
import { isSoundEnabled, setSoundEnabled, playTapSound } from '../../utils/sound';
import {
  showSuccessAlert,
  showErrorAlert,
  showWarningAlert,
  showConfirmDialog,
} from '../../utils/alert';

const APP_VERSION = '2.0.0';

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

      await showSuccessAlert('Cadangan Berhasil', 'File cadangan JSON berhasil diunduh ke perangkat Anda.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal membuat file cadangan';
      await showErrorAlert('Gagal Cadangan', msg);
    }
  };

  // Impor / Pulihkan Database JSON
  const handleRestoreBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const rawJson = JSON.parse(event.target?.result as string);
        const parsed = BackupSchema.safeParse(rawJson);

        if (!parsed.success) {
          throw new Error('Format file cadangan tidak valid atau rusak!');
        }

        const ok = await showConfirmDialog({
          title: 'Pulihkan Data Cadangan?',
          text: 'Data saat ini di aplikasi akan ditimpa dengan data dari file cadangan ini. Lanjutkan?',
          confirmButtonText: 'Ya, Pulihkan Sekarang',
          isDanger: true,
        });

        if (!ok) return;

        const data = parsed.data;

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
          }
        );

        await loadSettings();
        if (onSettingsChanged) onSettingsChanged();
        await showSuccessAlert('Pemulihan Sukses', 'Seluruh data berhasil dipulihkan dari cadangan.');
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'File tidak dapat diproses';
        await showErrorAlert('Gagal Memulihkan Data', msg);
      } finally {
        if (restoreInputRef.current) restoreInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
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
        ],
        async () => {
          await db.stockBatches.clear();
          await db.stockMovements.clear();
          await db.sales.clear();
          await db.personalUsages.clear();
          await db.cashLedger.clear();
          await db.auditLogs.clear();
          await db.ratePresets.clear();
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

      {/* Bagian 3: Cadangan & Pemulihan Data */}
      <div className="p-4 sm:p-5 rounded-2xl theme-bg-card border theme-border space-y-4">
        <h2 className="text-xs font-bold theme-text-secondary uppercase tracking-wider flex items-center gap-2">
          <ShieldCheck size={14} className="theme-text-muted" />
          <span>Cadangan Database Lokal</span>
        </h2>

        <p className="text-xs theme-text-secondary leading-relaxed">
          Seluruh data bisnis Anda disimpan 100% lokal di perangkat ini (IndexedDB).
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {/* Unduh Cadangan */}
          <button
            type="button"
            onClick={handleExportBackup}
            className="p-3 rounded-xl theme-bg-surface border theme-border hover:theme-bg-card flex items-center gap-3 transition text-left"
          >
            <div className="p-2 rounded-lg theme-bg-card theme-text-secondary border theme-border">
              <Download size={15} />
            </div>
            <div>
              <span className="text-xs font-semibold theme-text-primary block">
                Unduh Cadangan JSON
              </span>
              <span className="text-[10px] theme-text-muted">
                Ekspor seluruh data ke file
              </span>
            </div>
          </button>

          {/* Pulihkan Cadangan */}
          <div>
            <input
              type="file"
              ref={restoreInputRef}
              onChange={handleRestoreBackup}
              accept=".json"
              className="hidden"
            />
            <button
              type="button"
              onClick={() => restoreInputRef.current?.click()}
              className="w-full p-3 rounded-xl theme-bg-surface border theme-border hover:theme-bg-card flex items-center gap-3 transition text-left"
            >
              <div className="p-2 rounded-lg theme-bg-card theme-text-secondary border theme-border">
                <Upload size={15} />
              </div>
              <div>
                <span className="text-xs font-semibold theme-text-primary block">
                  Pulihkan dari JSON
                </span>
                <span className="text-[10px] theme-text-muted">
                  Validasi ketat skema Zod
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
    </div>
  );
};
