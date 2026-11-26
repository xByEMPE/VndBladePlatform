// src/components/PageGuard.jsx
import { useTranslation } from "react-i18next";
import { tx } from "@/i18n/tx";
import React from 'react'
import { useRolePermissions } from '@/hooks/useRolePermissions'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Shield, AlertTriangle } from 'lucide-react'
import LoadingSpinner from './LoadingSpinner'

const PageGuard = ({ 
  children, 
  requiredRole, 
  allowedRoles = [], 
  fallback = null,
  showAccessDenied = true 
}) => {
  useTranslation();
  const { role, loading, hasPermission } = useRolePermissions()

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-gray-900 to-black text-white flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner size="lg" text={tx("Verificando permisos...")} />
        </div>
      </div>
    )
  }

  // Verificar si el rol tiene acceso ('dev' tiene acceso total a todas las vistas)
  let hasAccess = false

  if (role === 'dev') {
    hasAccess = true
  } else if (requiredRole) {
    hasAccess = hasPermission(requiredRole)
  } else if (allowedRoles.length > 0) {
    hasAccess = allowedRoles.includes(role)
  } else {
    hasAccess = true // Sin restricciones
  }

  if (!hasAccess) {
    if (fallback) {
      return fallback
    }

    if (!showAccessDenied) {
      return null
    }

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-gray-900 to-black text-white flex items-center justify-center p-4">
        <Card className="max-w-md w-full bg-slate-800/70 backdrop-blur-md border-slate-700/50">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mb-4">
              <Shield className="w-8 h-8 text-red-500" />
            </div>
            <CardTitle className="text-2xl text-red-500 mb-2">
              {tx("Acceso Denegado")}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <div className="flex items-center justify-center gap-2 mb-4">
              <AlertTriangle className="w-5 h-5 text-yellow-500" />
              <span className="text-gray-300">
                {tx("No tienes permisos para acceder a esta sección")}
              </span>
            </div>
            <div className="text-sm text-gray-400 space-y-1">
              <p>{tx("Tu rol actual:")}{" "}<span className="font-medium text-white">{role || tx("No definido")}</span></p>
              {requiredRole && (
                <p>{tx("Rol requerido:")}{" "}<span className="font-medium text-white">{requiredRole}</span></p>
              )}
              {allowedRoles.length > 0 && (
                <p>{tx("Roles permitidos:")}{" "}<span className="font-medium text-white">{allowedRoles.join(', ')}</span></p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return children
}

export default PageGuard