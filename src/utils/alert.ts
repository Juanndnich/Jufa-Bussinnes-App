import Swal, { SweetAlertOptions } from 'sweetalert2';

function isDarkMode(): boolean {
  if (typeof document === 'undefined') return true;
  return document.documentElement.classList.contains('dark') || 
    (!document.documentElement.classList.contains('light') && window.matchMedia('(prefers-color-scheme: dark)').matches);
}

function getThemeSwalConfig() {
  const dark = isDarkMode();
  return {
    background: dark ? '#18181b' : '#ffffff',
    color: dark ? '#f4f4f5' : '#09090b',
    confirmButtonColor: dark ? '#22c55e' : '#16a34a',
    cancelButtonColor: dark ? '#3f3f46' : '#94a3b8',
    customClass: {
      popup: 'rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-2xl p-5',
      title: 'text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-100',
      htmlContainer: 'text-sm text-zinc-600 dark:text-zinc-400',
      confirmButton: 'px-5 py-2.5 rounded-xl font-medium text-sm transition shadow-sm',
      cancelButton: 'px-5 py-2.5 rounded-xl font-medium text-sm transition',
    },
  };
}

export const showSuccessAlert = async (title: string, text?: string) => {
  const theme = getThemeSwalConfig();
  return Swal.fire({
    icon: 'success',
    title,
    text,
    timer: 2000,
    timerProgressBar: true,
    showConfirmButton: false,
    ...theme,
  });
};

export const showErrorAlert = async (title: string, text?: string) => {
  const theme = getThemeSwalConfig();
  return Swal.fire({
    icon: 'error',
    title,
    text,
    confirmButtonText: 'Tutup',
    ...theme,
  });
};

export const showWarningAlert = async (title: string, text?: string) => {
  const theme = getThemeSwalConfig();
  return Swal.fire({
    icon: 'warning',
    title,
    text,
    confirmButtonText: 'Mengerti',
    ...theme,
  });
};

export const showConfirmDialog = async (options: {
  title: string;
  text?: string;
  confirmButtonText?: string;
  cancelButtonText?: string;
  isDanger?: boolean;
}): Promise<boolean> => {
  const theme = getThemeSwalConfig();
  const result = await Swal.fire({
    title: options.title,
    text: options.text,
    icon: options.isDanger ? 'warning' : 'question',
    showCancelButton: true,
    confirmButtonText: options.confirmButtonText || 'Ya, Lanjutkan',
    cancelButtonText: options.cancelButtonText || 'Batal',
    reverseButtons: true,
    focusCancel: options.isDanger,
    ...theme,
    confirmButtonColor: options.isDanger ? '#ef4444' : theme.confirmButtonColor,
  });

  return result.isConfirmed;
};

export const showCustomAlert = async (options: SweetAlertOptions) => {
  const theme = getThemeSwalConfig();
  return Swal.fire({
    ...theme,
    ...options,
  });
};

export const showToast = async (title: string, icon: 'success' | 'info' | 'warning' | 'error' = 'info') => {
  const theme = getThemeSwalConfig();
  return Swal.fire({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 3000,
    timerProgressBar: true,
    icon,
    title,
    background: theme.background,
    color: theme.color,
    customClass: {
      popup: 'rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-xl text-xs py-2 px-3',
      title: 'text-xs font-semibold text-zinc-900 dark:text-zinc-100',
    },
  });
};
