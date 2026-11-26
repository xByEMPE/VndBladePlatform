// Utilidad para eliminar proyectos con cascada completa
// Función auxiliar que puede ser reutilizada en otros módulos

import { supabase } from '../lib/supabase.js';

/**
 * Elimina un proyecto completamente con todos sus datos relacionados
 * @param {Object} project - El proyecto a eliminar
 * @param {Function} onProgress - Callback para reportar progreso (opcional)
 * @param {Function} t - Función de traducción (opcional)
 * @returns {Promise<Object>} Resultado de la eliminación
 */
export const deleteProjectCascade = async (project, onProgress = () => {}, t = (key) => key) => {
  const projectId = project.id;
  const projectName = project.name;
  
  console.log(`[Eliminación] Iniciando eliminación completa del proyecto: ${projectName} (ID: ${projectId})`);
  
  const result = {
    success: false,
    projectId,
    projectName,
    deletedCounts: {},
    errors: [],
    storageResult: { deleted: 0, failed: 0 }
  };

  try {
    onProgress(t('deleteProject.gettingProjectData'));

    // Paso 1: Obtener todas las turbinas del proyecto
    console.log('[Eliminación] Paso 1: Obteniendo turbinas...');
    const { data: turbines, error: turbinesQueryError } = await supabase
      .from('turbines')
      .select('id, turbine_name')
      .eq('project_id', projectId);

    if (turbinesQueryError) throw turbinesQueryError;
    const turbineIds = (turbines || []).map(t => t.id);
    console.log(`[Eliminación] Encontradas ${turbines?.length || 0} turbinas`);

    let bladeIds = [];
    if (turbineIds.length > 0) {
      // Paso 2: Obtener todas las blades de las turbinas
      onProgress(t('deleteProject.gettingBlades'));
      console.log('[Eliminación] Paso 2: Obteniendo blades...');
      const { data: blades, error: bladesQueryError } = await supabase
        .from('blades')
        .select('id')
        .in('turbine_id', turbineIds);

      if (bladesQueryError) throw bladesQueryError;
      bladeIds = (blades || []).map(b => b.id);
      console.log(`[Eliminación] Encontradas ${blades?.length || 0} blades`);
    }

    // Paso 3: Obtener todos los archivos de inspección (captures V2) para eliminar del storage
    onProgress(t('deleteProject.gettingInspectionFiles'));
    console.log('[Eliminación] Paso 3: Obteniendo capturas para eliminar del storage...');
    
    let filePaths = [];
    if (bladeIds.length > 0) {
      const { data: captures, error: capError } = await supabase
        .from('captures')
        .select('storage_path')
        .in('blade_id', bladeIds);

      if (capError) throw capError;
      filePaths = (captures || []).map(c => c.storage_path).filter(Boolean);
    }
    console.log(`[Eliminación] Encontrados ${filePaths.length} archivos para eliminar del storage`);

    // Paso 4: Eliminar hallazgos (V2 findings)
    if (bladeIds.length > 0) {
      onProgress(t('deleteProject.deletingDamages'));
      console.log('[Eliminación] Paso 4: Eliminando hallazgos (findings)...');
      
      // V2 join: findings join with captures join with blades
      // We'll do it in two steps or using a subquery if supported, but best is to delete by capture_id
      const { data: capturesToDelete } = await supabase
        .from('captures')
        .select('id')
        .in('blade_id', bladeIds);
      
      const captureIds = (capturesToDelete || []).map(c => c.id);
      
      if (captureIds.length > 0) {
        // --- CHUNKED DELETE FINDINGS ---
        let totalFindingsDeleted = 0;
        const chunkSize = 100;
        for (let i = 0; i < captureIds.length; i += chunkSize) {
          const chunk = captureIds.slice(i, i + chunkSize);
          const { count: findingsCount, error: deleteFindingsError } = await supabase
            .from('findings')
            .delete({ count: 'exact' })
            .in('capture_id', chunk);

          if (deleteFindingsError) throw deleteFindingsError;
          totalFindingsDeleted += findingsCount || 0;
        }
        
        result.deletedCounts.damages = totalFindingsDeleted;
        console.log(`[Eliminación] Eliminados ${totalFindingsDeleted} hallazgos (findings)`);
      }
    }

    // Paso 5: Eliminar capturas (V2 captures) de la BD
    onProgress(t('deleteProject.deletingInspectionFiles'));
    console.log('[Eliminación] Paso 5: Eliminando registros de capturas...');
    if (bladeIds.length > 0) {
      // --- CHUNKED DELETE CAPTURES ---
      let totalCapsDeleted = 0;
      const chunkSize = 100;
      for (let i = 0; i < bladeIds.length; i += chunkSize) {
        const chunk = bladeIds.slice(i, i + chunkSize);
        const { count: capsCount, error: deleteCapsError } = await supabase
          .from('captures')
          .delete({ count: 'exact' })
          .in('blade_id', chunk);

        if (deleteCapsError) throw deleteCapsError;
        totalCapsDeleted += capsCount || 0;
      }
      
      result.deletedCounts.inspectionFiles = totalCapsDeleted;
      console.log(`[Eliminación] Eliminados ${totalCapsDeleted} registros de capturas`);
    }


    // Paso 6: Eliminar blades (si hay turbinas)
    if (turbineIds.length > 0 && bladeIds.length > 0) {
      onProgress(t('deleteProject.deletingBlades'));
      console.log('[Eliminación] Paso 6: Eliminando blades...');
      const { count: bladesCount, error: deleteBladesError } = await supabase
        .from('blades')
        .delete({ count: 'exact' })
        .in('turbine_id', turbineIds);

      if (deleteBladesError) throw deleteBladesError;
      result.deletedCounts.blades = bladesCount || 0;
      console.log(`[Eliminación] Eliminadas ${bladesCount || 0} blades`);
    }



    // Paso 8: Eliminar turbinas
    if (turbineIds.length > 0) {
      onProgress(t('deleteProject.deletingTurbines'));
      console.log('[Eliminación] Paso 8: Eliminando turbinas...');
      const { count: turbinesCount, error: deleteTurbinesError } = await supabase
        .from('turbines')
        .delete({ count: 'exact' })
        .eq('project_id', projectId);

      if (deleteTurbinesError) throw deleteTurbinesError;
      result.deletedCounts.turbines = turbinesCount || 0;
      console.log(`[Eliminación] Eliminadas ${turbinesCount || 0} turbinas`);
    }

    // Paso 9: Eliminar proyecto principal
    onProgress(t('deleteProject.deletingProject'));
    console.log('[Eliminación] Paso 9: Eliminando proyecto principal...');
    const { error: deleteProjectError } = await supabase
      .from('projects')
      .delete()
      .eq('id', projectId);

    if (deleteProjectError) throw deleteProjectError;
    result.deletedCounts.projects = 1;
    console.log(`[Eliminación] Proyecto eliminado de la base de datos`);

    // Paso 10: Eliminar archivos del storage
    if (filePaths.length > 0) {
      onProgress(t('deleteProject.deletingStorageFiles', { count: filePaths.length }));
      console.log(`[Eliminación] Paso 10: Eliminando ${filePaths.length} archivos del storage...`);
      
      let deletedFilesCount = 0;
      let failedFilesCount = 0;

      // Eliminar archivos en lotes para evitar saturar la API
      const batchSize = 10;
      for (let i = 0; i < filePaths.length; i += batchSize) {
        const batch = filePaths.slice(i, i + batchSize);
        const batchNumber = Math.floor(i / batchSize) + 1;
        const totalBatches = Math.ceil(filePaths.length / batchSize);
        
        onProgress(t('deleteProject.deletingStorageFilesBatch', { batchNumber, totalBatches }));
        
        try {
          const { error: storageDeleteError } = await supabase.storage
            .from('images')
            .remove(batch);

          if (storageDeleteError) {
            console.warn(`[Eliminación] Error eliminando lote ${batchNumber}:`, storageDeleteError);
            failedFilesCount += batch.length;
            result.errors.push(`Error en lote ${batchNumber}: ${storageDeleteError.message}`);
          } else {
            deletedFilesCount += batch.length;
          }
        } catch (error) {
          console.warn(`[Eliminación] Error en lote ${batchNumber}:`, error);
          failedFilesCount += batch.length;
          result.errors.push(`Error en lote ${batchNumber}: ${error.message}`);
        }
      }

      result.storageResult = { deleted: deletedFilesCount, failed: failedFilesCount };
      console.log(`[Eliminación] Storage: ${deletedFilesCount} archivos eliminados, ${failedFilesCount} fallaron`);
    } else {
      console.log('[Eliminación] No hay archivos en el storage para eliminar');
    }

    // Emitir evento de sincronización
    window.dispatchEvent(new CustomEvent('vind:project-updated', { 
      detail: { 
        action: 'project_deleted',
        projectId,
        projectName,
        result
      }
    }));

    result.success = true;
    onProgress(t('deleteProject.deletionCompletedSuccessfully'));

    return result;

  } catch (error) {
    console.error('[Eliminación] Error durante la eliminación:', error);
    result.errors.push(error.message);
    onProgress(t('deleteProject.errorDuringDeletion'));
    throw error;
  }
};

/**
 * Obtiene un resumen de los datos que serán eliminados con el proyecto
 * @param {string} projectId - ID del proyecto
 * @returns {Promise<Object>} Resumen de datos
 */
export const getProjectDeletionSummary = async (projectId) => {
  try {
    // Contar turbinas
    const { count: turbineCount } = await supabase
      .from('turbines')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', projectId);

    // Contar capturas (V2)
    const { data: projectTurbines } = await supabase
      .from('turbines')
      .select('id')
      .eq('project_id', projectId);
    
    let totalCaptures = 0;
    let totalFindings = 0;
    let totalBlades = 0;

    if (projectTurbines?.length > 0) {
      const turbineIds = projectTurbines.map(t => t.id);
      
      const { data: projectBlades } = await supabase
        .from('blades')
        .select('id')
        .in('turbine_id', turbineIds);
      
      totalBlades = projectBlades?.length || 0;

      if (projectBlades?.length > 0) {
        const bladeIds = projectBlades.map(b => b.id);
        // Chunked count for captures to avoid URL too long
        let capsResult = 0;
        const bladeChunkSize = 100;
        for (let i = 0; i < bladeIds.length; i += bladeChunkSize) {
          const chunk = bladeIds.slice(i, i + bladeChunkSize);
          const { count } = await supabase
            .from('captures')
            .select('*', { count: 'exact', head: true })
            .in('blade_id', chunk);
          capsResult += count || 0;
        }
        totalCaptures = capsResult || 0;

        const { data: projectCaptures } = await supabase
          .from('captures')
          .select('id')
          .in('blade_id', bladeIds);
        
        if (projectCaptures?.length > 0) {
          const captureIds = projectCaptures.map(c => c.id);
          // Chunked count for findings to avoid URL too long
          const chunkSize = 150;
          for (let i = 0; i < captureIds.length; i += chunkSize) {
            const chunk = captureIds.slice(i, i + chunkSize);
            const { count: findingsResult } = await supabase
              .from('findings')
              .select('*', { count: 'exact', head: true })
              .in('capture_id', chunk);
            totalFindings += findingsResult || 0;
          }
        }
      }
    }



    return {
      turbines: turbineCount || 0,
      blades: totalBlades,
      inspectionFiles: totalCaptures,
      damages: totalFindings
    };

  } catch (error) {
    console.warn('Error obteniendo resumen del proyecto:', error);
    return null;
  }
};

