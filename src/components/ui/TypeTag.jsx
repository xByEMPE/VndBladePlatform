import React from 'react';
import { cn } from '@/lib/utils';

/** Etiqueta pequeña de tipo de proyecto (DRONE, LPS…). */
const TypeTag = ({ children, className }) => (
  <span
    className={cn(
      'rounded-sm border border-line-subtle bg-surface-card px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-ink',
      className,
    )}
  >
    {children}
  </span>
);

export default TypeTag;
