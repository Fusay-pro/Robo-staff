'use client';

import { useT } from '@/context/I18nContext';

export default function LanguageToggle({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale } = useT();
  return (
    <div className={`flex items-center gap-0.5 bg-surface-container rounded-lg p-0.5 ${compact ? 'text-[10px]' : 'text-xs'}`}>
      {(['en', 'th'] as const).map(l => (
        <button key={l} onClick={() => setLocale(l)}
          className={`px-2 py-1 rounded-md font-bold uppercase transition-colors ${
            locale === l ? 'bg-primary text-white shadow-sm' : 'text-on-surface-variant hover:text-on-surface'
          }`}>
          {l}
        </button>
      ))}
    </div>
  );
}
