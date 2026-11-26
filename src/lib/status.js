/**
 * Fuente única de estados del Design System.
 * Las clases son strings estáticos completos para que Tailwind (JIT) las detecte.
 * Clave de estado: 'done' | 'progress' | 'alert' | 'cancelled' | 'review' | 'planning' | 'pending'.
 *
 * Cada estado define sus variantes de presentación:
 *  - dot / text:  punto + texto (StatusBadge)
 *  - bar / stroke: barras de progreso y medidores
 *  - pill:        variante con forma de píldora propia (solo `cancelled` en StatusBadge)
 *  - chip:        colores de la PÍLDORA tenue (StatusPill): texto del color sobre fondo teñido
 */
export const STATUS = Object.freeze({
  done: {
    dot: 'bg-status-done',
    text: 'text-status-done',
    bar: 'bg-status-done',
    stroke: 'stroke-status-done',
    pill: '',
    chip: 'text-status-done bg-status-done/10',
  },
  progress: {
    dot: 'bg-status-progress',
    text: 'text-status-progress',
    bar: 'bg-status-progress',
    stroke: 'stroke-status-progress',
    pill: '',
    chip: 'text-status-progress bg-status-progress/10',
  },
  alert: {
    dot: 'bg-status-alert',
    text: 'text-status-alert',
    bar: 'bg-status-alert',
    stroke: 'stroke-status-alert',
    pill: '',
    chip: 'text-status-alert bg-status-alert/10',
  },
  cancelled: {
    dot: 'bg-error-text',
    text: 'text-error-text',
    bar: 'bg-error-text',
    stroke: 'stroke-error-text',
    pill: 'rounded-full border border-error-border bg-error-bg px-2.5 py-0.5',
    chip: 'text-error-text bg-error-bg',
  },
  review: {
    dot: 'bg-sev-4',
    text: 'text-sev-4',
    bar: 'bg-sev-4',
    stroke: 'stroke-sev-4',
    pill: '',
    chip: 'text-sev-4 bg-sev-4/10',
  },
  // "Amarillo": el dorado de marca (p. ej. Planeación y otros estados intermedios)
  planning: {
    dot: 'bg-brand',
    text: 'text-brand',
    bar: 'bg-brand',
    stroke: 'stroke-brand',
    pill: '',
    chip: 'text-brand bg-brand/10',
  },
  pending: {
    dot: 'bg-ink-muted',
    text: 'text-ink-muted',
    bar: 'bg-ink-muted',
    stroke: 'stroke-ink-muted',
    pill: '',
    chip: 'text-ink-muted bg-surface-card',
  },
});

export const DEFAULT_STATUS = 'pending';

/** Devuelve la definición del estado; si la clave es desconocida, usa 'pending'. */
export const getStatus = (key) => STATUS[key] ?? STATUS[DEFAULT_STATUS];
