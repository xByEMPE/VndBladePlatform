// Estado de proyecto (texto en español guardado en BD) → clave del Design System.
const BY_TEXT = Object.freeze({
  Completado: 'done',
  'En progreso': 'progress',
  Cancelado: 'cancelled',
});

/** Cualquier otro valor (p. ej. "Planeación" o vacío) se muestra como 'pending'. */
export const toStatusKey = (status) => BY_TEXT[status] ?? 'pending';

/**
 * Clave para las PÍLDORAS de estado (StatusPill): Completado → verde, En progreso → celeste y
 * cualquier otro (Planeación, Pausado…) → 'planning' (dorado, "amarillo"), como se mostraba antes.
 */
export const toChipStatusKey = (status) => (status === 'Completado' ? 'done' : status === 'En progreso' ? 'progress' : 'planning');
