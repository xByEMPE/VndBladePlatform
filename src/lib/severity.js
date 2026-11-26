/**
 * Fuente única de la escala de severidad de daños (Cat 1 leve → Cat 5 crítica).
 * La usan el visor de pala (BladeModelViewer) y el mapa de aerogeneradores. El PDF conserva su
 * propia paleta (pages/reportViewer/pdf/severityColor.js) a propósito, para no alterar reportes emitidos.
 *
 * - Clases Tailwind: strings estáticos completos (para que el JIT las detecte) basados en los tokens
 *   --sev-1…--sev-5 de index.css.
 * - `hex`: espejo de esos tokens para consumidores que no usan Tailwind (canvas/SVG). Un test verifica
 *   que no se desincronice de index.css.
 * - `onColor`: color de texto legible sobre el fondo de la categoría (todas son claras → texto oscuro).
 */

export const SEVERITY_LEVELS = Object.freeze([1, 2, 3, 4, 5]);

export const SEVERITY = Object.freeze({
  1: { level: 1, hex: '#34D399', bg: 'bg-sev-1', text: 'text-sev-1', border: 'border-sev-1', tint: 'bg-sev-1/20', glow: 'shadow-[0_0_8px_hsl(var(--sev-1)/0.35)]', onColor: 'text-surface-base' },
  2: { level: 2, hex: '#8AD241', bg: 'bg-sev-2', text: 'text-sev-2', border: 'border-sev-2', tint: 'bg-sev-2/20', glow: 'shadow-[0_0_8px_hsl(var(--sev-2)/0.35)]', onColor: 'text-surface-base' },
  3: { level: 3, hex: '#DEAB47', bg: 'bg-sev-3', text: 'text-sev-3', border: 'border-sev-3', tint: 'bg-sev-3/20', glow: 'shadow-[0_0_8px_hsl(var(--sev-3)/0.35)]', onColor: 'text-surface-base' },
  4: { level: 4, hex: '#FB923C', bg: 'bg-sev-4', text: 'text-sev-4', border: 'border-sev-4', tint: 'bg-sev-4/20', glow: 'shadow-[0_0_8px_hsl(var(--sev-4)/0.35)]', onColor: 'text-surface-base' },
  5: { level: 5, hex: '#EF4444', bg: 'bg-sev-5', text: 'text-sev-5', border: 'border-sev-5', tint: 'bg-sev-5/20', glow: 'shadow-[0_0_8px_hsl(var(--sev-5)/0.35)]', onColor: 'text-surface-base' },
});

/**
 * Sin daños / sin inspeccionar / valor desconocido: neutro. A diferencia de las categorías, el fondo
 * es oscuro (tarjeta) con borde gris y texto claro, porque texto oscuro sobre gris medio no llega a 4.5:1.
 * `hex` = token ink-muted, para consumidores sin Tailwind.
 */
export const NEUTRAL_SEVERITY = Object.freeze({
  level: null,
  hex: '#8FA2BF',
  bg: 'bg-surface-card',
  text: 'text-ink-muted',
  border: 'border-ink-muted',
  tint: 'bg-ink-muted/15',
  glow: '',
  onColor: 'text-ink',
});

/** Acepta 3, "3", "Cat 3" o "cat3"; devuelve el nivel 1–5 o null si no es una categoría válida. */
export const parseSeverity = (value) => {
  if (value === null || value === undefined) return null;
  const match = String(value).trim().match(/^(?:cat\s*)?([1-5])$/i);
  return match ? Number(match[1]) : null;
};

/** Definición de la categoría (o la neutra si el valor no es 1–5). */
export const getSeverity = (value) => SEVERITY[parseSeverity(value)] ?? NEUTRAL_SEVERITY;

/** Hex de la categoría (o el neutro). */
export const severityHex = (value) => getSeverity(value).hex;

/** Etiqueta corta: "Cat 3". Devuelve null si el valor no es una categoría válida. */
export const severityLabel = (value) => {
  const level = parseSeverity(value);
  return level ? `Cat ${level}` : null;
};
