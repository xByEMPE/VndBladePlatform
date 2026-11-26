/**
 * Utilidades para el sistema de traducción
 * Manejo de cache, formateo y validación de traducciones
 */

import { getSystemConfig, getDamageNotesConfig } from '../config/translationConfig';

/**
 * Clase para manejar el cache de traducciones
 */
class TranslationCache {
  constructor() {
    this.config = getSystemConfig();
    this.prefix = this.config.cachePrefix;
    this.expirationHours = this.config.cacheExpirationHours;
  }

  /**
   * Genera una clave de cache para un texto
   * @param {string} text - Texto a traducir
   * @param {string} targetLang - Idioma destino
   * @returns {string} - Clave de cache
   */
  generateCacheKey(text, targetLang) {
    const hash = this.simpleHash(text);
    return `${this.prefix}${hash}_${targetLang}`;
  }

  /**
   * Hash simple para generar claves de cache
   * @param {string} str - String a hashear
   * @returns {string} - Hash simple
   */
  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convertir a 32bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Obtiene una traducción del cache
   * @param {string} text - Texto original
   * @param {string} targetLang - Idioma destino
   * @returns {string|null} - Traducción cacheada o null
   */
  get(text, targetLang) {
    if (!this.config.enableCache) return null;

    try {
      const key = this.generateCacheKey(text, targetLang);
      const cached = localStorage.getItem(key);
      
      if (!cached) return null;

      const data = JSON.parse(cached);
      const now = Date.now();
      
      // Verificar si el cache ha expirado
      if (now - data.timestamp > this.expirationHours * 60 * 60 * 1000) {
        this.remove(text, targetLang);
        return null;
      }

      return data.translation;
    } catch (error) {
      console.warn('Error reading translation cache:', error);
      return null;
    }
  }

  /**
   * Guarda una traducción en el cache
   * @param {string} text - Texto original
   * @param {string} targetLang - Idioma destino
   * @param {string} translation - Traducción
   */
  set(text, targetLang, translation) {
    if (!this.config.enableCache) return;

    try {
      const key = this.generateCacheKey(text, targetLang);
      const data = {
        translation,
        timestamp: Date.now()
      };
      
      localStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
      console.warn('Error saving translation cache:', error);
    }
  }

  /**
   * Elimina una traducción del cache
   * @param {string} text - Texto original
   * @param {string} targetLang - Idioma destino
   */
  remove(text, targetLang) {
    if (!this.config.enableCache) return;

    try {
      const key = this.generateCacheKey(text, targetLang);
      localStorage.removeItem(key);
    } catch (error) {
      console.warn('Error removing translation cache:', error);
    }
  }

  /**
   * Limpia todo el cache de traducciones
   */
  clear() {
    if (!this.config.enableCache) return;

    try {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith(this.prefix)) {
          localStorage.removeItem(key);
        }
      });
    } catch (error) {
      console.warn('Error clearing translation cache:', error);
    }
  }
}

/**
 * Utilidades para formateo de texto antes de traducir
 */
export const TextFormatter = {
  /**
   * Limpia texto corrupto de traducciones anteriores
   * @param {string} text - Texto a limpiar
   * @returns {string} - Texto limpio
   */
  cleanCorruptedText(text) {
    if (!text) return text;
    
    let cleaned = text;
    
    // Limpiar fragmentos CODE corruptos (más agresivo)
    cleaned = cleaned.replace(/\b[A-Z]*CODE[A-Z_]*\b/gi, '');
    cleaned = cleaned.replace(/\b_*CODE_*\b/gi, '');
    cleaned = cleaned.replace(/CODE_[^_]*_CODE/gi, '');
    cleaned = cleaned.replace(/CODE_[A-Za-z]*_CODE/gi, '');
    
    // Limpiar patrones específicos detectados
    cleaned = cleaned.replace(/\bCODE_le_le_CODE\b/gi, '');
    cleaned = cleaned.replace(/\bCODE_CODE_CODE\b/gi, '');
    
    // Limpiar fragmentos con guion bajo de traducciones corruptas previas. Ya no se quitan palabras
    // sueltas como "les" o "te": son palabras reales del español ("no les afectan").
    cleaned = cleaned.replace(/\b(te_|_te|teand)\b/gi, '');
    cleaned = cleaned.replace(/\btener\s+operations\b/gi, 'stop operations');
    cleaned = cleaned.replace(/\bgive\s+te\s+teand\s+te_\b/gi, 'stop');
    cleaned = cleaned.replace(/\bternal\s+damage\b/gi, 'internal damage');
    
    // Limpiar fragmentos de palabras rotas
    cleaned = cleaned.replace(/\s+s\s+considered\b/gi, ' is considered');
    cleaned = cleaned.replace(/\bpossible\s+les\s+damage\b/gi, 'possible damage');
    cleaned = cleaned.replace(/\bdamage\s+in\s+tes\b/gi, 'damage');
    
    // Limpiar underscores múltiples y caracteres sueltos
    cleaned = cleaned.replace(/_+/g, ' ');
    cleaned = cleaned.replace(/\b_\b/g, '');
    
    // Limpiar espacios múltiples y normalizar
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    
    // Limpiar patrones específicos al final
    cleaned = cleaned.replace(/^\s*s\s+/gi, '');
    cleaned = cleaned.replace(/\s+s\s*$/gi, '');
    
    return cleaned;
  },
  /**
   * Prepara el texto para traducción preservando elementos importantes
   * @param {string} text - Texto a formatear
   * @returns {string} - Texto formateado
   */
  prepareForTranslation(text) {
    if (!text) return text;

    // Ya no se envuelven números ni códigos con marcadores NUM_/CODE_: sin límites de palabra
    // partían palabras normales ("ma-te-rial", "nú-cle-o") y LibreTranslate devolvía texto roto.
    // LibreTranslate respeta bien números, medidas y códigos como "Cat 3".
    return text;
  },

  /**
   * Restaura el texto después de la traducción
   * @param {string} translatedText - Texto traducido
   * @returns {string} - Texto restaurado
   */
  restoreAfterTranslation(translatedText) {
    if (!translatedText) return translatedText;

    let restored = translatedText;

    // Restaurar números y medidas (permitir variaciones en espacios)
    restored = restored.replace(/\s*NUM_([^_]+)_NUM\s*/g, ' $1');

    // Restaurar códigos técnicos (permitir variaciones en espacios y texto corrupto)
    restored = restored.replace(/\s*CODE_([^_]+)_CODE\s*/g, ' $1');
    
    // Limpiar fragmentos CODE corruptos que puedan quedar
    restored = restored.replace(/\b[A-Z]*CODE[A-Z_]*\b/g, '');
    restored = restored.replace(/\b_CODE\b/g, '');
    restored = restored.replace(/\bCODE_\b/g, '');
    
    // Limpiar palabras fragmentadas típicas de traducción corrupta
    restored = restored.replace(/\b(les|tes|ner|te_|_te|te\s|les\s|tes\s)\b/g, '');
    
    // Limpiar espacios múltiples y normalizar texto
    restored = restored.replace(/\s+/g, ' ').trim();
    
    // Limpiar espacios al inicio y final de frases
    restored = restored.replace(/^\s+|\s+$/g, '');

    return restored;
  }
};

/**
 * Utilidades para validación de traducciones
 */
export const TranslationValidator = {
  /**
   * Valida si una traducción es válida
   * @param {string} original - Texto original
   * @param {string} translation - Traducción
   * @returns {boolean} - True si es válida
   */
  isValid(original, translation) {
    if (!original || !translation) return false;
    if (original.trim() === translation.trim()) return false;
    if (translation.length < original.length * 0.1) return false; // Muy corta
    if (translation.length > original.length * 5) return false; // Muy larga
    
    // Detectar fragmentos CODE corruptos
    if (/\b[A-Z]*CODE[A-Z_]*\b/.test(translation)) {
      console.warn('Translation contains corrupted CODE fragments:', translation);
      return false;
    }
    
    // Detectar palabras fragmentadas típicas
    if (/\b(les|tes|ner|te_|_te)\b/.test(translation)) {
      console.warn('Translation contains fragmented words:', translation);
      return false;
    }
    
    // Detectar exceso de caracteres de subrayado
    if ((translation.match(/_/g) || []).length > 3) {
      console.warn('Translation contains too many underscores:', translation);
      return false;
    }
    
    return true;
  },

  /**
   * Detecta si el texto parece estar en español
   * @param {string} text - Texto a analizar
   * @returns {boolean} - True si parece español
   */
  isSpanish(text) {
    if (!text) return false;
    
    const spanishWords = [
      'el', 'la', 'de', 'que', 'y', 'a', 'en', 'un', 'es', 'se', 'no', 'te', 'lo', 'le', 'da', 'su', 'por', 'son', 'con', 'para', 'al', 'del', 'los', 'las', 'una', 'daño', 'grieta', 'erosión', 'impacto', 'corrosión', 'desgaste', 'pala', 'turbina', 'viento', 'energía'
    ];
    
    const words = text.toLowerCase().split(/\s+/);
    const spanishWordCount = words.filter(word => 
      spanishWords.includes(word.replace(/[^\w]/g, ''))
    ).length;
    
    return spanishWordCount > words.length * 0.1; // Al menos 10% de palabras en español
  }
};

/**
 * Función principal para traducir notas de daños con cache
 * @param {string} text - Texto a traducir
 * @param {string} targetLang - Idioma destino
 * @param {Function} translateFunction - Función de traducción
 * @returns {Promise<string>} - Texto traducido
 */
export const translateWithCache = async (text, targetLang, translateFunction) => {
  if (!text?.trim()) return text;

  const cache = new TranslationCache();
  
  // Limpiar texto corrupto antes de procesarlo
  const cleanedText = TextFormatter.cleanCorruptedText(text);
  
  // Intentar obtener del cache (usando texto limpio)
  const cached = cache.get(cleanedText, targetLang);
  if (cached) {
    console.log('Translation found in cache');
    return cached;
  }

  // Preparar texto para traducción
  const preparedText = TextFormatter.prepareForTranslation(cleanedText);
  
  // Traducir
  const translated = await translateFunction(preparedText, targetLang);
  
  // Restaurar formato
  const finalTranslation = TextFormatter.restoreAfterTranslation(translated);
  
  // Validar traducción
  if (TranslationValidator.isValid(cleanedText, finalTranslation)) {
    // Guardar en cache
    cache.set(cleanedText, targetLang, finalTranslation);
    return finalTranslation;
  } else {
    console.warn('Invalid translation, returning cleaned original text');
    return cleanedText; // Retornar el texto limpio en lugar del original
  }
};

// Instancia del cache para uso global
export const translationCache = new TranslationCache();

// Exportar función de limpieza para uso directo
export const cleanCorruptedText = TextFormatter.cleanCorruptedText;

// Función para limpiar cache de traducciones corruptas
export const cleanCorruptedCache = () => {
  const cache = new TranslationCache();
  const allEntries = Object.keys(localStorage)
    .filter(key => key.startsWith('translation_cache_'))
    .map(key => {
      try {
        return { key, value: JSON.parse(localStorage.getItem(key)) };
      } catch {
        return null;
      }
    })
    .filter(Boolean);

  let cleanedCount = 0;
  
  allEntries.forEach(({ key, value }) => {
    if (value && typeof value === 'string') {
      // Verificar si la traducción está corrupta
      if (/\b[A-Z]*CODE[A-Z_]*\b|les|tes|ner|te_|_te/.test(value)) {
        localStorage.removeItem(key);
        cleanedCount++;
      }
    }
  });
  
  return cleanedCount;
};

/**
 * Traduce las notas adicionales de un daño al idioma activo de la sesión de traducción.
 * Si la traducción está deshabilitada o falla, devuelve el texto original limpio.
 * @param {string} notes - Notas a traducir
 * @returns {Promise<string>} - Texto traducido o limpio
 */
export const translateAdditionalNotes = async (notes, languageCode) => {
  if (!notes?.trim()) return notes || '';

  // Limpiar el texto por si viene corrupto de traducciones previas
  const cleanedNotes = TextFormatter.cleanCorruptedText(notes);

  try {
    // Importación dinámica para evitar dependencia circular
    const { isTranslationEnabled, getTargetLanguage } = await import('../config/translationConfig');
    if (!isTranslationEnabled()) return cleanedNotes;

    // El idioma pedido (PDF o interfaz) manda; sin él se usa el destino de la configuración
    const targetLang = languageCode
      ? String(languageCode).toLowerCase().split('-')[0]
      : getTargetLanguage();
    if (!targetLang || targetLang === 'es') return cleanedNotes;

    const { default: translateFn } = await import('../services/hybridTranslationService');

    return await translateWithCache(cleanedNotes, targetLang, (text) =>
      translateFn(text, targetLang)
    );
  } catch (error) {
    console.warn('[translateAdditionalNotes] Translation failed, returning original:', error);
    return cleanedNotes;
  }
};

export default {
  TextFormatter,
  TranslationValidator,
  translateWithCache,
  translateAdditionalNotes,
  translationCache
};


