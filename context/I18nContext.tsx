'use client';

import { createContext, useContext, useState, ReactNode } from 'react';
import { messages } from '@/lib/i18n/messages';

type Locale = 'en' | 'th';

interface I18nValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

const STORAGE_KEY = 'staff_locale_v1';

function detectInitial(): Locale {
  if (typeof window === 'undefined') return 'en';
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'th' || stored === 'en') return stored;
  const nav = navigator.language || '';
  return nav.startsWith('th') ? 'th' : 'en';
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => detectInitial());

  function setLocale(l: Locale) {
    setLocaleState(l);
    if (typeof window !== 'undefined') localStorage.setItem(STORAGE_KEY, l);
  }

  function t(key: string, params?: Record<string, string | number>): string {
    const fallback = messages.en as Record<string, string>;
    const dict = (messages as Record<Locale, Record<string, string>>)[locale] || fallback;
    let str = dict[key];
    if (str == null) str = fallback[key] ?? key;
    if (params) {
      for (const k in params) str = str.replace(`{${k}}`, String(params[k]));
    }
    return str;
  }

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useT() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useT must be used within I18nProvider');
  return ctx;
}
