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
} from 'lucide-react';
import Swal from 'sweetalert2';
import { AppSettings, Cashflow, StockBatch, Transaction } from '../types';
import { exportSqliteBinary, getDatabase, importSqliteBinary } from '../services/db';
import { resetAllDataToEmpty, saveSettings } from '../services/repository';

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

  // Save Settings
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await saveSettings(formData);
      await onRefreshData();
      Swal.fire({
        icon: 'success',
        title: 'Pengaturan Disimpan',
        text: 'Semua preferensi harga dan konfigurasi berhasil diperbarui.',
        timer: 1600,
        showConfirmButton: false,
      });
    } catch (err: any) {
      Swal.fire({
        icon: 'error',
        title: 'Gagal Menyimpan',
        text: err.message,
      });
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
      title: 'Backup JSON Berhasil',
      text: 'File JSON backup terstruktur telah diunduh.',
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
        title: 'File SQLite Berhasil Diunduh',
        text: 'Database biner SQLite nyata (.sqlite) berhasil disimpan.',
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
      text: 'Semua transaksi dan batch saat ini akan digantikan oleh file database yang diimpor.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Ya, Pulihkan Database',
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
        title: 'Pemulihan Berhasil',
        text: 'Database SQLite berhasil diimpor dan dimuat ulang.',
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
          title: 'Integritas Database Sempurna',
          text: 'Pemeriksaan PRAGMA integrity_check: SQLite database sehat, konsisten, dan siap digunakan.',
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
      text: 'Tindakan ini akan menghapus permanen seluruh transaksi penjualan, batch stok Robux, dan mutasi kas. Database akan kembali bersih total.',
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
        title: 'Database Dibersihkan',
        text: 'Semua data transaksi, stok, dan kas telah dikosongkan. Aplikasi siap untuk penggunaan baru yang bersih.',
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
      {/* Top Banner */}
      <div className="bg-[#09090b] p-5 rounded-2xl border border-white/10">
        <h2 className="text-xl font-poppins font-bold text-white flex items-center gap-2">
          <Settings className="text-white" size={22} />
          <span>Pengaturan Bisnis, Harga & Backup Database</span>
        </h2>
        <p className="text-xs text-neutral-400 mt-1">
          Kustomisasi rate default, tier kuantitas paket Robux, kategori kas, serta backup dan restore data lokal.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Settings Form */}
        <form
          onSubmit={handleSave}
          className="bg-[#09090b] p-6 rounded-2xl border border-white/10 space-y-4"
        >
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <h3 className="font-poppins font-bold text-white text-base">Konfigurasi Toko & Harga</h3>
            <button
              type="submit"
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-white hover:bg-neutral-200 text-black text-xs font-bold transition"
            >
              <Save size={14} />
              <span>Simpan Pengaturan</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-neutral-300 block mb-1">Nama Toko</label>
              <input
                type="text"
                value={formData.store_name}
                onChange={e => setFormData({ ...formData, store_name: e.target.value })}
                className="w-full bg-[#111114] border border-white/15 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-white/30"
                required
              />
            </div>

            <div>
              <label className="text-xs font-medium text-neutral-300 block mb-1">
                Rate Jual Standar Default (Rp / R$)
              </label>
              <input
                type="number"
                step="0.1"
                value={formData.default_rate}
                onChange={e => setFormData({ ...formData, default_rate: Number(e.target.value) })}
                className="w-full bg-[#111114] border border-white/15 rounded-xl px-3 py-2 text-xs font-mono font-bold text-white focus:outline-none focus:border-white/30"
                required
              />
            </div>

            <div>
              <label className="text-xs font-medium text-neutral-300 block mb-1">
                Batas Kuantitas Paket Kecil (R$)
              </label>
              <input
                type="number"
                min="1"
                value={formData.small_pack_threshold}
                onChange={e =>
                  setFormData({ ...formData, small_pack_threshold: Number(e.target.value) })
                }
                className="w-full bg-[#111114] border border-white/15 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-white/30"
              />
              <span className="text-[10px] text-neutral-500">Misal ≤ 100 R$ dianggap paket eceran</span>
            </div>

            <div>
              <label className="text-xs font-medium text-neutral-300 block mb-1">
                Ambang Batas Peringatan Stok Minimum (R$)
              </label>
              <input
                type="number"
                min="0"
                value={formData.min_stock_alert}
                onChange={e =>
                  setFormData({ ...formData, min_stock_alert: Number(e.target.value) })
                }
                className="w-full bg-[#111114] border border-white/15 rounded-xl px-3 py-2 text-xs font-mono text-rose-300 focus:outline-none focus:border-white/30"
              />
              <span className="text-[10px] text-neutral-500">Muncul alert jika stok di bawah ini</span>
            </div>

            <div>
              <label className="text-xs font-medium text-neutral-300 block mb-1">
                Rate Paket Kecil (Eceran) (Rp)
              </label>
              <input
                type="number"
                step="0.1"
                value={formData.small_pack_rate}
                onChange={e =>
                  setFormData({ ...formData, small_pack_rate: Number(e.target.value) })
                }
                className="w-full bg-[#111114] border border-white/15 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-white/30"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-neutral-300 block mb-1">
                Rate Paket Besar (Grosir) (Rp)
              </label>
              <input
                type="number"
                step="0.1"
                value={formData.large_pack_rate}
                onChange={e =>
                  setFormData({ ...formData, large_pack_rate: Number(e.target.value) })
                }
                className="w-full bg-[#111114] border border-white/15 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-white/30"
              />
            </div>
          </div>

          {/* List Management: Payment Methods */}
          <div className="pt-2 border-t border-white/10">
            <label className="text-xs font-medium text-neutral-300 block mb-2">
              Daftar Metode Pembayaran Toko
            </label>
            <div className="flex flex-wrap gap-2 mb-2">
              {formData.payment_methods.map(m => (
                <span
                  key={m}
                  className="px-2.5 py-1 rounded-lg bg-[#111114] border border-white/15 text-xs text-white flex items-center gap-1.5"
                >
                  <span>{m}</span>
                  {formData.payment_methods.length > 1 && (
                    <button
                      type="button"
                      onClick={() =>
                        setFormData({
                          ...formData,
                          payment_methods: formData.payment_methods.filter(x => x !== m),
                        })
                      }
                      className="text-neutral-500 hover:text-rose-400"
                    >
                      ✕
                    </button>
                  )}
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Tambah metode bayar (misal: Seabank, ShopeePay)..."
                value={newPaymentMethod}
                onChange={e => setNewPaymentMethod(e.target.value)}
                className="bg-[#111114] border border-white/15 rounded-xl px-3 py-1.5 text-xs text-white flex-1 focus:outline-none focus:border-white/30"
              />
              <button
                type="button"
                onClick={() => {
                  if (newPaymentMethod.trim() && !formData.payment_methods.includes(newPaymentMethod.trim())) {
                    setFormData({
                      ...formData,
                      payment_methods: [...formData.payment_methods, newPaymentMethod.trim()],
                    });
                    setNewPaymentMethod('');
                  }
                }}
                className="px-3 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold border border-white/10"
              >
                + Tambah
              </button>
            </div>
          </div>

          {/* List Management: Suppliers */}
          <div className="pt-2 border-t border-white/10">
            <label className="text-xs font-medium text-neutral-300 block mb-2">
              Daftar Nama Supplier Favorit
            </label>
            <div className="flex flex-wrap gap-2 mb-2">
              {formData.suppliers.map(s => (
                <span
                  key={s}
                  className="px-2.5 py-1 rounded-lg bg-[#111114] border border-white/15 text-xs text-white flex items-center gap-1.5"
                >
                  <span>{s}</span>
                  {formData.suppliers.length > 1 && (
                    <button
                      type="button"
                      onClick={() =>
                        setFormData({
                          ...formData,
                          suppliers: formData.suppliers.filter(x => x !== s),
                        })
                      }
                      className="text-neutral-500 hover:text-rose-400"
                    >
                      ✕
                    </button>
                  )}
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Tambah nama supplier..."
                value={newSupplier}
                onChange={e => setNewSupplier(e.target.value)}
                className="bg-[#111114] border border-white/15 rounded-xl px-3 py-1.5 text-xs text-white flex-1 focus:outline-none focus:border-white/30"
              />
              <button
                type="button"
                onClick={() => {
                  if (newSupplier.trim() && !formData.suppliers.includes(newSupplier.trim())) {
                    setFormData({
                      ...formData,
                      suppliers: [...formData.suppliers, newSupplier.trim()],
                    });
                    setNewSupplier('');
                  }
                }}
                className="px-3 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold border border-white/10"
              >
                + Tambah
              </button>
            </div>
          </div>
        </form>

        {/* Database Backup, Restore & Danger Zone */}
        <div className="bg-[#09090b] p-6 rounded-2xl border border-white/10 space-y-5">
          <div className="border-b border-white/10 pb-3 flex items-center justify-between">
            <h3 className="font-poppins font-bold text-white text-base flex items-center gap-2">
              <Database size={18} className="text-white" />
              <span>Backup, Restore & Keamanan Data</span>
            </h3>
            <span className="text-[10px] text-neutral-300 bg-white/10 px-2 py-0.5 rounded border border-white/10 font-mono">
              100% Offline Lokal
            </span>
          </div>

          <div className="text-xs text-neutral-300 space-y-2">
            <p>
              Semua data transaksi, modal, dan stok Anda tersimpan secara persisten di penyimpanan SQLite internal browser (IndexedDB) komputer Anda tanpa pernah dikirim ke internet.
            </p>
            {lastBackup && (
              <p className="text-neutral-400 font-mono text-[11px]">
                Backup terakhir: {new Date(lastBackup).toLocaleString('id-ID')}
              </p>
            )}
          </div>

          {/* Backup Options */}
          <div className="space-y-3 pt-1">
            <div className="p-4 rounded-xl bg-[#111114] border border-white/10 flex items-center justify-between">
              <div>
                <span className="font-semibold text-white text-xs block">Cadangkan File .SQLite Asli</span>
                <span className="text-[11px] text-neutral-400">
                  Dapat dibuka di DB Browser for SQLite atau diimpor kembali.
                </span>
              </div>
              <button
                onClick={handleExportSQLite}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-neutral-200 text-black font-bold text-xs transition"
              >
                <Download size={13} /> Unduh SQLite
              </button>
            </div>

            <div className="p-4 rounded-xl bg-[#111114] border border-white/10 flex items-center justify-between">
              <div>
                <span className="font-semibold text-white text-xs block">Cadangkan JSON Terstruktur</span>
                <span className="text-[11px] text-neutral-400">
                  Cadangan teks lengkap untuk audit dan migrasi.
                </span>
              </div>
              <button
                onClick={handleExportJSON}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-200 font-semibold text-xs border border-white/15 transition"
              >
                <Download size={13} /> Unduh JSON
              </button>
            </div>

            {/* Restore File Input */}
            <div className="p-4 rounded-xl bg-[#111114] border border-white/10 space-y-2">
              <span className="font-semibold text-white text-xs block">
                Pulihkan / Impor Database (.sqlite / .db)
              </span>
              <p className="text-[11px] text-neutral-400">
                Pilih file database SQLite untuk memulihkan seluruh data toko Anda.
              </p>
              <label className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border border-dashed border-white/20 hover:border-white/40 bg-neutral-950/60 text-neutral-300 text-xs font-semibold cursor-pointer transition">
                <Upload size={14} />
                <span>Pilih File SQLite dari Komputer</span>
                <input
                  type="file"
                  accept=".sqlite,.db"
                  onChange={handleImportSQLite}
                  className="hidden"
                />
              </label>
            </div>

            {/* Integrity Test */}
            <div className="p-4 rounded-xl bg-[#111114] border border-white/10 flex items-center justify-between">
              <div>
                <span className="font-semibold text-white text-xs block">Uji Integritas SQLite</span>
                <span className="text-[11px] text-neutral-400">
                  Periksa konsistensi tabel dan halaman database (PRAGMA integrity_check)
                </span>
              </div>
              <button
                onClick={handleTestIntegrity}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 font-medium text-xs border border-white/10"
              >
                <ShieldCheck size={14} className="text-emerald-400" />
                <span>Uji Integritas</span>
              </button>
            </div>

            {/* Danger Zone: Reset Data */}
            <div className="p-4 rounded-xl bg-rose-950/20 border border-rose-500/20 flex items-center justify-between">
              <div>
                <span className="font-semibold text-rose-400 text-xs flex items-center gap-1.5">
                  <AlertTriangle size={13} />
                  <span>Kosongkan Seluruh Data</span>
                </span>
                <span className="text-[11px] text-neutral-400">
                  Hapus permanen semua data transaksi, stok, dan kas kembali bersih.
                </span>
              </div>
              <button
                onClick={handleResetDatabase}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs transition"
              >
                <Trash2 size={13} />
                <span>Kosongkan Data</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
