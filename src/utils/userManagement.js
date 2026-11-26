// src/utils/userManagement.js
import { supabase } from '../lib/supabase'

// Constantes para roles
export const USER_ROLES = {
  DEV: 'dev',
  ADMIN: 'admin',
  TECHNICIAN: 'technician',
  CLIENT: 'client'
}

// Función para obtener todos los usuarios con sus roles y módulos
export const getAllUsers = async () => {
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select(`
        id,
        email,
        role,
        full_name,
        company,
        phone,
        is_active,
        allowed_modules,
        invitation_accepted,
        created_at,
        updated_at
      `)
      .order('created_at', { ascending: false })

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    console.error('Error fetching users:', error)
    return { data: null, error }
  }
}

// Función para actualizar el rol de un usuario
export const updateUserRole = async (userId, newRole) => {
  try {
    // Validar que el rol sea válido
    if (!Object.values(USER_ROLES).includes(newRole)) {
      throw new Error(`Invalid role: ${newRole}. Must be one of: ${Object.values(USER_ROLES).join(', ')}`)
    }

    // Llamada alineada con la firma RPC de Supabase (target_user_id, new_role)
    const { error } = await supabase.rpc('update_user_role', {
      target_user_id: userId,
      new_role: newRole
    })

    if (error) throw error
    return { success: true, error: null }
  } catch (error) {
    console.error('Error updating user role:', error)
    return { success: false, error }
  }
}

// Función para obtener información de un usuario específico
export const getUserInfo = async (userEmail) => {
  try {
    const { data, error } = await supabase.rpc('get_user_with_role', {
      user_email: userEmail
    })

    if (error) throw error
    return { data: data?.[0] || null, error: null }
  } catch (error) {
    console.error('Error fetching user info:', error)
    return { data: null, error }
  }
}

// Función para actualizar información del perfil de usuario
export const updateUserProfile = async (userId, profileData) => {
  try {
    const payload = {
      full_name: profileData.full_name,
      updated_at: new Date().toISOString()
    }

    if (profileData.email !== undefined) payload.email = profileData.email
    if (profileData.company !== undefined) payload.company = profileData.company
    if (profileData.phone !== undefined) payload.phone = profileData.phone

    const { data, error } = await supabase
      .from('user_profiles')
      .update(payload)
      .eq('id', userId)
      .select()

    if (error) throw error
    return { data: data?.[0], error: null }
  } catch (error) {
    console.error('Error updating user profile:', error)
    return { data: null, error }
  }
}

// Función para marcar invitación como aceptada
export const markInvitationAccepted = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .update({
        invitation_accepted: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)
      .select()

    if (error) throw error
    return { data: data?.[0], error: null }
  } catch (error) {
    console.error('Error marking invitation as accepted:', error)
    return { data: null, error }
  }
}

// Función para obtener usuarios por rol
export const getUsersByRole = async (role) => {
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select(`
        id,
        email,
        role,
        full_name,
        company,
        phone,
        is_active,
        allowed_modules,
        invitation_accepted,
        created_at
      `)
      .eq('role', role)
      .order('created_at', { ascending: false })

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    console.error('Error fetching users by role:', error)
    return { data: null, error }
  }
}

// Función para verificar si un usuario tiene un rol específico o superior
export const hasRole = (userRole, requiredRole) => {
  const roleHierarchy = {
    [USER_ROLES.CLIENT]: 1,
    [USER_ROLES.TECHNICIAN]: 2,
    [USER_ROLES.ADMIN]: 3,
    [USER_ROLES.DEV]: 4
  }
  
  return (roleHierarchy[userRole] ?? 0) >= (roleHierarchy[requiredRole] ?? 0)
}

// Función para obtener el rol del usuario actual
export const getCurrentUserRole = async () => {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    // OPCIÓN 1: Intentar función RPC
    try {
      const { data: rpcRole, error: rpcError } = await supabase.rpc('get_current_user_role')
      
      if (!rpcError && rpcRole) {
        return rpcRole
      }
    } catch (rpcErr) {
      // Usar consulta directa si RPC falla
    }

    // OPCIÓN 2: Consulta directa
    const { data, error } = await supabase
      .from('user_profiles')
      .select('role, email') 
      .eq('id', user.id)
      .maybeSingle()

    if (error) {
      console.warn('Error fetching user role directly:', error)
      return USER_ROLES.CLIENT
    }

    if (!data) {
      console.warn('User profile not found, defaulting to CLIENT role')
      return USER_ROLES.CLIENT
    }

    const userRole = data?.role || USER_ROLES.CLIENT
    return userRole
  } catch (error) {
    console.error('Error fetching current user role:', error)
    return USER_ROLES.CLIENT
  }
}

// Variable global para manejar callbacks de refresh de rol
let roleChangeCallbacks = []

// Función para registrar callbacks que se ejecutan cuando el rol cambia
export const onRoleChange = (callback) => {
  roleChangeCallbacks.push(callback)
  
  return () => {
    roleChangeCallbacks = roleChangeCallbacks.filter(cb => cb !== callback)
  }
}

// Función para notificar cambios de rol a todos los componentes suscritos
export const notifyRoleChange = async () => {
  const newRole = await getCurrentUserRole()
  roleChangeCallbacks.forEach(callback => {
    try {
      callback(newRole)
    } catch (error) {
      console.error('Error in role change callback:', error)
    }
  })
  return newRole
}

// Función para forzar actualización de rol en toda la aplicación
export const refreshUserRole = async () => {
  return await notifyRoleChange()
}

// Hacer la función disponible globalmente para debug desde consola
if (typeof window !== 'undefined') {
  window.refreshUserRole = refreshUserRole
  window.getCurrentUserRole = getCurrentUserRole
}