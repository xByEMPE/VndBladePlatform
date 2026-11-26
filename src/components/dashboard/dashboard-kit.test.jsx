import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import BentoCard from '@/components/ui/BentoCard';
import ModuleLink from './ModuleLink';
import ActivityRow from './ActivityRow';
import RecentActivityCard from './RecentActivityCard';
import YearFilter from './YearFilter';
import PageHeader from '@/components/layout/PageHeader';
import { toStatusKey } from '@/lib/projectStatus';
import { toPercent } from '@/lib/gauge';

vi.mock('@/i18n/tx', () => ({ tx: (s) => s }));

const project = (over = {}) => ({
  id: 1, name: 'OAXACA 1', wind_farm: 'OAXACA I', client: 'EAOSA',
  status: 'Completado', turbine_count: 5, project_type: 'BLADES', ...over,
});

describe('helpers', () => {
  it('toStatusKey mapea los textos de BD y cae a pending', () => {
    expect(toStatusKey('Completado')).toBe('done');
    expect(toStatusKey('En progreso')).toBe('progress');
    expect(toStatusKey('Cancelado')).toBe('cancelled');
    expect(toStatusKey('Planeación')).toBe('pending');
    expect(toStatusKey(undefined)).toBe('pending');
  });

  it('toPercent redondea y es seguro con total 0', () => {
    expect(toPercent(1, 3)).toBe(33);
    expect(toPercent(5, 0)).toBe(0);
    expect(toPercent(9, 3)).toBe(100);
  });
});

describe('BentoCard flat', () => {
  it('marca data-flat para desactivar la elevación', () => {
    render(<BentoCard flat>x</BentoCard>);
    expect(screen.getByText('x')).toHaveAttribute('data-flat', 'true');
  });
});

describe('ModuleLink', () => {
  it('es un botón; featured marca la tarjeta activa; chevron con micro-desplazamiento', () => {
    const onClick = vi.fn();
    render(<ModuleLink featured title="Progreso" description="desc" icon={<i />} onClick={onClick} />);
    const btn = screen.getByRole('button', { name: /Progreso/ });
    expect(btn).toHaveAttribute('data-active', 'true');
    expect(btn.querySelector('svg')).toHaveClass('group-hover:translate-x-0.5');
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('no featured no es activa y su icono va en blanco; el featured en dorado', () => {
    const { container, rerender } = render(<ModuleLink title="Otro" description="d" icon={<i />} onClick={() => {}} />);
    expect(screen.getByRole('button')).not.toHaveAttribute('data-active');
    expect(container.querySelector('span[aria-hidden]')).toHaveClass('text-ink');
    rerender(<ModuleLink featured title="Otro" description="d" icon={<i />} onClick={() => {}} />);
    expect(container.querySelector('span[aria-hidden]')).toHaveClass('text-brand');
  });
});

describe('ActivityRow', () => {
  it('muestra nombre, subtítulo, estado y conteo', () => {
    render(<ActivityRow icon={<i />} name="N" subtitle="S" status="done" statusLabel="Completado" count={68} onClick={() => {}} />);
    expect(screen.getByText('N')).toBeInTheDocument();
    expect(screen.getByText('S')).toBeInTheDocument();
    expect(screen.getByText('Completado')).toHaveClass('text-status-done');
    expect(screen.getByText('68')).toBeInTheDocument();
  });
});

describe('RecentActivityCard', () => {
  it('lista proyectos y abre el seleccionado', () => {
    const onOpen = vi.fn();
    const p = project();
    render(<RecentActivityCard projects={[p]} onOpenProject={onOpen} />);
    fireEvent.click(screen.getByRole('button', { name: /OAXACA 1/ }));
    expect(onOpen).toHaveBeenCalledWith(p);
  });

  it('Cancelado usa el token sobrio de error', () => {
    render(<RecentActivityCard projects={[project({ status: 'Cancelado' })]} onOpenProject={() => {}} />);
    expect(screen.getByText('Cancelado')).toHaveClass('bg-error-bg', 'text-error-text');
  });

  it('"Gestionar todos" solo aparece si se pasa onManageAll', () => {
    const { rerender } = render(<RecentActivityCard projects={[project()]} onOpenProject={() => {}} />);
    expect(screen.queryByText('Gestionar todos')).toBeNull();
    rerender(<RecentActivityCard projects={[project()]} onOpenProject={() => {}} onManageAll={() => {}} />);
    expect(screen.getByText('Gestionar todos').closest('button')).toHaveClass('text-info');
    expect(screen.getByText('Gestionar todos').closest('button').className).not.toMatch(/text-brand/);
  });

  it('estado vacío', () => {
    render(<RecentActivityCard projects={[]} onOpenProject={() => {}} />);
    expect(screen.getByText('No hay proyectos para mostrar')).toBeInTheDocument();
  });
});

describe('YearFilter / PageHeader', () => {
  it('YearFilter notifica el cambio y ofrece "Todos" + años', () => {
    const onChange = vi.fn();
    render(<YearFilter value="2026" onChange={onChange} years={['2026', '2025']} label="Año" allLabel="Todos" />);
    const select = screen.getByRole('combobox', { name: 'Año' });
    expect(select.querySelectorAll('option')).toHaveLength(3);
    fireEvent.change(select, { target: { value: '2025' } });
    expect(onChange).toHaveBeenCalledWith('2025');
  });

  it('PageHeader renderiza h1 y no incluye badge de rol', () => {
    render(<PageHeader overline="O" title="Centro de Operaciones" description="D" icon={<i />} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Centro de Operaciones' })).toBeInTheDocument();
    expect(screen.queryByText(/administrador/i)).toBeNull();
  });
});
