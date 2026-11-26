import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import i18n from '@/i18n/i18n';
import ChangeEmailDialog from './ChangeEmailDialog';
import { toast } from '@/components/ui/use-toast';

const mocks = vi.hoisted(() => ({ invoke: vi.fn() }));

vi.mock('@/lib/supabase', () => ({
  supabase: { functions: { invoke: (...a) => mocks.invoke(...a) } },
}));
vi.mock('@/components/ui/use-toast', () => ({ toast: vi.fn() }));

const USER = { id: 'u-target', email: 'viejo@x.com', full_name: 'Ana Pérez' };

// Como supabase-js: los errores HTTP llegan como FunctionsHttpError con el Response en `context`
const httpError = (message) => ({ message: 'Edge Function returned a non-2xx status code', context: { json: async () => ({ error: message }) } });

const setup = () => {
  const onClose = vi.fn();
  const onDone = vi.fn();
  render(<ChangeEmailDialog user={USER} onClose={onClose} onDone={onDone} />);
  return { onClose, onDone };
};
const fill = (email = 'nuevo@x.com', reason = 'ya no tiene acceso al correo viejo') => {
  fireEvent.change(screen.getByLabelText('Correo nuevo'), { target: { value: email } });
  fireEvent.change(screen.getByLabelText('Motivo'), { target: { value: reason } });
};
const verify = () => fireEvent.click(screen.getByRole('button', { name: 'Verificar' }));

describe('ChangeEmailDialog', () => {
  beforeEach(() => {
    mocks.invoke.mockReset();
    toast.mockClear();
  });

  it('muestra el correo actual de solo lectura y pide correo nuevo y motivo', () => {
    setup();
    expect(screen.getByRole('dialog', { name: 'Cambiar correo de usuario' })).toBeInTheDocument();
    expect(screen.getByLabelText('Correo actual')).toHaveAttribute('readonly');
    expect(screen.getByLabelText('Correo actual')).toHaveValue('viejo@x.com');
    expect(screen.getByText('Queda registrado en la bitácora junto con tu usuario.')).toBeInTheDocument();
  });

  it('valida en el cliente: correo inválido y motivo corto, sin llamar a la función', () => {
    setup();
    fill('sinarroba', 'ya no tiene acceso');
    verify();
    expect(screen.getByRole('alert')).toHaveTextContent('Escribe un correo válido.');

    fill('nuevo@x.com', 'xx');
    verify();
    expect(screen.getByRole('alert')).toHaveTextContent('El motivo debe tener al menos 5 caracteres.');
    expect(mocks.invoke).not.toHaveBeenCalled();
  });

  it('paso 1 Verificar: simulación (dry_run) y paso 2 Confirmar: cambio real, con el mismo cuerpo', async () => {
    mocks.invoke.mockResolvedValue({ data: { ok: true, old_email: 'viejo@x.com', new_email: 'nuevo@x.com', projects_with_old_email: 0 }, error: null });
    const { onClose, onDone } = setup();
    fill();
    verify();

    await screen.findByRole('button', { name: 'Confirmar cambio' });
    expect(mocks.invoke).toHaveBeenNthCalledWith(1, 'admin-change-user-email', {
      body: { target_user_id: 'u-target', new_email: 'nuevo@x.com', reason: 'ya no tiene acceso al correo viejo', dry_run: true },
    });
    // el resumen muestra lo que se va a hacer
    expect(screen.getByText('viejo@x.com')).toBeInTheDocument();
    expect(screen.getByText('nuevo@x.com')).toBeInTheDocument();
    expect(screen.getByText('ya no tiene acceso al correo viejo')).toBeInTheDocument();
    expect(screen.queryByRole('status')).toBeNull(); // sin proyectos afectados, sin aviso
    expect(onDone).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar cambio' }));
    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
    expect(mocks.invoke).toHaveBeenNthCalledWith(2, 'admin-change-user-email', {
      body: { target_user_id: 'u-target', new_email: 'nuevo@x.com', reason: 'ya no tiene acceso al correo viejo', dry_run: false },
    });
    expect(onClose).toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Correo actualizado' }));
  });

  it('avisa cuántos proyectos mencionan el correo anterior', async () => {
    mocks.invoke.mockResolvedValue({ data: { ok: true, old_email: 'viejo@x.com', new_email: 'nuevo@x.com', projects_with_old_email: 3 }, error: null });
    setup();
    fill();
    verify();
    const warning = await screen.findByRole('status');
    expect(warning).toHaveTextContent('3 proyecto(s) mencionan el correo anterior como texto');
  });

  it('muestra el mensaje que devuelve la función (p. ej. la regla del Master Dev) y no avanza', async () => {
    mocks.invoke.mockResolvedValue({ data: null, error: httpError('El correo del Master Dev esta protegido y no puede cambiarse') });
    setup();
    fill();
    verify();
    expect(await screen.findByRole('alert')).toHaveTextContent('El correo del Master Dev esta protegido');
    expect(screen.queryByRole('button', { name: 'Confirmar cambio' })).toBeNull();
  });

  it('si la petición no llega (red/CORS), lo dice en lugar de un error genérico', async () => {
    mocks.invoke.mockResolvedValue({ data: null, error: { name: 'FunctionsFetchError', message: 'Failed to send a request to the Edge Function' } });
    setup();
    fill();
    verify();
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo contactar el servicio');
    expect(screen.getByRole('alert')).toHaveTextContent('CORS');
  });

  it('si el error no trae cuerpo legible, muestra un mensaje genérico', async () => {
    mocks.invoke.mockResolvedValue({ data: null, error: { message: 'x', context: { json: async () => { throw new Error('no json'); } } } });
    setup();
    fill();
    verify();
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo completar la operación.');
  });

  it('si falla el cambio real, se queda en el resumen con el error y sin cerrar', async () => {
    mocks.invoke
      .mockResolvedValueOnce({ data: { ok: true, old_email: 'viejo@x.com', new_email: 'nuevo@x.com', projects_with_old_email: 0 }, error: null })
      .mockResolvedValueOnce({ data: null, error: httpError('Ese correo ya esta en uso por otra cuenta') });
    const { onClose, onDone } = setup();
    fill();
    verify();
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar cambio' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Ese correo ya esta en uso');
    expect(onDone).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('"Volver" regresa al formulario conservando lo escrito', async () => {
    mocks.invoke.mockResolvedValue({ data: { ok: true, old_email: 'viejo@x.com', new_email: 'nuevo@x.com', projects_with_old_email: 0 }, error: null });
    setup();
    fill();
    verify();
    fireEvent.click(await screen.findByRole('button', { name: 'Volver' }));
    expect(screen.getByLabelText('Correo nuevo')).toHaveValue('nuevo@x.com');
    expect(screen.getByLabelText('Motivo')).toHaveValue('ya no tiene acceso al correo viejo');
  });

  it('se cierra con Escape, con la X y al hacer clic fuera; no con clic dentro', () => {
    const { onClose } = setup();
    fireEvent.click(screen.getByRole('dialog'));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(onClose).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByRole('dialog').parentElement);
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  describe('inglés', () => {
    beforeEach(async () => { await act(async () => { await i18n.changeLanguage('en'); }); });
    afterEach(async () => { await act(async () => { await i18n.changeLanguage('es'); }); });

    it('muestra los textos en inglés', async () => {
      mocks.invoke.mockResolvedValue({ data: { ok: true, old_email: 'viejo@x.com', new_email: 'nuevo@x.com', projects_with_old_email: 2 }, error: null });
      setup();
      expect(screen.getByRole('dialog', { name: 'Change user email' })).toBeInTheDocument();
      fireEvent.change(screen.getByLabelText('New email'), { target: { value: 'nuevo@x.com' } });
      fireEvent.change(screen.getByLabelText('Reason'), { target: { value: 'lost access to old email' } });
      fireEvent.click(screen.getByRole('button', { name: 'Verify' }));
      expect(await screen.findByRole('button', { name: 'Confirm change' })).toBeInTheDocument();
      expect(screen.getByRole('status')).toHaveTextContent('2 project(s) mention the previous email as text');
    });
  });
});
