import React from 'react';
import { cn } from '@/lib/utils';

/** Enlace discreto en forma de botón (p. ej. "Volver al inicio de sesión"), centrado, con icono opcional. */
const AuthLinkButton = ({ icon = null, className, children, ...rest }) => (
  <button
    type="button"
    className={cn('mx-auto flex items-center justify-center gap-2 text-sm text-ink-muted transition-colors duration-200 hover:text-brand', className)}
    {...rest}
  >
    {icon}
    {children}
  </button>
);

export default AuthLinkButton;
