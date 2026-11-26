import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ToolBtn } from '@/components/damageEditor/panels';
import { ComparePanel } from '@/pages/damageEditor/components/ComparePanel';
import { EditorHeader } from '@/pages/damageEditor/components/EditorHeader';

vi.mock('@/i18n/tx', () => ({ tx: (s) => s }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k) => k }) }));
vi.mock('@/components/OptimizedImage', () => ({ default: () => <div data-testid="img" /> }));

const read = (rel) => fs.readFileSync(path.resolve(__dirname, rel), 'utf8');

describe('ToolBtn (la barra de herramientas conserva su aspecto ORIGINAL por decisión de diseño)', () => {
  it.each([
    ['default', ['border-white/10', 'bg-slate-800/80', 'text-slate-200', 'hover:border-white/25']],
    ['active', ['border-amber-500/50', 'bg-amber-500/10', 'text-amber-400']],
    ['info', ['border-blue-400/50', 'bg-blue-500/15', 'text-blue-300']],
    ['purple', ['border-purple-400/50', 'bg-purple-500/15', 'text-purple-300']],
    ['primary', ['border-amber-400', 'bg-amber-500', 'text-slate-900', 'hover:bg-amber-400']],
    ['success', ['border-status-done/40', 'bg-status-done/10', 'text-status-done', 'hover:bg-status-done/25']],
    ['danger', ['border-rose-500/40', 'bg-rose-500/10', 'text-rose-300', 'hover:bg-rose-500/20']],
  ])('tono %s es el original', (tone, classes) => {
    render(<ToolBtn tone={tone}>X</ToolBtn>);
    expect(screen.getByRole('button', { name: 'X' })).toHaveClass(...classes);
  });

  it('no queda ningún tono de la receta unificada ni tonos "legacy" provisionales', () => {
    const src = read('../components/damageEditor/panels.jsx');
    const tones = src.match(/const TOOL_TONES = \{([\s\S]*?)\n\};/)?.[1] ?? '';
    expect(tones).not.toMatch(/text-brand|text-info|bg-brand|legacy/);
    // toda línea con un color crudo conserva la marca explícita del guardián
    const RAW_COLOR = /\b(slate|amber|blue|purple|rose|emerald)-\d|border-white|bg-white/;
    const lines = tones.split('\n').filter((l) => l.includes(': "'));
    expect(lines.filter((l) => RAW_COLOR.test(l)).every((l) => l.includes('guard-allow-raw'))).toBe(true);
  });

  it('el verde (success) sigue la receta de los rojos y los amarillos: fondo tenue + hover que sube el fondo', () => {
    const src = read('../components/damageEditor/panels.jsx');
    const tones = src.match(/const TOOL_TONES = \{([\s\S]*?)\n\};/)?.[1] ?? '';
    const line = (name) => tones.split('\n').find((l) => l.trim().startsWith(`${name}:`)) ?? '';
    // las tres comparten el patrón: borde/40 + fondo/10 + texto del mismo color + hover que sube el fondo
    expect(line('success')).toMatch(/border-status-done\/40 bg-status-done\/10 text-status-done hover:bg-status-done\/25/);
    expect(line('danger')).toMatch(/bg-rose-500\/10 .*hover:bg-rose-500\/20/);
    expect(line('active')).toMatch(/bg-amber-500\/10/);
    expect(line('success')).not.toMatch(/emerald|text-white/); // ya no es verde sólido con texto blanco
  });

  it('Crosshair usa los tonos normales: reposo "default" y activo "info" (azul original)', () => {
    const toolbar = read('./damageEditor/components/EditorToolbar.jsx');
    expect(toolbar).toContain('toolMode === "crosshair" ? "info" : "default"');
    expect(toolbar).not.toContain('legacy');
    render(<ToolBtn tone="info">C</ToolBtn>);
    expect(screen.getByRole('button', { name: 'C' })).toHaveClass('text-blue-300');
  });

  it('un tono desconocido cae al por defecto (gris original)', () => {
    render(<ToolBtn tone="raro">Z</ToolBtn>);
    expect(screen.getByRole('button', { name: 'Z' })).toHaveClass('text-slate-200');
  });
});

describe('barra de herramientas: una sola fila con scroll horizontal (decisión de diseño)', () => {
  const toolbar = read('./damageEditor/components/EditorToolbar.jsx');
  const root = toolbar.match(/<div className="(flex items-center[^"]*)">/)?.[1] ?? '';

  it('es una sola fila con scroll horizontal en todos los anchos (no se envuelve en filas)', () => {
    expect(root).toContain('overflow-x-auto');
    expect(root).not.toMatch(/flex-wrap/);
    expect(root).not.toContain('sm:overflow-visible');
  });

  it('conserva la barra de desplazamiento oculta, como estaba', () => {
    expect(root).toContain('[scrollbar-width:none]');
    expect(root).toContain('[&::-webkit-scrollbar]:hidden');
  });

  it('cada grupo es indivisible (shrink-0): no se aplasta, se desplaza', () => {
    expect(read('../components/damageEditor/panels.jsx')).toMatch(/const ToolGroup[\s\S]*?flex shrink-0 items-center/);
  });

  it('conserva los cuatro grupos en orden: Edición, Medición, Imagen, Zoom', () => {
    const order = [...toolbar.matchAll(/<ToolGroup label=\{?([^}>]*)/g)].map((m) => m[1]);
    expect(order).toHaveLength(4);
    expect(order[1]).toContain('Medición');
    expect(order[2]).toContain('Imagen');
    expect(order[3]).toContain('Zoom');
  });
});

describe('ComparePanel', () => {
  const props = {
    t: (k) => k, compareImage: { section: 'SS', publicUrl: 'x.jpg' }, setCompareImage: vi.fn(),
    compareZoom: 1, setCompareZoom: vi.fn(), comparePan: { x: 0, y: 0 }, isDraggingCompare: false,
    getSectionLabel: (s) => s, handleCompareWheel: vi.fn(), handleCompareMouseDown: vi.fn(),
    handleCompareMouseMove: vi.fn(), handleCompareMouseUp: vi.fn(), resetCompareView: vi.fn(),
  };

  it('cerrar la comparación es destructivo en vino sobrio (sin rojo crudo)', () => {
    render(<ComparePanel {...props} />);
    const close = screen.getByTitle('common.closeComparison');
    expect(close).toHaveClass('bg-error-bg', 'border-error-border', 'text-error-text');
    expect(close.className).not.toMatch(/red-\d/);
  });

  it('la etiqueta "Comparando" tiene texto oscuro legible sobre el celeste', () => {
    render(<ComparePanel {...props} />);
    expect(screen.getByText(/common.comparing/, { selector: 'div' })).toHaveClass('bg-status-progress/90', 'text-surface-base');
  });
});

describe('EditorHeader (fase 10)', () => {
  const props = {
    t: (k, o) => o?.defaultValue ?? k, editingDetection: { id: 1 }, damageInfo: null, detections: [],
    downloading: false, setDownloading: () => {}, showDownloadMenu: false, setShowDownloadMenu: () => {},
    isSidebarOpen: false, setIsSidebarOpen: () => {}, imageSrc: 'x.jpg', imageAlt: 'x',
    navigationData: { projectName: 'OAXACA', wtg: 'WTG-02', blade: 'Blade A' },
    currentImage: {}, section: 'SS', project: {}, getSectionLabel: () => 'SS',
  };

  it('icono en línea dentro del sobretítulo celeste, sin caja de icono', () => {
    const { container } = render(<EditorHeader {...props} />);
    const overline = screen.getByText('OAXACA').closest('p');
    expect(overline).toHaveClass('text-info', 'flex', 'items-center');
    expect(overline.querySelector('svg')).not.toBeNull();
    expect(container.querySelector('.h-9.w-9')).toBeNull();
    expect(screen.getByRole('heading', { level: 1 })).toHaveClass('text-ink');
  });

  it('el botón de descarga (verde) usa la receta de los rojos y los amarillos: fondo tenue, hover que sube', () => {
    render(<EditorHeader {...props} />);
    const btn = screen.getByRole('button', { name: /Descargar/ });
    expect(btn).toHaveClass('border-status-done/40', 'bg-status-done/10', 'text-status-done', 'hover:bg-status-done/25');
    expect(btn.className).not.toMatch(/emerald|text-white/); // ya no es verde sólido
    // sigue siendo verde, no dorado (el anillo de foco ring-brand es común a todos y se ignora)
    expect(btn.className.split(/\s+/).filter((c) => !/ring/.test(c)).join(' ')).not.toMatch(/brand/);
  });

  it('"Editando" (era ámbar) usa el dorado nuevo', () => {
    render(<EditorHeader {...props} />);
    expect(screen.getByText('Editando')).toHaveClass('text-brand', 'border-brand/40');
  });
});

describe('ImageStage (contrato del lienzo: solo colores)', () => {
  const src = read('./damageEditor/components/ImageStage.jsx');

  it('los recuadros de detección usan los tokens de severidad (--sev-N), no hex', () => {
    [1, 2, 3, 4, 5].forEach((n) => expect(src).toContain(`"Cat ${n}": "hsl(var(--sev-${n}))"`));
    expect(src).not.toMatch(/#10B981|#84CC16|#F59E0B|#F97316|#EF4444|#6B7280/i);
  });

  it('el polígono de nueva detección usa el celeste técnico (info)', () => {
    expect(src).toContain('fill: "hsl(var(--info) / 0.2)"');
    expect(src).toContain('stroke: "hsl(var(--info))"');
    expect(src).not.toMatch(/22d3ee|rgba\(34, 211, 238/i);
  });

  it('los indicadores de selección neutros de alto contraste siguen como literales (blanco)', () => {
    expect(src).toContain('bg-white/50');
    expect(src).toContain('border-white');
    expect(src).toContain('stroke="#fff"'); // trazo de selección
    expect(src).toContain('solid white'); // borde de la caja de detección
  });

  it('no hay colores cyan crudos y las guías de medición usan info', () => {
    expect(src).not.toMatch(/cyan-\d/);
    expect(src).toContain('text-info');
  });
});

describe('alturas mínimas y panel lateral (contrato de layout)', () => {
  const page = read('./DamageEditorPage.jsx');
  const detections = read('./damageEditor/components/DetectionsPanel.jsx');

  it('la fila principal garantiza 20rem de alto para que el lienzo no se aplaste', () => {
    expect(page).toMatch(/className="flex min-h-\[20rem\] flex-1 overflow-hidden"/);
  });

  it('el panel lateral hace scroll vertical (ya no recorta con overflow-hidden) y oculta el horizontal', () => {
    const sidebar = page.match(/className=\{`flex flex-col ([^`]*?)border-l[^`]*`\}/)?.[1] ?? '';
    expect(sidebar).toContain('overflow-y-auto');
    expect(sidebar).toContain('overflow-x-hidden');
    expect(sidebar).toContain('overscroll-contain');
    expect(sidebar).not.toContain('overflow-hidden');
  });

  it('el cajón móvil usa alto dinámico del viewport (dvh) y vuelve a auto en escritorio', () => {
    expect(page).toContain('fixed inset-y-0 right-0 z-50 h-dvh');
    expect(page).toContain('lg:static lg:z-auto lg:h-auto lg:w-96');
  });

  it('la lista de detecciones garantiza 16rem en lugar de colapsar a 0', () => {
    expect(detections).toContain('min-h-[16rem]');
    expect(detections).not.toMatch(/"flex min-h-0 flex-1 flex-col p-3"/);
  });

  it('el cálculo de coordenadas del lienzo no depende del scroll (usa getBoundingClientRect)', () => {
    expect(read('./damageEditor/hooks/useCanvasInteraction.js')).toContain('getBoundingClientRect');
  });

  it('el panel de secciones y el de información conservan su altura natural', () => {
    expect(read('./damageEditor/components/SectionsPanel.jsx')).toContain('flex-shrink-0');
    expect(read('./damageEditor/components/DamageInfoPanel.jsx')).toContain('flex-shrink-0');
  });
});

describe('exclusiones respetadas', () => {
  it('downloads.js (canvas de exportación) conserva sus colores', () => {
    const dl = read('./damageEditor/utils/downloads.js');
    expect(dl).not.toMatch(/hsl\(var/); // no se tocó
  });
});
