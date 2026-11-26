import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from "react-router-dom";
import StatusBadge from './StatusBadge';
import ProgressBar from './ProgressBar';
import BentoCard from './BentoCard';
import KpiMetric from './KpiMetric';
import RadialGauge from './RadialGauge';
import UserProfile from '../layout/UserProfile';
import { gaugeGeometry, clampPercent, percentOf, formatPercent } from '@/lib/gauge';
import { getStatus } from '@/lib/status';
import { getRoleLabel } from '@/lib/roleLabel';

describe('StatusBadge', () => {
  it.each([
    ['done', 'text-status-done', 'bg-status-done'],
    ['progress', 'text-status-progress', 'bg-status-progress'],
    ['alert', 'text-status-alert', 'bg-status-alert'],
  ])('estado %s usa su token', (status, text, dot) => {
    render(<StatusBadge status={status} label="X" />);
    const el = screen.getByText('X');
    expect(el).toHaveClass(text);
    expect(el.querySelector('span')).toHaveClass(dot);
  });

  it('cancelled usa el token sobrio de error (fondo, borde, texto)', () => {
    render(<StatusBadge status="cancelled" label="Cancelado" />);
    expect(screen.getByText('Cancelado')).toHaveClass('bg-error-bg', 'border-error-border', 'text-error-text');
  });

  it('un estado desconocido cae a pending', () => {
    render(<StatusBadge status="otro" label="?" />);
    expect(screen.getByText('?')).toHaveClass('text-ink-muted');
    expect(getStatus('otro')).toBe(getStatus('pending'));
  });
});

describe('ProgressBar', () => {
  it('es compacta (h-1.5, rounded-full) y expone aria', () => {
    render(<ProgressBar value={40} label="Avance" />);
    const bar = screen.getByRole('progressbar', { name: 'Avance' });
    expect(bar).toHaveClass('h-1.5', 'rounded-full');
    expect(bar).toHaveAttribute('aria-valuenow', '40');
  });

  it('multi-estado: un segmento por estado y suma limitada a 100', () => {
    const { container } = render(
      <ProgressBar
        segments={[
          { status: 'done', value: 60 },
          { status: 'progress', value: 30 },
          { status: 'alert', value: 50 },
        ]}
      />,
    );
    const widths = [...container.querySelectorAll('[data-segment]')].map((s) => s.style.width);
    expect(widths).toEqual(['60%', '30%', '10%']);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
  });

  it('valores inválidos o negativos no rompen', () => {
    render(<ProgressBar value={-5} />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
  });
});

describe('BentoCard', () => {
  it('aplica .bento-card y marca data-active solo si está activa', () => {
    const { rerender } = render(<BentoCard>hola</BentoCard>);
    expect(screen.getByText('hola')).toHaveClass('bento-card');
    expect(screen.getByText('hola')).not.toHaveAttribute('data-active');
    rerender(<BentoCard active>hola</BentoCard>);
    expect(screen.getByText('hola')).toHaveAttribute('data-active', 'true');
  });

  it('as="button" recibe type=button; interactive en div es operable con teclado', () => {
    render(
      <>
        <BentoCard as="button">b</BentoCard>
        <BentoCard interactive>d</BentoCard>
      </>,
    );
    expect(screen.getByText('b')).toHaveAttribute('type', 'button');
    expect(screen.getByText('d')).toHaveAttribute('tabindex', '0');
    expect(screen.getByText('d')).toHaveAttribute('role', 'button');
  });
});

describe('KpiMetric', () => {
  it('muestra etiqueta, valor mono, leyenda y pie', () => {
    render(
      <KpiMetric label="TURBINAS" value={377} caption="Asignadas">
        <ProgressBar value={50} />
      </KpiMetric>,
    );
    expect(screen.getByText('TURBINAS')).toBeInTheDocument();
    expect(screen.getByText('377')).toHaveClass('font-mono');
    expect(screen.getByText('Asignadas')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });
});

describe('KpiMetric trailing / percentOf', () => {
  it('muestra el porcentaje a la derecha de la leyenda con su color', () => {
    render(<KpiMetric label="X" value={1} caption="Reportes listos" trailing="39.8%" trailingClassName="text-status-done" />);
    const t = screen.getByTestId('kpi-trailing');
    expect(t).toHaveTextContent('39.8%');
    expect(t).toHaveClass('text-status-done', 'font-mono');
    expect(t.previousSibling).toHaveTextContent('Reportes listos');
  });

  it('sin trailing no genera el contenedor de valor', () => {
    render(<KpiMetric label="X" value={1} caption="c" />);
    expect(screen.queryByTestId('kpi-trailing')).toBeNull();
  });

  it('percentOf: 1 decimal y datos de referencia (377 turbinas)', () => {
    expect(percentOf(150, 377)).toBe(39.8);
    expect(percentOf(75, 377)).toBe(19.9);
    expect(percentOf(152, 377)).toBe(40.3);
    expect(percentOf(5, 0)).toBe(0);
    expect(formatPercent(20)).toBe('20.0%');
  });
});

describe('RadialGauge / gauge.js', () => {
  it('78% → dashoffset = circunferencia × 0.22', () => {
    const g = gaugeGeometry(78, 120, 10);
    expect(g.circumference).toBeCloseTo(2 * Math.PI * 55, 5);
    expect(g.offset).toBeCloseTo(g.circumference * 0.22, 5);
  });

  it('limita el valor al rango 0–100', () => {
    expect(clampPercent(150)).toBe(100);
    expect(clampPercent(-3)).toBe(0);
    expect(clampPercent('x')).toBe(0);
  });

  it('renderiza arco con dasharray/dashoffset y rol meter accesible', () => {
    render(<RadialGauge value={78} label="Disponibilidad" />);
    const meter = screen.getByRole('meter', { name: 'Disponibilidad' });
    expect(meter).toHaveAttribute('aria-valuenow', '78');
    const arc = screen.getByTestId('gauge-arc');
    const { circumference, offset } = gaugeGeometry(78, 120, 10);
    expect(Number(arc.getAttribute('stroke-dasharray'))).toBeCloseTo(circumference, 5);
    expect(Number(arc.getAttribute('stroke-dashoffset'))).toBeCloseTo(offset, 5);
    expect(arc).toHaveClass('stroke-status-done');
    expect(screen.getByText('78%')).toBeInTheDocument();
  });
});

describe('UserProfile / getRoleLabel', () => {
  it('el rol va estrictamente después del correo en el DOM', () => {
    render(<MemoryRouter><UserProfile email="demo2@vindgroup.com" role="ADMINISTRADOR" /></MemoryRouter>);
    const email = screen.getByText('demo2@vindgroup.com');
    const role = screen.getByTestId('user-role');
    expect(email.parentElement).toBe(role.parentElement);
    expect(email.compareDocumentPosition(role) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('el rol va en azul celeste (token info)', () => {
    render(<MemoryRouter><UserProfile email="a@b.c" role="ADMINISTRADOR" /></MemoryRouter>);
    expect(screen.getByTestId('user-role')).toHaveClass('text-info');
  });

  it('es una cápsula: tarjeta con borde que envuelve avatar, correo y rol', () => {
    const { container } = render(<MemoryRouter><UserProfile email="a@b.c" role="ADMINISTRADOR" /></MemoryRouter>);
    const capsule = container.firstChild.firstChild; // botón dentro del contenedor del menú
    expect(capsule).toHaveClass('bg-surface-card', 'border', 'border-line-subtle', 'rounded-lg', 'px-3', 'py-1.5');
    expect(capsule.firstChild).toHaveClass('border-line-medium'); // recuadro del avatar
    expect(capsule).toContainElement(screen.getByText('a@b.c'));
  });

  it('menú: admin ve Configuración pero no Auditoría; dev ve ambas; technician/client ninguna', () => {
    const open = (props) => {
      const { unmount } = render(<MemoryRouter><UserProfile email="a@b.c" role="X" {...props} /></MemoryRouter>);
      fireEvent.click(screen.getByRole('button', { expanded: false }));
      const names = screen.getAllByRole('menuitem').map((el) => el.textContent);
      unmount();
      return names;
    };
    expect(open({ canConfigure: true })).toEqual(['Perfil', 'Configuración']);
    expect(open({ canConfigure: true, isDev: true })).toEqual(['Auditoría y Registros', 'Perfil', 'Configuración']);
    expect(open({})).toEqual(['Perfil']);
  });

  it('getRoleLabel: fallback ADMINISTRADOR, mayúsculas y roles conocidos', () => {
    expect(getRoleLabel(null)).toBe('ADMINISTRADOR');
    expect(getRoleLabel(undefined)).toBe('ADMINISTRADOR');
    expect(getRoleLabel('admin')).toBe('ADMINISTRADOR');
    expect(getRoleLabel('technician')).toBe('TÉCNICO');
    expect(getRoleLabel('client')).toBe('CLIENTE');
    expect(getRoleLabel('auditor')).toBe('AUDITOR');
  });
});
