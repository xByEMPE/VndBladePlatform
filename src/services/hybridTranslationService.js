/**
 * Servicio híbrido de traducción:
 * 1. LibreTranslate (Space de Hugging Face, directo desde el navegador)
 * 2. Diccionario técnico local como respaldo
 * 3. Texto original como último recurso
 */

import translateWithLibre from './libreTranslationService';

/**
 * Diccionario completo de traducción local para términos técnicos específicos de turbinas eólicas
 */
const TECHNICAL_DICTIONARY = {
  'es-en': {
    // Términos de daños principales
    'grieta': 'crack',
    'grietas': 'cracks',
    'fisura': 'fissure',
    'fisuras': 'fissures',
    'estructura': 'structure',
    'estructural': 'structural',
    'estructurales': 'structural',
    'grave': 'severe',
    'graves': 'severe',
    'considerables': 'considerable',
    'considerable': 'considerable',
    'transversales': 'transverse',
    'transversal': 'transverse',
    'longitudinales': 'longitudinal',
    'longitudinal': 'longitudinal',
    'erosión': 'erosion',
    'erosionado': 'eroded',
    'erosionada': 'eroded',
    'impacto': 'impact',
    'impactos': 'impacts',
    'corrosión': 'corrosion',
    'corroído': 'corroded',
    'corroída': 'corroded',
    'desgaste': 'wear',
    'desgastado': 'worn',
    'desgastada': 'worn',
    'suciedad': 'dirt',
    'sucio': 'dirty',
    'sucia': 'dirty',
    'aceite': 'oil',
    'grasa': 'grease',
    'filtrada': 'leaked',
    'filtrado': 'leaked',
    'fractura': 'fracture',
    'fracturas': 'fractures',
    'separación': 'separation',
    'desprendimiento': 'detachment',
    'rotura': 'break',
    'roturas': 'breaks',
    'astillado': 'chipped',
    'astillada': 'chipped',
    'rajadura': 'crack',
    'rajaduras': 'cracks',
    
    // Acciones y verbos
    'detener': 'stop',
    'parar': 'stop',
    'paralizar': 'halt',
    'operaciones': 'operations',
    'funcionamiento': 'operation',
    'inmediatamente': 'immediately',
    'urgentemente': 'urgently',
    'evitar': 'avoid',
    'prevenir': 'prevent',
    'reparar': 'repair',
    'inspeccionar': 'inspect',
    'revisar': 'check',
    'monitorear': 'monitor',
    'reemplazar': 'replace',
    'cambiar': 'change',
    'verificar': 'verify',
    'evaluar': 'evaluate',
    'analizar': 'analyze',
    
    // Severidad y magnitud
    'daños': 'damage',
    'daño': 'damage',
    'dano': 'damage',
    'mayores': 'major',
    'mayor': 'major',
    'menores': 'minor',
    'menor': 'minor',
    'crítico': 'critical',
    'crítica': 'critical',
    'críticos': 'critical',
    'críticas': 'critical',
    'severo': 'severe',
    'severa': 'severe',
    'severos': 'severe',
    'severas': 'severe',
    'leve': 'mild',
    'leves': 'mild',
    'moderado': 'moderate',
    'moderada': 'moderate',
    'moderados': 'moderate',
    'moderadas': 'moderate',
    'extenso': 'extensive',
    'extensa': 'extensive',
    'extensos': 'extensive',
    'extensas': 'extensive',
    'profundo': 'deep',
    'profunda': 'deep',
    'profundos': 'deep',
    'profundas': 'deep',
    'superficial': 'superficial',
    'superficiales': 'superficial',
    
    // Descriptores técnicos
    'atencion': 'attention',
    'atención': 'attention',
    'cuidado': 'care',
    'precaución': 'caution',
    'advertencia': 'warning',
    'alerta': 'alert',
    'dar': 'give',
    'brindar': 'provide',
    'otorgar': 'grant',
    'presencia': 'presence',
    'existencia': 'existence',
    'aparición': 'appearance',
    'manifestación': 'manifestation',
    'derivada': 'derived',
    'derivado': 'derived',
    'causada': 'caused',
    'causado': 'caused',
    'originada': 'originated',
    'originado': 'originated',
    'posibles': 'possible',
    'posible': 'possible',
    'probables': 'probable',
    'probable': 'probable',
    'potenciales': 'potential',
    'potencial': 'potential',
    'internos': 'internal',
    'interno': 'internal',
    'internas': 'internal',
    'interna': 'internal',
    'externos': 'external',
    'externo': 'external',
    'externas': 'external',
    'externa': 'external',
    'dadas': 'given',
    'dado': 'given',
    'dada': 'given',
    'dados': 'given',
    'dimensiones': 'dimensions',
    'dimensión': 'dimension',
    'tamaño': 'size',
    'tamaños': 'sizes',
    'medidas': 'measurements',
    'medida': 'measurement',
    
    // Componentes de turbina
    'pala': 'blade',
    'palas': 'blades',
    'turbina': 'turbine',
    'turbinas': 'turbines',
    'aerogenerador': 'wind turbine',
    'aerogeneradores': 'wind turbines',
    'rotor': 'rotor',
    'rotores': 'rotors',
    'buje': 'hub',
    'bujes': 'hubs',
    'góndola': 'nacelle',
    'góndolas': 'nacelles',
    'torre': 'tower',
    'torres': 'towers',
    'cimentación': 'foundation',
    'cimentaciones': 'foundations',
    'rodamiento': 'bearing',
    'rodamientos': 'bearings',
    'generador': 'generator',
    'generadores': 'generators',
    'transformador': 'transformer',
    'transformadores': 'transformers',
    
    // Direcciones y ubicaciones
    'maquina': 'machine',
    'máquina': 'machine',
    'equipo': 'equipment',
    'equipos': 'equipment',
    'sistema': 'system',
    'sistemas': 'systems',
    'parte': 'part',
    'partes': 'parts',
    'sección': 'section',
    'secciones': 'sections',
    'zona': 'zone',
    'zonas': 'zones',
    'área': 'area',
    'áreas': 'areas',
    'región': 'region',
    'regiones': 'regions',
    'lado': 'side',
    'lados': 'sides',
    'extremo': 'end',
    'extremos': 'ends',
    'centro': 'center',
    'centros': 'centers',
    'base': 'base',
    'bases': 'bases',
    'punta': 'tip',
    'puntas': 'tips',
    'raíz': 'root',
    'raíces': 'roots',
    
    // Preposiciones y conectores comunes
    'para': 'to',
    'hacia': 'towards',
    'hasta': 'until',
    'desde': 'from',
    'en': 'in',
    'sobre': 'on',
    'bajo': 'under',
    'durante': 'during',
    'después': 'after',
    'antes': 'before',
    'de': 'of',
    'del': 'of the',
    'al': 'to the',
    'la': 'the',
    'el': 'the',
    'los': 'the',
    'las': 'the',
    'un': 'a',
    'una': 'a',
    'unos': 'some',
    'unas': 'some',
    'por': 'by',
    'con': 'with',
    'sin': 'without',
    'entre': 'between',
    'dentro': 'inside',
    'fuera': 'outside',
    'cerca': 'near',
    'lejos': 'far',
    'arriba': 'above',
    'abajo': 'below',
    'y': 'and',
    'o': 'or',
    'pero': 'but',
    'aunque': 'although',
    'porque': 'because',
    'cuando': 'when',
    'donde': 'where',
    'como': 'as',
    'más': 'more',
    'menos': 'less',
    'muy': 'very',
    'bastante': 'quite',
    'algo': 'somewhat',
    'mucho': 'much',
    'poco': 'little',
    'tanto': 'so much',
    'tan': 'so',
    'que': 'that',
    'cual': 'which',
    'cuales': 'which',
    'qué': 'what',
    'quién': 'who',
    'cómo': 'how',
    'cuándo': 'when',
    'dónde': 'where',
    'por qué': 'why',
    'se': 'is',
    'está': 'is',
    'están': 'are',
    'son': 'are',
    'fue': 'was',
    'fueron': 'were',
    'será': 'will be',
    'serán': 'will be',
    'ha': 'has',
    'han': 'have',
    'había': 'had',
    'habían': 'had',
    'tendrá': 'will have',
    'tendrán': 'will have'
  }
};

/**
 * Traducción local básica usando diccionario técnico
 */
const translateWithDictionary = (text, sourceLang = 'es', targetLang = 'en') => {
  const dictKey = `${sourceLang}-${targetLang}`;
  const dictionary = TECHNICAL_DICTIONARY[dictKey];

  if (!dictionary) {
    console.warn(`[Local Translation] No dictionary found for ${dictKey}`);
    return text;
  }

  let translated = text.toLowerCase();

  // Reemplazar términos del diccionario
  Object.entries(dictionary).forEach(([source, target]) => {
    const regex = new RegExp(`\\b${source}\\b`, 'gi');
    translated = translated.replace(regex, target);
  });

  // Capitalizar primera letra
  return translated.charAt(0).toUpperCase() + translated.slice(1);
};

/**
 * Servicio principal de traducción (es -> targetLang).
 * El glosario de inspección (pala -> blade, borde de salida -> trailing edge, ...) se aplica en el
 * Space de Hugging Face (huggingface-space/glossary.json), no aquí.
 * @param {string} text - Texto a traducir
 * @param {string} targetLang - Idioma destino ('en', 'EN-US', ...)
 * @returns {Promise<string>} - Texto traducido o el original si falla
 */
const translateTextHybrid = async (text, targetLang) => {
  if (!text?.trim()) return text;

  const target = String(targetLang || 'en').toLowerCase().split('-')[0];

  try {
    return await translateWithLibre(text, targetLang, 'es');
  } catch (error) {
    console.warn('[Hybrid Translation] LibreTranslate failed:', error.message);
  }

  // Respaldo local solo para es -> en
  if (target === 'en') {
    const localResult = translateWithDictionary(text, 'es', 'en');
    if (localResult.toLowerCase() !== text.toLowerCase()) return localResult;
  }

  return text;
};

export default translateTextHybrid;
export { translateWithDictionary, TECHNICAL_DICTIONARY };