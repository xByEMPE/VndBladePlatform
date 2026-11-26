import React from 'react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import WtgGeneratorPage from './WtgGeneratorPage';
import SavedCalibrations from '@/components/wtgm/SavedCalibrations';
import EditCalibrationDialog from '@/components/wtgm/EditCalibrationDialog';

// vi.mock se eleva automáticamente por encima de los imports
vi.mock('@/i18n/tx', () => ({
  tx: (s, o) => (o ? s.replace(/\{\{(\w+)\}\}/g, (_, k) => o[k]) : s),
  dateLocale: () => 'es',
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k) => k }) }));
// El calibrador (subproyecto aislado) y el almacenamiento (Supabase) se simulan: no forman parte de esta fase
vi.mock('@/pages/wtgwtgmgenerator/src/WtgCalibrator.jsx', () => ({
  default: () => <div data-testid="calibrator">calibrador</div>,
}));
vi.mock('@/lib/wtgmStorage', () => ({
  listWtgmCalibrations: vi.fn().mockResolvedValue([
    {
      id: 'c1', wtg_model: 'V90', wind_farm: 'OAXACA', manufacturer: 'VESTAS', method: 'manual',
      created_at: '2026-05-27T10:00:00Z', tower_height_m: 80, rotor_diameter_m: 90, blade_length_m: 44,
      missing_fields: ['a'], photo1_path: null, photo2_path: null, wtgm: {},
    },
  ]),
  saveWtgmCalibration: vi.fn(),
  updateWtgmCalibration: vi.fn(),
}));

beforeAll(() => {
  // jsdom no implementa <dialog>.showModal()
  HTMLDialogElement.prototype.showModal = function showModal() { this.open = true; };
  HTMLDialogElement.prototype.close = function close() { this.open = false; };
});

const renderPage = () => render(<MemoryRouter><WtgGeneratorPage /></MemoryRouter>);

describe('WtgGeneratorPage', () => {
  it('cabecera: overline celeste con icono en línea, título blanco y SIN badge de rol', async () => {
    renderPage();
    expect(screen.getByText('Herramientas')).toHaveClass('text-info', 'flex');
    expect(screen.getByRole('heading', { level: 1, name: 'Generador de geometría WTG' })).toBeInTheDocument();
    expect(screen.queryByText(/administrador/i)).toBeNull();
    await screen.findByText('OAXACA'); // espera a que cargue la lista
  });

  it('no hay botón "Volver": la página arranca directamente con el encabezado', async () => {
    renderPage();
    expect(screen.queryByRole('button', { name: /Volver/ })).toBeNull();
    await screen.findByText('OAXACA');
  });

  it('pestañas: role tab, subrayado dorado en la activa y el calibrador sigue montado (no se pierden fotos)', async () => {
    renderPage();
    const saved = screen.getByRole('tab', { name: /Calibraciones guardadas/ });
    const nuevo = screen.getByRole('tab', { name: /Nueva calibración/ });
    expect(saved).toHaveAttribute('aria-selected', 'true');
    expect(saved).toHaveClass('border-brand', 'text-brand');
    expect(nuevo).toHaveClass('border-transparent', 'text-ink-muted');

    // El calibrador existe en el DOM aunque su panel esté oculto
    expect(screen.getByTestId('calibrator')).toBeInTheDocument();
    expect(document.getElementById('wtg-panel-new')).toHaveAttribute('hidden');

    fireEvent.click(nuevo);
    expect(nuevo).toHaveAttribute('aria-selected', 'true');
    expect(nuevo).toHaveClass('border-brand');
    expect(document.getElementById('wtg-panel-new')).not.toHaveAttribute('hidden');
    expect(document.getElementById('wtg-panel-saved')).toHaveAttribute('hidden');
    // sigue siendo el mismo nodo montado
    expect(screen.getByTestId('calibrator')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('tab', { name: /Calibraciones guardadas/ })).toBeInTheDocument());
  });
});

describe('SavedCalibrations', () => {
  const row = {
    id: 'c1', wtg_model: 'V90', wind_farm: 'OAXACA', manufacturer: 'VESTAS', method: 'manual',
    created_at: '2026-05-27T10:00:00Z', tower_height_m: 80, rotor_diameter_m: 90, blade_length_m: 44,
    missing_fields: ['a', 'b'], photo1_path: null, photo2_path: null, wtgm: {},
  };
  const base = { rows: [row], loading: false, error: '', onRefresh: () => {}, onCreate: () => {}, onEdit: () => {} };

  it('cada calibración es un BentoCard con elevación y botones con el estilo del sistema', () => {
    render(<SavedCalibrations {...base} />);
    const card = screen.getByText('OAXACA').closest('.bento-card');
    expect(card).not.toBeNull();
    expect(card).not.toHaveAttribute('data-flat');
    // "Generar" era ámbar sólido → dorado nuevo; "Editar" era gris → conserva su aspecto original
    expect(screen.getByRole('button', { name: /Generar .wtgm/ })).toHaveClass('border-brand/40', 'bg-brand/10', 'text-brand');
    const edit = screen.getByRole('button', { name: /Editar/ });
    expect(edit).toHaveClass('border-line-subtle', 'bg-surface-card', 'text-ink');
    // sin dorado en el botón (el anillo de foco ring-brand es común a todos y se ignora)
    expect(edit.className.split(/\s+/).filter((c) => !/ring/.test(c)).join(' ')).not.toMatch(/brand/);
    expect(screen.getByText('V90', { selector: 'span' })).toHaveClass('text-brand');
  });

  it('avisa los datos sin completar con el token de alerta y llama a onEdit', () => {
    const onEdit = vi.fn();
    render(<SavedCalibrations {...base} onEdit={onEdit} />);
    expect(screen.getByText('2 dato(s) sin completar')).toHaveClass('text-status-alert');
    fireEvent.click(screen.getByRole('button', { name: /Editar/ }));
    expect(onEdit).toHaveBeenCalledWith(row);
  });

  it('estado vacío usa EmptyState y ofrece crear', () => {
    const onCreate = vi.fn();
    render(<SavedCalibrations {...base} rows={[]} onCreate={onCreate} />);
    expect(screen.getByText('Aún no hay calibraciones guardadas.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Crear nueva calibración/ }));
    expect(onCreate).toHaveBeenCalledTimes(1);
  });

  it('el error usa el vino sobrio y permite reintentar', () => {
    const onRefresh = vi.fn();
    render(<SavedCalibrations {...base} rows={[]} error="boom" onRefresh={onRefresh} />);
    expect(screen.getByRole('alert')).toHaveClass('bg-error-bg', 'border-error-border', 'text-error-text');
    fireEvent.click(screen.getByRole('button', { name: /Reintentar/ }));
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('filtra por modelo (lógica intacta)', () => {
    const rows = [row, { ...row, id: 'c2', wtg_model: 'G114', wind_farm: 'SEDENA' }];
    render(<SavedCalibrations {...base} rows={rows} />);
    expect(screen.getByText('SEDENA')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^V90/ }));
    expect(screen.queryByText('SEDENA')).toBeNull();
    expect(screen.getByText('OAXACA')).toBeInTheDocument();
  });
});

describe('EditCalibrationDialog', () => {
  const row = {
    id: 'c1', wtg_model: 'V90', wind_farm: 'OAXACA', manufacturer: 'VESTAS',
    tower_height_m: 80, rotor_diameter_m: 90, blade_length_m: 44, photo1_path: null, photo2_path: null,
    wtgm: { geometry: {} }, geometry: { values: {} },
  };

  it('usa tokens: fondo base, borde medio, error sobrio y botones del sistema', async () => {
    const { container } = render(<EditCalibrationDialog row={row} onClose={() => {}} onSaved={() => {}} />);
    const dlg = container.querySelector('dialog');
    expect(dlg).toHaveClass('bg-surface-base', 'text-ink');
    expect(dlg.className).toContain('border-line-medium');
    expect(dlg.className).toContain('backdrop:bg-surface-base/70');
    expect(screen.getByRole('button', { name: 'Guardar cambios' })).toHaveClass('border-brand/40', 'text-brand');
    // "Cancelar" (gris original) no es dorado
    expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveClass('border-line-subtle', 'text-ink');

    // un valor no numérico dispara el error con el estilo sobrio (validación intacta)
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveClass('bg-error-bg', 'border-error-border', 'text-error-text');
  });
});
