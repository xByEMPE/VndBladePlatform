import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useProjectMapData } from './useProjectMapData';

const rpc = vi.hoisted(() => vi.fn());
vi.mock('@/pages/shared/data/mapData', () => ({ getProjectMapData: rpc }));

const ROWS = [{ turbine_id: 'a', max_severity: 3, damage_count: 2, gps_samples: 10, est_lat: 1, est_lon: 2 }];

beforeEach(() => {
  // Con llaves: devolver el mock haría que vitest lo ejecute como función de limpieza.
  rpc.mockReset();
});

describe('useProjectMapData', () => {
  it('no consulta si está deshabilitado (proyectos LPS) o no hay proyecto', () => {
    const { result } = renderHook(() => useProjectMapData('p1', false));
    renderHook(() => useProjectMapData(null, true));
    expect(rpc).not.toHaveBeenCalled();
    expect(result.current).toMatchObject({ rows: null, loading: false, error: null });
  });

  it('carga las filas de la RPC con el id del proyecto', async () => {
    rpc.mockResolvedValue({ data: ROWS, error: null });
    const { result } = renderHook(() => useProjectMapData('p1', true));
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(rpc).toHaveBeenCalledWith('p1');
    expect(result.current.rows).toEqual(ROWS);
    expect(result.current.error).toBeNull();
  });

  it('un error de la RPC no lanza: queda en `error` y se puede reintentar', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'permission denied' } });
    const { result } = renderHook(() => useProjectMapData('p1', true));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeTruthy();
    expect(result.current.rows).toBeNull();

    rpc.mockResolvedValueOnce({ data: ROWS, error: null });
    await act(async () => {
      await result.current.reload();
    });
    expect(result.current.error).toBeNull();
    expect(result.current.rows).toEqual(ROWS);
  });

  it('una excepción de red tampoco lanza', async () => {
    rpc.mockRejectedValue(new Error('Failed to fetch'));
    const { result } = renderHook(() => useProjectMapData('p1', true));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeTruthy();
    expect(result.current.error.message).toBe('Failed to fetch');
    expect(result.current.rows).toBeNull();
  });

  it('vuelve a consultar cuando cambia el proyecto o la clave de refresco', async () => {
    rpc.mockResolvedValue({ data: ROWS, error: null });
    const { result, rerender } = renderHook(({ id, key }) => useProjectMapData(id, true, key), {
      initialProps: { id: 'p1', key: 1 },
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    rerender({ id: 'p1', key: 2 });
    await waitFor(() => expect(rpc).toHaveBeenCalledTimes(2));
    rerender({ id: 'p2', key: 2 });
    await waitFor(() => expect(rpc).toHaveBeenCalledTimes(3));
    expect(rpc).toHaveBeenLastCalledWith('p2');
  });

  it('una respuesta tardía de un proyecto anterior no pisa la del actual', async () => {
    let resolveFirst;
    rpc.mockImplementationOnce(() => new Promise((r) => (resolveFirst = r)));
    rpc.mockResolvedValueOnce({ data: [{ turbine_id: 'new' }], error: null });
    const { result, rerender } = renderHook(({ id }) => useProjectMapData(id, true), { initialProps: { id: 'p1' } });
    rerender({ id: 'p2' });
    await waitFor(() => expect(result.current.rows).toEqual([{ turbine_id: 'new' }]));
    await act(async () => resolveFirst({ data: [{ turbine_id: 'old' }], error: null }));
    expect(result.current.rows).toEqual([{ turbine_id: 'new' }]);
  });

  it('al deshabilitarse limpia los datos', async () => {
    rpc.mockResolvedValue({ data: ROWS, error: null });
    const { result, rerender } = renderHook(({ on }) => useProjectMapData('p1', on), { initialProps: { on: true } });
    await waitFor(() => expect(result.current.rows).toEqual(ROWS));
    rerender({ on: false });
    expect(result.current.rows).toBeNull();
  });
});
