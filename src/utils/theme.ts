export type ThemeMode = 'dark' | 'light' | 'system';

export interface ColorPreset {
  id: string;
  name: string;
  colorHex: string;
}

export const COLOR_PRESETS: ColorPreset[] = [
  { id: 'obsidian', name: 'Obsidian Minimalis', colorHex: '#ffffff' },
  { id: 'gold', name: 'Golden Robux', colorHex: '#f59e0b' },
  { id: 'cyan', name: 'Cyber Neon Cyan', colorHex: '#06b6d4' },
  { id: 'emerald', name: 'Emerald Profit', colorHex: '#10b981' },
  { id: 'violet', name: 'Royal Violet', colorHex: '#8b5cf6' },
  { id: 'rose', name: 'Rose Crimson', colorHex: '#f43f5e' },
];

export function applyTheme(
  mode: ThemeMode = 'dark',
  accentColor?: string
) {
  const root = document.documentElement;

  // Resolve Dark vs Light
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

  // Accent Color
  const activeColor = accentColor || '#ffffff';
  root.style.setProperty('--theme-accent', activeColor);
}
