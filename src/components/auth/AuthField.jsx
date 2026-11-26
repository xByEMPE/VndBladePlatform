import React from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { INPUT } from '@/lib/classes';

/**
 * Campo de formulario de autenticación: etiqueta + input (estilo INPUT del sistema, foco dorado) y,
 * opcionalmente, botón para mostrar/ocultar la contraseña.
 * El resto de props (value, onChange, type, required, placeholder, minLength…) pasan al <input>.
 * @param {{
 *   id: string, label: React.ReactNode, labelClassName?: string, className?: string,
 *   inputClassName?: string, disabled?: boolean,
 *   toggle?: { shown: boolean, onToggle: () => void, size?: number, className?: string }
 * }} props
 */
const AuthField = ({ id, label, labelClassName, className, inputClassName, disabled, toggle, ...inputProps }) => (
  <div className={cn('space-y-2', className)}>
    <label htmlFor={id} className={cn('block text-sm font-medium text-brand', labelClassName)}>
      {label}
    </label>
    <div className="relative">
      <input
        id={id}
        disabled={disabled}
        className={cn(INPUT, 'h-12 rounded-lg px-4 text-base sm:h-12 sm:text-base', toggle && 'pr-12', inputClassName)}
        {...inputProps}
      />
      {toggle ? (
        <button
          type="button"
          onClick={toggle.onToggle}
          disabled={disabled}
          aria-pressed={toggle.shown}
          className={cn(
            'absolute right-4 top-1/2 -translate-y-1/2 text-ink-muted outline-none transition-colors duration-200 hover:text-brand disabled:cursor-not-allowed disabled:opacity-50',
            toggle.className,
          )}
        >
          {toggle.shown ? <EyeOff size={toggle.size ?? 20} /> : <Eye size={toggle.size ?? 20} />}
        </button>
      ) : null}
    </div>
  </div>
);

export default AuthField;
