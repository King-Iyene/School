import { createContext, useContext, useEffect, useState, ReactNode, useCallback, useMemo } from 'react';
import { useTenantSettings } from './TenantContext';

export type ThemeMode = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'schoolos-theme-mode';

interface ThemeContextType {
  mode: ThemeMode;
  isDark: boolean;
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function readStoredMode(): ThemeMode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
  } catch {
    // localStorage unavailable (private mode, etc.) — fall through to default
  }
  return 'system';
}

function prefersDark(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches;
}

/**
 * Drives two independent things from one place:
 *  - light/dark mode (per-device, saved to localStorage, available to every
 *    user regardless of plan — toggled from Header).
 *  - the tenant's custom accent color, if an Enterprise tenant has set one
 *    from /system/appearance (tenant_settings.app_primary_color /
 *    app_secondary_color) — applied as CSS variable overrides so it takes
 *    effect for every user of that tenant, on top of whichever light/dark
 *    mode they've individually picked.
 * Both are just CSS custom properties (see index.css's `.dark` block and
 * the `app-*` Tailwind tokens in tailwind.config.js) — nothing here touches
 * the DOM beyond toggling a class and setting a couple of --app-* vars.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const { settings } = useTenantSettings();
  const [mode, setModeState] = useState<ThemeMode>(readStoredMode);
  const [systemPrefersDark, setSystemPrefersDark] = useState(prefersDark);

  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!mq) return;
    const listener = (e: MediaQueryListEvent) => setSystemPrefersDark(e.matches);
    mq.addEventListener('change', listener);
    return () => mq.removeEventListener('change', listener);
  }, []);

  const isDark = mode === 'dark' || (mode === 'system' && systemPrefersDark);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
  }, [isDark]);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // best-effort only
    }
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (settings.app_primary_color) {
      root.style.setProperty('--app-primary', settings.app_primary_color);
    } else {
      root.style.removeProperty('--app-primary');
    }
    if (settings.app_secondary_color) {
      root.style.setProperty('--app-secondary', settings.app_secondary_color);
    } else {
      root.style.removeProperty('--app-secondary');
    }
  }, [settings.app_primary_color, settings.app_secondary_color]);

  const value = useMemo(() => ({ mode, isDark, setMode }), [mode, isDark, setMode]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
}
