/**
 * Utilidades para gestión de permisos de proyectos
 * Determina qué proyectos puede ver cada usuario según su rol y asignaciones
 */

import { supabase } from '@/lib/supabase';
import { USER_ROLES } from '@/lib/utils';

// 'dev' hereda todos los permisos de 'admin'
const isAdminLike = (role) => role === USER_ROLES.ADMIN || role === 'dev';

/**
 * Verifica si un usuario tiene acceso a un proyecto específico
 * @param {Object} user - Usuario actual de Supabase
 * @param {string} role - Rol del usuario (admin|technician|client)
 * @param {Object} project - Objeto del proyecto con staff y review_personnel_email
 * @returns {boolean} - True si el usuario tiene acceso
 */
export const hasProjectAccess = (user, role, project) => {
  if (!user || !project) return false;
  
  // Admin puede acceder a todos los proyectos
  if (isAdminLike(role)) {
    return true;
  }
  
  const userEmail = user.email?.toLowerCase();
  
  // Verificar si es el gerente del parque
  const isParkManager = project.park_manager_email?.toLowerCase() === userEmail;
  
  // Verificar si es el líder técnico
  const isTechnicalLead = project.technical_lead_email?.toLowerCase() === userEmail;
  
  // Verificar si está en el staff del proyecto
  const isInStaff = project.staff?.some(member => 
    member.email?.toLowerCase() === userEmail
  );
  
  // Verificar si es el personal de revisión
  const isReviewPersonnel = project.review_personnel_email?.toLowerCase() === userEmail;
  
  return isParkManager || isTechnicalLead || isInStaff || isReviewPersonnel;
};

/**
 * Filtra una lista de proyectos según los permisos del usuario
 * @param {Array} projects - Array de proyectos
 * @param {Object} user - Usuario actual de Supabase
 * @param {string} role - Rol del usuario
 * @returns {Array} - Array de proyectos filtrado
 */
export const filterProjectsByPermissions = (projects, user, role) => {
  if (!Array.isArray(projects) || !user) return [];
  
  // Admin ve todos los proyectos
  if (isAdminLike(role)) {
    return projects;
  }
  
  return projects.filter(project => hasProjectAccess(user, role, project));
};

/**
 * Obtiene los proyectos del usuario actual con filtrado automático
 * @param {Object} user - Usuario actual de Supabase  
 * @param {string} role - Rol del usuario
 * @returns {Promise<Array>} - Array de proyectos filtrado
 */
export const fetchUserProjects = async (user, role) => {
  try {
    // Verificar que tenemos usuario y rol válidos
    if (!user || !role) {
      console.warn('fetchUserProjects called without valid user or role');
      return [];
    }

    const { data: rawProjects, error } = await supabase
      .from('projects')
      .select(`
        *,
        project_access (
            role,
            user_profiles (
                id,
                full_name,
                email,
                role
            )
        )
      `)
      .order('created_at', { ascending: false });

    // Mapear estructura nueva a formato legacy 'staff' para compatibilidad
    const projects = rawProjects?.map(p => ({
        ...p,
        staff: p.project_access?.map(pa => ({
            id: pa.user_profiles?.id,
            full_name: pa.user_profiles?.full_name,
            email: pa.user_profiles?.email,
            role: pa.role // Rol en el proyecto
        })) || []
    }));

    if (error) {
      console.error('Supabase query error:', error);
      throw error;
    }

    // Filtrar proyectos según permisos
    const filteredProjects = filterProjectsByPermissions(projects || [], user, role);
    console.log(`Filtered ${projects?.length || 0} projects to ${filteredProjects.length} for user ${user.email}`);
    
    return filteredProjects;
    
  } catch (error) {
    console.error('Error fetching user projects:', error);
    throw error;
  }
};

/**
 * Verifica si un usuario puede editar un proyecto específico
 * @param {Object} user - Usuario actual de Supabase
 * @param {string} role - Rol del usuario
 * @param {Object} project - Proyecto a verificar
 * @returns {boolean} - True si puede editar
 */
export const canEditProject = (user, role, project) => {
  return isAdminLike(role);
};

/**
 * Verifica si un usuario puede eliminar un proyecto específico
 * @param {Object} user - Usuario actual de Supabase
 * @param {string} role - Rol del usuario
 * @param {Object} project - Proyecto a verificar
 * @returns {boolean} - True si puede eliminar
 */
export const canDeleteProject = (user, role, project) => {
  return isAdminLike(role);
};

/**
 * Verifica si un usuario puede crear nuevos proyectos
 * @param {string} role - Rol del usuario
 * @returns {boolean} - True si puede crear
 */
export const canCreateProject = (role) => {
  return isAdminLike(role);
};

export default {
  hasProjectAccess,
  filterProjectsByPermissions,
  fetchUserProjects,
  canEditProject,
  canDeleteProject,
  canCreateProject
};
