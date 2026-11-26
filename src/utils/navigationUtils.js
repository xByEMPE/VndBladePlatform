/**
 * Utilidades para manejo de datos de navegación por altura
 */

import { supabase } from '../lib/supabase';

/**
 * Obtiene datos de navegación para una imagen específica
 */
export const getImageNavigationData = async (inspectionFileId) => {
  try {
    const { data, error } = await supabase
      .from('image_navigation')
      .select('*')
      .eq('inspection_file_id', inspectionFileId)
      .single();

    if (error) {
      console.warn('[Navigation] Error obteniendo datos de navegación:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('[Navigation] Error en getImageNavigationData:', error);
    return null;
  }
};

/**
 * Obtiene imágenes con altura equivalente para navegación entre secciones
 */
export const getImagesByHeight = async (projectId, turbineId, targetHeight, tolerance = 0.1) => {
  try {
    const { data, error } = await supabase
      .from('image_navigation')
      .select(`
        *,
        inspection_files!inner (
          id,
          file_path,
          file_name,
          section,
          blade_id,
          blades!inner (
            blade_name,
            turbine_id
          )
        )
      `)
      .eq('inspection_files.blades.turbine_id', turbineId)
      .gte('h_norm', targetHeight - tolerance)
      .lte('h_norm', targetHeight + tolerance)
      .order('h_norm', { ascending: true });

    if (error) {
      console.warn('[Navigation] Error obteniendo imágenes por altura:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('[Navigation] Error en getImagesByHeight:', error);
    return [];
  }
};

/**
 * Obtiene estadísticas de altura por sección
 */
export const getSectionHeightStats = async (projectId, turbineId, bladeId, section) => {
  try {
    const { data, error } = await supabase
      .from('image_navigation')
      .select(`
        h_norm,
        h_rel,
        section_stats,
        inspection_files!inner (
          section,
          blade_id
        )
      `)
      .eq('inspection_files.blade_id', bladeId)
      .eq('inspection_files.section', section)
      .not('h_norm', 'is', null)
      .order('h_norm', { ascending: true });

    if (error) {
      console.warn('[Navigation] Error obteniendo estadísticas de sección:', error);
      return null;
    }

    if (!data || data.length === 0) {
      return null;
    }

    const heights = data.map(d => d.h_norm).filter(h => h !== null);
    const sectionStats = data[0]?.section_stats;

    return {
      min: Math.min(...heights),
      max: Math.max(...heights),
      avg: heights.reduce((a, b) => a + b, 0) / heights.length,
      count: heights.length,
      sectionStats: sectionStats
    };
  } catch (error) {
    console.error('[Navigation] Error en getSectionHeightStats:', error);
    return null;
  }
};

/**
 * Encuentra la imagen más cercana en altura para navegación
 */
export const findClosestImageByHeight = async (projectId, turbineId, currentHeight, targetSection) => {
  try {
    const { data, error } = await supabase
      .from('image_navigation')
      .select(`
        *,
        inspection_files!inner (
          id,
          file_path,
          file_name,
          section,
          blade_id,
          blades!inner (
            blade_name,
            turbine_id
          )
        )
      `)
      .eq('inspection_files.blades.turbine_id', turbineId)
      .eq('inspection_files.section', targetSection)
      .not('h_norm', 'is', null)
      .order('h_norm', { ascending: true });

    if (error || !data || data.length === 0) {
      return null;
    }

    // Encontrar la imagen más cercana en altura
    let closest = data[0];
    let minDiff = Math.abs(data[0].h_norm - currentHeight);

    for (const img of data) {
      const diff = Math.abs(img.h_norm - currentHeight);
      if (diff < minDiff) {
        minDiff = diff;
        closest = img;
      }
    }

    return closest;
  } catch (error) {
    console.error('[Navigation] Error en findClosestImageByHeight:', error);
    return null;
  }
};

/**
 * Obtiene el rango de alturas disponible para una turbina
 */
export const getTurbineHeightRange = async (projectId, turbineId) => {
  try {
    const { data, error } = await supabase
      .from('image_navigation')
      .select(`
        h_norm,
        inspection_files!inner (
          blade_id,
          blades!inner (
            turbine_id
          )
        )
      `)
      .eq('inspection_files.blades.turbine_id', turbineId)
      .not('h_norm', 'is', null);

    if (error || !data || data.length === 0) {
      return null;
    }

    const heights = data.map(d => d.h_norm).filter(h => h !== null);
    
    return {
      min: Math.min(...heights),
      max: Math.max(...heights),
      count: heights.length
    };
  } catch (error) {
    console.error('[Navigation] Error en getTurbineHeightRange:', error);
    return null;
  }
};

