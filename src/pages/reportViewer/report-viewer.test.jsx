import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import PageHeader from '@/components/layout/PageHeader';
import { ReportHeader } from './components/header/ReportHeader';
import { EditorHeader } from '@/pages/damageEditor/components/EditorHeader';
import { SEV, SeverityBadge, OriginTag, sevNumber, BladeSummaryCard, BladeSegment } from '@/components/reportViewer/viewerKit';
import { BTN_PRIMARY, BTN_DANGER, FOCUS_RING, PANEL } from '@/lib/classes';

vi.mock('@/i18n/tx', () => ({ tx: (s) => s }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k) => k }) }));

const t = (k) => k;
const base = {
  t,
  isClient: false,
  project: { name: 'OAXACA 4', wind_farm: 'OAXACA IV' },
  turbine: { turbine_name: 'WTG-12' },
  isRefreshing: false,
  handleManualRefresh: () => {},
  isApproved: true,
};

describe('PageHeader (slots)', () => {
  it('renderiza subtitle y actions; sin ellos no genera contenedores vacíos', () => {
    const { container, rerender } = render(<PageHeader title="T" />);
    expect(container.querySelectorAll('p')).toHaveLength(0);
    rerender(<PageHeader title="T" subtitle="Sub" actions={<button>Acción</button>} />);
    expect(screen.getByText('Sub')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Acción' })).toBeInTheDocument();
  });
});

describe('azul celeste técnico', () => {
  it('PageHeader: icono en línea dentro del sobretítulo, ambos celeste, sin caja grande', () => {
    const { container } = render(<PageHeader overline="GESTIÓN" title="T" icon={<i data-testid="ico" />} />);
    const overline = screen.getByText('GESTIÓN');
    expect(overline).toHaveClass('text-info', 'flex', 'items-center');
    expect(overline).toContainElement(screen.getByTestId('ico'));
    expect(container.querySelector('.h-12')).toBeNull();
    expect(screen.getByRole('heading', { level: 1 }).parentElement).toBe(overline.parentElement);
  });

  it('Cat 2 y "En progreso" comparten el mismo token celeste', () => {
    expect(SEV[2].bar).toBe('bg-sev-2');
  });
});

describe('EditorHeader (Editor de Daños)', () => {
  const props = {
    t: (k, o) => o?.defaultValue ?? k,
    editingDetection: null, damageInfo: null, detections: [],
    downloading: false, setDownloading: () => {}, showDownloadMenu: false, setShowDownloadMenu: () => {},
    isSidebarOpen: false, setIsSidebarOpen: () => {}, imageSrc: 'x.jpg', imageAlt: 'x',
    navigationData: { projectName: 'OAXACA', wtg: 'WTG-02', blade: 'Blade A' },
    currentImage: {}, section: 'SS', project: {}, getSectionLabel: () => 'SS',
  };

  it('muestra título y botón de descarga, sin badge de rol', () => {
    render(<EditorHeader {...props} />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('WTG-02 · Blade A · SS');
    expect(screen.getByRole('button', { name: /Descargar/ })).toBeInTheDocument();
    expect(screen.queryByText(/administrador|técnico|cliente/i)).toBeNull();
  });
});

describe('ReportHeader', () => {
  it('muestra turbina, proyecto, estado del documento y Actualizar; NO muestra rol', () => {
    render(<ReportHeader {...base} />);
    expect(screen.getByRole('heading', { level: 1, name: 'WTG-12' })).toBeInTheDocument();
    expect(screen.getByText('OAXACA 4 · OAXACA IV')).toBeInTheDocument();
    expect(screen.getByText('reportViewer.statusApproved')).toHaveClass('text-status-done');
    expect(screen.getByRole('button', { name: /reportViewer.update/ })).toBeInTheDocument();
    expect(screen.queryByText(/administrador|cliente|técnico|roleAdmin|roleClient/i)).toBeNull();
  });

  it('pendiente de aprobar usa el estado alerta', () => {
    render(<ReportHeader {...base} isApproved={false} />);
    expect(screen.getByText('reportViewer.statusToApprove')).toHaveClass('text-status-alert');
  });

  it('un cliente no ve el estado del documento pero sí Actualizar', () => {
    render(<ReportHeader {...base} isClient />);
    expect(screen.queryByText('reportViewer.statusApproved')).toBeNull();
    expect(screen.getByRole('button', { name: /reportViewer.update/ })).toBeInTheDocument();
  });

  it('deshabilita Actualizar mientras refresca y dispara el handler', () => {
    const onRefresh = vi.fn();
    const { rerender } = render(<ReportHeader {...base} handleManualRefresh={onRefresh} />);
    fireEvent.click(screen.getByRole('button', { name: /reportViewer.update/ }));
    expect(onRefresh).toHaveBeenCalledTimes(1);
    rerender(<ReportHeader {...base} isRefreshing />);
    expect(screen.getByRole('button', { name: /reportViewer.updating/ })).toBeDisabled();
  });
});

describe('viewerKit con tokens', () => {
  it('SEV cubre Cat 1–5 con tokens sev-N', () => {
    [1, 2, 3, 4, 5].forEach((n) => {
      expect(SEV[n].bar).toBe(`bg-sev-${n}`);
      expect(SEV[n].chip).toContain(`text-sev-${n}`);
    });
  });

  it('SeverityBadge: etiqueta y fallback a Cat 3', () => {
    const { rerender } = render(<SeverityBadge severity="Cat 5" />);
    expect(screen.getByText('Cat 5')).toHaveClass('text-sev-5');
    rerender(<SeverityBadge severity="2" />);
    expect(screen.getByText('Cat 2')).toHaveClass('text-sev-2');
    expect(sevNumber(undefined)).toBe(3);
  });

  it('OriginTag: IA usa progreso, manual neutro', () => {
    const { rerender } = render(<OriginTag auto />);
    expect(screen.getByText('Detectado por IA')).toHaveClass('text-status-progress');
    rerender(<OriginTag auto={false} />);
    expect(screen.getByText('Manual')).toHaveClass('text-ink');
  });

  it('BladeSummaryCard es un BentoCard activable y accesible', () => {
    const onSelect = vi.fn();
    render(
      <BladeSummaryCard blade="Pala A" active onSelect={onSelect} total={3} images={9}
        counts={[1, 0, 2, 0, 0]} damagesLabel="daños" imagesLabel="imágenes" />,
    );
    const btn = screen.getByRole('button', { name: /Pala A/ });
    expect(btn).toHaveClass('bento-card');
    expect(btn).toHaveAttribute('data-active', 'true');
    expect(btn).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(btn);
    expect(onSelect).toHaveBeenCalled();
  });

  it('BladeSegment marca la pala elegida con la marca', () => {
    render(<BladeSegment blades={['A', 'B']} value="B" onChange={() => {}} label="Pala" />);
    expect(screen.getByRole('button', { name: 'B' })).toHaveClass('bg-brand');
    expect(screen.getByRole('button', { name: 'A' })).not.toHaveClass('bg-brand');
  });
});

describe('lib/classes (sin colores crudos)', () => {
  it('las constantes solo usan tokens', () => {
    const all = [BTN_PRIMARY, BTN_DANGER, FOCUS_RING, PANEL].join(' ');
    expect(all).not.toMatch(/\b(slate|amber|emerald|rose|red|blue|gray|yellow)-\d|white\/|#[0-9a-f]{6}/i);
  });
});
