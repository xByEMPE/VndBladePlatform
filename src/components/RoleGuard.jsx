import { tx } from "@/i18n/tx";
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { canAccessPath, USER_ROLES } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import LoadingSpinner from './LoadingSpinner';

const ROLE_HIERARCHY = Object.freeze({
  [USER_ROLES.CLIENT]: 1,
  [USER_ROLES.TECHNICIAN]: 2,
  [USER_ROLES.ADMIN]: 3,
  [USER_ROLES.DEV]: 4,
});

const RoleGuard = ({ role, requiredRole, children }) => {
  const location = useLocation();
  const path = location.pathname;
  const { t } = useTranslation('common');

  // Si aún no se conoce el rol, mostrar loading
  if (!role) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-gray-900 to-black text-white flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner size="lg" text={t('auth.verifyingPermissions')} />
        </div>
      </div>
    );
  }

  // Si se especifica un rol requerido, verificar que el usuario tenga ese rol o superior
  if (requiredRole) {
    const userRoleLevel = ROLE_HIERARCHY[role] || 0;
    const requiredRoleLevel = ROLE_HIERARCHY[requiredRole] || 99;

    if (userRoleLevel < requiredRoleLevel) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-gray-900 to-black text-white flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-4">{tx("Acceso Denegado")}</h2>
            <p className="text-gray-400 mb-4">
              {tx("No tienes permisos para acceder a esta sección")}
            </p>
            <p className="text-gray-500 text-sm">
              {tx("Se requiere rol:")} {requiredRole}
            </p>
          </div>
        </div>
      );
    }
  }

  // Para el dashboard (/), siempre permitir acceso
  if (path === '/') {
    return children;
  }

  const allowed = canAccessPath(role, path);
  if (!allowed) {
    return <Navigate to="/" replace />;
  }

  return children;
};

export default RoleGuard;