import React from 'react';
import { cn } from '@/lib/utils';

/** Sobretítulo en mayúsculas (etiquetas de sección). `as` define la etiqueta semántica. */
const Overline = ({ as: Comp = 'span', className, children, ...rest }) => (
  <Comp className={cn('text-[11px] font-bold uppercase tracking-wider text-ink-muted', className)} {...rest}>
    {children}
  </Comp>
);

export default Overline;
