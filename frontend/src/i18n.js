import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import translationEN from './locales/en.json';
import translationFA from './locales/fa.json';
import translationPS from './locales/ps.json';

const resources = {
  en: {
    translation: translationEN
  },
  fa: {
    translation: translationFA
  },
  ps: {
    translation: translationPS
  }
};

// Retrieve language from localStorage or default to English
const savedLanguage = localStorage.getItem('sky_banking_lang') || 'en';

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: savedLanguage,
    fallbackLng: 'en',
    returnNull: false,
    returnEmptyString: false,
    interpolation: {
      escapeValue: false // React already safely escapes HTML values
    }
  });

export default i18n;
