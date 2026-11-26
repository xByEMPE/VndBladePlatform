import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import DeleteProjectDialog from './DeleteProjectDialog';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k) => k }) }));
vi.mock('@/utils/deleteProjectCascade', () => ({
  getProjectDeletionSummary: vi.fn().mockResolvedValue({
    staff: 2, turbines: 5, blades: 15, inspectionFiles: 40, damages: 7,
  }),
}));

const project = { id: 'p1', name: 'OAXACA 4', wind_farm: 'OAXACA IV' };
const setup = (props = {}) => {
  const onClose = vi.fn();
  const onConfirmDelete = vi.fn();
  const utils = render(
    <DeleteProjectDialog isOpen project={project} onClose={onClose} onConfirmDelete={onConfirmDelete} {...props} />,
  );
  return { onClose, onConfirmDelete, ...utils };
};

describe('DeleteProjectDialog', () => {
  it('cerrado no renderiza nada', () => {
    const { container } = render(<DeleteProjectDialog isOpen={false} project={project} onClose={() => {}} onConfirmDelete={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('el botón destructivo usa el estilo de error sobrio (sin rojos crudos)', () => {
    setup();
    const btn = screen.getByRole('button', { name: 'deleteProject.continueWithDeletion' });
    expect(btn).toHaveClass('bg-error-bg', 'border-error-border', 'text-error-text');
    expect(document.body.innerHTML).not.toMatch(/\b(red|slate|gray|yellow|purple|blue|green)-\d{2,3}/);
  });

  it('confirmación por pasos: exige escribir la palabra exacta antes de borrar', async () => {
    const { onConfirmDelete } = setup();
    // "Continuar" está deshabilitado mientras se calcula el resumen de datos
    await screen.findByText('40');
    fireEvent.click(screen.getByRole('button', { name: 'deleteProject.continueWithDeletion' }));

    const finalBtn = screen.getByRole('button', { name: /deleteProject.deletePermanently/ });
    expect(finalBtn).toBeDisabled();

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'otra cosa' } });
    expect(screen.getByText('deleteProject.confirmDeletionText')).toHaveClass('text-error-text');
    expect(finalBtn).toBeDisabled();

    fireEvent.change(input, { target: { value: 'deleteProject.delete' } });
    expect(finalBtn).toBeEnabled();
    fireEvent.click(finalBtn);
    expect(onConfirmDelete).toHaveBeenCalledTimes(1);
  });

  it('Cancelar cierra, salvo que esté eliminando', () => {
    const { onClose, rerender } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'common.cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);

    rerender(<DeleteProjectDialog isOpen project={project} onClose={onClose} onConfirmDelete={() => {}} isDeleting deleteProgress="Borrando…" />);
    expect(screen.queryByRole('button', { name: 'common.cancel' })).toBeNull();
    expect(screen.getByText('Borrando…')).toBeInTheDocument();
  });

  it('muestra el resumen de datos con tokens', async () => {
    setup();
    expect(await screen.findByText('40')).toHaveClass('text-ink', 'font-mono');
    expect(screen.getByText('7')).toHaveClass('text-error-text');
  });
});
