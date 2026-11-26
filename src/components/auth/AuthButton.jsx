import React from 'react';
import { cn } from '@/lib/utils';
import { BTN_PRIMARY, BTN_SECONDARY } from '@/lib/classes';

const PRIMARY_SIZE = 'h-14 sm:h-14 w-full gap-2 text-lg font-bold';
const SECONDARY_SIZE = 'h-12 sm:h-12 w-full gap-2 text-base font-medium';

/**
 * Botón de las pantallas de autenticación, de ancho completo, con los estilos del sistema:
 * `primary` (BTN_PRIMARY, dorado) o `secondary` (BTN_SECONDARY, gris). Con `loading` muestra un
 * indicador en lugar del `icon`. `as` permite usar p. ej. `motion.button`.
 * @param {{ as?: React.ElementType, variant?: 'primary'|'secondary', loading?: boolean,
 *   icon?: React.ReactNode, className?: string, children?: React.ReactNode }} props
 */
const AuthButton = React.forwardRef(
  ({ as: Comp = 'button', variant = 'primary', loading = false, icon = null, className, children, ...rest }, ref) => {
    const extra = Comp === 'button' && rest.type === undefined ? { type: 'button' } : {};
    return (
      <Comp
        ref={ref}
        className={cn(variant === 'secondary' ? BTN_SECONDARY : BTN_PRIMARY, variant === 'secondary' ? SECONDARY_SIZE : PRIMARY_SIZE, className)}
        {...extra}
        {...rest}
      >
        {loading ? (
          <span aria-hidden="true" data-testid="auth-spinner" className="h-5 w-5 animate-spin rounded-full border-2 border-ink/30 border-t-ink" />
        ) : (
          icon
        )}
        {children}
      </Comp>
    );
  },
);
AuthButton.displayName = 'AuthButton';

export default AuthButton;
