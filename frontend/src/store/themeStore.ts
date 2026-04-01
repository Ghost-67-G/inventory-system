import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ThemeMode = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

interface ThemeState {
  mode: ThemeMode;
  resolvedTheme: ResolvedTheme;
  setMode: (mode: ThemeMode) => void;
}

const STORAGE_KEY = 'theme-mode';
const MEDIA_QUERY = '(prefers-color-scheme: dark)';

function getSystemTheme(): ResolvedTheme {
  return window.matchMedia(MEDIA_QUERY).matches ? 'dark' : 'light';
}

function applyResolvedTheme(resolvedTheme: ResolvedTheme): void {
  if (resolvedTheme === 'dark') {
    document.documentElement.classList.add('dark');
    return;
  }
  document.documentElement.classList.remove('dark');
}

function resolveTheme(mode: ThemeMode): ResolvedTheme {
  return mode === 'system' ? getSystemTheme() : mode;
}

export function initializeTheme(): void {
  let mode: ThemeMode = 'system';
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') {
      mode = stored;
    }
  } catch {
    mode = 'system';
  }

  const resolvedTheme = resolveTheme(mode);
  applyResolvedTheme(resolvedTheme);
  useThemeStore.setState({ mode, resolvedTheme });
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      mode: 'system',
      resolvedTheme: 'light',
      setMode: (mode) => {
        const resolvedTheme = resolveTheme(mode);
        applyResolvedTheme(resolvedTheme);
        set({ mode, resolvedTheme });
      }
    }),
    {
      name: STORAGE_KEY,
      partialize: (state) => ({ mode: state.mode })
    }
  )
);

let cleanupMediaListener: (() => void) | null = null;

export function bindSystemThemeListener(): () => void {
  if (cleanupMediaListener) {
    cleanupMediaListener();
  }

  const mediaQuery = window.matchMedia(MEDIA_QUERY);
  const handler = () => {
    const { mode } = useThemeStore.getState();
    if (mode !== 'system') {
      return;
    }

    const resolvedTheme = resolveTheme(mode);
    applyResolvedTheme(resolvedTheme);
    useThemeStore.setState({ resolvedTheme });
  };

  mediaQuery.addEventListener('change', handler);
  cleanupMediaListener = () => {
    mediaQuery.removeEventListener('change', handler);
    cleanupMediaListener = null;
  };

  return cleanupMediaListener;
}
