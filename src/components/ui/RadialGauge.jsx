import React from 'react';
import { cn } from '@/lib/utils';
import { getStatus } from '@/lib/status';
import { gaugeGeometry } from '@/lib/gauge';

/**
 * Medidor circular SVG (stroke-dasharray / stroke-dashoffset).
 * @param {{
 *   value: number, size?: number, strokeWidth?: number,
 *   status?: string, label?: string, showLabel?: boolean, className?: string
 * }} props
 * `value` es un porcentaje 0–100 (se limita). `label` es el texto accesible y, si `showLabel`
 * (por defecto) y el tamaño ≥ 96, también el subtítulo dentro del anillo.
 */
const RadialGauge = ({ value, size = 120, strokeWidth = 10, status = 'done', label, showLabel = true, className }) => {
  const { pct, radius, circumference, offset, center } = gaugeGeometry(value, size, strokeWidth);

  return (
    <div
      role="meter"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      aria-label={label}
      className={cn('relative inline-flex items-center justify-center', className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" className="-rotate-90">
        <circle cx={center} cy={center} r={radius} fill="none" strokeWidth={strokeWidth} className="stroke-line-subtle" />
        <circle
          data-testid="gauge-arc"
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={cn('animate-gauge-fill', getStatus(status).stroke)}
          style={{ '--gauge-circ': circumference, '--gauge-offset': offset }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className={cn('font-mono font-bold tabular-nums text-ink', size < 96 ? 'text-sm' : 'text-2xl')}
        >
          {Math.round(pct)}%
        </span>
        {label && showLabel && size >= 96 ? (
          <span className="text-[10px] uppercase tracking-wider text-ink-muted">{label}</span>
        ) : null}
      </div>
    </div>
  );
};

export default RadialGauge;
