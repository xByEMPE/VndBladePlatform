import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SearchField from './SearchField';
import EmptyState from './EmptyState';
import Pagination from './Pagination';
import { StatusTag, STATUS_META, PANEL, BTN_PRIMARY } from '@/components/projects/formKit';
import { getStatus } from '@/lib/status';
import * as classes from '@/lib/classes';

vi.mock('@/i18n/tx', () => ({ tx: (s) => s }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k) => k }) }));

describe('SearchField', () => {
  it('es accesible por etiqueta y notifica el texto escrito', () => {
    const onChange = vi.fn();
    render(<SearchField value="" onChange={onChange} label="Buscar turbina" placeholder="Buscar" />);
    const input = screen.getByRole('searchbox', { name: 'Buscar turbina' });
    fireEvent.change(input, { target: { value: 'WTG-1' } });
    expect(onChange).toHaveBeenCalledWith('WTG-1');
  });
});

describe('EmptyState', () => {
  it('muestra el mensaje con icono atenuado', () => {
    const { container } = render(<EmptyState>Sin datos</EmptyState>);
    expect(screen.getByText('Sin datos')).toBeInTheDocument();
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });
});

describe('Pagination', () => {
  const base = {
    rangeText: '1–10 de 25', perPageLabel: 'Por página', pageSize: 10, pageSizes: [10, 25, 50],
    onPageSizeChange: () => {}, page: 1, totalPages: 3, onPageChange: () => {},
    pageText: 'Página 1 / 3', prevLabel: 'Anterior', nextLabel: 'Siguiente',
  };

  it('deshabilita Anterior en la primera página y navega con Siguiente', () => {
    const onPageChange = vi.fn();
    render(<Pagination {...base} onPageChange={onPageChange} />);
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it('deshabilita Siguiente en la última página y cambia el tamaño', () => {
    const onPageSizeChange = vi.fn();
    render(<Pagination {...base} page={3} onPageSizeChange={onPageSizeChange} />);
    expect(screen.getByRole('button', { name: 'Siguiente' })).toBeDisabled();
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '25' } });
    expect(onPageSizeChange).toHaveBeenCalledWith(25);
  });
});

describe('formKit centralizado (StatusTag + constantes)', () => {
  it('reexporta las constantes de lib/classes (una sola fuente)', () => {
    expect(PANEL).toBe(classes.PANEL);
    expect(BTN_PRIMARY).toBe(classes.BTN_PRIMARY);
  });

  it.each([
    ['Completado', 'text-status-done'],
    ['En progreso', 'text-status-progress'],
    ['Pausado', 'text-status-alert'],
    ['Revisión', 'text-sev-4'],
    ['Pendiente', 'text-ink-muted'],
    ['Planeación', 'text-ink-muted'],
  ])('StatusTag "%s" usa %s', (status, cls) => {
    render(<StatusTag status={status} />);
    expect(screen.getByText(STATUS_META[status].key)).toHaveClass(cls);
  });

  it('Cancelado usa la píldora sobria de error', () => {
    render(<StatusTag status="Cancelado" />);
    expect(screen.getByText('status.cancelled')).toHaveClass('bg-error-bg', 'border-error-border', 'text-error-text');
  });

  it('un estado desconocido cae a pending y conserva su texto', () => {
    render(<StatusTag status="Raro" />);
    expect(screen.getByText('Raro')).toHaveClass('text-ink-muted');
    expect(getStatus('review').text).toBe('text-sev-4');
  });
});
