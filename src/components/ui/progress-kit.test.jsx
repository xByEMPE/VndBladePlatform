import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import TypeTag from './TypeTag';
import Metric from './Metric';
import RadialGauge from './RadialGauge';
import ProgressBar from './ProgressBar';
import KpiGrid from './KpiGrid';
import { Metric as ViewerMetric } from '@/components/reportViewer/viewerKit';
import { percentOf } from '@/lib/gauge';
import { getStatus } from '@/lib/status';

describe('TypeTag', () => {
  it('usa tokens y permite className extra', () => {
    render(<TypeTag className="ml-2">LPS</TypeTag>);
    const tag = screen.getByText('LPS');
    expect(tag).toHaveClass('border-line-subtle', 'bg-surface-card', 'text-ink', 'ml-2');
  });
});

describe('Metric', () => {
  it('renderiza dt/dd y soporta wide', () => {
    const { container } = render(<dl><Metric label="Cliente" value="EAOSA" wide /></dl>);
    expect(screen.getByText('Cliente').tagName).toBe('DT');
    expect(screen.getByText('EAOSA').tagName).toBe('DD');
    expect(container.firstChild.firstChild).toHaveClass('col-span-full');
  });

  it('viewerKit reexporta el mismo componente (una sola fuente)', () => {
    expect(ViewerMetric).toBe(Metric);
  });
});

describe('RadialGauge showLabel', () => {
  it('con tamaño grande muestra la etiqueta, salvo que showLabel=false (sigue accesible)', () => {
    const { rerender } = render(<RadialGauge value={40} size={128} label="Avance" />);
    expect(screen.getByText('Avance')).toBeInTheDocument();
    rerender(<RadialGauge value={40} size={128} label="Avance" showLabel={false} />);
    expect(screen.queryByText('Avance')).toBeNull();
    expect(screen.getByRole('meter', { name: 'Avance' })).toHaveAttribute('aria-valuenow', '40');
    expect(screen.getByText('40%')).toBeInTheDocument();
  });
});

describe('ProgressBar de estado general (segmentos en %)', () => {
  it('3 segmentos done/progress/pending suman el total', () => {
    const total = 20;
    const segments = [
      { status: 'done', value: percentOf(10, total) },
      { status: 'progress', value: percentOf(6, total) },
      { status: 'pending', value: percentOf(4, total) },
    ];
    const { container } = render(<ProgressBar segments={segments} label="Estado" />);
    expect([...container.querySelectorAll('[data-segment]')].map((s) => s.style.width)).toEqual(['50%', '30%', '20%']);
    expect(screen.getByRole('progressbar', { name: 'Estado' })).toHaveAttribute('aria-valuenow', '100');
  });
});

describe('KpiGrid con 4 columnas', () => {
  it('className sobrescribe lg:grid-cols-5 por lg:grid-cols-4', () => {
    const { container } = render(<KpiGrid className="lg:grid-cols-4"><div /><div /></KpiGrid>);
    expect(container.firstChild).toHaveClass('lg:grid-cols-4');
    expect(container.firstChild).not.toHaveClass('lg:grid-cols-5');
  });
});

// Todos los botones llevan anillo de foco dorado (ring-brand); al comprobar "no es dorado" se ignora ese anillo.
const withoutFocusRing = (cls) => cls.split(/\s+/).filter((c) => !/ring/.test(c)).join(' ');

// REGLA DE DISEÑO: los botones que ya eran amarillos usan el estilo dorado nuevo; los que no, conservan su aspecto original.
describe('botones amarillos (BTN_PRIMARY y BTN_BRAND_OUTLINE): estilo dorado nuevo', () => {
  it.each(['BTN_PRIMARY', 'BTN_BRAND_OUTLINE'])(
    '%s: fondo dorado tenue, texto y borde dorados; al hover el fondo sube; solo tokens',
    async (name) => {
      const cls = (await import('@/lib/classes'))[name];
      expect(cls).toContain('bg-brand/10');
      expect(cls).toContain('text-brand');
      expect(cls).toContain('border-brand/40');
      expect(cls).toContain('hover:bg-brand/25');
      expect(cls).not.toMatch(/hover:bg-brand(?![/\w-])/); // no se rellena por completo
      expect(cls).not.toMatch(/(?<![:\w-])shadow-\[/); // sin halo fijo
      expect(cls).not.toMatch(/\b(slate|amber|emerald|rose|red|blue)-\d|white\/|#[0-9a-f]{6}/i);
    },
  );

  it('comparten la misma apariencia dorada (una sola fuente)', async () => {
    const { BTN_PRIMARY, BTN_BRAND_OUTLINE } = await import('@/lib/classes');
    const look = 'border-brand/40 bg-brand/10 text-brand transition-colors duration-200 hover:bg-brand/25';
    expect(BTN_PRIMARY).toContain(look);
    expect(BTN_BRAND_OUTLINE).toContain(look);
  });

  it('es la misma receta que BTN_DANGER (fondo teñido + hover que sube el fondo), en dorado', async () => {
    const { BTN_DANGER, BTN_PRIMARY } = await import('@/lib/classes');
    expect(BTN_DANGER).toContain('bg-error-bg');
    expect(BTN_DANGER).toContain('hover:bg-error-border/40');
    expect(BTN_PRIMARY).toContain('bg-brand/10');
    expect(BTN_PRIMARY).toContain('hover:bg-brand/25');
  });
});

describe('BTN_SECONDARY (antes gris neutro): conserva su aspecto original', () => {
  it('es gris neutro en tokens (borde sutil, fondo tarjeta, texto claro), NO dorado', async () => {
    const { BTN_SECONDARY, BTN_PRIMARY } = await import('@/lib/classes');
    expect(BTN_SECONDARY).toContain('border-line-subtle');
    expect(BTN_SECONDARY).toContain('bg-surface-card');
    expect(BTN_SECONDARY).toContain('text-ink');
    expect(BTN_SECONDARY).toContain('hover:border-line-medium');
    expect(withoutFocusRing(BTN_SECONDARY)).not.toMatch(/brand/); // el anillo de foco sí es dorado
    expect(BTN_SECONDARY).not.toBe(BTN_PRIMARY);
  });

  it('BTN_DANGER (no era amarillo) sigue en vino sobrio', async () => {
    const { BTN_DANGER } = await import('@/lib/classes');
    expect(BTN_DANGER).toContain('text-error-text');
    expect(withoutFocusRing(BTN_DANGER)).not.toMatch(/brand/);
  });
});

describe('estados del sistema usados por Progreso General', () => {
  it.each(['done', 'progress', 'alert', 'cancelled', 'review', 'pending'])('%s tiene dot y texto', (k) => {
    expect(getStatus(k).dot).toMatch(/^bg-/);
    expect(getStatus(k).text).toMatch(/^text-/);
  });
});
