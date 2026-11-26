import React from 'react';
import { cn } from '@/lib/utils';

/**
 * Aerogenerador minimalista para el centro del círculo del marcador: torre delgada blanca (token ink), buje y
 * tres palas que toman el color de la categoría (`currentColor`, lo da la clase `text-sev-N` de quien lo usa).
 * Sin góndola, sombreados ni sombra en el suelo: a 20 px no se distinguirían y solo ensuciarían.
 *
 * - Las palas van en `.wind-turbine-rotor`, que gira sobre el centro del buje (ver turbine-map.css). `phase` (0–1)
 *   desfasa el giro para que un parque no gire todo sincronizado.
 *
 * @param {{ size?: number, phase?: number, className?: string }} props   `size` = alto en px.
 */

const VIEW = { w: 32, h: 32 };
const HUB = { x: 16, y: 12 }; // centro del buje en el viewBox
const SPIN_SECONDS = 7; // debe coincidir con la duración base de turbine-map.css

// Pala apuntando hacia arriba desde el buje: ancha en la raíz y afilada en la punta.
const BLADE = 'M15 11.4 C14.6 8.2 15.1 4.4 16 1 C16.9 4.2 17.4 8.2 17 11.4 Z';

const WindTurbineIcon = ({ size = 20, phase = 0, className }) => (
  <svg
    data-icon="wind-turbine"
    width={(size * VIEW.w) / VIEW.h}
    height={size}
    viewBox={`0 0 ${VIEW.w} ${VIEW.h}`}
    fill="currentColor"
    aria-hidden="true"
    className={cn('overflow-visible', className)}
  >
    {/* torre */}
    <polygon data-part="tower" points="15.2,13 16.8,13 17.4,30 14.6,30" className="fill-ink" />

    {/* rotor: tres palas a 120° */}
    <g
      className="wind-turbine-rotor"
      style={{ transformOrigin: `${HUB.x}px ${HUB.y}px`, animationDelay: `-${(phase * SPIN_SECONDS).toFixed(2)}s` }}
    >
      {[0, 120, 240].map((angle) => (
        <path key={angle} data-part="blade" d={BLADE} transform={`rotate(${angle} ${HUB.x} ${HUB.y})`} />
      ))}
    </g>

    {/* buje */}
    <circle data-part="hub" cx={HUB.x} cy={HUB.y} r="1.8" className="fill-ink" />
  </svg>
);

export default WindTurbineIcon;
