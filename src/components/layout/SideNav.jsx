import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Activity, BarChart3, BookOpen, Database, ChevronDown, FolderKanban, Shield, Sliders } from 'lucide-react';
import { tx } from '@/i18n/tx';
import { ADMIN_REGISTRIES } from '@/config/adminRegistries';
import { useRolePermissions } from '@/hooks/useRolePermissions';
import { FOCUS_RING } from '@/lib/classes';
import { cn } from '@/lib/utils';

const OPERATIONS_ITEMS = [
  { to: '/', label: 'Panel principal', icon: Activity, end: true },
  { to: '/progress', label: 'Progreso General', icon: BarChart3 },
  { to: '/reports-portal', label: 'Portal de Reportes', icon: BookOpen },
  { to: '/projects', label: 'Inspecciones de Palas', icon: FolderKanban, adminOnly: true },
  { to: '/capture', label: 'Inspecciones LPS', icon: Shield, adminOnly: true },
  { to: '/wtg-generator', label: 'Generador WTG', icon: Sliders, adminOnly: true },
];

const itemClass = ({ isActive }) =>
  cn(
    'flex w-full cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm transition-all duration-150',
    isActive
      ? 'border-info/30 bg-info/15 text-info'
      : 'border-transparent text-ink hover:border-info/30 hover:bg-info/15 hover:text-info',
    FOCUS_RING,
  );

const GroupHeader = ({ icon: Icon, label, open, onToggle, id }) => (
  <button
    type="button"
    onClick={onToggle}
    aria-expanded={open}
    aria-controls={id}
    className={cn(
      'flex w-full items-center justify-between rounded-md px-3 py-2 text-xs font-bold uppercase tracking-wider text-ink hover:bg-line-subtle',
      FOCUS_RING,
    )}
  >
    <span className="flex items-center gap-2">
      <Icon size={14} aria-hidden="true" />
      {label}
    </span>
    <ChevronDown size={14} aria-hidden="true" className={cn('transition-transform', open && 'rotate-180')} />
  </button>
);

/**
 * Menú lateral: dos bloques en acordeón (Centro de Operaciones y Centro Administrativo).
 */
const SideNav = ({ collapsed = false }) => {
  const { pathname } = useLocation();
  const inAdmin = pathname.startsWith('/centro-admin');
  const [opsOpen, setOpsOpen] = useState(!inAdmin);
  const [adminOpen, setAdminOpen] = useState(inAdmin);
  const { role, isAdmin } = useRolePermissions();
  const isUserAdmin = role === 'admin' || role === 'dev' || (typeof isAdmin === 'function' && isAdmin());
  const operationsItems = OPERATIONS_ITEMS.filter((item) => !item.adminOnly || isUserAdmin);

  return (
    <aside
      aria-label={tx('Menú principal')}
      aria-hidden={collapsed || undefined}
      className={cn(
        'sticky top-16 flex h-[calc(100vh-4rem)] shrink-0 flex-col gap-2 overflow-y-auto border-r border-line-subtle bg-surface-panel transition-[width,padding] duration-200',
        collapsed ? 'w-0 overflow-hidden border-r-0 p-0' : 'w-64 p-3',
      )}
    >
      <GroupHeader
        id="nav-operations"
        icon={Activity}
        label={tx('Centro de Operaciones')}
        open={opsOpen}
        onToggle={() => setOpsOpen((v) => !v)}
      />
      {opsOpen && (
        <motion.ul
          id="nav-operations"
          initial={{ opacity: 0, y: -10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.15 }}
          className="flex origin-top flex-col gap-1 pl-2"
        >
          {operationsItems.map(({ to, label, icon: Icon, end }) => (
            <li key={to}>
              <NavLink to={to} end={end} className={itemClass}>
                <Icon size={16} aria-hidden="true" />
                {tx(label)}
              </NavLink>
            </li>
          ))}
        </motion.ul>
      )}

      <GroupHeader
        id="nav-admin"
        icon={Database}
        label={tx('Centro Administrativo')}
        open={adminOpen}
        onToggle={() => setAdminOpen((v) => !v)}
      />
      {adminOpen && (
        <motion.ul
          id="nav-admin"
          initial={{ opacity: 0, y: -10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.15 }}
          className="flex origin-top flex-col gap-1 pl-2"
        >
          {ADMIN_REGISTRIES.map((registry) => (
            <li key={registry.id}>
              <NavLink to={`/centro-admin/${registry.id}`} className={itemClass}>
                <registry.icon size={16} aria-hidden="true" className="shrink-0" />
                {tx(registry.label)}
              </NavLink>
            </li>
          ))}
        </motion.ul>
      )}
    </aside>
  );
};

export default SideNav;
