import React from 'react';
import { cn } from '@/lib/utils';

const TONES = {
  error: 'border-error-border bg-error-bg text-error-text',
  success: 'border-status-done/30 bg-status-done/10 text-status-done',
  info: 'border-info/30 bg-info/10 text-info',
};

/**
 * Aviso de una pantalla de autenticación: error (vino sobrio), éxito (verde salvia) o informativo (celeste).
 * @param {{ tone?: 'error'|'success'|'info', icon?: React.ReactNode, className?: string, children: React.ReactNode }} props
 */
const AuthAlert = ({ tone = 'error', icon = null, className, children }) => (
  <div
    role={tone === 'error' ? 'alert' : 'status'}
    data-tone={tone}
    className={cn('flex items-center gap-2 rounded-lg border p-3 text-sm', TONES[tone], className)}
  >
    {icon ? (
      <span aria-hidden="true" className="shrink-0">
        {icon}
      </span>
    ) : null}
    <div className="min-w-0">{children}</div>
  </div>
);

export default AuthAlert;
