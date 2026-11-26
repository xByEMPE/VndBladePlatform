import React from 'react';

/**
 * Dato etiquetado (<dt>/<dd>) en tarjeta tenue. Usar dentro de un <dl>.
 * @param {{ label: string, value: React.ReactNode, wide?: boolean }} props
 */
const Metric = ({ label, value, wide = false }) => (
  <div
    className={`min-w-0 rounded-md border border-line-subtle bg-surface-card/40 px-3 py-2 ${wide ? 'col-span-full' : ''}`}
  >
    <dt className="text-[11px] font-semibold uppercase tracking-widest text-ink-muted">{label}</dt>
    <dd className="mt-0.5 break-words text-sm font-semibold tabular-nums text-ink">{value}</dd>
  </div>
);

export default Metric;
