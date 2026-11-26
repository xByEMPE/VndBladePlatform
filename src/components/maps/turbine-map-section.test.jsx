import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TurbineMapSection from './TurbineMapSection';

// TurbineMap real se prueba aparte; aquí solo importa cómo lo envuelve la sección.
vi.mock('./TurbineMap', () => ({
  default: ({ items, onDeleteReport, getPhotoUrl }) => {
    if (items.some((i) => i.explode)) throw new Error('boom');
    return (
      <div
        data-testid="turbine-map"
        data-count={items.length}
        data-can-delete={onDeleteReport ? 'yes' : 'no'}
        data-photo-url={getPhotoUrl ? getPhotoUrl('x') : 'none'}
      />
    );
  },
}));

const ITEMS = [{ id: 'a', name: '25' }];

afterEach(() => vi.restoreAllMocks());

describe('TurbineMapSection', () => {
  it('muestra el esqueleto mientras carga el módulo diferido y luego el mapa', async () => {
    render(<TurbineMapSection items={ITEMS} onOpenReport={() => {}} />);
    expect(screen.getByRole('status', { name: 'Cargando mapa' })).toHaveAttribute('aria-busy', 'true');
    expect(await screen.findByTestId('turbine-map')).toHaveAttribute('data-count', '1');
    expect(screen.queryByRole('status', { name: 'Cargando mapa' })).not.toBeInTheDocument();
  });

  it('muestra el esqueleto mientras se cargan los datos (loading)', () => {
    render(<TurbineMapSection items={[]} loading onOpenReport={() => {}} />);
    expect(screen.getByRole('status', { name: 'Cargando mapa' })).toBeInTheDocument();
    expect(screen.queryByTestId('turbine-map')).not.toBeInTheDocument();
  });

  it('si la RPC falla avisa, ofrece reintentar y NO rompe el mapa (se ve sin color de severidad)', async () => {
    const onRetry = vi.fn();
    render(<TurbineMapSection items={ITEMS} error={new Error('rpc')} onRetry={onRetry} onOpenReport={() => {}} />);
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('No se pudieron cargar los datos de daños');
    expect(await screen.findByTestId('turbine-map')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('sin error no muestra el aviso', async () => {
    render(<TurbineMapSection items={ITEMS} onOpenReport={() => {}} />);
    await screen.findByTestId('turbine-map');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('un fallo de renderizado del mapa se contiene en la sección (con opción de recargar)', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <div>
        <p>resto de la pantalla</p>
        <TurbineMapSection items={[{ id: 'x', name: 'X', explode: true }]} onOpenReport={() => {}} />
      </div>,
    );
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo cargar el mapa');
    expect(screen.getByRole('button', { name: 'Recargar página' })).toBeInTheDocument();
    expect(screen.getByText('resto de la pantalla')).toBeInTheDocument();
  });

  it('reenvía getPhotoUrl al mapa para firmar la foto de la turbina', async () => {
    render(<TurbineMapSection items={ITEMS} onOpenReport={() => {}} getPhotoUrl={(p) => `signed:${p}`} />);
    expect(await screen.findByTestId('turbine-map')).toHaveAttribute('data-photo-url', 'signed:x');
  });

  it('solo pasa la acción de eliminar si la pantalla la entrega (solo admin/dev)', async () => {
    const { unmount } = render(<TurbineMapSection items={ITEMS} onOpenReport={() => {}} />);
    expect(await screen.findByTestId('turbine-map')).toHaveAttribute('data-can-delete', 'no');
    unmount();
    render(<TurbineMapSection items={ITEMS} onOpenReport={() => {}} onDeleteReport={() => {}} />);
    expect(await screen.findByTestId('turbine-map')).toHaveAttribute('data-can-delete', 'yes');
  });
});
