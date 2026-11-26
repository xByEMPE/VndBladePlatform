/**
 * Cliente de LibreTranslate (Space de Hugging Face) llamado directo desde el navegador.
 * Solo soporta es <-> en. El Space puede estar dormido: se espera con /lt-status.
 */

import { getLibreTranslateConfig } from '../config/translationConfig';

const SUPPORTED = ['es', 'en'];

/** Normaliza códigos tipo 'EN-US', 'ES-ES' a 'en' / 'es'. */
export const normalizeLang = (lang) => {
  if (!lang) return 'en';
  return String(lang).toLowerCase().split('-')[0];
};

const buildHeaders = (config) => {
  const headers = { 'Content-Type': 'application/json' };
  if (config.token) headers['X-API-Token'] = config.token;
  return headers;
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const fetchWithTimeout = async (url, options, timeoutMs) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
};

let lastWarmupAt = 0;

/**
 * Despierta el Space en segundo plano (GET /lt-status) sin esperar la respuesta, para que esté
 * listo cuando llegue la primera traducción. Se limita a una vez cada warmupCooldownMs.
 */
export const warmUpTranslationService = () => {
  const { baseUrl, translation } = getLibreTranslateConfig();
  if (!translation.enabled || !baseUrl) return;
  if (Date.now() - lastWarmupAt < translation.warmupCooldownMs) return;
  lastWarmupAt = Date.now();
  fetchWithTimeout(`${baseUrl}/lt-status`, {}, 10000).catch(() => {});
};

let warmupPromise = null;

/** Espera a que el Space esté listo; comparte la espera entre llamadas concurrentes. */
export const waitUntilReady = () => {
  if (warmupPromise) return warmupPromise;

  const { baseUrl, translation } = getLibreTranslateConfig();
  const deadline = Date.now() + translation.warmupMaxWaitMs;

  warmupPromise = (async () => {
    while (Date.now() < deadline) {
      try {
        const res = await fetchWithTimeout(`${baseUrl}/lt-status`, {}, 10000);
        if (res.ok && (await res.json()).ready) return true;
      } catch {
        // El Space puede estar despertando: reintentar
      }
      await sleep(translation.warmupPollMs);
    }
    throw new Error('LibreTranslate no estuvo disponible a tiempo');
  })().finally(() => {
    warmupPromise = null;
  });

  return warmupPromise;
};

// /tr/translate aplica el glosario de inspección en el Space; /lt/translate es LibreTranslate a secas.
// Si el Space aún no tiene /tr (404) se usa /lt durante el resto de la sesión.
let glossaryEndpointAvailable = true;

const postTranslate = (config, path, lines, source, target) =>
  fetchWithTimeout(
    `${config.baseUrl}${path}`,
    {
      method: 'POST',
      headers: buildHeaders(config),
      body: JSON.stringify({ q: lines, source, target, format: 'text' }),
    },
    config.translation.requestTimeout,
  );

const requestTranslation = async (config, lines, source, target) => {
  if (glossaryEndpointAvailable) {
    const res = await postTranslate(config, '/tr/translate', lines, source, target);
    if (res.status !== 404) return res;
    glossaryEndpointAvailable = false;
  }
  return postTranslate(config, '/lt/translate', lines, source, target);
};

/**
 * Traduce texto con LibreTranslate preservando saltos de línea.
 * @param {string} text
 * @param {string} targetLang - 'en', 'es', 'EN-US', ...
 * @param {string} [sourceLang='es']
 * @returns {Promise<string>}
 * @throws {Error} si el idioma no está soportado o el servicio falla
 */
const translateWithLibre = async (text, targetLang, sourceLang = 'es') => {
  if (!text?.trim()) return text;

  const config = getLibreTranslateConfig();
  const source = normalizeLang(sourceLang);
  const target = normalizeLang(targetLang);

  if (!SUPPORTED.includes(source) || !SUPPORTED.includes(target)) {
    throw new Error(`Idioma no soportado: ${source} -> ${target}`);
  }
  if (source === target) return text;

  // Se envía cada línea no vacía como elemento de q (el servidor devuelve un array)
  const lines = text.split('\n');
  const indexes = [];
  const payload = [];
  lines.forEach((line, i) => {
    if (line.trim()) {
      indexes.push(i);
      payload.push(line);
    }
  });

  let res;
  try {
    res = await requestTranslation(config, payload, source, target);
  } catch {
    res = null; // Space dormido: corta la conexión o expira
  }

  if (!res || res.status === 503 || res.status === 502) {
    await waitUntilReady();
    res = await requestTranslation(config, payload, source, target);
  }

  if (!res.ok) {
    throw new Error(`LibreTranslate respondió ${res.status}`);
  }

  const data = await res.json();
  const translated = Array.isArray(data.translatedText) ? data.translatedText : [data.translatedText];
  if (translated.length !== payload.length || translated.some((t) => typeof t !== 'string')) {
    throw new Error('Respuesta de LibreTranslate inválida');
  }

  const out = [...lines];
  indexes.forEach((lineIndex, k) => {
    out[lineIndex] = translated[k];
  });
  return out.join('\n');
};

export default translateWithLibre;
