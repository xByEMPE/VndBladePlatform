import { tx } from '@/i18n/tx';

export const DEFAULT_ROLE_LABEL = 'ADMINISTRADOR';

// Roles de userManagement.js (USER_ROLES) → etiqueta visible.
const ROLE_LABELS = Object.freeze({
  dev: "DESARROLLADOR",
  admin: 'ADMINISTRADOR',
  technician: 'TÉCNICO',
  client: 'CLIENTE',
});

// Colores de la píldora de cada rol (texto, fondo tenue y borde del mismo color): tres roles con
// diferenciación cromática clara, solo con tokens. Strings estáticos completos para Tailwind (JIT).
const ROLE_CHIPS = Object.freeze({
  dev: 'text-role-dev bg-role-dev/10 border-role-dev/30',
  admin: 'text-brand bg-brand/10 border-brand/30',
  technician: 'text-info bg-info/10 border-info/30',
  client: 'text-status-done bg-status-done/10 border-status-done/30',
});
const DEFAULT_ROLE_CHIP = 'text-ink-muted bg-surface-card border-line-subtle';

// Borde y anillo de foco del color de cada rol (para controles editables, p. ej. el selector de rol).
const ROLE_FOCUS = Object.freeze({
  dev: 'focus:border-role-dev/60 focus:ring-role-dev/30',
  admin: 'focus:border-brand/60 focus:ring-brand/30',
  technician: 'focus:border-info/60 focus:ring-info/30',
  client: 'focus:border-status-done/60 focus:ring-status-done/30',
});

/** Clases de foco del color de un rol; un rol desconocido usa el foco dorado estándar. */
export const getRoleFocus = (role) =>
  ROLE_FOCUS[String(role ?? '').toLowerCase()] ?? 'focus:border-brand/60 focus:ring-brand/30';

/** Clases de color de la píldora de un rol; un rol desconocido usa el estilo neutro. */
export const getRoleChip = (role) => ROLE_CHIPS[String(role ?? '').toLowerCase()] ?? DEFAULT_ROLE_CHIP;

/**
 * Etiqueta del rol en mayúsculas. Equivale a
 * `(role || 'ADMINISTRADOR').toUpperCase()`, pero traduce los roles conocidos
 * (p. ej. 'admin' → 'ADMINISTRADOR' en vez de 'ADMIN').
 * Es solo presentación: no concede ni revoca permisos.
 */
export const getRoleLabel = (role) => {
  const value = String(role || DEFAULT_ROLE_LABEL);
  const known = ROLE_LABELS[value.toLowerCase()];
  return known ? tx(known) : value.toUpperCase(); // se traduce al idioma activo
};

const ROLE_NAMES = Object.freeze({
  dev: 'Desarrollador',
  admin: 'Administrador',
  technician: 'Técnico',
  client: 'Cliente',
});

/** Nombre del rol con mayúscula inicial en el idioma activo (p. ej. 'dev' → 'Desarrollador' / 'Developer'). */
export const getRoleName = (role) => {
  const known = ROLE_NAMES[String(role ?? '').toLowerCase()];
  return known ? tx(known) : String(role ?? ''); // se traduce al idioma activo
};
