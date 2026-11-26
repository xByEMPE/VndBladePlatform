/**
 * Constantes de clases del Design System (solo tokens, sin colores crudos).
 * Páginas y kits (viewerKit, y más adelante formKit) las reexportan: una sola fuente.
 */

/** Anillo de foco estándar (teclado). */
export const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background';

/** Alias histórico usado por los kits de páginas. */
export const FOCUS = FOCUS_RING;

export const PANEL = 'rounded-lg border border-line-subtle bg-surface-panel';

export const OVERLINE = 'text-[11px] font-semibold uppercase tracking-widest text-ink-muted';

export const INPUT =
  'w-full h-11 sm:h-10 !py-0 !leading-6 rounded-md border border-line-subtle bg-surface-card px-3 text-base sm:text-sm text-ink placeholder:text-ink-muted outline-none transition-colors focus:border-brand/60 focus:ring-2 focus:ring-brand/30 disabled:cursor-not-allowed disabled:opacity-50';

export const BTN = `inline-flex h-11 sm:h-10 items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_RING}`;

/**
 * REGLA DE DISEÑO: los botones que ya eran amarillos (dorado/ámbar) usan este estilo nuevo
 * (la receta del botón vino en dorado); los que NO eran amarillos conservan su aspecto original.
 *
 * Apariencia de los botones amarillos: fondo dorado tenue, texto y borde dorados; al pasar el
 * cursor el fondo sube de intensidad. Debe declararse ANTES de los botones que la usan
 * (las constantes no se elevan).
 */
const GOLD_LOOK =
  'border border-brand/40 bg-brand/10 text-brand transition-colors duration-200 hover:bg-brand/25 active:scale-[0.98]';

/** Botón primario (antes ámbar sólido): estilo dorado nuevo. */
export const BTN_PRIMARY = `${BTN} ${GOLD_LOOK}`;

/**
 * Botón secundario (antes gris neutro): conserva su aspecto ORIGINAL, expresado en tokens
 * (borde blanco al 10% → line-subtle; fondo pizarra → surface-card; borde al hover → line-medium).
 */
export const BTN_SECONDARY = `${BTN} border border-line-subtle bg-surface-card text-ink hover:border-line-medium`;

export const BTN_DANGER = `${BTN} border border-error-border bg-error-bg text-error-text hover:bg-error-border/40`;

/** Botón verde (confirmar/reactivar): misma receta que los rojos y los amarillos, en verde salvia. */
export const BTN_SUCCESS = `${BTN} border border-status-done/40 bg-status-done/10 text-status-done hover:bg-status-done/25`;

/** Botón azul celeste (acción informativa/segura): misma receta que los verdes y dorados, en azul. */
export const BTN_INFO = `${BTN} border border-info/40 bg-info/10 text-info hover:bg-info/25`;

/**
 * Sobrescritura para AlertDialogAction destructivo (cerrar sesión, eliminar…): reemplaza los
 * colores dorados del estilo base por el error sobrio. Úsese con cn() para resolver conflictos.
 */
export const ALERT_DESTRUCTIVE =
  'border-error-border bg-error-bg text-error-text hover:bg-error-border/40';

/**
 * Botón/enlace de acción sobre filas/tarjetas (descargar o ver reporte; antes ámbar): estilo dorado
 * nuevo, con altura compacta de 40px.
 */
export const BTN_BRAND_OUTLINE = `group/btn inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-md px-4 text-sm font-semibold !leading-none no-underline disabled:cursor-not-allowed disabled:opacity-60 ${GOLD_LOOK} ${FOCUS_RING}`;

/** Transición de entrada estándar (framer-motion). */
export const FADE = { duration: 0.2, ease: 'easeOut' };
