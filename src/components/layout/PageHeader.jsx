import React from 'react';
import Overline from '@/components/ui/Overline';
import { cn } from '@/lib/utils';

/**
 * Encabezado de página. El icono va EN LÍNEA antes del sobretítulo (ambos en azul celeste);
 * título, subtítulo y descripción arrancan desde el margen izquierdo.
 * Estándar para toda la app. El rol del usuario NO va aquí (vive en el Header superior);
 * en `actions` solo van estados del documento y acciones (p. ej. StatusBadge, botón Actualizar).
 * @param {{
 *   overline?: string, title: string, subtitle?: string, description?: string,
 *   icon?: React.ReactNode, actions?: React.ReactNode, className?: string
 * }} props
 * `subtitle` es una línea corta bajo el título (se trunca); `description` es un párrafo.
 * `className` permite integrarlo en otros contenedores (p. ej. "border-b-0 pb-3").
 */
const PageHeader = ({ overline, title, subtitle, description, icon, actions, className }) => (
  <div className={cn('flex flex-wrap items-start gap-4 border-b border-line-subtle pb-5', className)}>
    <div className="min-w-0 flex-1">
      {overline || icon ? (
        <Overline as="p" className="flex items-center gap-2 text-info">
          {icon ? (
            <span aria-hidden="true" className="inline-flex shrink-0 [&>svg]:h-3.5 [&>svg]:w-3.5">
              {icon}
            </span>
          ) : null}
          {overline}
        </Overline>
      ) : null}
      <h1 className="mt-1.5 truncate text-2xl font-semibold tracking-tight text-ink sm:text-3xl">{title}</h1>
      {subtitle ? <p className="mt-1 truncate text-sm text-ink-muted">{subtitle}</p> : null}
      {description ? <p className="mt-1.5 max-w-2xl text-sm text-ink-muted">{description}</p> : null}
    </div>
    {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
  </div>
);

export default PageHeader;
