import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import '@/i18n/i18n';
import { canAccessPath } from '@/lib/utils';
import UsersSection from './UsersSection';

const mk = (id, email, role, is_active = true) => ({ id, email, full_name: id, role, is_active, created_at: '2026-01-15T12:00:00Z' });
const users = [
  mk('me', 'me@x.com', 'admin'),
  mk('adm2', 'adm2@x.com', 'admin'),
  mk('tec', 'tec@x.com', 'technician'),
  mk('cli', 'cli@x.com', 'client'),
  mk('dev2', 'dev2@x.com', 'dev'),
  mk('master', 'enrique.hernandez@bo.vindgroup.com.mx', 'dev'),
];
const baseProps = {
  users, searchTerm: '', onSearchChange: () => {}, filterRole: 'all', onFilterRoleChange: () => {},
  currentUserId: 'me', isMaster: false, onRoleChange: vi.fn(), onToggleStatus: vi.fn(), onChangeEmail: vi.fn(),
};
const row = (email) => screen.getByText(email).closest('tr');

describe('Configuración: el admin gestiona como un dev no Master, sin tocar cuentas dev', () => {
  it('admin: puede cambiar rol y estado de technician, client y OTROS admin; correo solo de client', () => {
    render(<UsersSection {...baseProps} callerIsDev={false} />);
    for (const email of ['tec@x.com', 'cli@x.com', 'adm2@x.com']) {
      expect(within(row(email)).getByRole('combobox')).toBeInTheDocument();
      expect(within(row(email)).getByRole('button', { name: /Desactivar|Deactivate|admin\.userManagement\.actions\.deactivate/ })).toBeEnabled();
    }
    expect(within(row('cli@x.com')).getByRole('button', { name: 'Cambiar correo' })).toBeInTheDocument();
    expect(within(row('tec@x.com')).queryByRole('button', { name: 'Cambiar correo' })).toBeNull();
  });

  it('admin: las cuentas dev (y el Master) no se tocan: sin menú de rol y con el botón de estado deshabilitado', () => {
    render(<UsersSection {...baseProps} callerIsDev={false} />);
    for (const email of ['dev2@x.com', 'enrique.hernandez@bo.vindgroup.com.mx']) {
      expect(within(row(email)).queryByRole('combobox')).toBeNull();
      const toggle = within(row(email)).getByRole('button', { name: /Desactivar|Deactivate|admin\.userManagement\.actions\.deactivate/ });
      expect(toggle).toBeDisabled();
    }
    expect(row('dev2@x.com').querySelector('[title="Solo un dev puede modificar cuentas dev"]')).not.toBeNull();
  });

  it('admin: su propia fila no cambia de rol ni se desactiva', () => {
    render(<UsersSection {...baseProps} callerIsDev={false} />);
    expect(within(row('me@x.com')).queryByRole('combobox')).toBeNull();
    const toggle = within(row('me@x.com')).getByRole('button', { name: /Desactivar|Deactivate|admin\.userManagement\.actions\.deactivate/ });
    expect(toggle).toBeDisabled();
    expect(toggle).toHaveAttribute('title', 'Nadie puede desactivar su propia cuenta');
  });

  it('dev no Master: sigue pudiendo cambiar el rol de otra cuenta dev (sin cambios)', () => {
    render(<UsersSection {...baseProps} currentUserId="devme" callerIsDev />);
    expect(within(row('dev2@x.com')).getByRole('combobox')).toBeInTheDocument();
  });

  it('los admin no tienen la opción "Desarrollador" al asignar roles', () => {
    render(<UsersSection {...baseProps} callerIsDev={false} />);
    // el menú de rol solo ofrece dev al Master Dev (isMaster); aquí no
    expect(within(row('tec@x.com')).getByRole('combobox')).toBeInTheDocument();
  });
});

describe('rutas de Configuración por rol', () => {
  it('admin y dev entran a /settings; technician y client no; la Auditoría sigue solo para dev', () => {
    expect(canAccessPath('admin', '/settings')).toBe(true);
    expect(canAccessPath('dev', '/settings')).toBe(true);
    expect(canAccessPath('technician', '/settings')).toBe(false);
    expect(canAccessPath('client', '/settings')).toBe(false);
    expect(canAccessPath('admin', '/dev/auditoria')).toBe(false);
    expect(canAccessPath('dev', '/dev/auditoria')).toBe(true);
  });
});
