/**
 * JufaStore — Domain Logika & Perhitungan Tabungan Pribadi (Savings)
 * Aturan Mutlak: Integer Rupiah, Tanpa Emoji, Tanpa Efek Samping Database/UI
 */

export interface SavingsSummaryResult {
  totalBalance: number;
  totalIn: number;
  totalOut: number;
  unallocatedBalance: number;
  categories: Array<{
    name: string;
    balance: number;
    totalIn: number;
    totalOut: number;
  }>;
}

/**
 * Menghitung ringkasan saldo tabungan secara presisi (integer Rupiah).
 */
export function calculateSavingsSummary(
  entries: Array<{ type: 'IN' | 'OUT'; amountRupiah: number; category?: string }>,
  savedCategories: Array<{ name: string }> = []
): SavingsSummaryResult {
  let totalIn = 0;
  let totalOut = 0;
  let unallocatedIn = 0;
  let unallocatedOut = 0;

  const catStats = new Map<string, { totalIn: number; totalOut: number }>();

  // Pastikan semua kategori tersimpan terdaftar (meskipun saldonya masih 0)
  for (const sc of savedCategories) {
    const cleanName = sc.name.trim();
    if (cleanName && !catStats.has(cleanName)) {
      catStats.set(cleanName, { totalIn: 0, totalOut: 0 });
    }
  }

  for (const entry of entries) {
    const amt = Math.round(Number(entry.amountRupiah) || 0);
    const cat = (entry.category || '').trim();
    const isUnallocated =
      !cat || cat.toUpperCase() === 'UMUM' || cat.toLowerCase() === 'tanpa kategori';

    if (entry.type === 'IN') {
      totalIn += amt;
      if (isUnallocated) {
        unallocatedIn += amt;
      } else {
        const stat = catStats.get(cat) || { totalIn: 0, totalOut: 0 };
        stat.totalIn += amt;
        catStats.set(cat, stat);
      }
    } else if (entry.type === 'OUT') {
      totalOut += amt;
      if (isUnallocated) {
        unallocatedOut += amt;
      } else {
        const stat = catStats.get(cat) || { totalIn: 0, totalOut: 0 };
        stat.totalOut += amt;
        catStats.set(cat, stat);
      }
    }
  }

  const categoriesList = Array.from(catStats.entries()).map(([name, stat]) => ({
    name,
    balance: stat.totalIn - stat.totalOut,
    totalIn: stat.totalIn,
    totalOut: stat.totalOut,
  }));

  categoriesList.sort((a, b) => a.name.localeCompare(b.name));

  return {
    totalBalance: totalIn - totalOut,
    totalIn,
    totalOut,
    unallocatedBalance: unallocatedIn - unallocatedOut,
    categories: categoriesList,
  };
}

/**
 * Validasi kecukupan saldo tabungan sebelum penarikan (OUT) dilakukan.
 */
export function validateSavingsWithdrawal(
  amountRupiah: number,
  targetCategory: string,
  entries: Array<{ type: 'IN' | 'OUT'; amountRupiah: number; category?: string }>
): { valid: boolean; availableBalance: number; error?: string } {
  const amt = Math.round(Number(amountRupiah) || 0);
  if (amt <= 0) {
    return {
      valid: false,
      availableBalance: 0,
      error: 'Nominal uang tabungan harus lebih dari Rp0',
    };
  }

  const cleanCategory = (targetCategory || '').trim();
  const isUnallocated =
    !cleanCategory ||
    cleanCategory.toUpperCase() === 'UMUM' ||
    cleanCategory.toLowerCase() === 'tanpa kategori';

  let currentBalance = 0;
  for (const e of entries) {
    const eCat = (e.category || '').trim();
    const eIsUnallocated =
      !eCat || eCat.toUpperCase() === 'UMUM' || eCat.toLowerCase() === 'tanpa kategori';

    if (isUnallocated) {
      if (eIsUnallocated) {
        currentBalance += e.type === 'IN' ? e.amountRupiah : -e.amountRupiah;
      }
    } else {
      if (eCat.toLowerCase() === cleanCategory.toLowerCase()) {
        currentBalance += e.type === 'IN' ? e.amountRupiah : -e.amountRupiah;
      }
    }
  }

  if (amt > currentBalance) {
    const targetName = isUnallocated
      ? 'Uang Biasa / Tanpa Kategori'
      : `Kategori "${cleanCategory}"`;
    return {
      valid: false,
      availableBalance: currentBalance,
      error: `Saldo tabungan pada ${targetName} tidak mencukupi (Tersedia: Rp${Math.max(0, currentBalance).toLocaleString('id-ID')}, Dibutuhkan: Rp${amt.toLocaleString('id-ID')})`,
    };
  }

  return { valid: true, availableBalance: currentBalance };
}
