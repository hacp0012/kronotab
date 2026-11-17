import { useEffect, useState } from 'react';
import { ChromeAccent, DEFAULT_THEME_SETTINGS, ThemeMode, ThemeSettings } from './types';
import { useChromeStorage } from './useChromeStorage';

export const CHROME_ACCENTS: {
  id: ChromeAccent;
  label: string;
  swatch: string;
}[] = [
  { id: 'amber', label: 'Ambre (Défaut)', swatch: '#f59e0b' },
  { id: 'blue', label: 'Bleu Chrome', swatch: '#1a73e8' },
  { id: 'indigo', label: 'Indigo', swatch: '#4f46e5' },
  { id: 'emerald', label: 'Sauge / Émeraude', swatch: '#0d9488' },
  { id: 'violet', label: 'Lavande', swatch: '#7c3aed' },
  { id: 'rose', label: 'Terracotta / Rose', swatch: '#e11d48' },
];

export function useTheme() {
  const [themeSettings, setThemeSettings] = useChromeStorage<ThemeSettings>(
    'themeSettings',
    DEFAULT_THEME_SETTINGS
  );

  const [systemPrefersDark, setSystemPrefersDark] = useState<boolean>(() =>
    typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
      : true
  );

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => setSystemPrefersDark(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const resolvedDark =
    themeSettings.mode === 'system'
      ? systemPrefersDark
      : themeSettings.mode === 'dark';

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', resolvedDark ? 'dark' : 'light');
    root.setAttribute('data-accent', themeSettings.accent || 'amber');

    if (resolvedDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }

    const chromeWithTheme = (typeof chrome !== 'undefined' ? chrome : undefined) as
      | (typeof chrome & {
          theme?: {
            getCurrent: (
              cb: (theme: { colors?: { frame?: number[] } }) => void
            ) => void;
          };
        })
      | undefined;

    if (chromeWithTheme?.theme?.getCurrent) {
      chromeWithTheme.theme.getCurrent((theme) => {
        if (theme?.colors?.frame && Array.isArray(theme.colors.frame)) {
          const [r, g, b] = theme.colors.frame;
          root.style.setProperty('--chrome-frame-rgb', `${r}, ${g}, ${b}`);
        }
      });
    }
  }, [resolvedDark, themeSettings.accent]);

  const setMode = (mode: ThemeMode) => {
    setThemeSettings((prev) => ({ ...prev, mode }));
  };

  const setAccent = (accent: ChromeAccent) => {
    setThemeSettings((prev) => ({ ...prev, accent }));
  };

  return {
    themeSettings,
    resolvedDark,
    setMode,
    setAccent,
  };
}
