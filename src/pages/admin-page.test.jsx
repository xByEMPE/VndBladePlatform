import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within, fireEvent, waitFor, act } from '@testing-library/react';
import AdminPage from './AdminPage';
import { BTN_SUCCESS, BTN_DANGER } from '@/lib/classes';

const mocks = vi.hoisted(() => {
  const rows = {
    user_profiles: [
      { id: 'u1', email: 'ada@x.com', full_name: 'Ada', role: 'admin', is_active: true, created_at: '2026-05-01T00:00:00Z' },
      { id: 'u2', email: 'tec@x.com', role: 'technician', is_active: true, created_at: '2026-05-02T00:00:00Z' },
      { id: 'u3', email: 'cli@x.com', role: 'client', is_active: false, created_at: '2026-05-03T00:00:00Z' },
    ],
    projects: [
      { id: 'p1', name: 'OAXACA 1', wind_farm: 'OAXACA I', client: 'EAOSA', status: 'Completado', turbine_count: 5, created_at: '2026-04-01T00:00:00Z' },
      { id: 'p2', name: 'SEDENA', wind_farm: 'SEDENA', client: 'SEDENA', status: 'En progreso', turbine_count: 3, created_at: '2026-04-02T00:00:00Z' },
      { id: 'p3', name: 'NUEVO', wind_farm: 'N', client: 'C', status: 'Planeación', turbine_count: 0, created_at: '2026-04-03T00:00:00Z' },
    ],
  };
  return {
    rows,
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    update: vi.fn().mockResolvedValue({ error: null }),
    currentEmail: 'enrique.hernandez@bo.vindgroup.com.mx',
    invoke: vi.fn().mockResolvedValue({ data: { ok: true }, error: null }),
  };
});

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (table) => ({
      select: () => ({ order: () => Promise.resolve({ data: mocks.rows[table], error: null }) }),
      update: (values) => ({ eq: (col, val) => mocks.update(table, values, col, val) }),
    }),
    rpc: mocks.rpc,
    functions: { invoke: (...a) => mocks.invoke(...a) },
    auth: { getUser: () => Promise.resolve({ data: { user: { id: 'u1', email: mocks.currentEmail } } }) },
  },
}));
vi.mock('@/components/ui/use-toast', () => ({ toast: vi.fn() }));
vi.mock('@/i18n/tx', () => ({ tx: (s) => s, dateLocale: () => 'es' }));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k, d) => (typeof d === 'string' ? d : k) }),
}));

const read = (rel) => fs.readFileSync(path.resolve(__dirname, rel), 'utf8');
const renderPage = async () => {
  const utils = render(<AdminPage />);
  await screen.findByText('ada@x.com'); // espera a que cargue
  return utils;
};
const rowOf = (email) => screen.getByText(email).closest('tr');

describe('AdminPage: cabecera y estadísticas', () => {
  it('PageHeader: icono en línea con sobretítulo celeste y título blanco sobrio (no el amarillo 4xl)', async () => {
    await renderPage();
    const h1 = screen.getByRole('heading', { level: 1, name: 'Panel de Administración' });
    expect(h1).toHaveClass('text-ink');
    expect(h1.className).not.toMatch(/yellow|text-4xl/);
    const overline = screen.getByText('Gestión de activos eólicos');
    expect(overline).toHaveClass('text-info', 'flex', 'items-center');
    expect(overline.querySelector('svg')).not.toBeNull();
  });

  it('no hay badge de rol en la cabecera', async () => {
    await renderPage();
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(within(h1.parentElement).queryByText(/administrador|técnico|cliente/i)).toBeNull();
  });

  it('4 KPIs en KpiGrid con los valores calculados por la lógica', async () => {
    await renderPage();
    expect(screen.getByText('admin.stats.totalUsers').closest('div[class*="p-5"]')).toHaveTextContent('3');
    expect(screen.getByText('admin.stats.totalProjects').closest('div[class*="p-5"]')).toHaveTextContent('3');
    expect(screen.getByText('admin.stats.activeUsers').closest('div[class*="p-5"]')).toHaveTextContent('2');
    expect(screen.getByText('admin.stats.admins').closest('div[class*="p-5"]')).toHaveTextContent('1');
  });
});

describe('AdminPage: iconos de las tarjetas con su color original', () => {
  it('Total Usuarios en azul y Total Proyectos en verde, como antes', async () => {
    await renderPage();
    const iconOf = (label) => screen.getByText(label).closest('div[class*="p-5"]').querySelector('[aria-hidden="true"]');
    expect(iconOf('admin.stats.totalUsers')).toHaveClass('text-blue-400');
    expect(iconOf('admin.stats.totalProjects')).toHaveClass('text-green-400');
  });

  it('el icono de Usuarios activos (verde salvia) y el de administradores (oro) siguen con los tokens', async () => {
    await renderPage();
    const iconOf = (label) => screen.getByText(label).closest('div[class*="p-5"]').querySelector('[aria-hidden="true"]');
    expect(iconOf('admin.stats.activeUsers')).toHaveClass('text-status-done');
    expect(iconOf('admin.stats.admins')).toHaveClass('text-brand');
  });
});

describe('AdminPage: tabla de usuarios', () => {
  it('una sola columna de rol: el selector se tiñe con el color del rol (admin oro, técnico celeste, cliente verde)', async () => {
    await renderPage();
    const roleSelect = (email) => within(rowOf(email)).getByRole('combobox');
    expect(roleSelect('ada@x.com')).toHaveClass('text-brand', 'bg-brand/10');
    expect(roleSelect('tec@x.com')).toHaveClass('text-info', 'bg-info/10');
    expect(roleSelect('cli@x.com')).toHaveClass('text-status-done', 'bg-status-done/10');
    // ya no hay un segundo selector en la columna de acciones
    expect(within(rowOf('ada@x.com')).getAllByRole('combobox')).toHaveLength(1);
  });

  it('estado activo/inactivo: icono (check verde / equis roja) y color de la letra como estaban', async () => {
    await renderPage();
    const active = within(rowOf('ada@x.com')).getByText('admin.userManagement.status.active');
    expect(active).toHaveClass('text-ink'); // letra clara, no el color del estado
    expect(active.previousElementSibling).toHaveClass('text-green-400'); // icono check original
    expect(active.previousElementSibling.tagName.toLowerCase()).toBe('svg');

    const inactive = within(rowOf('cli@x.com')).getByText('admin.userManagement.status.inactive');
    expect(inactive).toHaveClass('text-ink');
    expect(inactive.previousElementSibling).toHaveClass('text-red-400'); // icono equis original
  });

  it('el estado ya no usa la pastilla StatusBadge en la tabla de usuarios', async () => {
    await renderPage();
    const row = rowOf('cli@x.com');
    expect(within(row).getByText('admin.userManagement.status.inactive')).not.toHaveClass('bg-error-bg');
  });

  it('desactivar usa el vino sobrio y reactivar el verde salvia tenue', async () => {
    await renderPage();
    const deactivate = within(rowOf('ada@x.com')).getByRole('button', { name: 'admin.userManagement.actions.deactivate' });
    expect(deactivate).toHaveClass('bg-error-bg', 'border-error-border', 'text-error-text');
    const activate = within(rowOf('cli@x.com')).getByRole('button', { name: 'admin.userManagement.actions.activate' });
    expect(activate).toHaveClass('bg-status-done/10', 'border-status-done/40', 'text-status-done', 'hover:bg-status-done/25');
    expect(activate.className).not.toMatch(/bg-error-bg/);
  });

  it('BUGFIX: desactivar actualiza user_profiles (supabase.from("user_profiles").update().eq("id", …))', async () => {
    mocks.update.mockClear();
    await renderPage();
    fireEvent.click(within(rowOf('ada@x.com')).getByRole('button', { name: 'admin.userManagement.actions.deactivate' }));
    await waitFor(() => expect(mocks.update).toHaveBeenCalledTimes(1));
    const [table, values, col, val] = mocks.update.mock.calls[0];
    expect(table).toBe('user_profiles');
    expect(values).toMatchObject({ is_active: false });
    expect(col).toBe('id');
    expect(val).toBe('u1');
  });

  it('BUGFIX: reactivar un usuario inactivo envía is_active: true', async () => {
    mocks.update.mockClear();
    await renderPage();
    fireEvent.click(within(rowOf('cli@x.com')).getByRole('button', { name: 'admin.userManagement.actions.activate' }));
    await waitFor(() => expect(mocks.update).toHaveBeenCalledTimes(1));
    expect(mocks.update.mock.calls[0][1]).toMatchObject({ is_active: true });
    expect(mocks.update.mock.calls[0][3]).toBe('u3');
  });

  it('el selector de rol es un menú accesible con foco del color del rol; elegir una opción llama al RPC (lógica intacta)', async () => {
    await renderPage();
    const trigger = within(rowOf('tec@x.com')).getByRole('combobox');
    expect(trigger).toHaveAccessibleName('admin.userManagement.table.role: tec@x.com');
    // el foco toma el color del rol (técnico = celeste), no el dorado fijo
    expect(trigger).toHaveClass('focus:border-info/60', 'focus:ring-info/30');
    expect(trigger.className).not.toMatch(/focus:border-brand/);
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(within(screen.getByRole('listbox')).getByRole('option', { name: /roles\.client/ }));
    await waitFor(() => expect(mocks.rpc).toHaveBeenCalledWith('update_user_role', { target_user_id: 'u2', new_role: 'client' }));
    expect(screen.queryByRole('listbox')).toBeNull(); // se cierra al elegir
  });

  it('el menú de rol se cierra con Escape y al hacer clic fuera', async () => {
    await renderPage();
    const trigger = within(rowOf('tec@x.com')).getByRole('combobox');

    fireEvent.click(trigger);
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).toBeNull();

    fireEvent.click(trigger);
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('Master Dev ve la opción "Desarrollador"; cualquier otro usuario no', async () => {
    // Master (por defecto en el mock)
    const master = await renderPage();
    fireEvent.click(within(rowOf('tec@x.com')).getByRole('combobox'));
    expect(within(screen.getByRole('listbox')).getByRole('option', { name: /roles\.dev/ })).toBeInTheDocument();
    master.unmount();

    // Otro dev: no existe la opción
    mocks.currentEmail = 'otro@x.com';
    mocks.rows.user_profiles[0].role = 'dev'; // la fila actual (u1) es un dev
    try {
      await renderPage();
      fireEvent.click(within(rowOf('tec@x.com')).getByRole('combobox'));
      expect(screen.getByRole('listbox')).toBeInTheDocument();
      expect(within(screen.getByRole('listbox')).queryByRole('option', { name: /roles\.dev/ })).toBeNull();
    } finally {
      mocks.rows.user_profiles[0].role = 'admin';
      mocks.currentEmail = 'enrique.hernandez@bo.vindgroup.com.mx';
    }
  });

  it('la búsqueda filtra y el estado vacío usa EmptyState', async () => {
    await renderPage();
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'zzzz' } });
    expect(await screen.findByText('admin.userManagement.noUsersFound')).toBeInTheDocument();
    expect(screen.queryByText('ada@x.com')).toBeNull();
  });

  it('el filtro por rol es un menú propio, incluye "Desarrollador" y filtra la tabla', async () => {
    await renderPage();
    const trigger = screen.getByLabelText('admin.userManagement.filterByRole');
    expect(trigger.tagName).toBe('BUTTON'); // ya no es un <select> nativo
    fireEvent.click(trigger);
    const list = within(screen.getByRole('listbox'));
    expect(list.getByRole('option', { name: /roles\.dev/ })).toBeInTheDocument();
    fireEvent.click(list.getByRole('option', { name: /roles\.client/ }));
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(screen.queryByText('ada@x.com')).toBeNull();
    expect(screen.getByText('cli@x.com')).toBeInTheDocument();
  });
});

describe('AdminPage: tabla de usuarios', () => {
  it('Configuración ya no muestra el resumen de proyectos', async () => {
    await renderPage();
    expect(screen.queryByText('Completado')).toBeNull();
    expect(screen.queryByText('admin.projectSummary.title')).toBeNull();
  });

  it('fila bloqueada (no eres Master Dev y es tu propia fila): chip RoleChip en solo lectura, sin selector', async () => {
    mocks.currentEmail = 'otro@x.com';
    try {
      await renderPage();
      const row = rowOf('ada@x.com');
      expect(within(row).queryByRole('combobox')).toBeNull();
      const chip = row.querySelector('[data-role="admin"]');
      expect(chip).not.toBeNull();
      expect(chip).toHaveClass('rounded-full', 'border');
    } finally {
      mocks.currentEmail = 'enrique.hernandez@bo.vindgroup.com.mx';
    }
  });
});

describe('AdminPage: cambio de correo asistido por dev', () => {
  const MASTER_ROW = { id: 'u-master', email: 'enrique.hernandez@bo.vindgroup.com.mx', full_name: 'Enrique', role: 'dev', is_active: true, created_at: '2026-05-04T00:00:00Z' };
  const changeBtn = (email) => within(rowOf(email)).getByRole('button', { name: 'Cambiar correo' });

  const hasChangeBtn = (email) => within(rowOf(email)).queryByRole('button', { name: 'Cambiar correo' }) !== null;

  it('"Cambiar correo" aparece SOLO en las filas client (abre el diálogo con su correo)', async () => {
    mocks.rows.user_profiles.push(MASTER_ROW);
    try {
      await renderPage();
      // client: sí
      const btn = changeBtn('cli@x.com');
      expect(btn).toBeEnabled();
      expect(btn).toHaveClass('text-info', 'bg-info/10'); // receta BTN_INFO (azul)
      // admin (ada, la cuenta actual), technician y dev (Master): no hay botón
      expect(hasChangeBtn('ada@x.com')).toBe(false);
      expect(hasChangeBtn('tec@x.com')).toBe(false);
      expect(hasChangeBtn(MASTER_ROW.email)).toBe(false);
      expect(screen.getAllByRole('button', { name: 'Cambiar correo' })).toHaveLength(1);

      fireEvent.click(btn);
      const dialog = await screen.findByRole('dialog', { name: 'Cambiar correo de usuario' });
      expect(within(dialog).getByLabelText('Correo actual')).toHaveValue('cli@x.com');
    } finally {
      mocks.rows.user_profiles.pop();
    }
  });

  it('un usuario que pasa a ser client recibe el botón (depende del rol, no de la fila)', async () => {
    const original = mocks.rows.user_profiles[1].role; // tec@x.com
    mocks.rows.user_profiles[1].role = 'client';
    try {
      await renderPage();
      expect(hasChangeBtn('tec@x.com')).toBe(true);
    } finally {
      mocks.rows.user_profiles[1].role = original;
    }
  });

  it('al terminar el cambio se recarga la tabla y se cierra el diálogo', async () => {
    mocks.invoke.mockResolvedValue({ data: { ok: true, old_email: 'cli@x.com', new_email: 'cli.nuevo@x.com', projects_with_old_email: 0 }, error: null });
    await renderPage();
    fireEvent.click(changeBtn('cli@x.com'));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Correo nuevo'), { target: { value: 'cli.nuevo@x.com' } });
    fireEvent.change(within(dialog).getByLabelText('Motivo'), { target: { value: 'cambio de correo corporativo' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Verificar' }));
    fireEvent.click(await within(dialog).findByRole('button', { name: 'Confirmar cambio' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(mocks.invoke).toHaveBeenLastCalledWith('admin-change-user-email', {
      body: { target_user_id: 'u3', new_email: 'cli.nuevo@x.com', reason: 'cambio de correo corporativo', dry_run: false },
    });
  });

  it('si la base rechaza el cambio (p. ej. la cuenta ya no es client) se muestra su mensaje en el diálogo', async () => {
    mocks.invoke.mockResolvedValue({
      data: null,
      error: { message: 'non-2xx', context: { json: async () => ({ error: 'Solo se puede cambiar el correo de cuentas client por esta via' }) } },
    });
    await renderPage();
    fireEvent.click(changeBtn('cli@x.com'));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Correo nuevo'), { target: { value: 'otro@x.com' } });
    fireEvent.change(within(dialog).getByLabelText('Motivo'), { target: { value: 'cambio de correo corporativo' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Verificar' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Solo se puede cambiar el correo de cuentas client');
    expect(screen.queryByRole('button', { name: 'Confirmar cambio' })).toBeNull();
  });
});

describe('AdminPage: activar/desactivar cuentas dev (solo el Master Dev; nadie la propia)', () => {
  const DEV_ROW = { id: 'u-dev2', email: 'dev2@x.com', full_name: 'Dev Dos', role: 'dev', is_active: true, created_at: '2026-05-05T00:00:00Z' };
  const toggleBtn = (email, name = 'admin.userManagement.actions.deactivate') => within(rowOf(email)).getByRole('button', { name });
  const SELF = 'Nadie puede desactivar su propia cuenta dev';
  const ONLY_MASTER = 'Solo el Master Dev puede activar o desactivar cuentas dev';

  it('el Master Dev puede desactivar a OTRO dev', async () => {
    mocks.rows.user_profiles.push(DEV_ROW);
    mocks.update.mockClear();
    try {
      await renderPage(); // el usuario actual es el Master (id u1)
      const btn = toggleBtn(DEV_ROW.email);
      expect(btn).toBeEnabled();
      fireEvent.click(btn);
      await waitFor(() => expect(mocks.update).toHaveBeenCalledTimes(1));
      expect(mocks.update.mock.calls[0]).toEqual(['user_profiles', expect.objectContaining({ is_active: false }), 'id', 'u-dev2']);
    } finally {
      mocks.rows.user_profiles.pop();
    }
  });

  it('nadie puede desactivar su propia cuenta dev, ni siquiera el Master Dev', async () => {
    mocks.rows.user_profiles[0].role = 'dev'; // la fila actual (u1) es dev
    mocks.update.mockClear();
    try {
      await renderPage();
      const btn = toggleBtn('ada@x.com');
      expect(btn).toBeDisabled();
      expect(btn).toHaveAttribute('title', SELF);
      fireEvent.click(btn);
      await act(async () => {});
      expect(mocks.update).not.toHaveBeenCalled();
    } finally {
      mocks.rows.user_profiles[0].role = 'admin';
    }
  });

  it('un dev que NO es el Master no desactiva ni reactiva a otros dev (botón deshabilitado con su motivo)', async () => {
    mocks.currentEmail = 'otro.dev@x.com';
    mocks.rows.user_profiles[0].role = 'dev';
    mocks.rows.user_profiles.push(DEV_ROW, { ...DEV_ROW, id: 'u-dev3', email: 'dev3@x.com', is_active: false });
    mocks.update.mockClear();
    try {
      await renderPage();
      const off = toggleBtn(DEV_ROW.email);
      expect(off).toBeDisabled();
      expect(off).toHaveAttribute('title', ONLY_MASTER);
      const on = toggleBtn('dev3@x.com', 'admin.userManagement.actions.activate'); // reactivar también es del Master
      expect(on).toBeDisabled();
      expect(on).toHaveAttribute('title', ONLY_MASTER);
      fireEvent.click(off);
      fireEvent.click(on);
      await act(async () => {});
      expect(mocks.update).not.toHaveBeenCalled();
    } finally {
      mocks.rows.user_profiles.pop();
      mocks.rows.user_profiles.pop();
      mocks.rows.user_profiles[0].role = 'admin';
      mocks.currentEmail = 'enrique.hernandez@bo.vindgroup.com.mx';
    }
  });

  it('un dev que no es el Master tampoco puede desactivar su propia cuenta (mensaje específico)', async () => {
    mocks.currentEmail = 'otro.dev@x.com';
    mocks.rows.user_profiles[0].role = 'dev';
    try {
      await renderPage();
      const btn = toggleBtn('ada@x.com');
      expect(btn).toBeDisabled();
      expect(btn).toHaveAttribute('title', SELF);
    } finally {
      mocks.rows.user_profiles[0].role = 'admin';
      mocks.currentEmail = 'enrique.hernandez@bo.vindgroup.com.mx';
    }
  });

  it('las cuentas que no son dev se siguen activando/desactivando como antes (incluso por un dev no Master)', async () => {
    mocks.currentEmail = 'otro.dev@x.com';
    mocks.rows.user_profiles[0].role = 'dev';
    mocks.update.mockClear();
    try {
      await renderPage();
      const btn = toggleBtn('tec@x.com');
      expect(btn).toBeEnabled();
      fireEvent.click(btn);
      await waitFor(() => expect(mocks.update).toHaveBeenCalledTimes(1));
      expect(mocks.update.mock.calls[0][3]).toBe('u2');
    } finally {
      mocks.rows.user_profiles[0].role = 'admin';
      mocks.currentEmail = 'enrique.hernandez@bo.vindgroup.com.mx';
    }
  });
});

describe('AdminPage: un admin (no dev) gestiona usuarios como un dev no Master, sin tocar cuentas dev', () => {
  const DEV_ROW = { id: 'u-dev9', email: 'dev9@x.com', full_name: 'Dev Nueve', role: 'dev', is_active: true, created_at: '2026-05-05T00:00:00Z' };

  it('cambia el rol y el estado de technician y client, y cambia el correo de client', async () => {
    mocks.currentEmail = 'ada@x.com'; // fila u1 = admin, no es el Master
    mocks.update.mockClear();
    mocks.rpc.mockClear();
    try {
      await renderPage();
      expect(screen.getByRole('button', { name: 'Cambiar correo' })).toBeInTheDocument(); // solo la fila client
      fireEvent.click(within(rowOf('tec@x.com')).getByRole('combobox'));
      expect(within(screen.getByRole('listbox')).queryByRole('option', { name: /roles\.dev/ })).toBeNull();
      fireEvent.click(within(screen.getByRole('listbox')).getByRole('option', { name: /roles\.client/ }));
      await waitFor(() => expect(mocks.rpc).toHaveBeenCalledWith('update_user_role', { target_user_id: 'u2', new_role: 'client' }));

      fireEvent.click(within(rowOf('tec@x.com')).getByRole('button', { name: 'admin.userManagement.actions.deactivate' }));
      await waitFor(() => expect(mocks.update).toHaveBeenCalledTimes(1));
      expect(mocks.update.mock.calls[0]).toEqual(['user_profiles', expect.objectContaining({ is_active: false }), 'id', 'u2']);
    } finally {
      mocks.currentEmail = 'enrique.hernandez@bo.vindgroup.com.mx';
    }
  });

  it('las cuentas dev quedan bloqueadas (sin menú de rol y con el estado deshabilitado) y no se escribe nada', async () => {
    mocks.currentEmail = 'ada@x.com';
    mocks.rows.user_profiles.push(DEV_ROW);
    mocks.update.mockClear();
    mocks.rpc.mockClear();
    try {
      await renderPage();
      const row = rowOf('dev9@x.com');
      expect(within(row).queryByRole('combobox')).toBeNull();
      const off = within(row).getByRole('button', { name: 'admin.userManagement.actions.deactivate' });
      expect(off).toBeDisabled();
      fireEvent.click(off);
      await act(async () => {});
      expect(mocks.update).not.toHaveBeenCalled();
      expect(mocks.rpc).not.toHaveBeenCalled();
    } finally {
      mocks.rows.user_profiles.pop();
      mocks.currentEmail = 'enrique.hernandez@bo.vindgroup.com.mx';
    }
  });
});

describe('contratos', () => {
  it('BTN_SUCCESS es la receta de rojos y amarillos en verde salvia', () => {
    expect(BTN_SUCCESS).toContain('border-status-done/40');
    expect(BTN_SUCCESS).toContain('bg-status-done/10');
    expect(BTN_SUCCESS).toContain('hover:bg-status-done/25');
    expect(BTN_DANGER).toContain('hover:bg-error-border/40');
  });

  it('la lógica de datos de la página sigue intacta (RPC y tablas)', () => {
    const src = read('./AdminPage.jsx');
    expect(src).toContain('supabase.rpc("update_user_role"');
    expect(src).toContain('.from("user_profiles")');
    expect(src).toContain('.from("projects")');
  });
});
