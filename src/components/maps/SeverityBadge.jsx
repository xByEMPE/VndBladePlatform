import React from 'react';
import { cn } from '@/lib/utils';
import { parseSeverity } from '@/lib/severity';

/**
 * Insignia de alerta en la esquina superior derecha del marcador de una turbina (solo Cat 4 y Cat 5):
 * - Cat 4: triángulo de advertencia con pulso (escala + opacidad).
 * - Cat 5: círculo rojo con signo de exclamación y parpadeo (opacidad).
 * Es decorativa: la severidad ya se anuncia en el aria-label del botón. Las animaciones están en turbine-map.css
 * y usan solo opacity/transform (se componen en GPU; nada de sombras animadas).
 */
const Exclamation = () => (
  <>
    <rect x="7.1" y="4.2" width="1.8" height="5.4" rx="0.9" className="fill-ink" stroke="none" />
    <circle cx="8" cy="11.9" r="1.1" className="fill-ink" stroke="none" />
  </>
);

const SeverityBadge = ({ severity }) => {
  const level = parseSeverity(severity);
  if (level !== 4 && level !== 5) return null;
  const critical = level === 5;

  return (
    <span
      data-badge={critical ? 'critical' : 'warning'}
      aria-hidden="true"
      className={cn(
        'pointer-events-none absolute -right-1 -top-1 block h-3 w-3',
        critical ? 'turbine-badge-blink text-sev-5' : 'turbine-badge-pulse text-sev-4',
      )}
    >
      <svg viewBox="0 0 16 16" className="block h-full w-full overflow-visible" fill="currentColor" strokeWidth="1" strokeLinejoin="round">
        {critical ? (
          <circle cx="8" cy="8" r="7.2" className="stroke-surface-base" />
        ) : (
          <polygon points="8,0.8 15.4,14.4 0.6,14.4" className="stroke-surface-base" />
        )}
        {critical ? (
          <Exclamation />
        ) : (
          <g transform="translate(0 0.6)">
            <Exclamation />
          </g>
        )}
      </svg>
    </span>
  );
};

export default SeverityBadge;
