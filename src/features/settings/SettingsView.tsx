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
  Cloud,
  CloudOff,
  RefreshCw,
  ExternalLink,
  Check,
  Globe,
  Radio,
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
import { testGoogleSheetsUrl, syncAllDataToGoogleSheets, initializeGoogleSheetTable, getSpreadsheetOpenUrl, GOOGLE_APPS_SCRIPT_TEMPLATE } from '../../utils/googleSheets';

import {
  subscribeUpdateState,
  checkForUpdates,
  getInstalledVersion,
  promptUpdateDialog,
  UpdateInfo,
} from '../../services/updateChecker';

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
  loans: z.array(z.any()).optional(),
});

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

  // Google Sheets Cloud Sync State
  const [googleSheetsUrl, setGoogleSheetsUrl] = useState('');
  const [googleSpreadsheetDocUrl, setGoogleSpreadsheetDocUrl] = useState('');
  const [autoSyncFrequency, setAutoSyncFrequency] = useState<'MANUAL' | 'REALTIME' | 'DAILY' | 'MONTHLY'>('MANUAL');
  const [isTestingSheets, setIsTestingSheets] = useState(false);
  const [isSyncingSheets, setIsSyncingSheets] = useState(false);
  const [isInitializingTable, setIsInitializingTable] = useState(false);
  const [isSavingSheetsConfig, setIsSavingSheetsConfig] = useState(false);
  const [showScriptGuideModal, setShowScriptGuideModal] = useState(false);
  const [isSheetsVerified, setIsSheetsVerified] = useState(false);

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
      setGoogleSheetsUrl(s.googleSheetsUrl || '');
      setGoogleSpreadsheetDocUrl(s.googleSpreadsheetDocUrl || '');
      setAutoSyncFrequency(s.autoSyncFrequency || 'MANUAL');
      if (s.googleSheetsUrl && s.googleSheetsUrl.includes('/exec')) {
        setIsSheetsVerified(true);
      }
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

  // Handler: Uji Koneksi Google Sheets
  const handleTestSheetsConnection = async () => {
    playTapSound();
    const cleanUrl = googleSheetsUrl.trim();
    if (!cleanUrl) {
      await showWarningAlert('URL Masih Kosong', 'Masukkan URL Web App Apps Script (berakhiran /exec) terlebih dahulu.');
      return;
    }

    // Jika pengguna tidak sengaja menempel link Google Spreadsheet dokumen ke kolom Web App
    if (cleanUrl.includes('docs.google.com/spreadsheets')) {
      setGoogleSpreadsheetDocUrl(cleanUrl);
      setGoogleSheetsUrl('');
      await repository.updateSettings({ googleSpreadsheetDocUrl: cleanUrl });
      await showWarningAlert(
        'Tautan Tersimpan sebagai Link Dokumen',
        'Tautan yang Anda masukkan adalah link Spreadsheet Anda. Kami telah memindahkannya ke kolom Link Dokumen. Untuk mengirim data otomatis, silakan buat Web App Apps Script dengan mengikuti tombol Panduan.'
      );
      setShowScriptGuideModal(true);
      return;
    }

    setIsTestingSheets(true);
    try {
      const res = await testGoogleSheetsUrl(cleanUrl);
      if (res.ok) {
        setIsSheetsVerified(true);
        await repository.updateSettings({
          googleSheetsUrl: cleanUrl,
          googleSpreadsheetDocUrl: googleSpreadsheetDocUrl.trim() || undefined,
        });
        await loadSettings();
        playSuccessSound();
        await showSuccessAlert('Koneksi Berhasil & Terverifikasi!', res.message);
      } else {
        setIsSheetsVerified(false);
        await showErrorAlert('Koneksi Gagal', res.message);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal menguji koneksi';
      await showErrorAlert('Gagal', msg);
    } finally {
      setIsTestingSheets(false);
    }
  };

  // Handler: Buat Struktur Tabel Kolom Otomatis di Spreadsheet
  const handleInitializeTable = async () => {
    playTapSound();
    if (!googleSheetsUrl.trim()) {
      await showWarningAlert('Web App Belum Diatur', 'Hubungkan URL Web App Apps Script terlebih dahulu.');
      return;
    }

    setIsInitializingTable(true);
    try {
      const res = await initializeGoogleSheetTable(googleSheetsUrl);
      if (res.success) {
        playSuccessSound();
        const ok = await showConfirmDialog({
          title: '6 Tabel Terpisah Berhasil Dibuat!',
          text: 'Semua 6 sheet tabel (Penjualan, Stok FIFO, Buku Kas, Pinjaman Modal, Investor, dan Pemakaian Pribadi) telah berhasil dibuat di tab masing-masing dengan jarak kolom yang lapang. Buka spreadsheet sekarang untuk melihat hasilnya?',
          confirmButtonText: 'Buka Spreadsheet',
          cancelButtonText: 'Tutup',
        });
        if (ok && googleSpreadsheetDocUrl.trim()) {
          window.open(getSpreadsheetOpenUrl(googleSpreadsheetDocUrl.trim()), '_blank');
        }
      } else {
        await showErrorAlert('Gagal Membuat Tabel', res.message);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Terjadi kesalahan';
      await showErrorAlert('Gagal', msg);
    } finally {
      setIsInitializingTable(false);
    }
  };

  // Handler: Simpan Pengaturan Google Sheets
  const handleSaveSheetsConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    playTapSound();
    setIsSavingSheetsConfig(true);
    try {
      await repository.updateSettings({
        googleSheetsUrl: googleSheetsUrl.trim(),
        googleSpreadsheetDocUrl: googleSpreadsheetDocUrl.trim(),
        autoSyncFrequency,
      });
      await loadSettings();
      playSuccessSound();
      await showSuccessAlert('Pengaturan Disimpan', 'Konfigurasi Google Sheets berhasil disimpan ke database lokal.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal menyimpan pengaturan';
      await showErrorAlert('Gagal', msg);
    } finally {
      setIsSavingSheetsConfig(false);
    }
  };

  // Handler: Salin Template Script Google Apps Script (Dengan Fallback Handal)
  const handleCopyAppsScript = async () => {
    playTapSound();
    let copied = false;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(GOOGLE_APPS_SCRIPT_TEMPLATE);
        copied = true;
      }
    } catch (err) {
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
      } catch (err) {
        copied = false;
      }
    }

    if (copied) {
      playSuccessSound();
      await showSuccessAlert(
        'Kode Berhasil Disalin!',
        'Tempelkan kode ini ke editor Google Apps Script di spreadsheet Anda, lalu Deploy sebagai Web App dengan izin "Anyone".'
      );
    } else {
      await showWarningAlert(
        'Seleksi Manual',
        'Silakan seleksi seluruh teks pada kotak kode di bawah dan tekan Ctrl+C pada keyboard Anda.'
      );
    }
  };

  // Handler: Sinkronisasikan Sekarang
  const handleSyncSheetsNow = async () => {
    playTapSound();
    if (!googleSheetsUrl.trim()) {
      await showWarningAlert('URL Belum Diatur', 'Masukkan dan simpan URL Web App Google Sheets terlebih dahulu.');
      return;
    }

    setIsSyncingSheets(true);
    try {
      const res = await syncAllDataToGoogleSheets(googleSheetsUrl);
      if (res.success) {
        await loadSettings();
        playSuccessSound();
        const ok = await showConfirmDialog({
          title: 'Sinkronisasi Berhasil!',
          text: res.message + ' Ingin membuka spreadsheet sekarang untuk melihat hasil kerja pencadangan?',
          confirmButtonText: 'Buka Spreadsheet',
          cancelButtonText: 'Tutup',
        });
        if (ok && googleSpreadsheetDocUrl.trim()) {
          window.open(getSpreadsheetOpenUrl(googleSpreadsheetDocUrl.trim()), '_blank');
        }
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
        allLoans,
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
        db.loans.toArray(),
      ]);

      const backupData = {
        version: 3,
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
        loans: allLoans,
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
        allLoans,
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
        db.loans.toArray(),
      ]);

      const backupData = {
        version: 3,
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
        loans: allLoans,
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
        db.loans,
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
        if (data.loans) {
          await db.loans.clear();
          await db.loans.bulkPut(data.loans);
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

        {/* Versi Badge & Cek Pembaruan */}
        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          <div className="flex items-center gap-2 px-3 py-1 rounded-xl theme-bg-card border theme-border text-xs font-mono theme-text-secondary">
            <span>Versi:</span>
            <span className="font-bold text-emerald-500 dark:text-emerald-400">v{currentVersion}</span>
          </div>

          {updateInfo?.hasUpdate ? (
            <button
              type="button"
              onClick={() => {
                playTapSound();
                promptUpdateDialog(updateInfo);
              }}
              className="px-3 py-1 rounded-xl text-xs font-bold bg-amber-500 text-zinc-950 hover:bg-amber-400 transition flex items-center gap-1.5 shadow-sm animate-pulse"
            >
              <span>🚀 Update v{updateInfo.version}</span>
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

      {/* Bagian 4: Sinkronisasi Cloud Google Spreadsheet */}
      <div className="p-4 sm:p-5 rounded-2xl theme-bg-card border theme-border space-y-4">
        <div className="flex items-center justify-between pb-2 border-b theme-border">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
              <Cloud size={17} />
            </div>
            <div>
              <h2 className="text-sm font-bold theme-text-primary tracking-tight">
                Sinkronisasi Cloud Google Spreadsheet
              </h2>
              <p className="text-[11px] theme-text-secondary">
                Cadangkan data transaksi, restock, kas, & pinjaman ke Google Spreadsheet secara online
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isSheetsVerified ? (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                <Check size={11} />
                <span>Terhubung</span>
              </span>
            ) : (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold theme-bg-surface theme-text-muted border theme-border">
                Belum Terhubung
              </span>
            )}
          </div>
        </div>

        <form onSubmit={handleSaveSheetsConfig} className="space-y-4">
          {/* Kolom 1: Link Google Spreadsheet Dokumen Pengguna */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold theme-text-secondary">
                1. Link Google Spreadsheet Anda (Tempat Melihat Hasil)
              </label>
              {googleSpreadsheetDocUrl.trim() && (
                <button
                  type="button"
                  onClick={handleOpenSpreadsheetDoc}
                  className="text-[11px] text-emerald-400 hover:underline flex items-center gap-1 font-semibold"
                >
                  <ExternalLink size={12} />
                  <span>Buka Spreadsheet di Tab Baru</span>
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="url"
                placeholder="Contoh: https://docs.google.com/spreadsheets/d/1eh5OCM.../edit"
                value={googleSpreadsheetDocUrl}
                onChange={(e) => setGoogleSpreadsheetDocUrl(e.target.value)}
                className="flex-1 px-3.5 py-2.5 rounded-xl theme-bg-input border theme-border text-xs font-mono theme-text-primary focus:outline-none focus:border-emerald-500"
              />
              <button
                type="button"
                onClick={handleOpenSpreadsheetDoc}
                disabled={!googleSpreadsheetDocUrl.trim()}
                className="px-3.5 py-2.5 rounded-xl theme-bg-surface border theme-border hover:theme-bg-card disabled:opacity-40 text-xs font-semibold theme-text-primary transition flex items-center gap-1.5 shrink-0"
                title="Buka dokumen spreadsheet"
              >
                <ExternalLink size={13} className="text-emerald-400" />
                <span className="hidden sm:inline">Buka Sheet</span>
              </button>
            </div>
            <p className="text-[10px] theme-text-muted">
              Tempelkan link Google Spreadsheet Anda di sini agar bisa dibuka langsung dengan 1 klik kapan saja.
            </p>
          </div>

          {/* Kolom 2: URL Web App Apps Script (Jembatan Kirim Data) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold theme-text-secondary">
                2. URL Web App Google Apps Script (Jembatan Kirim Data)
              </label>
              <button
                type="button"
                onClick={() => {
                  playTapSound();
                  setShowScriptGuideModal(true);
                }}
                className="text-[11px] text-emerald-400 hover:underline flex items-center gap-1 font-semibold"
              >
                <FileCode size={12} />
                <span>Panduan & Salin Kode Apps Script</span>
              </button>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <input
                type="url"
                placeholder="https://script.google.com/macros/s/.../exec"
                value={googleSheetsUrl}
                onChange={(e) => setGoogleSheetsUrl(e.target.value)}
                className="flex-1 px-3.5 py-2.5 rounded-xl theme-bg-input border theme-border text-xs font-mono theme-text-primary focus:outline-none focus:border-emerald-500"
              />
              <button
                type="button"
                onClick={handleTestSheetsConnection}
                disabled={isTestingSheets || !googleSheetsUrl.trim()}
                className="px-4 py-2.5 rounded-xl theme-bg-surface border theme-border hover:theme-bg-card disabled:opacity-40 text-xs font-semibold theme-text-primary transition flex items-center justify-center gap-1.5 shadow-sm"
              >
                <Radio size={14} className={isTestingSheets ? 'animate-pulse text-emerald-400' : 'text-emerald-400'} />
                <span>{isTestingSheets ? 'Menguji...' : 'Uji Koneksi'}</span>
              </button>
            </div>
            <p className="text-[10px] theme-text-muted">
              URL Web App didapat setelah Anda memasang kode di menu <strong>Ekstensi &gt; Apps Script</strong> pada spreadsheet Anda (berakhiran <span className="font-mono text-emerald-400 font-bold">/exec</span>).
            </p>
          </div>

          {/* Frekuensi Cadangan Otomatis */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold theme-text-secondary block">
              Jadwal Cadangan Otomatis Cloud
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(
                [
                  { id: 'REALTIME', label: 'Realtime (Online)', desc: 'Tiap transaksi selesai' },
                  { id: 'DAILY', label: 'Harian (WIB)', desc: 'Pencadangan tiap hari' },
                  { id: 'MONTHLY', label: 'Bulanan', desc: 'Pencadangan tiap bulan' },
                  { id: 'MANUAL', label: 'Manual Saja', desc: 'Hanya jika tombol ditekan' },
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => {
                    playTapSound();
                    setAutoSyncFrequency(f.id);
                  }}
                  className={`p-2.5 rounded-xl border text-left transition ${
                    autoSyncFrequency === f.id
                      ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400 font-bold shadow-sm'
                      : 'theme-border theme-bg-surface theme-text-secondary hover:theme-text-primary'
                  }`}
                >
                  <span className="text-xs block">{f.label}</span>
                  <span className="text-[10px] opacity-75 font-normal block">{f.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Tombol Aksi Lengkap */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t theme-border">
            <div className="flex flex-wrap items-center gap-2">
              {/* Tombol Buat Tabel Otomatis */}
              <button
                type="button"
                onClick={handleInitializeTable}
                disabled={isInitializingTable || !googleSheetsUrl.trim()}
                className="px-3.5 py-2 rounded-xl theme-bg-surface border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 disabled:opacity-40 text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
                title="Buat tabel dan header kolom otomatis di spreadsheet"
              >
                <FileSpreadsheet size={14} className={isInitializingTable ? 'animate-spin' : ''} />
                <span>{isInitializingTable ? 'Membuat Tabel...' : 'Buat Tabel di Spreadsheet'}</span>
              </button>

              {/* Tombol Buka Panduan Kode */}
              <button
                type="button"
                onClick={() => {
                  playTapSound();
                  setShowScriptGuideModal(true);
                }}
                className="px-3 py-2 rounded-xl theme-bg-surface border theme-border hover:theme-bg-card text-xs font-medium theme-text-primary flex items-center gap-1.5 transition"
              >
                <FileCode size={13} className="text-amber-400" />
                <span>Panduan & Kode Script</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              {/* Tombol Sinkronkan Sekarang */}
              <button
                type="button"
                onClick={handleSyncSheetsNow}
                disabled={isSyncingSheets || !googleSheetsUrl.trim()}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
              >
                <RefreshCw size={13} className={isSyncingSheets ? 'animate-spin' : ''} />
                <span>{isSyncingSheets ? 'Menyinkronkan...' : 'Sinkronkan Sekarang'}</span>
              </button>

              <button
                type="submit"
                disabled={isSavingSheetsConfig}
                className="px-4 py-2 rounded-xl theme-btn-primary hover:opacity-90 disabled:opacity-40 text-xs font-semibold transition shadow-sm"
              >
                {isSavingSheetsConfig ? 'Menyimpan...' : 'Simpan Pengaturan'}
              </button>
            </div>
          </div>
        </form>
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
                className="text-xs theme-text-muted hover:theme-text-primary"
              >
                Tutup
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 space-y-1">
                <span className="font-bold block">Hanya Perlu Dilakukan 1 Kali:</span>
                <p className="text-[11px] leading-relaxed opacity-95">
                  Spreadsheet Anda membutuhkan jembatan Web App Apps Script agar JufaStore dapat mengirim data transaksi, membuat tabel, dan melakukan pencadangan otomatis secara aman.
                </p>
              </div>

              {/* Langkah-langkah */}
              <div className="space-y-2">
                <div className="p-2.5 rounded-xl theme-bg-surface border theme-border flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold font-mono text-[11px] shrink-0">1</span>
                  <div className="space-y-1">
                    <span className="font-semibold theme-text-primary block">Buka Spreadsheet Anda</span>
                    <p className="text-[11px] theme-text-muted">Buka Google Spreadsheet kosong Anda di browser.</p>
                    {googleSpreadsheetDocUrl.trim() && (
                      <button
                        type="button"
                        onClick={handleOpenSpreadsheetDoc}
                        className="text-[11px] text-emerald-400 underline font-semibold flex items-center gap-1 mt-1"
                      >
                        <ExternalLink size={11} />
                        <span>Klik di sini untuk membuka Spreadsheet Anda</span>
                      </button>
                    )}
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
                    <span className="font-semibold theme-text-primary block">Hapus Kode Lama &amp; Tempelkan Kode di Bawah</span>
                    <p className="text-[11px] theme-text-muted">Hapus kode bawaan yang ada di editor Apps Script, lalu tempel kode lengkap yang disediakan di bawah ini.</p>
                  </div>
                </div>

                <div className="p-2.5 rounded-xl theme-bg-surface border theme-border flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold font-mono text-[11px] shrink-0">4</span>
                  <div>
                    <span className="font-semibold theme-text-primary block">Deploy Sebagai Web App</span>
                    <p className="text-[11px] theme-text-muted leading-relaxed">
                      Klik tombol biru <strong>Deploy</strong> (Terapkan) di kanan atas &gt; pilih <strong>New Deployment</strong> (Penerapan baru).
                      Pilih jenis <strong>Web App</strong>. Pada bagian <em>Who has access</em> (Siapa yang memiliki akses), pilih <strong>Anyone</strong> (Siapa saja). Lalu klik <strong>Deploy</strong>.
                    </p>
                  </div>
                </div>

                <div className="p-2.5 rounded-xl theme-bg-surface border theme-border flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold font-mono text-[11px] shrink-0">5</span>
                  <div>
                    <span className="font-semibold theme-text-primary block">Salin Web App URL</span>
                    <p className="text-[11px] theme-text-muted">Salin Web App URL yang berakhiran <strong className="text-emerald-400">/exec</strong> dan tempelkan ke kolom URL Web App di JufaStore.</p>
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
                    className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 transition shadow-sm"
                  >
                    <Copy size={12} />
                    <span>Salin Kode</span>
                  </button>
                </div>

                <textarea
                  id="appsScriptTextArea"
                  readOnly
                  rows={8}
                  value={GOOGLE_APPS_SCRIPT_TEMPLATE}
                  className="w-full p-3 rounded-xl theme-bg-input border theme-border text-[11px] font-mono theme-text-primary focus:outline-none focus:border-emerald-500"
                />
                <p className="text-[10px] theme-text-muted">
                  Jika tombol salin otomatis terhalang oleh pengaturan privasi browser Anda, Anda dapat menyeleksi seluruh teks di dalam kotak di atas dan tekan <strong className="theme-text-primary">Ctrl + C</strong>.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t theme-border">
              <button
                type="button"
                onClick={() => setShowScriptGuideModal(false)}
                className="px-4 py-2 rounded-xl text-xs theme-btn-primary font-bold shadow-sm"
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
