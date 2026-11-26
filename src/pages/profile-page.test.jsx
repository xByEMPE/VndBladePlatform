import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, within } from '@testing-library/react';
import i18n from '@/i18n/i18n';
import ProfilePage from './ProfilePage';

const MASTER = 'enrique.hernandez@bo.vindgroup.com.mx';

const mocks = vi.hoisted(() => ({
  user: { id: 'u1', email: 'x@x.com' },
  role: 'client',
  fullName: 'Ada Lovelace',
  updateUser: vi.fn().mockResolvedValue({ error: null }),
  update: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: () => Promise.resolve({ data: { user: mocks.user }, error: null }),
      updateUser: (...a) => mocks.updateUser(...a),
    },
    from: () => ({
      select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { full_name: mocks.fullName, role: mocks.role }, error: null }) }) }),
      update: (values) => ({ eq: () => { mocks.update(values); return Promise.resolve({ error: null }); } }),
    }),
  },
}));
vi.mock('@/components/ui/use-toast', () => ({ toast: vi.fn() }));
vi.mock('react-helmet', () => ({ Helmet: () => null }));

const setUser = (email, role, extra = {}) => {
  mocks.user = { id: 'u1', email, ...extra };
  mocks.role = role;
  mocks.fullName = 'Ada Lovelace';
};
// La página muestra un spinner hasta cargar; el encabezado aparece cuando ya conoce el rol
const renderPage = async () => {
  render(<ProfilePage />);
  await screen.findByRole('heading', { level: 1 });
};
const emailInput = () => document.getElementById('profile-email');
const nameInput = () => document.getElementById('profile-name');
// Ficha de solo lectura (client y Master Dev): <dl> con nombre, correo y "miembro desde"
const ficha = () => screen.queryByText(/Nombre del usuario|User name/)?.closest('dl') ?? null;

describe('ProfilePage: reglas de edición según el rol', () => {
  beforeEach(() => {
    mocks.updateUser.mockClear();
    mocks.update.mockClear();
  });

  it('client: ficha de solo lectura (con leyendas y nota de TI), sin campos ni botón de guardar; solo cambia su contraseña', async () => {
    setUser('cli@x.com', 'client', { created_at: '2026-01-15T12:00:00Z' });
    await renderPage();
    expect(nameInput()).toBeNull();
    expect(emailInput()).toBeNull(); // ya no son campos apagados
    const card = within(ficha());
    expect(card.getByText('Ada Lovelace')).toBeInTheDocument();
    expect(card.getByText('cli@x.com')).toBeInTheDocument();
    expect(card.getByText('Miembro desde')).toBeInTheDocument();
    expect(card.getByText(/enero de 2026/)).toBeInTheDocument();
    expect(screen.getAllByText('Solo lectura')).toHaveLength(2); // nombre y correo
    expect(screen.getByText('Para cambiar tu correo, solicítalo al equipo de TI.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Guardar Cambios' })).toBeNull();
    // la contraseña sí se puede cambiar
    expect(screen.getByRole('button', { name: 'Actualizar Contraseña' })).toBeInTheDocument();
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  it('client sin nombre: dice "Sin nombre registrado" en lugar del texto de ejemplo de un campo', async () => {
    setUser('cli@x.com', 'client');
    mocks.fullName = '';
    await renderPage();
    expect(within(ficha()).getByText('Sin nombre registrado')).toBeInTheDocument();
    expect(screen.queryByText('Ej. Ing. Carlos Mendoza')).toBeNull();
    expect(screen.queryByPlaceholderText('Ej. Ing. Carlos Mendoza')).toBeNull();
  });

  it('Master Dev: ficha limpia, SIN leyendas, nota ni botón de guardar; solo cambia su contraseña', async () => {
    setUser(MASTER, 'dev', { created_at: '2026-01-15T12:00:00Z' });
    await renderPage();
    expect(nameInput()).toBeNull();
    expect(emailInput()).toBeNull();
    const card = within(ficha());
    expect(card.getByText('Ada Lovelace')).toBeInTheDocument();
    expect(card.getByText(MASTER)).toBeInTheDocument();
    expect(card.getByText('Miembro desde')).toBeInTheDocument();
    // perfil limpio: ni "Solo lectura", ni el aviso de TI
    expect(screen.queryByText('Solo lectura')).toBeNull();
    expect(screen.queryByText('Para cambiar tu correo, solicítalo al equipo de TI.')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Guardar Cambios' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Actualizar Contraseña' })).toBeInTheDocument();
  });

  it('sin fecha de alta no se muestra la fila "Miembro desde"', async () => {
    setUser('cli@x.com', 'client'); // sin created_at
    await renderPage();
    expect(within(ficha()).queryByText('Miembro desde')).toBeNull();
  });

  it.each([['admin'], ['technician'], ['dev']])('%s: ficha limpia como el Master Dev (sin campos, leyendas ni botón de guardar); solo cambia su contraseña', async (role) => {
    setUser('persona@x.com', role, { created_at: '2026-01-15T12:00:00Z' });
    await renderPage();
    expect(nameInput()).toBeNull();
    expect(emailInput()).toBeNull();
    const card = within(ficha());
    expect(card.getByText('Ada Lovelace')).toBeInTheDocument();
    expect(card.getByText('persona@x.com')).toBeInTheDocument();
    expect(card.getByText('Miembro desde')).toBeInTheDocument();
    expect(screen.queryByText('Solo lectura')).toBeNull();
    expect(screen.queryByText('Para cambiar tu correo, solicítalo al equipo de TI.')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Guardar Cambios' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Actualizar Contraseña' })).toBeInTheDocument();
    // nunca escribe datos personales ni pide cambio de correo
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  it.each([['client', 'cli@x.com'], ['admin', 'a@x.com'], ['technician', 't@x.com'], ['dev', 'd@x.com'], ['dev', MASTER]])(
    '%s (%s): "Nivel de acceso" va sin candado y sin "· Solo lectura"',
    async (role, email) => {
      setUser(email, role);
      await renderPage();
      const level = screen.getByText('Nivel de acceso');
      expect(level.querySelector('svg')).toBeNull();
      expect(screen.queryByText(/Nivel de acceso · Solo lectura/)).toBeNull();
    },
  );

});

describe('ProfilePage: inglés', () => {
  beforeEach(async () => {
    await act(async () => { await i18n.changeLanguage('en'); });
  });
  afterEach(async () => {
    await act(async () => { await i18n.changeLanguage('es'); });
  });

  it('muestra los textos en inglés (títulos, ficha, leyendas y rol)', async () => {
    setUser('cli@x.com', 'client', { created_at: '2026-01-15T12:00:00Z' });
    await renderPage();
    expect(screen.getByRole('heading', { level: 1, name: 'User Profile' })).toBeInTheDocument();
    expect(screen.getByText('Personal Details')).toBeInTheDocument();
    expect(screen.getByText('Security and Password')).toBeInTheDocument();
    const card = within(ficha());
    expect(card.getByText('Member since')).toBeInTheDocument();
    expect(card.getByText(/January 15, 2026/)).toBeInTheDocument(); // fecha en inglés
    expect(screen.getAllByText('Read only')).toHaveLength(2);
    expect(screen.getByText('To change your email, ask the IT team.')).toBeInTheDocument();
    expect(screen.getByText('Client')).toBeInTheDocument();
    expect(screen.getByText('Access level')).toBeInTheDocument();
    expect(screen.queryByText(/Access level · Read only/)).toBeNull();
  });

  it('client sin nombre: "No name on record"', async () => {
    setUser('cli@x.com', 'client');
    mocks.fullName = '';
    await renderPage();
    expect(within(ficha()).getByText('No name on record')).toBeInTheDocument();
  });

  it('admin y Master Dev ven la misma ficha limpia en inglés: sin "Save Changes" ni "Read only"', async () => {
    setUser('persona@x.com', 'admin');
    const { unmount } = render(<ProfilePage />);
    await screen.findByRole('heading', { level: 1 });
    expect(screen.getByText('Access level')).toBeInTheDocument();
    expect(screen.getByText('Administrator')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save Changes' })).toBeNull();
    expect(screen.queryByText('Read only')).toBeNull();
    unmount();

    setUser(MASTER, 'dev');
    render(<ProfilePage />);
    await screen.findByRole('heading', { level: 1 });
    expect(screen.getByText('Access level')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save Changes' })).toBeNull();
    expect(screen.queryByText('Read only')).toBeNull();
  });

  it('el rol Desarrollador se llama Developer', async () => {
    setUser('dev@x.com', 'dev');
    await renderPage();
    expect(screen.getByText('Developer')).toBeInTheDocument();
  });
});
