import { create } from 'zustand';

export type Theme = 'light' | 'dark';
export type Lang = 'ko' | 'en';

interface UiState {
  theme: Theme;
  lang: Lang;
  init: () => void;
  setTheme: (t: Theme) => void;
  toggleTheme: () => void;
  setLang: (l: Lang) => void;
}

function applyTheme(t: Theme) {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('dark', t === 'dark');
}

export const useUi = create<UiState>((set, get) => ({
  theme: 'light',
  lang: 'ko',

  init: () => {
    if (typeof localStorage === 'undefined') return;
    const stored = localStorage.getItem('theme') as Theme | null;
    const prefersDark = typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches;
    const theme: Theme = stored ?? (prefersDark ? 'dark' : 'light');
    const lang = (localStorage.getItem('lang') as Lang | null) ?? 'ko';
    applyTheme(theme);
    set({ theme, lang });
  },

  setTheme: (t) => {
    if (typeof localStorage !== 'undefined') localStorage.setItem('theme', t);
    applyTheme(t);
    set({ theme: t });
  },
  toggleTheme: () => get().setTheme(get().theme === 'dark' ? 'light' : 'dark'),

  setLang: (l) => {
    if (typeof localStorage !== 'undefined') localStorage.setItem('lang', l);
    set({ lang: l });
  },
}));
