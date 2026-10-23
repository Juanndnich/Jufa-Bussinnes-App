export type ThemeMode = 'dark' | 'light' | 'system';

let systemListenerAttached = false;

export function applyTheme(mode: ThemeMode = 'dark') {
  const root = document.documentElement;

  const updateClasses = () => {
    let isDark = true;
    if (mode === 'light') {
      isDark = false;
    } else if (mode === 'system') {
      isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    }

    if (isDark) {
      root.classList.add('dark');
      root.classList.remove('light');
    } else {
      root.classList.remove('dark');
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
