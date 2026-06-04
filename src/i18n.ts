import { useUi, type Lang } from '@/stores/ui';

// Inline bilingual helper: t('한국어', 'English') returns the active language.
// Lightweight (no key dictionary) — strings stay co-located with the UI.
export function useT() {
  const lang = useUi((s) => s.lang);
  return (ko: string, en: string) => (lang === 'en' ? en : ko);
}

export const useLang = (): Lang => useUi((s) => s.lang);

// Non-reactive getter for use outside React (e.g. chart data builders).
export const currentLang = (): Lang => useUi.getState().lang;
