// Comparaciones de rol compartidas por las páginas. Son funciones puras sobre el texto del rol
// que devuelve useRolePermissions ("admin", "technician" o "client").

// Puede editar quien es administrador o técnico.
export const canEditByRole = (role) => role === "admin" || role === "dev" || role === "technician";

// Es cliente (solo lectura).
export const isClientRole = (role) => role === "client";
