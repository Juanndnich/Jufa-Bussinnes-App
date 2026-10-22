/**
 * Format currency as Indonesian Rupiah according to specifications:
 * e.g. "Rp320.000" or "-Rp2.000"
 */
export function formatRupiah(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return 'Rp0';
  }
  const isNegative = amount < 0;
  const absAmount = Math.round(Math.abs(amount));
  const formatted = absAmount.toLocaleString('id-ID');
  return isNegative ? `-Rp${formatted}` : `Rp${formatted}`;
}

/**
 * Format integer numbers with thousand separators
 */
export function formatNumber(val: number | null | undefined): string {
  if (val === null || val === undefined || isNaN(val)) {
    return '0';
  }
  return Math.round(val).toLocaleString('id-ID');
}

/**
 * Format float numbers with custom decimals
 */
export function formatDecimal(val: number | null | undefined, decimals = 2): string {
  if (val === null || val === undefined || isNaN(val)) {
    return '0';
  }
  return val.toLocaleString('id-ID', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Format date in Asia/Jakarta timezone
 */
export function formatDateJakarta(dateStr: string | Date | undefined, includeTime = true): string {
  if (!dateStr) return '-';
  try {
    const d = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
    if (isNaN(d.getTime())) return '-';
    
    return new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      ...(includeTime ? { hour: '2-digit', minute: '2-digit' } : {}),
    }).format(d);
  } catch {
    return String(dateStr);
  }
}

/**
 * Get current ISO string or Jakarta date ISO
 */
export function getJakartaCurrentDate(): string {
  return new Date().toISOString();
}

/**
 * Generate unique codes
 */
export function generateTransactionCode(seq = 1): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `TRX-${yyyy}${mm}${dd}-${String(seq).padStart(3, '0')}-${rand}`;
}

export function generateBatchCode(seq = 1): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const rand = Math.floor(100 + Math.random() * 900);
  return `BATCH-${yyyy}${mm}${dd}-${String(seq).padStart(2, '0')}-${rand}`;
}
