/** Limita un valor al rango 0–100; valores no numéricos se tratan como 0. */
export const clampPercent = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, n));
};

/** value/total como porcentaje entero 0–100 (total ≤ 0 → 0). */
export const toPercent = (value, total) => (total > 0 ? Math.round(clampPercent((value / total) * 100)) : 0);

/** value/total como porcentaje con 1 decimal (p. ej. 39.8); total ≤ 0 → 0. */
export const percentOf = (value, total) =>
  total > 0 ? Math.round(clampPercent((value / total) * 100) * 10) / 10 : 0;

/** Texto "39.8%" con 1 decimal fijo. */
export const formatPercent = (pct) => `${Number(pct).toFixed(1)}%`;

/**
 * Geometría del medidor circular.
 * dasharray = circunferencia; dashoffset = circunferencia * (1 - pct/100).
 */
export const gaugeGeometry = (value, size = 120, strokeWidth = 10) => {
  const pct = clampPercent(value);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - pct / 100);
  return { pct, radius, circumference, offset, center: size / 2 };
};
