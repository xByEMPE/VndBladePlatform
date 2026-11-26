import React from 'react';
import { cn } from '@/lib/utils';

/**
 * Tarjeta bento. Estilos de hover/borde/foco viven en `.bento-card` (index.css).
 * @param {{
 *   as?: React.ElementType, active?: boolean, interactive?: boolean, flat?: boolean,
 *   className?: string, children?: React.ReactNode
 * }} props
 * `active` resalta el borde con la marca. `flat` desactiva la elevación al hover
 * (para paneles contenedores que no son clicables). `interactive` la hace operable con
 * teclado (si `as` es 'div'); para acciones reales usa as="button" o as="a".
 */
const BentoCard = React.forwardRef(
  ({ as: Comp = 'div', active = false, interactive = false, flat = false, className, children, ...rest }, ref) => {
    const extra = {};
    if (Comp === 'button' && rest.type === undefined) extra.type = 'button';
    if (interactive && Comp === 'div') {
      extra.tabIndex = 0;
      extra.role = rest.role ?? 'button';
    }
    return (
      <Comp
        ref={ref}
        data-active={active ? 'true' : undefined}
        data-flat={flat ? 'true' : undefined}
        className={cn('bento-card', interactive && 'cursor-pointer', className)}
        {...extra}
        {...rest}
      >
        {children}
      </Comp>
    );
  },
);
BentoCard.displayName = 'BentoCard';

export default BentoCard;
