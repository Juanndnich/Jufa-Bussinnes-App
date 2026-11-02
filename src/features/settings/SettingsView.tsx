import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Capacitor } from '@capacitor/core';
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
  Cloud,
  CloudOff,
  RefreshCw,
  ExternalLink,
  Check,
  Globe,
  Radio,
  Rocket,
  Eye,
  EyeOff,
  Edit3,
  MoreVertical,
} from 'lucide-react';
import Cropper from 'react-easy-crop';
import { z } from 'zod';
import { db } from '../../db/db';
import { repository } from '../../db/repository';
import { AppSettings } from '../../db/schema';
import { applyTheme } from '../../utils/theme';
import { isSoundEnabled, setSoundEnabled, isButtonSoundEnabled, setButtonSoundEnabled, isTxSoundEnabled, setTxSoundEnabled, getMasterVolume, setMasterVolume, playTapSound, playSuccessSound, testSound } from '../../utils/sound';
import { exportSalesToCsv, exportCashLedgerToCsv } from '../../utils/exportCsv';
import { formatDateJakarta } from '../../utils/formatters';
import {
  showSuccessAlert,
  showErrorAlert,
  showWarningAlert,
  showConfirmDialog,
} from '../../utils/alert';
import { getSpreadsheetOpenUrl } from '../../utils/googleSheets';

import {
  subscribeUpdateState,
  checkForUpdates,
  getInstalledVersion,
  promptUpdateDialog,
  UpdateInfo,
} from '../../services/updateChecker';

const APP_VERSION = '2.1.0';

import {
  exportBackupToFile,
  getBackupJsonString,
  restoreFromFile,
  restoreFromJsonText,
  BackupSchema,
  StockMovementBackupSchema,
} from '../../services/backupService';
import {
  SheetsSyncState,
  subscribeSheetsSyncState,
  triggerSyncNow,
  triggerFullSheetsSync,
  testSheetsConnection,
  requestSetupSheets,
  resetSheetsSettings,
  SHEETS_CODE_GS_TEMPLATE,
} from '../../services/sheetsSync';

export { BackupSchema, StockMovementBackupSchema } from '../../services/backupService';

interface SettingsViewProps {
  onSettingsChanged?: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ onSettingsChanged }) => {
  const [currentVersion, setCurrentVersion] = useState<string>('2.1.0');
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);

  useEffect(() => {
    getInstalledVersion().then(setCurrentVersion);
    const unsub = subscribeUpdateState(setUpdateInfo);
    return () => unsub();
  }, []);

  const handleCheckUpdate = async () => {
    playTapSound();
    setIsCheckingUpdate(true);
    try {
      await checkForUpdates({ manual: true });
    } finally {
      setIsCheckingUpdate(false);
    }
  };
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [storeName, setStoreName] = useState('JufaStore');
  const [themeMode, setThemeMode] = useState<'system' | 'light' | 'dark'>('dark');
  const [soundEnabled, setSoundActive] = useState<boolean>(() => isSoundEnabled());
  const [buttonSound, setButtonSound] = useState<boolean>(() => isButtonSoundEnabled());
  const [txSound, setTxSound] = useState<boolean>(() => isTxSoundEnabled());
  const [soundVolume, setSoundVolume] = useState<number>(() => getMasterVolume());

  // Google Sheets Cloud Sync State V2
  const [sheetsWebhookUrl, setSheetsWebhookUrl] = useState('');
  const [sheetsSecret, setSheetsSecret] = useState('');
  const [googleSpreadsheetDocUrl, setGoogleSpreadsheetDocUrl] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [sheetsSyncEnabled, setSheetsSyncEnabled] = useState(false);
  const [isEditingConnection, setIsEditingConnection] = useState(false);
  const [showAdvancedDropdown, setShowAdvancedDropdown] = useState(false);
  const [hasLegacyTokenNotice, setHasLegacyTokenNotice] = useState(false);
  const [sheetsSyncState, setSheetsSyncState] = useState<SheetsSyncState | null>(null);

  const [isTestingSheets, setIsTestingSheets] = useState(false);
  const [isSyncingSheets, setIsSyncingSheets] = useState(false);
  const [isInitializingTable, setIsInitializingTable] = useState(false);
  const [showScriptGuideModal, setShowScriptGuideModal] = useState(false);

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
      const loadedUrl = s.sheetsWebhookUrl || s.googleSheetsUrl || '';
      const loadedSecret = s.sheetsSecret || '';
      setSheetsWebhookUrl(loadedUrl);
      setSheetsSecret(loadedSecret);
      setGoogleSpreadsheetDocUrl(s.googleSpreadsheetDocUrl || '');
      setSheetsSyncEnabled(s.sheetsSyncEnabled ?? false);
      setHasLegacyTokenNotice(!!s.googleSheetsToken && !s.sheetsSecret);
      setIsEditingConnection(!loadedUrl || !loadedSecret);
    } catch (err) {
      console.error('Failed to load settings:', err);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  useEffect(() => {
    const unsub = subscribeSheetsSyncState((st) => {
      setSheetsSyncState(st);
    });
    return unsub;
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


  // Helper: Mask URL Web App
  const maskUrl = (url: string) => {
    if (!url) return '';
    if (url.length <= 42) return url;
    return url.slice(0, 30) + '...' + url.slice(-10);
  };

  // Handler: Buka Spreadsheet di Tab Baru
  const handleOpenSpreadsheetDoc = () => {
    playTapSound();
    const docUrl = googleSpreadsheetDocUrl.trim();
    if (!docUrl) {
      showWarningAlert('Tautan Belum Diisi', 'Masukkan link Google Spreadsheet Anda terlebih dahulu.');
      return;
    }
    const finalUrl = getSpreadsheetOpenUrl(docUrl);
    window.open(finalUrl, '_blank');
  };

  // Handler: Toggle Aktif/Nonaktif Sinkronisasi Otomatis
  const handleToggleSyncEnabled = async () => {
    playTapSound();
    const nextVal = !sheetsSyncEnabled;
    setSheetsSyncEnabled(nextVal);
    await repository.updateSettings({ sheetsSyncEnabled: nextVal });
    if (nextVal) {
      triggerSyncNow().catch(() => {});
    }
  };

  // Handler: Uji Koneksi Google Sheets & Simpan
  const handleTestAndSaveConnection = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    playTapSound();
    const cleanUrl = sheetsWebhookUrl.trim();
    const cleanSecret = sheetsSecret.trim();

    if (!cleanUrl) {
      await showWarningAlert('URL Masih Kosong', 'Masukkan URL Web App Apps Script (berakhiran /exec) terlebih dahulu.');
      return;
    }
    if (!cleanSecret) {
      await showWarningAlert('Kode Rahasia Kosong', 'Masukkan Kode Rahasia yang didapatkan dari log eksekusi fungsi setup() di Apps Script.');
      return;
    }

    if (cleanUrl.includes('docs.google.com/spreadsheets')) {
      setGoogleSpreadsheetDocUrl(cleanUrl);
      setSheetsWebhookUrl('');
      await repository.updateSettings({ googleSpreadsheetDocUrl: cleanUrl });
      await showWarningAlert(
        'Tautan Tersimpan sebagai Link Dokumen',
        'Tautan yang Anda masukkan adalah link Spreadsheet Anda, bukan URL Web App. Kami telah memindahkannya ke kolom Link Dokumen.'
      );
      setShowScriptGuideModal(true);
      return;
    }

    setIsTestingSheets(true);
    try {
      const res = await testSheetsConnection(cleanUrl, cleanSecret);
      if (res.ok) {
        await repository.updateSettings({
          sheetsWebhookUrl: cleanUrl,
          sheetsSecret: cleanSecret,
          sheetsSyncEnabled: true,
          googleSpreadsheetDocUrl: googleSpreadsheetDocUrl.trim() || undefined,
          googleSheetsToken: undefined,
        });
        setSheetsSyncEnabled(true);
        setIsEditingConnection(false);
        setHasLegacyTokenNotice(false);
        await loadSettings();
        playSuccessSound();

        const askFull = await showConfirmDialog({
          title: 'Koneksi Berhasil!',
          text: 'Jembatan Google Apps Script berhasil terhubung. Kirim seluruh data Anda ke Google Spreadsheet sekarang?',
          confirmButtonText: 'Kirim Data Sekarang',
          cancelButtonText: 'Nanti Saja',
        });
        if (askFull) {
          setIsSyncingSheets(true);
          try {
            const syncRes = await triggerFullSheetsSync();
            if (syncRes.success) {
              await showSuccessAlert('Sinkronisasi Selesai', syncRes.message);
            } else {
              await showErrorAlert('Gagal Sinkron', syncRes.message);
            }
          } finally {
            setIsSyncingSheets(false);
          }
        }
      } else {
        await showErrorAlert('Koneksi Gagal', res.message);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal menguji koneksi';
      await showErrorAlert('Gagal', msg);
    } finally {
      setIsTestingSheets(false);
    }
  };

  // Handler: Sinkron Sekarang (Hanya yang Berubah)
  const handleSyncSheetsNow = async () => {
    playTapSound();
    if (!sheetsWebhookUrl.trim() || !sheetsSecret.trim()) {
      await showWarningAlert('Belum Terhubung', 'Hubungkan Web App dan Kode Rahasia Google Sheets terlebih dahulu.');
      return;
    }

    setIsSyncingSheets(true);
    try {
      const res = await triggerSyncNow();
      if (res.success) {
        playSuccessSound();
        await showSuccessAlert('Sinkronisasi Selesai', res.message);
      } else {
        await showErrorAlert('Sinkronisasi Gagal', res.message);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal melakukan sinkronisasi';
      await showErrorAlert('Gagal', msg);
    } finally {
      setIsSyncingSheets(false);
    }
  };

  // Handler: Sinkronisasi Penuh (Kirim Ulang Seluruh Tabel)
  const handleFullSync = async () => {
    playTapSound();
    if (!sheetsWebhookUrl.trim() || !sheetsSecret.trim()) {
      await showWarningAlert('Belum Terhubung', 'Hubungkan Web App dan Kode Rahasia Google Sheets terlebih dahulu.');
      return;
    }

    const ok = await showConfirmDialog({
      title: 'Sinkronisasi Penuh?',
      text: 'Seluruh 9 tabel dan dasbor ringkasan akan dikirim ulang ke Google Spreadsheet tanpa memeriksa sidik jari.',
      confirmButtonText: 'Ya, Sinkron Penuh',
      cancelButtonText: 'Batal',
    });
    if (!ok) return;

    setIsSyncingSheets(true);
    try {
      const res = await triggerFullSheetsSync();
      if (res.success) {
        playSuccessSound();
        await showSuccessAlert('Sinkronisasi Penuh Berhasil', res.message);
      } else {
        await showErrorAlert('Gagal Sinkron Penuh', res.message);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal memicu sinkronisasi penuh';
      await showErrorAlert('Gagal', msg);
    } finally {
      setIsSyncingSheets(false);
    }
  };

  // Handler: Buat & Rapikan Struktur 10 Sheet
  const handleInitializeTable = async () => {
    playTapSound();
    if (!sheetsWebhookUrl.trim() || !sheetsSecret.trim()) {
      await showWarningAlert('Belum Terhubung', 'Hubungkan Web App dan Kode Rahasia Google Sheets terlebih dahulu.');
      return;
    }

    setIsInitializingTable(true);
    try {
      const res = await requestSetupSheets(sheetsWebhookUrl.trim(), sheetsSecret.trim());
      if (res.ok) {
        playSuccessSound();
        const ok = await showConfirmDialog({
          title: 'Struktur Sheet Selesai Dirapikan!',
          text: 'Seluruh 10 tab sheet telah dibuat dan dirapikan di Google Spreadsheet. Buka dokumen spreadsheet Anda sekarang?',
          confirmButtonText: 'Buka Spreadsheet',
          cancelButtonText: 'Tutup',
        });
        if (ok && googleSpreadsheetDocUrl.trim()) {
          window.open(getSpreadsheetOpenUrl(googleSpreadsheetDocUrl.trim()), '_blank');
        }
      } else {
        await showErrorAlert('Gagal Merapikan Sheet', res.message);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Terjadi kesalahan';
      await showErrorAlert('Gagal', msg);
    } finally {
      setIsInitializingTable(false);
    }
  };

  // Handler: Salin Template Script Google Apps Script
  const handleCopyAppsScript = async () => {
    playTapSound();
    let copied = false;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(SHEETS_CODE_GS_TEMPLATE);
        copied = true;
      }
    } catch {
      copied = false;
    }

    if (!copied) {
      try {
        const textarea = document.getElementById('appsScriptTextArea') as HTMLTextAreaElement;
        if (textarea) {
          textarea.select();
          document.execCommand('copy');
          copied = true;
        }
      } catch {
        copied = false;
      }
    }

    if (copied) {
      playSuccessSound();
      await showSuccessAlert(
        'Kode Berhasil Disalin!',
        'Tempelkan kode ini ke editor Google Apps Script di spreadsheet Anda, jalankan fungsi setup(), lalu Deploy sebagai Web App dengan akses "Anyone".'
      );
    } else {
      await showWarningAlert(
        'Seleksi Manual',
        'Silakan seleksi seluruh teks pada kotak kode dan tekan Ctrl+C pada keyboard Anda.'
      );
    }
  };

  // Handler: Reset Pengaturan Sheets
  const handleResetSheets = async () => {
    playTapSound();
    setShowAdvancedDropdown(false);
    const ok = await showConfirmDialog({
      title: 'Reset Pengaturan Sheets?',
      text: 'Pengaturan URL Web App, Kode Rahasia, dan riwayat sidik jari tabel akan dihapus dari perangkat ini. Data di spreadsheet Anda tidak akan terhapus.',
      confirmButtonText: 'Ya, Reset',
      cancelButtonText: 'Batal',
    });
    if (!ok) return;

    await resetSheetsSettings();
    setSheetsWebhookUrl('');
    setSheetsSecret('');
    setSheetsSyncEnabled(false);
    setIsEditingConnection(true);
    playSuccessSound();
    await showSuccessAlert('Pengaturan Direset', 'Pengaturan sinkronisasi Google Sheets telah dibersihkan.');
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
      const nowIso = await exportBackupToFile();
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
      const { jsonStr, timestamp } = await getBackupJsonString();
      await navigator.clipboard.writeText(jsonStr);
      setSettings((prev) => (prev ? { ...prev, lastBackupAt: timestamp } : null));
      if (onSettingsChanged) onSettingsChanged();
      playSuccessSound();
      await showSuccessAlert(
        'Teks Database Tersalin!',
        'Seluruh data JSON berhasil disalin ke clipboard tanpa token rahasia. Anda bisa menyimpannya di catatan (Notes) atau mengirim ke perangkat lain.'
      );
    } catch (err: unknown) {
      console.error('Failed to copy backup json:', err);
      await showErrorAlert('Gagal Menyalin', 'Tidak dapat mengakses clipboard perangkat.');
    }
  };

  // Impor / Pulihkan Database dari File JSON
  const handleRestoreBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const ok = await showConfirmDialog({
          title: 'Impor & Pulihkan Database?',
          text: 'Data saat ini di aplikasi akan ditimpa dengan data dari file cadangan ini. Lanjutkan?',
          confirmButtonText: 'Ya, Pulihkan Sekarang',
          isDanger: true,
        });

        if (!ok) return;

        await restoreFromFile(file);
        await loadSettings();
        if (onSettingsChanged) onSettingsChanged();
        playSuccessSound();
        await showSuccessAlert('Impor Berhasil', 'Seluruh data transaksi dan stok berhasil dipulihkan dan antrean sinkron penuh dimulai.');
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

      await restoreFromJsonText(pasteJsonText);
      await loadSettings();
      if (onSettingsChanged) onSettingsChanged();
      setShowPasteModal(false);
      setPasteJsonText('');
      playSuccessSound();
      await showSuccessAlert('Impor Berhasil', 'Seluruh data transaksi dan stok berhasil dipulihkan.');
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

        {/* Versi Badge & Cek Pembaruan */}
        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          <div className="flex items-center gap-2 px-3 py-1 rounded-xl theme-bg-card border theme-border text-xs font-mono theme-text-secondary">
            <span>Versi:</span>
            <span className="font-bold text-emerald-500 dark:text-emerald-400">v{currentVersion}</span>
          </div>

          {Capacitor.isNativePlatform() && (
            updateInfo?.hasUpdate ? (
              <button
                type="button"
                onClick={() => {
                  playTapSound();
                  promptUpdateDialog(updateInfo);
                }}
                className="px-3 py-1 rounded-xl text-xs font-bold bg-amber-500 text-zinc-950 hover:bg-amber-400 transition flex items-center gap-1.5 shadow-sm animate-pulse"
              >
                <Rocket size={13} />
                <span>Update v{updateInfo.version}</span>
              </button>
            ) : (
              <button
                type="button"
                disabled={isCheckingUpdate}
                onClick={handleCheckUpdate}
                className="px-3 py-1 rounded-xl text-xs font-medium theme-bg-card border theme-border hover:theme-border-strong theme-text-secondary hover:theme-text-primary transition flex items-center gap-1.5"
              >
                <RefreshCw size={12} className={isCheckingUpdate ? 'animate-spin text-emerald-400' : ''} />
                <span>{isCheckingUpdate ? 'Mengecek...' : 'Cek Update'}</span>
              </button>
            )
          )}
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

        {/* Kontrol Suara Lengkap */}
        <div className="pt-3 border-t theme-border space-y-3.5">
          {/* Slider Volume Master */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-semibold theme-text-primary">
              <span className="flex items-center gap-1.5">
                <Volume2 size={14} className="text-emerald-500" />
                Volume Efek Suara
              </span>
              <span className="theme-text-muted">{soundVolume}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={soundVolume}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                setSoundVolume(val);
                setMasterVolume(val);
              }}
              className="w-full accent-emerald-500 cursor-pointer h-2 bg-zinc-200 dark:bg-zinc-800 rounded-lg appearance-none"
            />
          </div>

          {/* Toggle Suara Tombol */}
          <div className="flex items-center justify-between pt-1">
            <div>
              <span className="text-xs font-semibold theme-text-primary block">
                Suara Sentuhan & Tombol
              </span>
              <span className="text-[10px] theme-text-muted">
                Klik halus saat navigasi dan menekan tombol
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                const next = !buttonSound;
                setButtonSoundEnabled(next);
                setButtonSound(next);
                if (next) playTapSound();
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition border ${
                buttonSound
                  ? 'theme-bg-surface text-emerald-500 dark:text-emerald-400 theme-border'
                  : 'theme-bg-input theme-text-muted theme-border'
              }`}
            >
              {buttonSound ? 'Aktif' : 'Mati'}
            </button>
          </div>

          {/* Toggle Suara Transaksi */}
          <div className="flex items-center justify-between pt-1">
            <div>
              <span className="text-xs font-semibold theme-text-primary block">
                Suara Transaksi & Pembukuan
              </span>
              <span className="text-[10px] theme-text-muted">
                Nada sukses saat transaksi selesai dicatat
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                const next = !txSound;
                setTxSoundEnabled(next);
                setTxSound(next);
                if (next) testSound();
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition border ${
                txSound
                  ? 'theme-bg-surface text-emerald-500 dark:text-emerald-400 theme-border'
                  : 'theme-bg-input theme-text-muted theme-border'
              }`}
            >
              {txSound ? 'Aktif' : 'Mati'}
            </button>
          </div>

          {/* Tombol Uji Suara */}
          <div className="pt-1 flex justify-end">
            <button
              type="button"
              onClick={() => testSound()}
              className="px-3 py-1.5 rounded-xl text-xs font-medium theme-bg-surface border theme-border theme-text-secondary hover:theme-text-primary flex items-center gap-1.5 transition shadow-sm"
            >
              <Volume2 size={13} className="text-emerald-500" />
              <span>Tes Suara</span>
            </button>
          </div>
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

      {/* Bagian 4: Sinkronisasi Google Sheets V2 */}
      <div className="space-y-4">
        {/* Banner Pembaruan V2 jika masih ada token lama */}
        {hasLegacyTokenNotice && (
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-amber-400 space-y-1.5 text-xs">
            <div className="flex items-center gap-2 font-bold">
              <AlertCircle size={15} />
              <span>Pembaruan Sistem Sinkronisasi Google Sheets V2</span>
            </div>
            <p className="text-[11px] leading-relaxed opacity-90">
              Sistem sinkronisasi telah ditingkatkan ke arsitektur cermin tabel yang lebih aman dan mandiri dengan enkripsi HMAC-SHA256. Token lama tidak digunakan lagi. Silakan ikuti panduan di bawah untuk memasang kode Apps Script baru dan menyalin Kode Rahasia baru.
            </p>
          </div>
        )}

        {/* (a) Kartu Status di Paling Atas */}
        <div className="p-4 sm:p-5 rounded-2xl theme-bg-card border theme-border space-y-4 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className={`p-2.5 rounded-xl border ${
                  isSyncingSheets || sheetsSyncState?.isSyncing
                    ? 'bg-blue-500/10 text-blue-500 border-blue-500/20'
                    : sheetsSyncState?.status === 'ERROR' || sheetsSyncState?.lastError
                    ? 'bg-red-500/10 text-red-500 border-red-500/20'
                    : sheetsWebhookUrl && sheetsSecret
                    ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                    : 'theme-bg-surface theme-text-muted theme-border'
                }`}
              >
                {isSyncingSheets || sheetsSyncState?.isSyncing ? (
                  <RefreshCw size={22} className="animate-spin" />
                ) : sheetsSyncState?.status === 'ERROR' || sheetsSyncState?.lastError ? (
                  <AlertCircle size={22} />
                ) : sheetsWebhookUrl && sheetsSecret ? (
                  <CheckCircle2 size={22} />
                ) : (
                  <CloudOff size={22} />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold theme-text-primary tracking-tight">
                    {isSyncingSheets || sheetsSyncState?.isSyncing
                      ? 'Sedang Sinkron...'
                      : sheetsSyncState?.status === 'ERROR' || sheetsSyncState?.lastError
                      ? 'Galat Sinkronisasi'
                      : sheetsWebhookUrl && sheetsSecret
                      ? 'Terhubung'
                      : 'Belum Terhubung'}
                  </h2>
                  {sheetsSyncState && sheetsSyncState.pendingTableCount > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/25">
                      {sheetsSyncState.pendingTableCount} tabel menunggu
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 text-[11px] theme-text-secondary mt-0.5">
                  <Clock size={12} className="theme-text-muted" />
                  <span>Waktu Sinkron Terakhir:</span>
                  <span className="font-semibold theme-text-primary">
                    {sheetsSyncState?.lastSyncAt ? formatDateJakarta(sheetsSyncState.lastSyncAt) : 'Belum pernah'}
                  </span>
                </div>
              </div>
            </div>

            {/* Saklar Aktif/Nonaktif */}
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <span className="text-xs theme-text-secondary font-medium">Sinkronisasi:</span>
              <button
                type="button"
                onClick={handleToggleSyncEnabled}
                disabled={!sheetsWebhookUrl || !sheetsSecret}
                className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-semibold transition border flex items-center gap-1.5 shadow-sm disabled:opacity-40 ${
                  sheetsSyncEnabled
                    ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                    : 'theme-bg-input theme-text-muted theme-border'
                }`}
              >
                {sheetsSyncEnabled ? 'Aktif' : 'Nonaktif'}
              </button>
            </div>
          </div>

          {/* Tombol Utama Status Card */}
          <div className="pt-2 border-t theme-border flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
            <p className="text-[11px] theme-text-muted">
              Data lokal di perangkat adalah sumber utama. Sheets bertindak sebagai cermin cadangan dan pelaporan satu arah.
            </p>
            <button
              type="button"
              onClick={handleSyncSheetsNow}
              disabled={isSyncingSheets || !sheetsWebhookUrl.trim() || !sheetsSecret.trim()}
              className="min-h-[44px] px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-bold transition flex items-center justify-center gap-2 shadow-sm shrink-0"
            >
              <RefreshCw size={14} className={isSyncingSheets ? 'animate-spin' : ''} />
              <span>{isSyncingSheets ? 'Menyinkronkan...' : 'Sinkron Sekarang'}</span>
            </button>
          </div>
        </div>

        {/* (e) Kartu Galat (Hanya muncul saat ada galat) */}
        {(sheetsSyncState?.lastError || sheetsSyncState?.status === 'ERROR') && (
          <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/25 text-red-400 space-y-2 text-xs shadow-sm">
            <div className="flex items-center gap-2 font-bold">
              <AlertCircle size={16} className="shrink-0" />
              <span>Kendala Sinkronisasi</span>
            </div>
            <p className="text-[11px] font-mono leading-relaxed opacity-95">
              {sheetsSyncState?.lastError || 'Terjadi kegagalan saat menghubungi Google Apps Script.'}
            </p>
            <div className="pt-1.5 border-t border-red-500/20 text-[11px] space-y-1 opacity-90">
              <span className="font-semibold block">Saran Perbaikan:</span>
              <p>1. Pastikan URL Web App berakhiran <strong className="font-mono">/exec</strong> dan penerapannya adalah versi terbaru.</p>
              <p>2. Pastikan hak akses Web App disetel ke <strong>Anyone (Siapa saja)</strong>.</p>
              <p>3. Pastikan Kode Rahasia cocok dengan yang dicetak oleh fungsi <strong className="font-mono">setup()</strong> di log eksekusi Apps Script.</p>
            </div>
          </div>
        )}

        {/* (b) Kartu Hubungkan (Stepper 3 Langkah / Ringkas saat terhubung) */}
        <div className="p-4 sm:p-5 rounded-2xl theme-bg-card border theme-border space-y-4 shadow-sm">
          <div className="flex items-center justify-between gap-2 pb-2 border-b theme-border">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                <Cloud size={16} />
              </div>
              <div>
                <h3 className="text-xs font-bold theme-text-primary uppercase tracking-wider">
                  Koneksi Google Spreadsheet
                </h3>
                <p className="text-[11px] theme-text-secondary">
                  Jembatan aman Google Apps Script dengan enkripsi tanda tangan HMAC-SHA256
                </p>
              </div>
            </div>

            {sheetsWebhookUrl && sheetsSecret && !isEditingConnection && (
              <button
                type="button"
                onClick={() => {
                  playTapSound();
                  setIsEditingConnection(true);
                }}
                className="min-h-[44px] px-3.5 py-1.5 rounded-xl theme-bg-surface border theme-border hover:theme-bg-card text-xs font-semibold theme-text-primary transition flex items-center gap-1.5"
              >
                <Edit3 size={13} className="text-emerald-400" />
                <span>Ubah</span>
              </button>
            )}
          </div>

          {/* Tampilan Ringkas Saat Terhubung */}
          {sheetsWebhookUrl && sheetsSecret && !isEditingConnection ? (
            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl theme-bg-surface border theme-border space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <span className="text-[11px] theme-text-secondary">URL Web App:</span>
                  <span className="font-mono text-[11px] theme-text-primary truncate" title={sheetsWebhookUrl}>
                    {maskUrl(sheetsWebhookUrl)}
                  </span>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pt-1.5 border-t theme-border">
                  <span className="text-[11px] theme-text-secondary">Kode Rahasia (HMAC):</span>
                  <span className="font-mono text-[11px] text-emerald-400 font-bold">
                    ••••••••••••••••••••••••••••••••
                  </span>
                </div>
                {googleSpreadsheetDocUrl.trim() && (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pt-1.5 border-t theme-border">
                    <span className="text-[11px] theme-text-secondary">Dokumen Spreadsheet:</span>
                    <button
                      type="button"
                      onClick={handleOpenSpreadsheetDoc}
                      className="text-[11px] text-emerald-400 hover:underline flex items-center gap-1 font-semibold self-start sm:self-auto"
                    >
                      <ExternalLink size={12} />
                      <span>Buka Dokumen di Tab Baru</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Tampilan Stepper 3 Langkah */
            <form onSubmit={handleTestAndSaveConnection} className="space-y-4">
              {/* Langkah 1: Salin Script */}
              <div className="p-3.5 rounded-xl theme-bg-surface border theme-border space-y-2.5">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold font-mono text-[11px] shrink-0">1</span>
                  <span className="text-xs font-bold theme-text-primary">
                    Pasang Kode Apps Script di Spreadsheet
                  </span>
                </div>
                <p className="text-[11px] theme-text-secondary leading-relaxed pl-7">
                  Buka Spreadsheet baru di browser, buka menu <strong>Ekstensi &gt; Apps Script</strong>, tempelkan kode script, lalu jalankan fungsi <strong>setup()</strong> dan salin Kode Rahasia dari log eksekusi.
                </p>
                <div className="flex flex-wrap items-center gap-2 pl-7 pt-1">
                  <button
                    type="button"
                    onClick={handleCopyAppsScript}
                    className="min-h-[44px] px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 transition shadow-sm"
                  >
                    <Copy size={13} />
                    <span>Salin Script Apps Script</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      playTapSound();
                      setShowScriptGuideModal(true);
                    }}
                    className="min-h-[44px] px-3.5 py-2 rounded-xl theme-bg-surface border theme-border hover:theme-bg-card text-xs font-semibold theme-text-primary flex items-center gap-1.5 transition"
                  >
                    <FileCode size={13} className="text-amber-400" />
                    <span>Panduan Lengkap</span>
                  </button>
                </div>

                {/* Tautan Dokumen Opsional */}
                <div className="pl-7 pt-2 space-y-1">
                  <label className="text-[11px] font-semibold theme-text-secondary block">
                    Link Google Spreadsheet Anda (Opsional, untuk tombol buka cepat):
                  </label>
                  <input
                    type="url"
                    placeholder="Contoh: https://docs.google.com/spreadsheets/d/.../edit"
                    value={googleSpreadsheetDocUrl}
                    onChange={(e) => setGoogleSpreadsheetDocUrl(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl theme-bg-input border theme-border text-xs font-mono theme-text-primary focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Langkah 2: Tempel URL Web App & Secret */}
              <div className="p-3.5 rounded-xl theme-bg-surface border theme-border space-y-3">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold font-mono text-[11px] shrink-0">2</span>
                  <span className="text-xs font-bold theme-text-primary">
                    Masukkan URL Web App &amp; Kode Rahasia
                  </span>
                </div>

                <div className="pl-7 space-y-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold theme-text-secondary block">
                      URL Web App Google Apps Script (berakhiran /exec):
                    </label>
                    <input
                      type="url"
                      placeholder="https://script.google.com/macros/s/.../exec"
                      value={sheetsWebhookUrl}
                      onChange={(e) => setSheetsWebhookUrl(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl theme-bg-input border theme-border text-xs font-mono theme-text-primary focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold theme-text-secondary block">
                      Kode Rahasia (Secret dari log setup):
                    </label>
                    <div className="relative">
                      <input
                        type={showSecret ? 'text' : 'password'}
                        placeholder="Tempel 64 karakter kode rahasia heksadesimal"
                        value={sheetsSecret}
                        onChange={(e) => setSheetsSecret(e.target.value)}
                        className="w-full pl-3.5 pr-10 py-2.5 rounded-xl theme-bg-input border theme-border text-xs font-mono theme-text-primary focus:outline-none focus:border-emerald-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowSecret(!showSecret)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:theme-text-primary p-1"
                        title={showSecret ? 'Sembunyikan' : 'Tampilkan'}
                      >
                        {showSecret ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Langkah 3: Uji Koneksi & Simpan */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t theme-border">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold font-mono text-[11px] shrink-0">3</span>
                  <span className="text-xs theme-text-secondary">Uji koneksi untuk mengaktifkan sinkronisasi.</span>
                </div>

                <div className="flex items-center gap-2">
                  {sheetsWebhookUrl && sheetsSecret && (
                    <button
                      type="button"
                      onClick={() => {
                        playTapSound();
                        setIsEditingConnection(false);
                      }}
                      className="min-h-[44px] px-4 py-2 rounded-xl theme-bg-surface border theme-border hover:theme-bg-card text-xs font-medium theme-text-secondary transition"
                    >
                      Batal Ubah
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={isTestingSheets || !sheetsWebhookUrl.trim() || !sheetsSecret.trim()}
                    className="min-h-[44px] px-5 py-2.5 rounded-xl theme-btn-primary hover:opacity-90 disabled:opacity-40 text-xs font-bold transition flex items-center justify-center gap-2 shadow-sm"
                  >
                    <Radio size={14} className={isTestingSheets ? 'animate-pulse text-emerald-400' : ''} />
                    <span>{isTestingSheets ? 'Menguji...' : 'Uji Koneksi & Simpan'}</span>
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>

        {/* (c) Kartu Status Tabel (9 Tabel) */}
        <div className="p-4 sm:p-5 rounded-2xl theme-bg-card border theme-border space-y-3 shadow-sm">
          <div className="flex items-center justify-between gap-2 pb-2 border-b theme-border">
            <div>
              <h3 className="text-xs font-bold theme-text-primary uppercase tracking-wider">
                Status Tabel Sinkronisasi
              </h3>
              <p className="text-[11px] theme-text-secondary">
                9 tabel dicerminkan secara berkala saat ada perubahan data
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {sheetsSyncState?.tables && Object.keys(sheetsSyncState.tables).length > 0 ? (
              Object.entries(sheetsSyncState.tables).map(([key, t]) => (
                <div
                  key={key}
                  className="p-3 rounded-xl theme-bg-surface border theme-border flex items-center justify-between gap-2"
                >
                  <div className="space-y-0.5 truncate">
                    <span className="text-xs font-semibold theme-text-primary block truncate">
                      {t.name}
                    </span>
                    <span className="text-[10px] theme-text-muted block">
                      {t.rowCount} baris
                    </span>
                  </div>

                  <div>
                    {t.status === 'SYNCED' ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1 whitespace-nowrap">
                        <CheckCircle2 size={11} />
                        <span>Sudah sinkron</span>
                      </span>
                    ) : t.status === 'PENDING' ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1 whitespace-nowrap">
                        <Clock size={11} />
                        <span>Menunggu</span>
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-500/10 text-red-400 border border-red-500/20 flex items-center gap-1 whitespace-nowrap">
                        <AlertCircle size={11} />
                        <span>Gagal</span>
                      </span>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-full p-4 text-center text-xs theme-text-muted">
                Daftar status tabel akan tampil setelah aplikasi selesai memuat data.
              </div>
            )}
          </div>
        </div>

        {/* (d) Kartu Lanjutan */}
        <div className="p-4 sm:p-5 rounded-2xl theme-bg-card border theme-border space-y-4 shadow-sm relative">
          <div className="flex items-center justify-between gap-2 pb-2 border-b theme-border">
            <div>
              <h3 className="text-xs font-bold theme-text-primary uppercase tracking-wider">
                Pengaturan Lanjutan
              </h3>
              <p className="text-[11px] theme-text-secondary">
                Alat pemeliharaan &amp; sinkronisasi manual
              </p>
            </div>

            {/* Titik Tiga Dropdown Menu */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowAdvancedDropdown(!showAdvancedDropdown)}
                className="w-10 h-10 rounded-xl theme-bg-surface border theme-border hover:theme-bg-card flex items-center justify-center text-zinc-400 hover:theme-text-primary transition"
                title="Menu lainnya"
              >
                <MoreVertical size={16} />
              </button>

              {showAdvancedDropdown && (
                <div className="absolute right-0 top-11 z-20 w-56 rounded-xl theme-bg-card border theme-border p-1.5 shadow-xl space-y-1 animate-in fade-in zoom-in-95 duration-100">
                  <button
                    type="button"
                    onClick={handleResetSheets}
                    className="w-full text-left px-3 py-2 rounded-lg text-xs font-semibold text-red-400 hover:bg-red-500/10 transition flex items-center gap-2"
                  >
                    <Trash2 size={13} />
                    <span>Reset Pengaturan Sheets</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2.5">
            {/* Tombol Utama Kartu Lanjutan: Sinkron Penuh */}
            <button
              type="button"
              onClick={handleFullSync}
              disabled={isSyncingSheets || !sheetsWebhookUrl.trim() || !sheetsSecret.trim()}
              className="min-h-[44px] px-4 py-2.5 rounded-xl border border-blue-500/30 text-blue-400 hover:bg-blue-500/10 disabled:opacity-40 text-xs font-bold transition flex items-center justify-center gap-2 shadow-sm"
              title="Kirim ulang seluruh 9 tabel dan dasbor ringkasan"
            >
              <Database size={14} />
              <span>Sinkron Penuh</span>
            </button>

            {/* Tombol Buat / Rapikan Sheet */}
            <button
              type="button"
              onClick={handleInitializeTable}
              disabled={isInitializingTable || !sheetsWebhookUrl.trim() || !sheetsSecret.trim()}
              className="min-h-[44px] px-4 py-2.5 rounded-xl theme-bg-surface border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 disabled:opacity-40 text-xs font-bold transition flex items-center justify-center gap-2 shadow-sm"
              title="Rapikan tab dan formula dasbor di spreadsheet"
            >
              <FileSpreadsheet size={14} className={isInitializingTable ? 'animate-spin' : ''} />
              <span>{isInitializingTable ? 'Merapikan...' : 'Buat / Rapikan Sheet'}</span>
            </button>

            {/* Tombol Salin Script */}
            <button
              type="button"
              onClick={handleCopyAppsScript}
              className="min-h-[44px] px-4 py-2.5 rounded-xl theme-bg-surface border theme-border hover:theme-bg-card text-xs font-semibold theme-text-primary flex items-center justify-center gap-2 transition"
            >
              <FileCode size={14} className="text-amber-400" />
              <span>Salin Script</span>
            </button>
          </div>

          <p className="text-[10px] theme-text-muted">
            Gunakan tombol <strong>Sinkron Penuh</strong> sekali setelah pertama kali menghubungkan akun atau setelah memulihkan cadangan agar seluruh data historis terunggah.
          </p>
        </div>
      </div>

      {/* Modal Panduan & Salin Kode Apps Script */}
      {showScriptGuideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-xl rounded-2xl theme-bg-card border theme-border p-5 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b theme-border">
              <div className="flex items-center gap-2">
                <FileCode size={18} className="text-emerald-500" />
                <h3 className="font-bold theme-text-primary text-sm">
                  Panduan Menghubungkan Google Spreadsheet
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowScriptGuideModal(false)}
                className="text-xs theme-text-muted hover:theme-text-primary p-1"
              >
                Tutup
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 space-y-1">
                <span className="font-bold block">Hanya Perlu Dilakukan 1 Kali:</span>
                <p className="text-[11px] leading-relaxed opacity-95">
                  Spreadsheet Anda membutuhkan jembatan Web App Apps Script agar JufaStore dapat mencerminkan data transaksi, mutasi stok, buku kas, dan pinjaman modal secara aman dengan tanda tangan HMAC-SHA256.
                </p>
              </div>

              {/* Langkah-langkah */}
              <div className="space-y-2">
                <div className="p-2.5 rounded-xl theme-bg-surface border theme-border flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold font-mono text-[11px] shrink-0">1</span>
                  <div className="space-y-1">
                    <span className="font-semibold theme-text-primary block">Buat Google Spreadsheet Baru</span>
                    <p className="text-[11px] theme-text-muted">Buka Google Drive atau Google Sheets di browser, lalu buat spreadsheet kosong baru.</p>
                  </div>
                </div>

                <div className="p-2.5 rounded-xl theme-bg-surface border theme-border flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold font-mono text-[11px] shrink-0">2</span>
                  <div>
                    <span className="font-semibold theme-text-primary block">Buka Editor Apps Script</span>
                    <p className="text-[11px] theme-text-muted">Pada menu atas Spreadsheet, klik menu <strong>Ekstensi</strong> lalu pilih <strong>Apps Script</strong>.</p>
                  </div>
                </div>

                <div className="p-2.5 rounded-xl theme-bg-surface border theme-border flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold font-mono text-[11px] shrink-0">3</span>
                  <div>
                    <span className="font-semibold theme-text-primary block">Tempel Kode Code.gs</span>
                    <p className="text-[11px] theme-text-muted">Hapus seluruh kode bawaan di editor, lalu tempelkan kode lengkap yang disediakan di bawah ini.</p>
                  </div>
                </div>

                <div className="p-2.5 rounded-xl theme-bg-surface border theme-border flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold font-mono text-[11px] shrink-0">4</span>
                  <div>
                    <span className="font-semibold theme-text-primary block">Jalankan Fungsi setup() &amp; Salin Kode Rahasia</span>
                    <p className="text-[11px] theme-text-muted leading-relaxed">
                      Pilih fungsi <strong>setup</strong> pada menu drop-down di atas editor &gt; klik <strong>Jalankan (Run)</strong> &gt; izinkan akses saat diminta. Buka menu <strong>Log Eksekusi</strong> di bagian bawah, lalu salin <strong>Kode Rahasia</strong> (64 karakter) yang tercetak.
                    </p>
                  </div>
                </div>

                <div className="p-2.5 rounded-xl theme-bg-surface border theme-border flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold font-mono text-[11px] shrink-0">5</span>
                  <div>
                    <span className="font-semibold theme-text-primary block">Deploy Sebagai Web App</span>
                    <p className="text-[11px] theme-text-muted leading-relaxed">
                      Klik tombol biru <strong>Deploy (Terapkan)</strong> di kanan atas &gt; pilih <strong>New Deployment</strong>.
                      Pilih jenis <strong>Web App</strong>. Pada bagian <em>Who has access</em> (Siapa yang memiliki akses), pilih <strong>Anyone (Siapa saja)</strong>. Lalu klik <strong>Deploy</strong> dan salin Web App URL (berakhiran <strong className="text-emerald-400 font-mono">/exec</strong>).
                    </p>
                  </div>
                </div>

                <div className="p-2.5 rounded-xl theme-bg-surface border theme-border flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold font-mono text-[11px] shrink-0">6</span>
                  <div>
                    <span className="font-semibold theme-text-primary block">Hubungkan di JufaStore</span>
                    <p className="text-[11px] theme-text-muted">Masukkan Web App URL dan Kode Rahasia ke kolom di JufaStore, lalu klik tombol <strong>Uji Koneksi &amp; Simpan</strong>.</p>
                  </div>
                </div>
              </div>

              {/* Kotak Kode Apps Script */}
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold theme-text-primary">Kode Google Apps Script:</span>
                  <button
                    type="button"
                    onClick={handleCopyAppsScript}
                    className="min-h-[44px] px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 transition shadow-sm"
                  >
                    <Copy size={13} />
                    <span>Salin Kode</span>
                  </button>
                </div>

                <textarea
                  id="appsScriptTextArea"
                  readOnly
                  rows={8}
                  value={SHEETS_CODE_GS_TEMPLATE}
                  className="w-full p-3 rounded-xl theme-bg-input border theme-border text-[11px] font-mono theme-text-primary focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t theme-border">
              <button
                type="button"
                onClick={() => setShowScriptGuideModal(false)}
                className="min-h-[44px] px-5 py-2 rounded-xl text-xs theme-btn-primary font-bold shadow-sm"
              >
                Saya Mengerti, Tutup Panduan
              </button>
            </div>
          </div>
        </div>
      )}

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
