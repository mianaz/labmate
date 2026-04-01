import { createContext, useContext } from 'react';
import { translations, NOTES_EN } from './translations.js';

export { translations, NOTES_EN };

export const LangContext = createContext('zh');
export function useLang() { return useContext(LangContext); }

export function t(key, lang) {
  const entry = translations[key];
  if (!entry) return key;
  return entry[lang] || entry.en || key;
}
