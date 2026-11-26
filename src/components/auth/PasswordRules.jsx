import React from 'react';
import { cn } from '@/lib/utils';

/**
 * Lista de requisitos de contraseña: cada regla muestra un punto y su texto en verde salvia cuando se cumple.
 * @param {{ title: string, rules: Array<{ key?: string, ok: boolean, label: string }> }} props
 */
const PasswordRules = ({ title, rules }) => (
  <div className="rounded-lg border border-line-subtle bg-surface-card p-3">
    <p className="mb-2 text-xs font-medium text-ink-muted">{title}</p>
    <ul className="space-y-1 text-xs text-ink-muted">
      {rules.map(({ key, ok, label }) => (
        <li key={key ?? label} data-ok={ok ? 'true' : 'false'} className={cn('flex items-center gap-2', ok && 'text-status-done')}>
          <span aria-hidden="true" className={cn('h-1.5 w-1.5 rounded-full', ok ? 'bg-status-done' : 'bg-ink-muted')} />
          {label}
        </li>
      ))}
    </ul>
  </div>
);

export default PasswordRules;
