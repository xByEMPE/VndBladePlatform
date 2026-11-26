import React from 'react';
import { cn } from '@/lib/utils';

const ICON_TONES = {
  brand: 'bg-brand/20 text-brand',
  success: 'bg-status-done/20 text-status-done',
};

/**
 * Cabecera de una tarjeta de autenticación: círculo con icono, título (h1) y subtítulo.
 * `subtitle` admite nodos (p. ej. un <strong> con el correo). `children` va debajo (avisos).
 * @param {{ icon: React.ReactNode, tone?: 'brand'|'success', title: React.ReactNode,
 *   subtitle?: React.ReactNode, subtitleClassName?: string, children?: React.ReactNode }} props
 */
const AuthHeader = ({ icon, tone = 'brand', title, subtitle, subtitleClassName, children }) => (
  <div className="text-center">
    <div className={cn('mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full', ICON_TONES[tone])}>
      {icon}
    </div>
    <h1 className="mb-2 text-2xl font-bold text-ink">{title}</h1>
    {subtitle ? <p className={cn('mb-6 text-sm text-ink-muted', subtitleClassName)}>{subtitle}</p> : null}
    {children}
  </div>
);

export default AuthHeader;
