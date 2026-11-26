import React, { useState } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@/i18n/i18n';
import { StaffEditor } from './formKit';

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('@/lib/supabase', () => ({ supabase: { rpc: (...a) => mocks.rpc(...a) } }));

const PEOPLE = [
  { id: 'u-ana', full_name: 'Ana Pérez', email: 'ana@x.com', job_title: 'TECNICO DE MANTENIMIENTO' },
  { id: 'u-beto', full_name: '', email: 'beto@x.com', job_title: null },
  { id: 'u-cris', full_name: 'Cris Ruiz', email: 'cris@x.com', job_title: 'AUXILIAR OPERATIVO' },
];
const EMPTY = { fullName: '', role: '', email: '', client_id: '', wind_farm_id: '' };

function Harness({ initialList = [], onAdd = vi.fn() }) {
  const [newStaff, setNewStaff] = useState(EMPTY);
  return (
    <>
      <StaffEditor
        idPrefix="t"
        newStaff={newStaff}
        setNewStaff={setNewStaff}
        onAdd={() => onAdd(newStaff)}
        list={initialList}
        onRemove={() => {}}
        companies={[]}
        windFarms={[]}
        emptyHint="vacío"
      />
      <output data-testid="state">{JSON.stringify(newStaff)}</output>
    </>
  );
}
const state = () => JSON.parse(screen.getByTestId('state').textContent);
const personSelect = () => document.getElementById('t-person');

describe('StaffEditor: selector de personal registrado', () => {
  beforeEach(() => mocks.rpc.mockReset());

  it('carga las personas con list_selectable_staff y ya no pide nombre ni correo a mano', async () => {
    mocks.rpc.mockResolvedValue({ data: PEOPLE, error: null });
    render(<Harness />);
    await waitFor(() => expect(personSelect()).not.toBeDisabled());
    expect(mocks.rpc).toHaveBeenCalledWith('list_selectable_staff');
    expect(document.getElementById('t-fullName')).toBeNull();
    // el selector muestra solo el nombre (sin correo); sin nombre en el perfil cae al correo
    expect(screen.getByRole('option', { name: 'Ana Pérez' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'beto@x.com' })).toBeInTheDocument();
    // el correo va en su propio campo, de solo lectura y vacío hasta elegir
    expect(document.getElementById('t-email')).toHaveAttribute('readonly');
    expect(document.getElementById('t-email')).toHaveValue('');
  });

  it('dos personas con el mismo nombre se distinguen con el correo en el selector', async () => {
    mocks.rpc.mockResolvedValue({ data: [
      { id: 'a', full_name: 'Juan López', email: 'juan.a@x.com', job_title: null },
      { id: 'b', full_name: 'Juan López', email: 'juan.b@x.com', job_title: null },
    ], error: null });
    render(<Harness />);
    await waitFor(() => expect(personSelect()).not.toBeDisabled());
    expect(screen.getByRole('option', { name: 'Juan López (juan.a@x.com)' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Juan López (juan.b@x.com)' })).toBeInTheDocument();
  });

  it('al elegir a alguien copia user_id, nombre, correo y arranca el rol con su puesto', async () => {
    mocks.rpc.mockResolvedValue({ data: PEOPLE, error: null });
    render(<Harness />);
    await waitFor(() => expect(personSelect()).not.toBeDisabled());
    fireEvent.change(personSelect(), { target: { value: 'u-ana' } });
    expect(state()).toMatchObject({ user_id: 'u-ana', fullName: 'Ana Pérez', email: 'ana@x.com', role: 'TECNICO DE MANTENIMIENTO' });
    expect(document.getElementById('t-email')).toHaveValue('ana@x.com'); // el correo se pone solo
    fireEvent.change(personSelect(), { target: { value: '' } });
    expect(document.getElementById('t-email')).toHaveValue(''); // y se limpia si se deselecciona
    fireEvent.change(personSelect(), { target: { value: 'u-ana' } });
    // el rol se puede ajustar para el proyecto
    fireEvent.change(document.getElementById('t-role'), { target: { value: 'PILOTO RPAS' } });
    expect(state().role).toBe('PILOTO RPAS');
  });

  it('quien ya está en el equipo (por user_id o por correo) no se ofrece de nuevo', async () => {
    mocks.rpc.mockResolvedValue({ data: PEOPLE, error: null });
    render(<Harness initialList={[
      { id: 1, user_id: 'u-ana', fullName: 'Ana Pérez', email: 'ana@x.com', role: 'R' },
      { id: 2, fullName: 'Histórico', email: 'CRIS@x.com', role: 'R' }, // entrada vieja sin user_id
    ]} />);
    await waitFor(() => expect(personSelect()).not.toBeDisabled());
    expect(screen.queryByRole('option', { name: /Ana Pérez/ })).toBeNull();
    expect(screen.queryByRole('option', { name: /Cris Ruiz/ })).toBeNull();
    expect(screen.getByRole('option', { name: /beto@x.com/ })).toBeInTheDocument();
  });

  it('si la RPC falla, avisa y bloquea el selector', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: 'boom' } });
    render(<Harness />);
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo cargar la lista de personal.');
    expect(personSelect()).toBeDisabled();
  });
});
