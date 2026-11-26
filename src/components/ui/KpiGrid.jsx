import React from 'react';
import { cn } from '@/lib/utils';

/**
 * Rejilla de KPIs con divisores. Cada hijo directo es una celda: añade padding con `p-5`.
 * Móvil: 2 columnas; lg: 5 columnas separadas por líneas verticales.
 */
const KpiGrid = ({ className, children }) => (
  <div
    className={cn(
      'grid grid-cols-2 lg:grid-cols-5',
      '[&>*]:border-line-subtle [&>*:nth-child(n+2)]:border-t lg:[&>*:nth-child(n+2)]:border-t-0',
      'lg:[&>*:nth-child(n+2)]:border-l [&>*:nth-child(odd)]:border-l-0 lg:[&>*:nth-child(odd)]:border-l',
      className,
    )}
  >
    {children}
  </div>
);

export default KpiGrid;
