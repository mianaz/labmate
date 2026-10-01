import { createContext, useContext } from 'react';
import { translations, NOTES_EN } from './translations.js';

export { translations, NOTES_EN };

export const LangContext = createContext('zh');
export function useLang() { return useContext(LangContext); }

// An empty string is a deliberate translation — e.g. dilPrepTotal in Chinese,
// where 至总体积 already says "total" — so only a missing one falls back to English.
export function t(key, lang) {
  const entry = translations[key];
  if (!entry) return key;
  if (typeof entry[lang] === 'string') return entry[lang];
  return typeof entry.en === 'string' ? entry.en : key;
}
