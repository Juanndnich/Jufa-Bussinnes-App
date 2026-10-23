export type ThemeMode = 'dark' | 'light' | 'system' | 'halloween';

let systemListenerAttached = false;

export function applyTheme(mode: ThemeMode = 'halloween') {
  const root = document.documentElement;

  const updateClasses = () => {
    let isDark = true;
    let isHalloween = false;

    if (mode === 'light') {
      isDark = false;
    } else if (mode === 'halloween') {
      isHalloween = true;
      isDark = true;
    } else if (mode === 'system') {
      isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    }

    root.classList.remove('dark', 'light', 'halloween');

    if (isHalloween) {
      root.classList.add('dark', 'halloween');
    } else if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.add('light');
    }
  };

  updateClasses();

  // Listen to system changes if in 'system' mode
  if (typeof window !== 'undefined' && window.matchMedia && !systemListenerAttached) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      // Re-apply if system mode is currently active
      const currentStored = localStorage.getItem('jufa_theme_mode');
      if (currentStored === 'system') {
        const isDarkNow = window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (isDarkNow) {
          root.classList.add('dark');
          root.classList.remove('light');
        } else {
          root.classList.remove('dark');
          root.classList.add('light');
        }
      }
    });
    systemListenerAttached = true;
  }
}
