// src/hooks/useRolePermissions.js
import { useState, useEffect, useCallback } from 'react'
import { getCurrentUserRole, onRoleChange } from '@/utils/userManagement'
import { canAccessPath, USER_ROLES } from '@/lib/utils'

const DEV_ROLE = USER_ROLES.DEV || 'dev'

export const useRolePermissions = () => {
  const [role, setRole] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchRole = useCallback(async () => {
    setLoading(true)
    try {
      const userRole = await getCurrentUserRole()
      setRole(userRole)
    } catch (error) {
      console.error('Error fetching user role:', error)
      setRole(USER_ROLES.CLIENT) // Default role
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchRole()
  }, [fetchRole])

  // Suscribirse a cambios de rol globales
  useEffect(() => {
    const unsubscribe = onRoleChange((newRole) => {
      setRole(newRole)
      setLoading(false)
    })

    return unsubscribe
  }, [])

  // Función para refrescar el rol manualmente
  const refreshRole = useCallback(async () => {
    await fetchRole()
  }, [fetchRole])

  const hasPermission = (requiredRole) => {
    if (!role) return false

    const roleHierarchy = {
      [USER_ROLES.CLIENT]: 1,
      [USER_ROLES.TECHNICIAN]: 2,
      [USER_ROLES.ADMIN]: 3,
      [DEV_ROLE]: 4,
    }

    return (roleHierarchy[role] ?? 0) >= (roleHierarchy[requiredRole] ?? 0)
  }

  const canAccess = (path) => {
    return canAccessPath(role, path)
  }

  const isDev = () => role === DEV_ROLE
  // 'dev' hereda todos los permisos operativos de 'admin'
  const isAdmin = () => role === USER_ROLES.ADMIN || role === DEV_ROLE
  const isTechnician = () => role === USER_ROLES.TECHNICIAN
  const isClient = () => role === USER_ROLES.CLIENT

  return {
    role,
    loading,
    hasPermission,
    canAccess,
    isDev,
    isAdmin,
    isTechnician,
    isClient,
    refreshRole, // Función para refrescar el rol manualmente
  }
}