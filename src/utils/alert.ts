import Swal, { SweetAlertIcon } from 'sweetalert2';

/**
 * Clean up any SweetAlert residual DOM state so the screen NEVER freezes.
 */
export function cleanupSwalLocks(): void {
  try {
    document.body.classList.remove('swal2-shown', 'swal2-height-auto');
    document.body.style.overflow = '';
    document.body.style.paddingRight = '';

    // If any invisible empty container remains, detach it
    const containers = document.querySelectorAll('.swal2-container');
    containers.forEach(el => {
      if (!el.querySelector('.swal2-popup:not(.swal2-hide)')) {
        el.remove();
      }
    });
  } catch {
    // Ignore any DOM cleanup errors
  }
}

/**
 * Non-blocking, light, instant Toast notification.
 * Never creates a screen-blocking backdrop.
 * Never locks touches or clicks.
 */
export function showToast(
  title: string,
  icon: SweetAlertIcon = 'success',
  subtitle?: string
): void {
  cleanupSwalLocks();

  const Toast = Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 2000,
    timerProgressBar: true,
    didOpen: toast => {
      toast.onmouseenter = Swal.stopTimer;
      toast.onmouseleave = Swal.resumeTimer;
    },
    didClose: () => {
      cleanupSwalLocks();
    },
  });

  Toast.fire({
    icon,
    title,
    text: subtitle,
  });
}

/**
 * Modal Alert with clean lifecycle
 */
export function showAlert(
  title: string,
  text?: string,
  icon: SweetAlertIcon = 'info'
) {
  cleanupSwalLocks();

  return Swal.fire({
    title,
    text,
    icon,
    confirmButtonText: 'OK',
    didClose: () => {
      cleanupSwalLocks();
    },
  });
}

/**
 * Confirmation dialog that guarantees backdrop dismissal
 */
export async function showConfirm(
  title: string,
  text?: string,
  confirmButtonText = 'Ya, Lanjutkan',
  isDanger = false
): Promise<boolean> {
  cleanupSwalLocks();

  const result = await Swal.fire({
    title,
    text,
    icon: isDanger ? 'warning' : 'question',
    showCancelButton: true,
    confirmButtonText,
    cancelButtonText: 'Batal',
    confirmButtonColor: isDanger ? '#e11d48' : '#2563eb',
    didClose: () => {
      cleanupSwalLocks();
    },
  });

  cleanupSwalLocks();
  return result.isConfirmed;
}
