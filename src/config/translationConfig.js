/**
 * Configuración para el sistema de traducción automática
 * Usa LibreTranslate (Space de Hugging Face) llamado directo desde el navegador
 */

// Resolver variables de entorno para Vite (import.meta.env) o CRA (process.env)
const ENV = (
  (typeof import.meta !== 'undefined' && import.meta.env) ||
  (typeof process !== 'undefined' && process.env) ||
  {}
);

export const TRANSLATION_CONFIG = {
  // Configuración de LibreTranslate
  libretranslate: {
    // URL base del Space (sin barra final)
    baseUrl: (ENV.VITE_LIBRETRANSLATE_URL || 'https://enriquevnd-libretranslate.hf.space').replace(/\/$/, ''),

    // Token opcional (PROXY_TOKEN del Space). Nota: queda visible en el bundle.
    token: ENV.VITE_LIBRETRANSLATE_TOKEN || '',

    // Configuración de idiomas (el Space solo carga es y en)
    languages: {
      source: 'es', // Idioma por defecto de las notas (español)
      target: 'en', // Idioma de destino para reportes PDF (inglés)
      fallback: 'es' // Idioma de respaldo si falla la detección
    },

    // Configuración de traducción
    translation: {
      // Habilitar traducción automática
      enabled: true,

      // Timeout por solicitud (ms); el Space gratuito puede ser lento
      requestTimeout: 30000,

      // Espera máxima a que el Space despierte (ms) y frecuencia de consulta
      warmupMaxWaitMs: 180000,
      warmupPollMs: 5000,

      // Tiempo mínimo entre pings de calentamiento al abrir el visor (ms)
      warmupCooldownMs: 300000
    }
  },

  // Configuración general del sistema
  system: {
    // Habilitar logging de traducciones
    enableLogging: (ENV.MODE || ENV.NODE_ENV) === 'development',

    // Cache de traducciones (en localStorage)
    enableCache: true,

    // Tiempo de vida del cache (en horas)
    cacheExpirationHours: 24,

    // Prefijo para claves de cache
    cachePrefix: 'vnd_translation_'
  },

  // Configuración específica para notas de daños
  damageNotes: {
    // Campos que deben traducirse
    fieldsToTranslate: ['additional_notes'],

    // Contexto para mejorar la traducción
    context: 'wind_turbine_damage_inspection',

    // Formateo especial para notas
    formatting: {
      // Preservar saltos de línea
      preserveLineBreaks: true,

      // Preservar números y medidas
      preserveNumbers: true,

      // Preservar códigos técnicos
      preserveTechnicalCodes: true
    }
  }
};

/**
 * Obtiene la configuración de LibreTranslate
 * @returns {object} - Configuración de LibreTranslate
 */
export const getLibreTranslateConfig = () => {
  return TRANSLATION_CONFIG.libretranslate;
};

/**
 * Obtiene la configuración del sistema
 * @returns {object} - Configuración del sistema
 */
export const getSystemConfig = () => {
  return TRANSLATION_CONFIG.system;
};

/**
 * Obtiene la configuración para notas de daños
 * @returns {object} - Configuración para notas de daños
 */
export const getDamageNotesConfig = () => {
  return TRANSLATION_CONFIG.damageNotes;
};

/**
 * Verifica si la traducción está habilitada
 * @returns {boolean} - True si está habilitada
 */
export const isTranslationEnabled = () => {
  return TRANSLATION_CONFIG.libretranslate.translation.enabled &&
         !!TRANSLATION_CONFIG.libretranslate.baseUrl;
};

/**
 * Obtiene el idioma de destino para reportes PDF
 * @returns {string} - Código del idioma de destino
 */
export const getTargetLanguage = () => {
  return TRANSLATION_CONFIG.libretranslate.languages.target;
};

/**
 * Obtiene el idioma fuente por defecto
 * @returns {string} - Código del idioma fuente
 */
export const getSourceLanguage = () => {
  return TRANSLATION_CONFIG.libretranslate.languages.source;
};

export default TRANSLATION_CONFIG;
