import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs) {
	return twMerge(clsx(inputs));
}

// Roles soportados en la plataforma
export const USER_ROLES = Object.freeze({
  DEV: 'dev',
  ADMIN: 'admin',
  TECHNICIAN: 'technician',
  CLIENT: 'client',
});

// Rutas operativas compartidas entre DEV y ADMIN
const ADMIN_OPERATIONAL_ROUTES = [
  '/',
  '/profile',
  '/projects',
  '/progress',
  '/avances',
  '/centro-admin',
  '/capture',
  '/reports-portal',
  '/report-viewer',
  '/report-editor',
  '/damage-editor',
  '/damage-editor-test',
  '/image-viewer',
  '/wtg-generator',
];

// Configuración (AdminPage): DEV la gestiona; ADMIN la ve en solo lectura (la base solo deja cambiar a un dev)
const SETTINGS_ROUTES = [
  '/settings',
  '/admin', // alias legacy de Configuración
];

// Mapa de accesos por rol a rutas principales
export const ROLE_ACCESS = Object.freeze({
  [USER_ROLES.DEV]: [
    ...ADMIN_OPERATIONAL_ROUTES,
    ...SETTINGS_ROUTES,
    '/dev/auditoria',  // Auditoría y Registros - Solo DEV
  ],
  [USER_ROLES.ADMIN]: [
    ...ADMIN_OPERATIONAL_ROUTES,
    ...SETTINGS_ROUTES,
  ],
  [USER_ROLES.TECHNICIAN]: [
    '/',
    '/profile',
    '/progress',
    '/capture',
    '/reports-portal',
    '/report-viewer',
    '/report-editor',
    '/damage-editor',
    '/damage-editor-test',
    '/image-viewer',
  ],
  [USER_ROLES.CLIENT]: [
    '/',
    '/profile',
    '/progress',        // Avance General
    '/reports-portal',  // Portal de Reportes
    '/report-viewer',   // Visualización de reportes
    '/damage-editor',   // Clientes pueden ver daños
    '/image-viewer',    // Clientes pueden ver imágenes
  ],
});

/**
 * Determina si un rol dado puede acceder a una ruta
 * @param {string} role - Rol del usuario (dev|admin|technician|client)
 * @param {string} path - Ruta a comprobar
 * @returns {boolean}
 */
export function canAccessPath(role, path) {
  if (!role || !path) return false;
  
  const normalized = path.endsWith('/') && path.length > 1 ? path.slice(0, -1) : path;
  const allowed = ROLE_ACCESS[role] || [];
  
  // Verificar acceso: exacto o que comience con ruta permitida + '/'
  return allowed.some((allowedPath) => {
    // Ruta exacta
    if (normalized === allowedPath) return true;
    
    // Ruta con parámetros: /report-viewer/123/turbine -> permitida si /report-viewer está en allowed
    if (normalized.startsWith(allowedPath + '/')) return true;
    
    return false;
  });
}

/**
 * Obtiene la ruta inicial (home) apropiada para un rol
 * @param {string} role
 * @returns {string}
 */
export function getHomePathForRole(role) {
  switch (role) {
    case USER_ROLES.DEV:
    case USER_ROLES.ADMIN:
    case USER_ROLES.TECHNICIAN:
    case USER_ROLES.CLIENT:
      return '/';
    default:
      return '/';
  }
}

/**
 * Devuelve la lista de tarjetas del dashboard permitidas para un rol
 * @param {string} role
 * @returns {Array<string>} Array de keys de tarjetas permitidas
 */
export function getAllowedDashboardCards(role) {
  switch (role) {
    case USER_ROLES.DEV:
    case USER_ROLES.ADMIN:
      return ['projects', 'progress', 'capture', 'reports-portal', 'wtg-generator'];
    case USER_ROLES.TECHNICIAN:
      return ['progress', 'capture', 'reports-portal'];
    case USER_ROLES.CLIENT:
      return ['progress', 'reports-portal'];
    default:
      return ['progress', 'reports-portal'];
  }
}