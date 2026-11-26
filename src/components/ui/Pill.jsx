import React from 'react';
import { cn } from '@/lib/utils';

/**
 * Píldora base (chip): bordes totalmente redondeados, texto pequeño en negrita.
 * Los colores los aportan StatusPill / RoleChip (o `className`). `bordered` añade borde (el color
 * del borde va en `className`, p. ej. `border-brand/30`).
 * @param {{ bordered?: boolean, className?: string, children: React.ReactNode }} props
 */
const Pill = ({ bordered = false, className, children, ...rest }) => (
  <span
    className={cn('inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold', bordered && 'border', className)}
    {...rest}
  >
    {children}
  </span>
);

export default Pill;
