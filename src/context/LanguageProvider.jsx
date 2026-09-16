import { useState, useCallback } from 'react';
import { LanguageContext } from './LanguageContext';
import en from '../i18n/en.json';
import ua from '../i18n/ua.json';

const translations = { en, ua };

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState(() => {
    try {
      return localStorage.getItem('lang') || 'en';
    } catch {
      return 'en';
    }
  });

  const toggleLanguage = useCallback(() => {
    setLanguage((prev) => {
      const next = prev === 'en' ? 'ua' : 'en';
      try { localStorage.setItem('lang', next); } catch { /* localStorage unavailable */ }
      return next;
    });
  }, []);

  const t = useCallback(
    (key) => {
      const keys = key.split('.');
      let value = translations[language];
      for (const k of keys) {
        value = value?.[k];
      }
      return value || key;
    },
    [language]
  );

  return (
    <LanguageContext.Provider value={{ language, toggleLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}
