'use client';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { translations, type Lang } from './i18n';

type LangContextType = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
};

const LangContext = createContext<LangContextType | null>(null);

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>('th');

  useEffect(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('shop_lang') : null;
    if (saved === 'th' || saved === 'en') setLangState(saved);
  }, []);

  function setLang(l: Lang) {
    setLangState(l);
    if (typeof window !== 'undefined') localStorage.setItem('shop_lang', l);
  }

  function t(key: string, vars?: Record<string, string | number>): string {
    const parts = key.split('.');
    let node: any = translations[lang];
    for (const p of parts) node = node?.[p];
    let text = typeof node === 'string' ? node : key;
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        text = text.replace(`{${k}}`, String(v));
      }
    }
    return text;
  }

  return <LangContext.Provider value={{ lang, setLang, t }}>{children}</LangContext.Provider>;
}

export function useLang() {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error('useLang must be used within a LangProvider');
  return ctx;
}
