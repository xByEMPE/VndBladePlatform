import { tx } from '@/i18n/tx';
import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useLocation } from 'react-router-dom';
import { User, Settings, FileCheck2, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { GLOW_BUTTON_ACTIVE, GLOW_BUTTON_BASE, GLOW_BUTTON_HOVER } from '@/lib/classes';

/**
 * Cápsula interactiva de perfil del navbar con menú desplegable:
 * - Perfil: visible para todos los roles autenticados.
 * - Configuración: admin (solo lectura) y dev (gestión) vía `canConfigure`.
 * - Auditoría y Registros: exclusivo para rol 'dev'.
 * @param {{ email: string, role: string, isDev?: boolean, canConfigure?: boolean }} props
 */
// Opción del menú: neutra por defecto; azul translúcido solo en hover o cuando la ruta está activa.
const ITEM_BASE =
  'flex w-full cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm transition-colors';
const itemClass = (active) =>
  `${ITEM_BASE} ${
    active
      ? 'border-info/30 bg-info/15 text-info'
      : 'border-transparent text-ink hover:border-info/30 hover:bg-info/15 hover:text-info'
  }`;

const UserProfile = ({ email, role, isDev = false, canConfigure = false }) => {
  useTranslation(); // re-renderiza al cambiar de idioma
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);
  const navigate = useNavigate();
  const { pathname } = useLocation();

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    const handleEscape = (event) => {
      if (event.key === 'Escape') setIsOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const handleNavigate = (path) => {
    setIsOpen(false);
    navigate(path);
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        className={cn(
          'flex cursor-pointer items-center gap-2.5 rounded-lg border bg-surface-card px-3 py-1.5',
          GLOW_BUTTON_BASE,
          GLOW_BUTTON_HOVER,
          isOpen && GLOW_BUTTON_ACTIVE,
        )}
      >
        <span
          aria-hidden="true"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-line-medium bg-surface-panel text-ink-muted"
        >
          <User className="h-3.5 w-3.5" />
        </span>

        <div className="hidden min-w-0 flex-col text-left leading-tight md:flex">
          <span className="truncate text-xs font-semibold tracking-tight text-ink">
            {email}
          </span>
          <span
            data-testid="user-role"
            className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-info"
          >
            {role}
          </span>
        </div>

        <ChevronDown
          aria-hidden="true"
          className={`h-3.5 w-3.5 shrink-0 text-ink-muted transition-transform duration-150 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {isOpen && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-60 origin-top-right rounded-xl border border-line-subtle bg-surface-panel p-1.5 shadow-xl"
        >
          {/* Visible SOLO para rol 'dev': Auditoría va primero */}
          {isDev && (
            <button
              type="button"
              role="menuitem"
              onClick={() => handleNavigate('/dev/auditoria')}
              className={itemClass(pathname === '/dev/auditoria')}
            >
              <FileCheck2 className="h-4 w-4" />
              <span>{tx("Auditoría y Registros")}</span>
            </button>
          )}

          {/* Visible para TODOS los usuarios autenticados */}
          <button
            type="button"
            role="menuitem"
            onClick={() => handleNavigate('/profile')}
            className={`${isDev ? 'mt-0.5 ' : ''}${itemClass(pathname === '/profile')}`}
          >
            <User className="h-4 w-4" />
            <span>{tx("Perfil")}</span>
          </button>

          {/* Visible para admin (solo lectura) y dev (gestión) */}
          {(canConfigure || isDev) && (
            <button
              type="button"
              role="menuitem"
              onClick={() => handleNavigate('/settings')}
              className={`mt-0.5 ${itemClass(pathname === '/settings')}`}
            >
              <Settings className="h-4 w-4" />
              <span>{tx("Configuración")}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default UserProfile;