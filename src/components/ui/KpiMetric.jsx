import React from 'react';
import { cn } from '@/lib/utils';

/**
 * Métrica KPI: etiqueta, valor mono, leyenda y un pie opcional (p. ej. <ProgressBar />).
 * Sin fondo ni borde propios: se puede colocar en una celda o dentro de <BentoCard>.
 * @param {{
 *   label: string, value: React.ReactNode, caption?: React.ReactNode,
 *   trailing?: React.ReactNode, trailingClassName?: string,
 *   icon?: React.ReactNode, iconClassName?: string,
 *   className?: string, children?: React.ReactNode
 * }} props
 * `trailing` (p. ej. "39.8%") se alinea a la derecha de la leyenda, sobre la barra.
 */
const KpiMetric = ({ label, value, caption, trailing, trailingClassName, icon, iconClassName, className, children }) => (
  <div className={cn('flex min-w-0 flex-col justify-between', className)}>
    <div className="flex items-start justify-between gap-3">
      <span className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">{label}</span>
      {icon ? (
        <span aria-hidden="true" className={cn('text-ink-muted', iconClassName)}>
          {icon}
        </span>
      ) : null}
    </div>
    <div className="mt-2">
      <div className="font-mono text-3xl font-bold tabular-nums text-ink">{value}</div>
      {caption || trailing ? (
        <div className="mt-1 flex items-center justify-between gap-2 text-xs text-ink-muted">
          <p>{caption}</p>
          {trailing ? (
            <span data-testid="kpi-trailing" className={cn('font-mono tabular-nums', trailingClassName)}>
              {trailing}
            </span>
          ) : null}
        </div>
      ) : null}
      {children ? <div className="mt-3">{children}</div> : null}
    </div>
  </div>
);

export default KpiMetric;
