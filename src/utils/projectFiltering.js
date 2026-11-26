// src/utils/projectFiltering.js
import { supabase } from '../lib/supabase';

/**
 * Filtra proyectos basado en los permisos del usuario
 * @param {Array} projects - Lista de proyectos
 * @param {Object} user - Usuario actual
 * @param {string} role - Rol del usuario
 * @returns {Array} - Proyectos filtrados
 */
export const filterProjectsByPermissions = (projects, user, role) => {
    if (!projects || !user || !role) return [];
    
    // Admin puede ver todos los proyectos
    if (role === 'admin' || role === 'dev') {
        return projects;
    }
    
    const userEmail = user.email?.toLowerCase().trim();
    if (!userEmail) return [];
    
    const filteredProjects = projects.filter(project => {
        // Verificar si es el gerente del parque
        const parkManagerEmail = project.park_manager_email?.toLowerCase().trim();
        const isParkManager = parkManagerEmail === userEmail;
        
        // Verificar si es el líder técnico
        const technicalLeadEmail = project.technical_lead_email?.toLowerCase().trim();
        const isTechnicalLead = technicalLeadEmail === userEmail;
        
        // Verificar si está en el staff (equipo técnico)
        const isInStaff = project.staff?.some(member => {
            const memberEmail = member.email?.toLowerCase().trim();
            return memberEmail === userEmail;
        }) || false;
        
        // Verificar si es el revisor del proyecto
        const reviewEmail = project.review_personnel_email?.toLowerCase().trim();
        const isReviewPersonnel = reviewEmail === userEmail;
        
        // Usuario tiene acceso si aparece en cualquiera de los 4 campos
        return isParkManager || isTechnicalLead || isInStaff || isReviewPersonnel;
    });
    
    console.log(`[RBAC] Filtered ${projects.length} projects to ${filteredProjects.length} for user ${userEmail}`);
    
    return filteredProjects;
};

/**
 * Obtiene proyectos filtrados directamente desde Supabase
 * @param {Object} user - Usuario actual
 * @param {string} role - Rol del usuario
 * @returns {Promise<Array>} - Proyectos filtrados
 */
export const fetchFilteredProjects = async (user, role) => {
    try {
        if (!user || !role) {
            console.warn('Cannot fetch projects: missing user or role');
            return [];
        }
        
        // Obtener proyectos con acceso (staff)
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

        if (error) {
            console.error('Error fetching projects:', error);
            return [];
        }

        // Mapear estructura nueva a formato legacy 'staff' para compatibilidad
        const allProjects = rawProjects.map(p => ({
            ...p,
            staff: (p.staff_list && Array.isArray(p.staff_list)) ? p.staff_list : (p.project_access?.map(pa => ({
                id: pa.user_profiles?.id,
                full_name: pa.user_profiles?.full_name,
                email: pa.user_profiles?.email,
                role: pa.role // Rol en el proyecto
            })) || [])
        }));

        if (error) {
            console.error('Error fetching projects:', error);
            return [];
        }

        // Aplicar filtrado
        const filteredProjects = filterProjectsByPermissions(allProjects || [], user, role);
        
        
        return filteredProjects;
        
    } catch (error) {
        console.error('Error in fetchFilteredProjects:', error);
        return [];
    }
};

/**
 * Verifica si un usuario tiene acceso a un proyecto específico
 * @param {Object} project - Proyecto a verificar
 * @param {Object} user - Usuario actual
 * @param {string} role - Rol del usuario
 * @returns {boolean} - true si tiene acceso
 */
export const hasProjectAccess = (project, user, role) => {
    if (!project || !user || !role) return false;
    
    // Admin siempre tiene acceso
    if (role === 'admin' || role === 'dev') return true;
    
    const userEmail = user.email?.toLowerCase().trim();
    if (!userEmail) return false;
    
    // Verificar si es el gerente del parque
    const parkManagerEmail = project.park_manager_email?.toLowerCase().trim();
    const isParkManager = parkManagerEmail === userEmail;
    
    // Verificar si es el líder técnico
    const technicalLeadEmail = project.technical_lead_email?.toLowerCase().trim();
    const isTechnicalLead = technicalLeadEmail === userEmail;
    
    // Verificar si está en el staff
    const isInStaff = project.staff?.some(member => {
        const memberEmail = member.email?.toLowerCase().trim();
        return memberEmail === userEmail;
    }) || false;
    
    // Verificar si es el revisor del proyecto
    const reviewEmail = project.review_personnel_email?.toLowerCase().trim();
    const isReviewPersonnel = reviewEmail === userEmail;
    
    return isParkManager || isTechnicalLead || isInStaff || isReviewPersonnel;
};
