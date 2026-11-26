import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act, within } from '@testing-library/react';
import i18n from '@/i18n/i18n';
import AuditLogsPage from './AuditLogsPage';
import { toast } from '@/components/ui/use-toast';

const mocks = vi.hoisted(() => ({ calls: [], total: 250, action: 'INSERT', reason: null }));

const makeLogs = (from, to, total) =>
  Array.from({ length: to - from + 1 }, (_, i) => ({
    id: String(from + i),
    user_id: null,
    user_role: 'dev',
    action: mocks.action,
    table_name: 'public.projects',
    record_id: `r${from + i}`,
    created_at: '2026-11-24T10:00:00Z',
    old_data: null,
    new_data: { n: from + i },
    metadata: {
      actor_email: 'quien@x.com',
      txid: 777,
      ...(mocks.reason
        ? { reason: mocks.reason, request_id: 'f7dc4754-1111-2222-3333-444455556666', target_email: 'viejo@x.com' }
        : {}),
    },
    total,
  }));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () =>
        Promise.resolve({
          data: [
            { id: 'u-zoe', email: 'zoe@x.com', full_name: 'Zoe Ruiz' },
            { id: 'u-ana', email: 'ana@x.com', full_name: 'Ana Pérez' },
            { id: 'u-sin', email: 'sin@x.com', full_name: null }, // sin nombre: se muestra el correo
          ],
          error: null,
        }),
    }),
    // El servidor filtra, pagina y cuenta: la página solo pinta lo que devuelven estas funciones.
    rpc: (name, params) => {
      mocks.calls.push({ name, params });
      if (name === 'audit_logs_search') {
        const from = params.p_offset;
        const to = Math.min(from + params.p_limit - 1, mocks.total - 1);
        return Promise.resolve({ data: makeLogs(from, to, mocks.total), error: null });
      }
      if (name === 'audit_logs_stats') {
        return Promise.resolve({ data: [{ total: mocks.total, inserts: 200, updates: 40, deletes: 10 }], error: null });
      }
      if (name === 'audit_logs_tables') return Promise.resolve({ data: ['public.projects'], error: null });
      return Promise.resolve({ data: null, error: null });
    },
  },
}));
vi.mock('@/components/ui/use-toast', () => ({ toast: vi.fn() }));
vi.mock('react-helmet', () => ({ Helmet: () => null }));

const searchCalls = () => mocks.calls.filter((c) => c.name === 'audit_logs_search');

describe('AuditLogsPage: servidor (paginación, KPIs y búsqueda)', () => {
  beforeEach(() => {
    mocks.calls.length = 0;
  });

  it('pagina de 100 en 100 con p_offset y "Cargar más" agrega las siguientes', async () => {
    render(<AuditLogsPage />);
    await screen.findByText('100 de 250 registros cargados');
    expect(searchCalls()[0].params).toMatchObject({ p_limit: 100, p_offset: 0 });

    fireEvent.click(screen.getByRole('button', { name: /Cargar más/ }));
    await screen.findByText('200 de 250 registros cargados');
    expect(searchCalls()[1].params).toMatchObject({ p_offset: 100 });

    fireEvent.click(screen.getByRole('button', { name: /Cargar más/ }));
    await screen.findByText('250 de 250 registros cargados');
    expect(searchCalls()[2].params).toMatchObject({ p_offset: 200 });

    await waitFor(() => expect(screen.queryByRole('button', { name: /Cargar más/ })).toBeNull());
    expect(screen.getByText('Se cargaron todos los registros del periodo.')).toBeInTheDocument();
  });

  it('los KPIs son exactos (vienen del servidor), no "100+"', async () => {
    render(<AuditLogsPage />);
    await screen.findByText('100 de 250 registros cargados');
    expect(screen.getByText('250')).toBeInTheDocument();
    expect(screen.getByText('200')).toBeInTheDocument();
    expect(screen.getByText('40')).toBeInTheDocument();
    expect(screen.queryByText('100+')).toBeNull();
  });

  it('la búsqueda se envía al servidor (con espera) y reinicia la lista en la página 0', async () => {
    render(<AuditLogsPage />);
    await screen.findByText('100 de 250 registros cargados');
    const before = searchCalls().length;

    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'abc-123' } });
    await waitFor(() => expect(searchCalls().length).toBeGreaterThan(before));
    const last = searchCalls().at(-1).params;
    expect(last).toMatchObject({ p_query: 'abc-123', p_offset: 0 });
  });

  it('el filtro de acción se envía al servidor e incluye los eventos de autenticación', async () => {
    render(<AuditLogsPage />);
    await screen.findByText('100 de 250 registros cargados');
    expect(screen.getByRole('option', { name: 'Inicio de sesión' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Cambio de contraseña' })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Acción'), { target: { value: 'LOGIN' } });
    await waitFor(() => expect(searchCalls().at(-1).params).toMatchObject({ p_action: 'LOGIN' }));
  });

  it('detalle: muestra valor anterior vs nuevo (JSON); "Historial del registro" filtra por tabla + record_id y se puede quitar', async () => {
    render(<AuditLogsPage />);
    await screen.findByText('100 de 250 registros cargados');

    fireEvent.click(screen.getAllByRole('button', { name: 'Ver diff' })[0]);
    expect(screen.getByText('Valor Anterior (old_data)')).toBeInTheDocument();
    expect(screen.getByText('Valor Nuevo (new_data)')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Campos' })).toBeNull(); // sin pestañas
    fireEvent.click(screen.getByRole('button', { name: 'Historial del registro' }));

    await waitFor(() =>
      expect(searchCalls().at(-1).params).toMatchObject({ p_table: 'public.projects', p_record: 'r0' }),
    );
    expect(screen.getByRole('status')).toHaveTextContent('Historial del registro');
    expect(screen.queryByText('Detalle de Evento', { exact: false })).toBeNull(); // el modal se cerró

    fireEvent.click(screen.getByRole('button', { name: 'Quitar filtro' }));
    await waitFor(() => expect(searchCalls().at(-1).params.p_record).toBeUndefined());
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('detalle: "Ver transacción" filtra por txid', async () => {
    render(<AuditLogsPage />);
    await screen.findByText('100 de 250 registros cargados');

    fireEvent.click(screen.getAllByRole('button', { name: 'Ver diff' })[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Ver transacción' }));

    await waitFor(() => expect(searchCalls().at(-1).params).toMatchObject({ p_txid: '777' }));
    expect(screen.getByRole('status')).toHaveTextContent('transacción');
  });

  describe('exportar desde el servidor', () => {
    beforeEach(() => {
      URL.createObjectURL = vi.fn(() => 'blob:test');
      URL.revokeObjectURL = vi.fn();
      vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
      toast.mockClear();
    });

    it('descarga TODO lo filtrado (no solo lo cargado) pidiendo páginas de 500 al servidor', async () => {
      mocks.total = 1200;
      render(<AuditLogsPage />);
      await screen.findByText('100 de 1200 registros cargados');
      const before = searchCalls().length;

      fireEvent.click(screen.getByRole('button', { name: /Exportar/ }));
      fireEvent.click(screen.getByRole('menuitem', { name: /CSV/ }));

      await waitFor(() => expect(URL.createObjectURL).toHaveBeenCalledTimes(1));
      const exportCalls = searchCalls().slice(before).map((c) => [c.params.p_offset, c.params.p_limit]);
      expect(exportCalls).toEqual([[0, 500], [500, 500], [1000, 500]]);
      const blob = URL.createObjectURL.mock.calls[0][0];
      expect(blob.size).toBeGreaterThan(0);
      expect(toast).not.toHaveBeenCalled(); // no se truncó
      mocks.total = 250;
    });

    it('con más registros que el tope exporta el tope y avisa cuántos quedaron fuera', async () => {
      mocks.total = 12000;
      render(<AuditLogsPage />);
      await screen.findByText('100 de 12000 registros cargados');

      fireEvent.click(screen.getByRole('button', { name: /Exportar/ }));
      fireEvent.click(screen.getByRole('menuitem', { name: /Markdown/ }));

      await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Exportación parcial' })));
      expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
      mocks.total = 250;
    });
  });

  describe('opciones de los filtros (Usuario y Tabla)', () => {
    // La app arranca dentro de <React.StrictMode> (src/main.jsx): en desarrollo ejecuta los efectos dos veces.
    // Antes, la 2.ª ejecución descartaba la respuesta de la 1.ª y los selectores quedaban vacíos.
    it('se llenan aunque la página se monte dos veces (StrictMode)', async () => {
      render(
        <React.StrictMode>
          <AuditLogsPage />
        </React.StrictMode>,
      );
      await screen.findByText('100 de 250 registros cargados');
      await waitFor(() => {
        expect(within(screen.getByLabelText('Usuario')).getAllByRole('option').map((o) => o.textContent)).toEqual([
          'Todos los usuarios', 'Ana Pérez', 'sin@x.com', 'Zoe Ruiz',
        ]);
      });
      expect(within(screen.getByLabelText('Tabla')).getAllByRole('option').map((o) => o.textContent)).toEqual([
        'Todas las tablas', 'projects',
      ]);
    });

    it('las opciones se piden una sola vez: cambiar filtros no las vuelve a pedir ni las vacía', async () => {
      render(<AuditLogsPage />);
      await screen.findByText('100 de 250 registros cargados');
      await waitFor(() => expect(within(screen.getByLabelText('Usuario')).getAllByRole('option')).toHaveLength(4));
      const tablesCalls = () => mocks.calls.filter((c) => c.name === 'audit_logs_tables').length;
      expect(tablesCalls()).toBe(1);

      // varios cambios de filtro seguidos
      fireEvent.click(screen.getByRole('button', { name: 'General' }));
      fireEvent.change(screen.getByLabelText('Acción'), { target: { value: 'UPDATE' } });
      fireEvent.change(screen.getByLabelText('Usuario'), { target: { value: 'u-ana' } });
      await waitFor(() => expect(searchCalls().at(-1).params).toMatchObject({ p_action: 'UPDATE', p_user: 'u-ana' }));

      expect(tablesCalls()).toBe(1);
      expect(within(screen.getByLabelText('Usuario')).getAllByRole('option')).toHaveLength(4);
      expect(within(screen.getByLabelText('Tabla')).getAllByRole('option')).toHaveLength(2);
    });

    it('"Actualizar" vuelve a pedir usuarios y tablas', async () => {
      render(<AuditLogsPage />);
      await screen.findByText('100 de 250 registros cargados');
      const before = mocks.calls.filter((c) => c.name === 'audit_logs_tables').length;
      fireEvent.click(screen.getByRole('button', { name: 'Actualizar' }));
      await waitFor(() => expect(mocks.calls.filter((c) => c.name === 'audit_logs_tables').length).toBeGreaterThan(before));
    });
  });

  describe('eventos de cambio de correo asistido por dev', () => {
    afterEach(async () => {
      mocks.action = 'INSERT';
      await act(async () => { await i18n.changeLanguage('es'); });
    });

    it('el filtro de acción los incluye y viajan al servidor', async () => {
      render(<AuditLogsPage />);
      await screen.findByText('100 de 250 registros cargados');
      const options = within(screen.getByLabelText('Acción')).getAllByRole('option').map((o) => o.textContent);
      expect(options).toEqual(expect.arrayContaining(['Cambio de correo: solicitado', 'Cambio de correo', 'Cambio de correo: falló']));

      fireEvent.change(screen.getByLabelText('Acción'), { target: { value: 'EMAIL_CHANGE' } });
      await waitFor(() => expect(searchCalls().at(-1).params).toMatchObject({ p_action: 'EMAIL_CHANGE' }));
    });

    it.each([
      ['EMAIL_CHANGE_REQUESTED', 'CORREO: SOLICITADO'],
      ['EMAIL_CHANGE', 'CAMBIO DE CORREO'],
      ['EMAIL_CHANGE_FAILED', 'CORREO: FALLÓ'],
    ])('%s se muestra con su etiqueta "%s" y no con el código técnico', async (action, label) => {
      mocks.action = action;
      render(<AuditLogsPage />);
      await screen.findByText('100 de 250 registros cargados');
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
      expect(screen.queryByText(action)).toBeNull();
    });

    it('en inglés: etiquetas y opciones traducidas', async () => {
      mocks.action = 'EMAIL_CHANGE';
      render(<AuditLogsPage />);
      await screen.findByText('100 de 250 registros cargados');
      await act(async () => { await i18n.changeLanguage('en'); });
      expect(screen.getAllByText('EMAIL CHANGE').length).toBeGreaterThan(0);
      expect(within(screen.getByLabelText('Action')).getByRole('option', { name: 'Email change: requested' })).toBeInTheDocument();
      expect(within(screen.getByLabelText('Action')).getByRole('option', { name: 'Email change: failed' })).toBeInTheDocument();
    });
  });

  describe('motivo del cambio de correo', () => {
    const REASON = 'el cliente ya no tiene acceso a su correo anterior';
    beforeEach(() => {
      mocks.action = 'EMAIL_CHANGE';
      mocks.reason = REASON;
    });
    afterEach(async () => {
      mocks.action = 'INSERT';
      mocks.reason = null;
      await act(async () => { await i18n.changeLanguage('es'); });
    });

    it('se ve en la fila (columna de campos afectados) sin abrir el detalle', async () => {
      render(<AuditLogsPage />);
      await screen.findByText('100 de 250 registros cargados');
      const rows = screen.getAllByText(REASON);
      expect(rows.length).toBeGreaterThan(0);
      const cell = rows[0].closest('td');
      expect(within(cell).getByText('Motivo:')).toBeInTheDocument();
      expect(within(cell).getByText('n')).toBeInTheDocument(); // los campos afectados siguen visibles junto al motivo
    });

    it('en el detalle sale destacado, con el ID de solicitud y el correo afectado', async () => {
      render(<AuditLogsPage />);
      await screen.findByText('100 de 250 registros cargados');
      fireEvent.click(screen.getAllByRole('button', { name: 'Ver diff' })[0]);
      const note = screen.getByRole('note');
      expect(within(note).getByText('Motivo del cambio')).toBeInTheDocument();
      expect(within(note).getByText(REASON)).toBeInTheDocument();
      expect(note).toHaveClass('bg-brand/10');
      expect(screen.getByText('ID de solicitud:')).toBeInTheDocument();
      expect(screen.getByText('f7dc4754…')).toBeInTheDocument();
      expect(screen.getByText('Correo afectado:')).toBeInTheDocument();
      expect(screen.getByText('viejo@x.com')).toBeInTheDocument();
    });

    it('los eventos sin motivo no muestran ni la línea ni el recuadro', async () => {
      mocks.reason = null;
      render(<AuditLogsPage />);
      await screen.findByText('100 de 250 registros cargados');
      expect(screen.queryByText('Motivo:')).toBeNull();
      fireEvent.click(screen.getAllByRole('button', { name: 'Ver diff' })[0]);
      expect(screen.queryByRole('note')).toBeNull();
    });

    it('en inglés: "Reason:", "Reason for the change", "Request ID:" y "Affected email:"', async () => {
      render(<AuditLogsPage />);
      await screen.findByText('100 de 250 registros cargados');
      await act(async () => { await i18n.changeLanguage('en'); });
      expect(screen.getAllByText('Reason:').length).toBeGreaterThan(0);
      fireEvent.click(screen.getAllByRole('button', { name: 'View diff' })[0]);
      expect(within(screen.getByRole('note')).getByText('Reason for the change')).toBeInTheDocument();
      expect(screen.getByText('Request ID:')).toBeInTheDocument();
      expect(screen.getByText('Affected email:')).toBeInTheDocument();
    });
  });

  describe('filtro por usuario (nombre)', () => {
    it('lista los usuarios por nombre (o correo si no tienen) ordenados, y filtra en el servidor', async () => {
      render(<AuditLogsPage />);
      await screen.findByText('100 de 250 registros cargados');

      const select = screen.getByLabelText('Usuario');
      const labels = within(select).getAllByRole('option').map((o) => o.textContent);
      expect(labels).toEqual(['Todos los usuarios', 'Ana Pérez', 'sin@x.com', 'Zoe Ruiz']);

      fireEvent.change(select, { target: { value: 'u-ana' } });
      await waitFor(() => expect(searchCalls().at(-1).params).toMatchObject({ p_user: 'u-ana', p_offset: 0 }));
      // los KPIs también siguen al usuario
      const statsCall = mocks.calls.filter((c) => c.name === 'audit_logs_stats').at(-1);
      expect(statsCall.params).toMatchObject({ p_user: 'u-ana' });

      fireEvent.change(select, { target: { value: 'ALL' } });
      await waitFor(() => expect(searchCalls().at(-1).params.p_user).toBeNull());
    });

    it('la exportación respeta el usuario elegido y lo indica en el encabezado del Markdown', async () => {
      URL.createObjectURL = vi.fn(() => 'blob:test');
      URL.revokeObjectURL = vi.fn();
      vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
      mocks.total = 250;
      render(<AuditLogsPage />);
      await screen.findByText('100 de 250 registros cargados');

      fireEvent.change(screen.getByLabelText('Usuario'), { target: { value: 'u-zoe' } });
      await waitFor(() => expect(searchCalls().at(-1).params).toMatchObject({ p_user: 'u-zoe' }));
      const before = searchCalls().length;

      fireEvent.click(screen.getByRole('button', { name: /Exportar/ }));
      fireEvent.click(screen.getByRole('menuitem', { name: /Markdown/ }));
      await waitFor(() => expect(URL.createObjectURL).toHaveBeenCalledTimes(1));

      const exportCall = searchCalls().slice(before)[0];
      expect(exportCall.params).toMatchObject({ p_user: 'u-zoe', p_limit: 500, p_offset: 0 });
      const text = await URL.createObjectURL.mock.calls[0][0].text();
      expect(text).toContain('Usuario: Zoe Ruiz');
    });

    it('en inglés el selector dice User / All users', async () => {
      render(<AuditLogsPage />);
      await screen.findByText('100 de 250 registros cargados');
      await act(async () => { await i18n.changeLanguage('en'); });
      try {
        expect(screen.getByLabelText('User')).toBeInTheDocument();
        expect(screen.getByRole('option', { name: 'All users' })).toBeInTheDocument();
      } finally {
        await act(async () => { await i18n.changeLanguage('es'); });
      }
    });
  });

  describe('inglés', () => {
    afterEach(async () => {
      await act(async () => { await i18n.changeLanguage('es'); });
    });

    it('la página, los filtros, el selector y la exportación se muestran en inglés al cambiar de idioma', async () => {
      render(<AuditLogsPage />);
      await screen.findByText('100 de 250 registros cargados');
      expect(screen.getByRole('heading', { level: 1, name: 'Auditoría y Registros' })).toBeInTheDocument();

      await act(async () => { await i18n.changeLanguage('en'); }); // sin recargar: reacciona al cambio
      expect(screen.getByRole('heading', { level: 1, name: 'Audit and Records' })).toBeInTheDocument();
      expect(screen.getByText('100 of 250 records loaded')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Today' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'General' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Login' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Password change' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Load more/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Export/ })).toBeInTheDocument();
      expect(screen.getByText("Today's Events")).toBeInTheDocument();
    });
  });

  it('muestra el correo del momento del evento (metadata.actor_email) como actor', async () => {
    render(<AuditLogsPage />);
    await screen.findByText('100 de 250 registros cargados');
    expect(screen.getAllByText('quien@x.com').length).toBeGreaterThan(0);
  });
});
