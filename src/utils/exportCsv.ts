import { Sale, CashLedgerEntry, Category, PersonalUsage } from '../db/schema';
import { formatDateJakarta } from './formatters';

function escapeCsvField(value: any): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function downloadCsvFile(filename: string, content: string): void {
  // UTF-8 BOM agar Excel di Windows & Android membaca karakter dengan benar
  const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportSalesToCsv(sales: Sale[]): void {
  const headers = [
    'No Invoice',
    'Waktu Transaksi (WIB)',
    'Nama Pembeli',
    'Robux Terjual (R$)',
    'Rate (Rp/R$)',
    'Total Omzet (Rp)',
    'Modal FIFO / HPP (Rp)',
    'Laba Kotor (Rp)',
    'Status',
    'Catatan',
  ];

  const rows = sales.map((s) => [
    s.invoiceNumber,
    formatDateJakarta(s.createdAt),
    s.customerName || '-',
    s.robuxSold,
    s.rateUsed,
    s.totalRevenueRupiah,
    s.totalCogsRupiah,
    s.grossProfitRupiah,
    s.status === 'ACTIVE' ? 'Aktif' : 'Dibatalkan (Void)',
    s.notes || '-',
  ]);

  const csvContent = [
    headers.map(escapeCsvField).join(','),
    ...rows.map((row) => row.map(escapeCsvField).join(',')),
  ].join('\r\n');

  const dateStr = new Date().toISOString().substring(0, 10);
  downloadCsvFile(`JufaStore_Penjualan_${dateStr}.csv`, csvContent);
}

export function exportCashLedgerToCsv(
  entries: CashLedgerEntry[],
  categories: Category[]
): void {
  const categoryMap = new Map<string, string>();
  for (const c of categories) {
    categoryMap.set(c.id, c.name);
  }

  const headers = [
    'ID Kas',
    'Tanggal (YYYY-MM-DD)',
    'Waktu Catat (WIB)',
    'Jenis Kas',
    'Nominal (Rp)',
    'Sumber Transaksi',
    'Kategori',
    'Catatan',
  ];

  const rows = entries.map((e) => {
    const jenis = e.type === 'IN' ? 'Kas Masuk' : 'Kas Keluar';
    const sumber =
      e.sourceType === 'SALE'
        ? 'Penjualan'
        : e.sourceType === 'RESTOCK'
        ? 'Restock Robux'
        : 'Manual';
    const kategoriName = e.categoryId ? categoryMap.get(e.categoryId) || '-' : '-';

    return [
      e.id,
      e.dateKey,
      formatDateJakarta(e.createdAt),
      jenis,
      e.amountRupiah,
      sumber,
      kategoriName,
      e.notes || '-',
    ];
  });

  const csvContent = [
    headers.map(escapeCsvField).join(','),
    ...rows.map((row) => row.map(escapeCsvField).join(',')),
  ].join('\r\n');

  const dateStr = new Date().toISOString().substring(0, 10);
  downloadCsvFile(`JufaStore_BukuKas_${dateStr}.csv`, csvContent);
}

export function exportPersonalUsagesToCsv(usages: PersonalUsage[]): void {
  const headers = [
    'ID Transaksi',
    'Waktu Catat (WIB)',
    'Robux Diambil (R$)',
    'Total Modal FIFO (Rp)',
    'Modal per Robux (Rp)',
    'Jumlah Batch Terpangkas',
    'Catatan / Keperluan',
  ];

  const rows = usages.map((u) => {
    const modalPerRobux = u.robuxUsed > 0 ? (u.totalCostRupiah / u.robuxUsed).toFixed(2) : '0';
    return [
      u.id,
      formatDateJakarta(u.createdAt),
      u.robuxUsed,
      u.totalCostRupiah,
      modalPerRobux,
      u.allocations ? u.allocations.length : 0,
      u.notes || '-',
    ];
  });

  const csvContent = [
    headers.map(escapeCsvField).join(','),
    ...rows.map((row) => row.map(escapeCsvField).join(',')),
  ].join('\r\n');

  const dateStr = new Date().toISOString().substring(0, 10);
  downloadCsvFile(`JufaStore_PemakaianPribadi_${dateStr}.csv`, csvContent);
}
