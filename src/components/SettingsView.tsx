import React, { useState } from 'react';
import {
  Settings,
  Database,
  Save,
  Download,
  Upload,
  AlertTriangle,
  ShieldCheck,
  Trash2,
  Palette,
  Sun,
  Moon,
  Monitor,
  Plus,
  CreditCard,
  Truck,
  CheckCircle2,
  AlertCircle,
  Smartphone,
  HardDrive,
} from 'lucide-react';
import Swal from 'sweetalert2';
import { AppSettings, Cashflow, StockBatch, Transaction } from '../types';
import { exportSqliteBinary, getDatabase, importSqliteBinary } from '../services/db';
import { resetAllDataToEmpty, saveSettings } from '../services/repository';
import { applyTheme, ThemeMode } from '../utils/theme';

interface SettingsViewProps {
  settings: AppSettings;
  transactions: Transaction[];
  batches: StockBatch[];
  cashflows: Cashflow[];
  onRefreshData: () => Promise<void>;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  transactions,
  batches,
  cashflows,
  onRefreshData,
}) => {
  const [formData, setFormData] = useState<AppSettings>(settings);
  const [newPaymentMethod, setNewPaymentMethod] = useState('');
  const [newSupplier, setNewSupplier] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Bersihkan data sampah icon base64 lama dari localStorage jika ada
  React.useEffect(() => {
    try {
      localStorage.removeItem('jufa_custom_icon_url');
    } catch {
      // ignore
    }
  }, []);

  // Handle Theme Mode Change (Dark, Light, System)
  const handleThemeModeChange = (mode: ThemeMode) => {
    setFormData(prev => ({ ...prev, theme_mode: mode }));
    localStorage.setItem('jufa_theme_mode', mode);
    applyTheme(mode);
  };

  // Add Payment Method
  const handleAddPaymentMethod = () => {
    const val = newPaymentMethod.trim();
    if (!val) return;
    if (formData.payment_methods.includes(val)) {
      Swal.fire({
        icon: 'warning',
        title: 'Metode Sudah Ada',
        text: `Metode "${val}" sudah terdaftar.`,
      });
      return;
    }
    setFormData(prev => ({
      ...prev,
      payment_methods: [...prev.payment_methods, val],
    }));
    setNewPaymentMethod('');
  };

  // Remove Payment Method
  const handleRemovePaymentMethod = (name: string) => {
    setFormData(prev => ({
      ...prev,
      payment_methods: prev.payment_methods.filter(m => m !== name),
    }));
  };

  // Add Supplier
  const handleAddSupplier = () => {
    const val = newSupplier.trim();
    if (!val) return;
    if (formData.suppliers.includes(val)) {
      Swal.fire({
        icon: 'warning',
        title: 'Supplier Sudah Ada',
        text: `Supplier "${val}" sudah terdaftar.`,
      });
      return;
    }
    setFormData(prev => ({
      ...prev,
      suppliers: [...prev.suppliers, val],
    }));
    setNewSupplier('');
  };

  // Remove Supplier
  const handleRemoveSupplier = (name: string) => {
    setFormData(prev => ({
      ...prev,
      suppliers: prev.suppliers.filter(s => s !== name),
    }));
  };

  // Save Settings - Fast & Safe without UI freeze
  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isSaving) return;

    setIsSaving(true);
    try {
      // Bersihkan property yang tidak perlu agar payload SQLite sangat ringan
      const cleanSettings: AppSettings = {
        store_name: formData.store_name.trim() || 'JUFA STORE',
        currency: 'IDR',
        default_rate: formData.default_rate || 165,
        small_pack_threshold: formData.small_pack_threshold || 100,
        small_pack_rate: formData.small_pack_rate || 170,
        large_pack_rate: formData.large_pack_rate || 160,
        min_stock_alert: formData.min_stock_alert || 500,
        payment_methods: formData.payment_methods,
        expense_categories: formData.expense_categories || [],
        suppliers: formData.suppliers,
        sales_sources: formData.sales_sources || ['WhatsApp'],
        stock_method: 'FIFO',
        theme_mode: formData.theme_mode || 'dark',
      };

      await saveSettings(cleanSettings);
      applyTheme(cleanSettings.theme_mode);
      await onRefreshData();

      Swal.fire({
        icon: 'success',
        title: 'Pengaturan Disimpan',
        text: 'Identitas toko, tema tampilan, dan daftar operasional berhasil diperbarui.',
        timer: 1500,
        showConfirmButton: false,
      });
    } catch (err: any) {
      Swal.fire({
        icon: 'error',
        title: 'Gagal Menyimpan',
        text: err.message,
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Export JSON Backup
  const handleExportJSON = () => {
    const backupData = {
      version: 1,
      appName: 'JUFA STORE Business Manager',
      exportedAt: new Date().toISOString(),
      settings: formData,
      batches,
      transactions,
      cashflows,
    };

    const jsonStr = JSON.stringify(backupData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `jufa_store_backup_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    localStorage.setItem('jufa_last_backup_date', new Date().toISOString());

    Swal.fire({
      icon: 'success',
      title: 'Pencadangan Berhasil',
      text: 'File JSON backup terstruktur telah diunduh ke komputer Anda.',
      timer: 1600,
      showConfirmButton: false,
    });
  };

  // Export SQLite Binary
  const handleExportSQLite = async () => {
    try {
      const binary = await exportSqliteBinary();
      const blob = new Blob([binary as unknown as BlobPart], { type: 'application/x-sqlite3' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `jufa_store_db_${new Date().toISOString().slice(0, 10)}.sqlite`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      localStorage.setItem('jufa_last_backup_date', new Date().toISOString());

      Swal.fire({
        icon: 'success',
        title: 'Database Asli Berhasil Diunduh',
        text: 'File database SQLite lokal (.sqlite) berhasil disimpan.',
        timer: 1600,
        showConfirmButton: false,
      });
    } catch (err: any) {
      Swal.fire({
        icon: 'error',
        title: 'Ekspor Gagal',
        text: err.message,
      });
    }
  };

  // Import SQLite Binary File
  const handleImportSQLite = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const confirm = await Swal.fire({
      title: 'Timpa Database Aktif?',
      text: 'Semua transaksi, stok, dan kas saat ini akan digantikan oleh file database cadangan yang diimpor.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Ya, Pulihkan Sekarang',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#e11d48',
    });

    if (!confirm.isConfirmed) return;

    try {
      const buffer = await file.arrayBuffer();
      const binary = new Uint8Array(buffer);
      await importSqliteBinary(binary);
      await onRefreshData();

      Swal.fire({
        icon: 'success',
        title: 'Pemulihan Sukses',
        text: 'Database SQLite berhasil diimpor dan siap digunakan kembali.',
      });
    } catch (err: any) {
      Swal.fire({
        icon: 'error',
        title: 'Impor Gagal',
        text: err.message || 'File tidak valid',
      });
    } finally {
      e.target.value = '';
    }
  };

  // Test Database Integrity
  const handleTestIntegrity = async () => {
    try {
      const db = await getDatabase();
      const res = db.exec('PRAGMA integrity_check;');
      const status = res[0]?.values[0]?.[0] || 'unknown';

      if (status === 'ok') {
        Swal.fire({
          icon: 'success',
          title: 'Database Sangat Sehat',
          text: 'Pemeriksaan integritas SQLite (PRAGMA integrity_check): Struktur tabel dan indeks 100% konsisten.',
        });
      } else {
        Swal.fire({
          icon: 'warning',
          title: 'Integritas Tidak Sesuai',
          text: String(status),
        });
      }
    } catch (err: any) {
      Swal.fire({
        icon: 'error',
        title: 'Uji Gagal',
        text: err.message,
      });
    }
  };

  // Reset / Clear All Database
  const handleResetDatabase = async () => {
    const res = await Swal.fire({
      title: 'Kosongkan Seluruh Data?',
      text: 'Tindakan ini akan menghapus permanen seluruh transaksi penjualan, stok Robux, dan mutasi kas. Pengaturan toko tetap tersimpan.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Ya, Bersihkan Semua Data',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#e11d48',
    });

    if (!res.isConfirmed) return;

    try {
      await resetAllDataToEmpty();
      await onRefreshData();
      Swal.fire({
        icon: 'success',
        title: 'Data Berhasil Dikosongkan',
        text: 'Aplikasi siap digunakan untuk transaksi bisnis yang baru.',
      });
    } catch (err: any) {
      Swal.fire({
        icon: 'error',
        title: 'Gagal Mengosongkan Data',
        text: err.message,
      });
    }
  };

  const lastBackup = localStorage.getItem('jufa_last_backup_date');

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b theme-border pb-4">
        <div>
          <h2 className="text-base sm:text-lg font-heading font-bold theme-text-primary flex items-center gap-2">
            <Settings size={20} /> Pengaturan Aplikasi & Cadangan Data
          </h2>
          <p className="text-xs theme-text-secondary">
            Konfigurasi nama toko, mode tema visual (Gelap/Terang/Otomatis), metode pembayaran, supplier, dan backup SQLite.
          </p>
        </div>

        <button
          onClick={() => handleSave()}
          className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-white hover:bg-neutral-200 text-black font-bold text-xs shadow-sm transition active:scale-95"
        >
          <Save size={14} /> Simpan Pengaturan
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Identitas & Tema */}
        <div className="space-y-6">
          {/* Section: Identitas Toko */}
          <div className="theme-bg-surface p-5 sm:p-6 rounded-2xl border theme-border space-y-4">
            <h3 className="font-heading font-bold theme-text-primary text-sm border-b theme-border pb-2.5">
              Profil & Nama Toko
            </h3>

            <div>
              <label className="text-xs font-medium theme-text-secondary block mb-1">
                Nama Bisnis / Toko
              </label>
              <input
                type="text"
                value={formData.store_name}
                onChange={e => setFormData({ ...formData, store_name: e.target.value })}
                className="w-full theme-bg-input border theme-border rounded-xl px-3 py-2 text-xs theme-text-primary font-bold focus:outline-none"
                placeholder="Misal: JUFA STORE"
                required
              />
              <span className="text-[11px] theme-text-muted mt-1 block">
                Nama ini ditampilkan pada header atas, dasbor, dan laporan resmi.
              </span>
            </div>
          </div>

          {/* Section: Tema Tampilan (Dark, Light, System) */}
          <div className="theme-bg-surface p-5 sm:p-6 rounded-2xl border theme-border space-y-4">
            <div className="flex items-center justify-between border-b theme-border pb-2.5">
              <h3 className="font-heading font-bold theme-text-primary text-sm flex items-center gap-2">
                <Palette size={16} /> Mode Tema Tampilan
              </h3>
              <span className="text-[11px] theme-text-muted">Langsung Aktif</span>
            </div>

            <div>
              <label className="text-xs font-medium theme-text-secondary block mb-2">
                Pilih Mode Tampilan
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => handleThemeModeChange('dark')}
                  className={`flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border transition-all duration-150 active:scale-95 text-xs font-bold ${
                    formData.theme_mode === 'dark' || !formData.theme_mode
                      ? 'theme-bg-card theme-border theme-text-primary ring-2 ring-white/20 shadow-sm'
                      : 'theme-bg-input theme-border-subtle theme-text-muted hover:theme-text-primary'
                  }`}
                >
                  <Moon size={16} />
                  <span>Mode Gelap</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleThemeModeChange('light')}
                  className={`flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border transition-all duration-150 active:scale-95 text-xs font-bold ${
                    formData.theme_mode === 'light'
                      ? 'theme-bg-card theme-border theme-text-primary ring-2 ring-black/20 shadow-sm'
                      : 'theme-bg-input theme-border-subtle theme-text-muted hover:theme-text-primary'
                  }`}
                >
                  <Sun size={16} />
                  <span>Mode Terang</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleThemeModeChange('system')}
                  className={`flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border transition-all duration-150 active:scale-95 text-xs font-bold ${
                    formData.theme_mode === 'system'
                      ? 'theme-bg-card theme-border theme-text-primary ring-2 ring-white/20 shadow-sm'
                      : 'theme-bg-input theme-border-subtle theme-text-muted hover:theme-text-primary'
                  }`}
                >
                  <Monitor size={16} />
                  <span>Otomatis (Sistem)</span>
                </button>
              </div>
              <span className="text-[11px] theme-text-muted mt-2 block">
                Mode Otomatis akan menyelaraskan tampilan dengan tema gelap/terang pada perangkat Anda.
              </span>
            </div>
          </div>
        </div>

        {/* Right Column: Operasional (Metode Bayar & Supplier) */}
        <div className="space-y-6">
          {/* Kelola Metode Pembayaran */}
          <div className="theme-bg-surface p-5 sm:p-6 rounded-2xl border theme-border space-y-4">
            <div className="flex items-center justify-between border-b theme-border pb-2.5">
              <h3 className="font-heading font-bold theme-text-primary text-sm flex items-center gap-2">
                <CreditCard size={16} /> Daftar Metode Pembayaran
              </h3>
              <span className="text-[11px] theme-text-muted">
                {formData.payment_methods.length} terdaftar
              </span>
            </div>

            {formData.payment_methods.length === 0 ? (
              <div className="p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-500 flex items-start gap-2.5 text-xs">
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <div>
                  <strong>Belum ada metode pembayaran yang terdaftar.</strong>
                  <p className="mt-0.5 opacity-90">
                    Silakan ketik dan tambahkan metode pembayaran yang Anda gunakan (contoh: BCA, Mandiri, Dana, GoPay, QRIS) di bawah ini.
                  </p>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto border theme-border rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="theme-bg-card theme-text-secondary border-b theme-border">
                    <tr>
                      <th className="p-2.5 w-10 text-center font-mono">#</th>
                      <th className="p-2.5">Nama Metode Pembayaran</th>
                      <th className="p-2.5 w-16 text-center">Hapus</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y theme-border-subtle">
                    {formData.payment_methods.map((method, idx) => (
                      <tr key={idx} className="theme-bg-card-hover">
                        <td className="p-2 text-center theme-text-muted font-mono">{idx + 1}</td>
                        <td className="p-2 font-medium theme-text-primary">{method}</td>
                        <td className="p-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemovePaymentMethod(method)}
                            className="p-1 theme-text-muted hover:text-rose-400 rounded transition"
                            title="Hapus metode ini"
                          >
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Misal: BCA, Dana, QRIS..."
                value={newPaymentMethod}
                onChange={e => setNewPaymentMethod(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddPaymentMethod();
                  }
                }}
                className="flex-1 theme-bg-input border theme-border rounded-xl px-3 py-2 text-xs theme-text-primary focus:outline-none"
              />
              <button
                type="button"
                onClick={handleAddPaymentMethod}
                className="px-3.5 py-2 rounded-xl theme-bg-card hover:theme-bg-card-hover border theme-border text-xs font-bold theme-text-primary transition flex items-center gap-1.5 active:scale-95"
              >
                <Plus size={14} /> Tambah
              </button>
            </div>
          </div>

          {/* Kelola Supplier */}
          <div className="theme-bg-surface p-5 sm:p-6 rounded-2xl border theme-border space-y-4">
            <div className="flex items-center justify-between border-b theme-border pb-2.5">
              <h3 className="font-heading font-bold theme-text-primary text-sm flex items-center gap-2">
                <Truck size={16} /> Daftar Supplier Robux
              </h3>
              <span className="text-[11px] theme-text-muted">
                {formData.suppliers.length} terdaftar
              </span>
            </div>

            {formData.suppliers.length === 0 ? (
              <div className="p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-500 flex items-start gap-2.5 text-xs">
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <div>
                  <strong>Belum ada nama supplier yang terdaftar.</strong>
                  <p className="mt-0.5 opacity-90">
                    Tambahkan nama supplier atau penyedia stok Robux Anda di bawah ini agar mudah dipilih saat melakukan restock.
                  </p>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto border theme-border rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="theme-bg-card theme-text-secondary border-b theme-border">
                    <tr>
                      <th className="p-2.5 w-10 text-center font-mono">#</th>
                      <th className="p-2.5">Nama Supplier / Sumber Stok</th>
                      <th className="p-2.5 w-16 text-center">Hapus</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y theme-border-subtle">
                    {formData.suppliers.map((supplier, idx) => (
                      <tr key={idx} className="theme-bg-card-hover">
                        <td className="p-2 text-center theme-text-muted font-mono">{idx + 1}</td>
                        <td className="p-2 font-medium theme-text-primary">{supplier}</td>
                        <td className="p-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveSupplier(supplier)}
                            className="p-1 theme-text-muted hover:text-rose-400 rounded transition"
                            title="Hapus supplier ini"
                          >
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Misal: Supplier Grosir Discord..."
                value={newSupplier}
                onChange={e => setNewSupplier(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddSupplier();
                  }
                }}
                className="flex-1 theme-bg-input border theme-border rounded-xl px-3 py-2 text-xs theme-text-primary focus:outline-none"
              />
              <button
                type="button"
                onClick={handleAddSupplier}
                className="px-3.5 py-2 rounded-xl theme-bg-card hover:theme-bg-card-hover border theme-border text-xs font-bold theme-text-primary transition flex items-center gap-1.5 active:scale-95"
              >
                <Plus size={14} /> Tambah
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Info Khusus: Lokasi Penyimpanan SQLite di Android & Komputer */}
      <div className="theme-bg-surface p-5 sm:p-6 rounded-2xl border theme-border space-y-4">
        <div className="flex items-center gap-2 border-b theme-border pb-3">
          <HardDrive size={18} className="theme-text-primary" />
          <div>
            <h3 className="font-heading font-bold theme-text-primary text-base">
              Lokasi Penyimpanan SQLite & Keamanan Data
            </h3>
            <p className="text-xs theme-text-secondary mt-0.5">
              Penjelasan teknis tempat database bisnis Anda tersimpan secara persisten dan terlindungi.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          {/* Card Lokasi Android */}
          <div className="p-4 rounded-xl theme-bg-card border theme-border space-y-2">
            <div className="flex items-center gap-2 font-bold theme-text-primary">
              <Smartphone size={16} className="text-emerald-400" />
              <span>Penyimpanan di HP Android (APK):</span>
            </div>
            <p className="text-xs theme-text-secondary leading-relaxed">
              Database SQLite aplikasi disimpan di dalam ruang penyimpanan internal private aplikasi:
            </p>
            <div className="p-2 rounded-lg bg-black/40 border theme-border font-mono text-[11px] text-zinc-300 select-all break-all">
              /data/user/0/com.jufastore.app/app_webview/IndexedDB/
            </div>
            <p className="text-[11px] theme-text-muted">
              Data terisolasi secara sandboxed, tidak dapat diakses oleh aplikasi lain, dan tidak hilang saat HP dimatikan atau di-restart.
            </p>
          </div>

          {/* Card Lokasi Web / PC */}
          <div className="p-4 rounded-xl theme-bg-card border theme-border space-y-2">
            <div className="flex items-center gap-2 font-bold theme-text-primary">
              <Database size={16} className="text-cyan-400" />
              <span>Penyimpanan di Komputer / Browser:</span>
            </div>
            <p className="text-xs theme-text-secondary leading-relaxed">
              Database biner SQLite diserialisasi dan disimpan permanen di IndexedDB lokal:
            </p>
            <div className="p-2 rounded-lg bg-black/40 border theme-border font-mono text-[11px] text-zinc-300 select-all break-all">
              IndexedDB: jufa_store_db → sqlite_storage (jufa_main_sqlite_binary)
            </div>
            <p className="text-[11px] theme-text-muted">
              Penyimpanan 100% offline di harddisk Anda tanpa mengirim data apapun ke server eksternal (Zero Leakage).
            </p>
          </div>
        </div>
      </div>

      {/* Full Width: Cadangan & Pemulihan Database SQLite */}
      <div className="theme-bg-surface p-5 sm:p-6 rounded-2xl border theme-border space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b theme-border pb-3">
          <div>
            <h3 className="font-heading font-bold theme-text-primary text-base flex items-center gap-2">
              <Database size={18} /> Cadangan & Pemulihan Database
            </h3>
            <p className="text-xs theme-text-secondary mt-0.5">
              Simpan dan pulihkan database bisnis Anda secara aman di komputer lokal.
            </p>
          </div>
          {lastBackup && (
            <span className="text-[11px] theme-text-muted">
              Pencadangan terakhir:{' '}
              {new Date(lastBackup).toLocaleDateString('id-ID', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Ekspor SQLite Binary */}
          <div className="p-4 rounded-xl theme-bg-card border theme-border space-y-3 flex flex-col justify-between">
            <div>
              <span className="text-xs font-bold theme-text-primary flex items-center gap-1.5">
                <Download size={14} /> Database SQLite (.sqlite)
              </span>
              <p className="text-[11px] theme-text-muted mt-1 leading-relaxed">
                Salinan biner asli database SQLite. Cocok untuk arsip permanen dan transfer antar perangkat.
              </p>
            </div>
            <button
              type="button"
              onClick={handleExportSQLite}
              className="w-full py-2 px-3 rounded-lg bg-white text-black font-bold text-xs hover:bg-neutral-200 transition text-center active:scale-95"
            >
              Unduh File .sqlite
            </button>
          </div>

          {/* Card 2: Ekspor JSON */}
          <div className="p-4 rounded-xl theme-bg-card border theme-border space-y-3 flex flex-col justify-between">
            <div>
              <span className="text-xs font-bold theme-text-primary flex items-center gap-1.5">
                <Download size={14} /> Cadangan Data (.json)
              </span>
              <p className="text-[11px] theme-text-muted mt-1 leading-relaxed">
                Format teks JSON terstruktur yang mudah dibaca dan diolah di software spreadsheet.
              </p>
            </div>
            <button
              type="button"
              onClick={handleExportJSON}
              className="w-full py-2 px-3 rounded-lg theme-bg-input hover:theme-bg-card-hover border theme-border theme-text-primary font-bold text-xs transition text-center active:scale-95"
            >
              Unduh File .json
            </button>
          </div>

          {/* Card 3: Impor & Pulihkan */}
          <div className="p-4 rounded-xl theme-bg-card border theme-border space-y-3 flex flex-col justify-between">
            <div>
              <span className="text-xs font-bold theme-text-primary flex items-center gap-1.5">
                <Upload size={14} /> Pulihkan Database
              </span>
              <p className="text-[11px] theme-text-muted mt-1 leading-relaxed">
                Muat ulang database bisnis dari file .sqlite yang telah Anda cadangkan sebelumnya.
              </p>
            </div>
            <label className="w-full py-2 px-3 rounded-lg theme-bg-input hover:theme-bg-card-hover border theme-border theme-text-primary font-bold text-xs transition text-center cursor-pointer block active:scale-95">
              Pilih File Cadangan
              <input
                type="file"
                accept=".sqlite,.db"
                onChange={handleImportSQLite}
                className="hidden"
              />
            </label>
          </div>

          {/* Card 4: Uji Integritas & Reset */}
          <div className="p-4 rounded-xl theme-bg-card border theme-border space-y-3 flex flex-col justify-between">
            <div>
              <span className="text-xs font-bold theme-text-primary flex items-center gap-1.5">
                <ShieldCheck size={14} /> Perawatan Database
              </span>
              <p className="text-[11px] theme-text-muted mt-1 leading-relaxed">
                Periksa kesehatan SQLite lokal atau bersihkan database untuk memulai pembukuan baru.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleTestIntegrity}
                className="flex-1 py-2 px-2 rounded-lg theme-bg-input hover:theme-bg-card-hover border theme-border theme-text-primary text-[11px] font-bold transition active:scale-95"
              >
                Cek Sehat
              </button>
              <button
                type="button"
                onClick={handleResetDatabase}
                className="py-2 px-2.5 rounded-lg border border-rose-500/30 text-rose-400 hover:bg-rose-500/10 text-[11px] font-bold transition active:scale-95"
                title="Kosongkan semua data"
              >
                Kosongkan
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
