import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// Importar archivos de traducción
import esCommon from '../locales/es/common.json';
import enCommon from '../locales/en/common.json';
import esReports from '../locales/es/reports.json';
import enReports from '../locales/en/reports.json';

const resources = {
  es: {
    common: esCommon,
    reports: esReports,
  },
  en: {
    common: enCommon,
    reports: enReports,
  },
};

i18n
  .use(initReactI18next) // passa i18n down to react-i18next
  .init({
    resources,
    lng: 'es', // idioma por defecto
    fallbackLng: 'es',
    debug: false,

    // have a common namespace used around the full app
    ns: ['common', 'reports'],
    defaultNS: 'common',

    keySeparator: '.', // we use dots to denote object hierarchy

    interpolation: {
      escapeValue: false, // not needed for react!!
    },

    // persist language preference
    detection: {
      order: ['localStorage', 'cookie', 'navigator'],
      caches: ['localStorage', 'cookie'],
    },
  });

export default i18n;
