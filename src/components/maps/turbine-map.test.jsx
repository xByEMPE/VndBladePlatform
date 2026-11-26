import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within, fireEvent, waitFor, act } from '@testing-library/react';
import TurbineMap from './TurbineMap';
import fs from 'node:fs';
import path from 'node:path';
import { MAP_STYLES } from '@/lib/mapStyles';
import { markerZIndex } from '@/lib/markerLayout';

// jsdom no tiene WebGL: se simula react-map-gl. El mock expone un botón para disparar `onError`
// (fallo de tiles) y cuenta los montajes para comprobar que "Reintentar" recrea el mapa.
// `point` y `container` simulan dónde cae la turbina en pantalla y el tamaño del mapa (jsdom no tiene layout).
const h = vi.hoisted(() => ({
  fitBounds: vi.fn(),
  flyTo: vi.fn(),
  mounts: 0,
  last: null,
  point: { x: 650, y: 430 },
  container: { w: 1300, h: 460 },
  projector: null, // (lngLat) => {x,y}: simula posiciones distintas en pantalla (por defecto todas caen en `point`)
}));

vi.mock('maplibre-gl/dist/maplibre-gl.css', () => ({}));
vi.mock('@/lib/maplibre', () => ({ default: { __fake: 'maplibre' }, workerUrl: '/worker.js' }));
vi.mock('react-map-gl/maplibre', async () => {
  const React = await import('react');
  const Map = React.forwardRef(({ children, onError, onLoad, mapStyle, initialViewState, mapLib }, ref) => {
    React.useImperativeHandle(ref, () => ({
      fitBounds: h.fitBounds,
      flyTo: h.flyTo,
      project: (lngLat) => (h.projector ? h.projector(lngLat) : h.point),
      getContainer: () => ({ clientWidth: h.container.w, clientHeight: h.container.h }),
    }));
    React.useEffect(() => {
      h.mounts += 1;
    }, []);
    h.last = { mapStyle, initialViewState, mapLib };
    return (
      <div data-testid="map">
        <button type="button" onClick={() => onError?.({ error: new Error('tile fail'), sourceId: 'openmaptiles' })}>
          __tile-error
        </button>
        <button type="button" onClick={() => onError?.({ error: new Error('glyph fail') })}>
          __other-error
        </button>
        <button type="button" onClick={() => onError?.({ error: Object.assign(new Error('aborted'), { name: 'AbortError' }) })}>
          __abort-error
        </button>
        <button type="button" onClick={() => onLoad?.({})}>
          __load
        </button>
        {children}
      </div>
    );
  });
  const Marker = ({ children, anchor, style }) => (
    <div data-testid="marker" data-anchor={anchor} data-z={style?.zIndex}>
      {children}
    </div>
  );
  const Popup = ({ children, onClose, anchor, offset }) => (
    <div
      data-testid="popup"
      data-anchor={anchor ?? 'auto'}
      data-offset-keys={offset && typeof offset === 'object' ? Object.keys(offset).sort().join(',') : ''}
    >
      {children}
      <button type="button" onClick={onClose}>
        __close-popup
      </button>
    </div>
  );
  const Control = () => null;
  return { default: Map, Map, Marker, Popup, NavigationControl: Control, FullscreenControl: Control };
});

// Parque mixto: coordenada registrada (T1), estimada por fotos (T2), sin ubicación (T7).
// Cat 1 a Cat 5 + "sin daños" repartidas en las turbinas con posición.
const make = (over) => ({
  model: 'V150',
  statusKey: 'done',
  statusLabel: 'Completado',
  severity: null,
  damageCount: 0,
  position: { lat: 16.56, lon: -94.73, source: 'registered' },
  ...over,
});

const MIXED = [
  make({ id: 't1', name: 'T1', severity: 1, damageCount: 2, position: { lat: 16.56, lon: -94.73, source: 'registered' } }),
  make({ id: 't2', name: 'T2', severity: 2, damageCount: 1, position: { lat: 16.57, lon: -94.72, source: 'estimated' } }),
  make({ id: 't3', name: 'T3', severity: 3, damageCount: 4, position: { lat: 16.58, lon: -94.71, source: 'registered' } }),
  make({ id: 't4', name: 'T4', severity: 4, damageCount: 3, position: { lat: 16.59, lon: -94.7, source: 'registered' } }),
  make({ id: 't5', name: 'T5', severity: 5, damageCount: 7, position: { lat: 16.6, lon: -94.69, source: 'registered' } }),
  make({ id: 't6', name: 'T6', severity: null, damageCount: 0, statusKey: 'pending', statusLabel: 'Pendiente', position: { lat: 16.61, lon: -94.68, source: 'registered' } }),
  make({ id: 't7', name: 'T7', severity: 5, damageCount: 2, position: null }),
];

const markerBtn = (name) => screen.getByRole('button', { name: new RegExp(`^Turbina ${name},`) });
const legendBtn = (label) => within(screen.getByRole('group', { name: 'Filtrar por daño' })).getByRole('button', { name: new RegExp(label) });

beforeEach(() => {
  h.fitBounds.mockClear();
  h.flyTo.mockClear();
  h.mounts = 0;
  h.last = null;
  h.point = { x: 650, y: 430 };
  h.container = { w: 1300, h: 460 };
  h.projector = null;
});

describe('TurbineMap: marcadores y colores por daño', () => {
  it('pinta un marcador por turbina con ubicación (la que no tiene posición no aparece en el mapa)', () => {
    render(<TurbineMap items={MIXED} onOpenReport={() => {}} />);
    expect(screen.getAllByTestId('marker')).toHaveLength(6);
    expect(screen.queryByRole('button', { name: /^Turbina T7,/ })).not.toBeInTheDocument();
  });

  it.each([1, 2, 3, 4, 5])('Cat %i pinta la figura con el token text-sev-%i y su etiqueta accesible', (n) => {
    render(<TurbineMap items={MIXED} onOpenReport={() => {}} />);
    const btn = markerBtn(`T${n}`);
    expect(btn.querySelector('svg')).toHaveClass(`text-sev-${n}`);
    expect(btn).toHaveAttribute('aria-label', expect.stringContaining(`Cat ${n}`));
  });

  it('sin daños / sin inspeccionar usa el neutro (no un color de severidad)', () => {
    render(<TurbineMap items={MIXED} onOpenReport={() => {}} />);
    const btn = markerBtn('T6');
    expect(btn.querySelector('svg')).toHaveClass('text-ink-muted');
    expect(btn.querySelector('svg').getAttribute('class')).not.toMatch(/text-sev-/);
    expect(btn).toHaveAttribute('aria-label', expect.stringContaining('Sin daños'));
  });

  it('un valor de severidad inválido cae en el neutro', () => {
    render(<TurbineMap items={[make({ id: 'x', name: 'X', severity: 'alta' })]} onOpenReport={() => {}} />);
    expect(markerBtn('X').querySelector('svg')).toHaveClass('text-ink-muted');
  });
});

describe('TurbineMap: aspas girando', () => {
  it('el rotor gira siempre (clase de animación en el grupo de palas, no solo al pasar el mouse)', () => {
    render(<TurbineMap items={MIXED} onOpenReport={() => {}} />);
    const rotor = markerBtn('T1').querySelector('.wind-turbine-rotor');
    expect(rotor).toBeInTheDocument();
    expect(rotor.style.transformOrigin).toMatch(/px/); // gira sobre el centro del buje
  });

  it('cada turbina arranca en una fase distinta (no giran todas sincronizadas) y es estable entre renders', () => {
    const { unmount } = render(<TurbineMap items={MIXED} onOpenReport={() => {}} />);
    const delays = MIXED.filter((i) => i.position).map((i) => markerBtn(i.name).querySelector('.wind-turbine-rotor').style.animationDelay);
    expect(new Set(delays).size).toBeGreaterThan(3);
    delays.forEach((d) => expect(d).toMatch(/^-\d+(\.\d+)?s$/));
    unmount();
    render(<TurbineMap items={MIXED} onOpenReport={() => {}} />);
    const again = MIXED.filter((i) => i.position).map((i) => markerBtn(i.name).querySelector('.wind-turbine-rotor').style.animationDelay);
    expect(again).toEqual(delays);
  });
});

describe('TurbineMap: costo de la animación', () => {
  const many = (n) =>
    Array.from({ length: n }, (_, i) =>
      make({ id: `m${i}`, name: `M${i}`, position: { lat: 16 + i * 0.001, lon: -94 - i * 0.001, source: 'registered' } }),
    );

  it('la figura animada no lleva filtros CSS (un drop-shadow sobre un SVG que gira se repinta en cada cuadro)', () => {
    render(<TurbineMap items={MIXED} onOpenReport={() => {}} />);
    const svg = markerBtn('T1').querySelector('svg');
    expect(svg.getAttribute('class')).not.toMatch(/drop-shadow|blur|filter/);
  });

  it('con pocas turbinas giran todas; con muchas (más de 60) solo gira la que tiene el cursor o está seleccionada', () => {
    const { container, unmount } = render(<TurbineMap items={many(60)} onOpenReport={() => {}} />);
    expect(container.firstChild).not.toHaveClass('turbine-map-static');
    unmount();
    const big = render(<TurbineMap items={many(61)} onOpenReport={() => {}} />);
    expect(big.container.firstChild).toHaveClass('turbine-map-static');
  });

  it('el límite cuenta las turbinas visibles: al filtrar y quedar pocas, vuelven a girar', () => {
    const items = [...many(61).map((i) => ({ ...i, severity: 5 })), make({ id: 'z', name: 'Z', severity: 1 })];
    const { container } = render(<TurbineMap items={items} onOpenReport={() => {}} />);
    expect(container.firstChild).toHaveClass('turbine-map-static');
    fireEvent.click(legendBtn('Cat 5'));
    expect(container.firstChild).not.toHaveClass('turbine-map-static');
  });
});

describe('TurbineMap: detalle al pasar el mouse (hover) y enfoque', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const advance = (ms) => act(() => vi.advanceTimersByTime(ms));

  it('al pasar el mouse sobre la turbina se abre el detalle sin hacer clic', () => {
    render(<TurbineMap items={MIXED} onOpenReport={() => {}} />);
    expect(screen.queryByTestId('popup')).not.toBeInTheDocument();
    fireEvent.mouseEnter(markerBtn('T3'));
    expect(within(screen.getByTestId('popup')).getByRole('heading', { name: 'T3' })).toBeInTheDocument();
  });

  it('al salir el mouse se cierra tras una breve espera (para poder llegar al popup)', () => {
    render(<TurbineMap items={MIXED} onOpenReport={() => {}} />);
    fireEvent.mouseEnter(markerBtn('T3'));
    fireEvent.mouseLeave(markerBtn('T3'));
    advance(100);
    expect(screen.getByTestId('popup')).toBeInTheDocument();
    advance(400);
    expect(screen.queryByTestId('popup')).not.toBeInTheDocument();
  });

  it('si el mouse pasa al popup durante la espera, no se cierra (se pueden usar sus botones)', () => {
    render(<TurbineMap items={MIXED} onOpenReport={() => {}} />);
    fireEvent.mouseEnter(markerBtn('T3'));
    fireEvent.mouseLeave(markerBtn('T3'));
    advance(100);
    fireEvent.mouseEnter(screen.getByTestId('popup').querySelector('[data-hover-card]'));
    advance(1000);
    expect(screen.getByTestId('popup')).toBeInTheDocument();
    fireEvent.mouseLeave(screen.getByTestId('popup').querySelector('[data-hover-card]'));
    advance(500);
    expect(screen.queryByTestId('popup')).not.toBeInTheDocument();
  });

  it('un clic fija el detalle: sigue abierto aunque el mouse salga', () => {
    render(<TurbineMap items={MIXED} onOpenReport={() => {}} />);
    fireEvent.mouseEnter(markerBtn('T3'));
    fireEvent.click(markerBtn('T3'));
    fireEvent.mouseLeave(markerBtn('T3'));
    advance(1000);
    expect(within(screen.getByTestId('popup')).getByRole('heading', { name: 'T3' })).toBeInTheDocument();
    expect(markerBtn('T3')).toHaveAttribute('aria-pressed', 'true');
  });

  it('con una fijada, pasar el mouse por otra muestra la de debajo del cursor y al salir vuelve a la fijada', () => {
    render(<TurbineMap items={MIXED} onOpenReport={() => {}} />);
    fireEvent.click(markerBtn('T3'));
    fireEvent.mouseEnter(markerBtn('T4'));
    expect(within(screen.getByTestId('popup')).getByRole('heading', { name: 'T4' })).toBeInTheDocument();
    fireEvent.mouseLeave(markerBtn('T4'));
    advance(500);
    expect(within(screen.getByTestId('popup')).getByRole('heading', { name: 'T3' })).toBeInTheDocument();
  });

  it('el botón de cierre cierra también la fijada', () => {
    render(<TurbineMap items={MIXED} onOpenReport={() => {}} />);
    fireEvent.click(markerBtn('T3'));
    fireEvent.click(screen.getByText('__close-popup'));
    advance(500);
    expect(screen.queryByTestId('popup')).not.toBeInTheDocument();
  });

  it('con el teclado: enfocar la turbina abre el detalle y desenfocar lo cierra', () => {
    render(<TurbineMap items={MIXED} onOpenReport={() => {}} />);
    fireEvent.focus(markerBtn('T2'));
    expect(within(screen.getByTestId('popup')).getByRole('heading', { name: 'T2' })).toBeInTheDocument();
    fireEvent.blur(markerBtn('T2'));
    advance(500);
    expect(screen.queryByTestId('popup')).not.toBeInTheDocument();
  });

  it('el detalle no queda cortado: el lado se calcula con el espacio real del mapa (no lo decide MapLibre antes de tener tamaño)', () => {
    render(<TurbineMap items={MIXED} onOpenReport={() => {}} />);
    fireEvent.mouseEnter(markerBtn('T3'));
    const popup = screen.getByTestId('popup');
    expect(popup).toHaveAttribute('data-anchor', 'bottom'); // turbina abajo del mapa: hay sitio arriba
    expect(popup.getAttribute('data-offset-keys')).toBe(
      'bottom,bottom-left,bottom-right,left,right,top,top-left,top-right',
    );
  });

  it('turbina al centro del mapa (como la turbina 25 sola): la tarjeta se abre a un lado, no abajo cortada', () => {
    h.point = { x: 650, y: 230 };
    render(<TurbineMap items={MIXED} onOpenReport={() => {}} />);
    fireEvent.mouseEnter(markerBtn('T3'));
    expect(screen.getByTestId('popup')).toHaveAttribute('data-anchor', 'left');
  });

  it('turbina en la parte alta: la tarjeta se abre hacia abajo', () => {
    h.point = { x: 650, y: 100 };
    h.container = { w: 700, h: 460 };
    render(<TurbineMap items={MIXED} onOpenReport={() => {}} />);
    fireEvent.mouseEnter(markerBtn('T3'));
    expect(screen.getByTestId('popup').getAttribute('data-anchor')).toMatch(/^top/);
  });

  it('cerca de un borde lateral la tarjeta se alinea hacia dentro', () => {
    h.point = { x: 60, y: 430 };
    render(<TurbineMap items={MIXED} onOpenReport={() => {}} />);
    fireEvent.mouseEnter(markerBtn('T3'));
    expect(screen.getByTestId('popup')).toHaveAttribute('data-anchor', 'bottom-left');
  });

  it('si el espacio es poco, la tarjeta limita su alto y desplaza por dentro (nunca se corta)', () => {
    h.point = { x: 400, y: 210 };
    h.container = { w: 800, h: 300 };
    render(<TurbineMap items={MIXED} onOpenReport={() => {}} />);
    fireEvent.mouseEnter(markerBtn('T3'));
    const card = screen.getByTestId('popup').querySelector('[data-hover-card]');
    expect(card.style.maxHeight).toMatch(/^\d+px$/);
    expect(card).toHaveClass('overflow-y-auto');
  });

  it('si el mapa aún no sabe su tamaño usa la colocación por defecto (arriba)', () => {
    h.container = { w: 0, h: 0 };
    render(<TurbineMap items={MIXED} onOpenReport={() => {}} />);
    fireEvent.mouseEnter(markerBtn('T3'));
    expect(screen.getByTestId('popup')).toHaveAttribute('data-anchor', 'bottom');
  });

  it('el detalle es una tarjeta compacta: foto a un lado de los datos (no una columna alta)', async () => {
    const items = [make({ id: 'f', name: 'F', photoPath: 'a.jpg' })];
    render(<TurbineMap items={items} onOpenReport={() => {}} getPhotoUrl={async () => 'https://x/a.jpg'} />);
    fireEvent.mouseEnter(markerBtn('F'));
    const card = screen.getByTestId('popup').querySelector('[data-hover-card]');
    expect(card.querySelector('[data-layout="side-by-side"]')).toBeInTheDocument();
  });
});

describe('TurbineMap: marcador minimalista (círculo tintado + aerogenerador)', () => {
  const disc = (name) => markerBtn(name).querySelector('[data-part="disc"]');

  it('dibuja un círculo con fondo tintado y borde del color de la categoría', () => {
    render(<TurbineMap items={MIXED} onOpenReport={() => {}} />);
    [1, 2, 3, 4, 5].forEach((n) => {
      expect(disc(`T${n}`)).toHaveClass('rounded-full', `border-sev-${n}`, `bg-sev-${n}/20`);
    });
  });

  it('el borde es fino (1.5px) y lleva un brillo sutil con el color de la categoría', () => {
    render(<TurbineMap items={MIXED} onOpenReport={() => {}} />);
    expect(disc('T5').className).toMatch(/border-\[1\.5px\]/);
    expect(disc('T5').className).toMatch(/shadow-\[0_0_\d+px_hsl\(var\(--sev-5\)\/0\.\d+\)\]/);
  });

  it('sin daños usa el neutro, sin brillo de severidad', () => {
    render(<TurbineMap items={MIXED} onOpenReport={() => {}} />);
    expect(disc('T6')).toHaveClass('border-ink-muted');
    expect(disc('T6').className).not.toMatch(/sev-/);
  });

  it('el icono interno es un aerogenerador: torre blanca (ink), buje y tres palas teñidas', () => {
    render(<TurbineMap items={MIXED} onOpenReport={() => {}} />);
    const svg = disc('T3').querySelector('svg[data-icon="wind-turbine"]');
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg).toHaveClass('text-sev-3');
    expect(svg.querySelectorAll('[data-part="blade"]')).toHaveLength(3);
    expect(svg.querySelector('[data-part="tower"]')).toHaveClass('fill-ink');
    expect(svg.querySelector('[data-part="hub"]')).toBeInTheDocument();
  });

  it('es minimalista: sin góndola, sombreados ni sombra en el suelo', () => {
    render(<TurbineMap items={MIXED} onOpenReport={() => {}} />);
    const svg = disc('T3').querySelector('svg');
    ['nacelle', 'shade', 'spinner', 'ground-shadow'].forEach((part) =>
      expect(svg.querySelector(`[data-part="${part}"]`)).toBeNull(),
    );
  });

  it('las palas están en un grupo propio (rotor) para girarlo sin mover la torre', () => {
    render(<TurbineMap items={MIXED} onOpenReport={() => {}} />);
    const rotor = disc('T1').querySelector('.wind-turbine-rotor');
    expect(rotor.querySelectorAll('[data-part="blade"]')).toHaveLength(3);
    expect(rotor.querySelector('[data-part="tower"]')).toBeNull();
  });

  it('el botón no pinta fondo propio y lleva turbine-marker (de ahí cuelgan el giro rápido y el hover)', () => {
    render(<TurbineMap items={MIXED} onOpenReport={() => {}} />);
    expect(markerBtn('T4').className).not.toMatch(/bg-sev-|rounded-full|bg-surface-card/);
    expect(markerBtn('T4')).toHaveClass('turbine-marker');
  });

  it('el círculo mide 26px de base y crece a 2x (52px) con el mouse o al seleccionar, vía la clase turbine-disc', () => {
    render(<TurbineMap items={MIXED} onOpenReport={() => {}} />);
    expect(disc('T4')).toHaveClass('turbine-disc', 'h-[26px]', 'w-[26px]');
    expect(disc('T4')).toHaveAttribute('data-active', 'false');
    fireEvent.click(markerBtn('T4'));
    expect(disc('T4')).toHaveAttribute('data-active', 'true');
  });

  it('el círculo se centra sobre la coordenada exacta (anchor center)', () => {
    render(<TurbineMap items={MIXED} onOpenReport={() => {}} />);
    screen.getAllByTestId('marker').forEach((m) => expect(m).toHaveAttribute('data-anchor', 'center'));
  });

  it('la seleccionada queda marcada con aria-pressed', () => {
    render(<TurbineMap items={MIXED} onOpenReport={() => {}} />);
    expect(markerBtn('T2')).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(markerBtn('T2'));
    expect(markerBtn('T2')).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('TurbineMap: etiquetas de texto plano', () => {
  const labelOf = (name) => within(markerBtn(name)).getByText(name);
  const many = Array.from({ length: 20 }, (_, i) =>
    make({ id: `m${i}`, name: `M${i}`, position: { lat: 16 + i * 0.001, lon: -94 - i * 0.001, source: 'registered' } }),
  );

  it('son texto plano pequeño y gris suave, sin caja ni borde', () => {
    render(<TurbineMap items={MIXED} onOpenReport={() => {}} />);
    const label = labelOf('T3');
    expect(label).toHaveClass('turbine-marker-label', 'text-ink-muted', 'text-[10px]');
    expect(label.className).not.toMatch(/\b(bg-|border|shadow|rounded|px-|py-)/);
  });

  it('van debajo del círculo y no deforman el marcador (truncadas)', () => {
    render(<TurbineMap items={[make({ id: 'l', name: 'WTG-025-BLOQUE-NORTE-LARGO' })]} onOpenReport={() => {}} />);
    expect(labelOf('WTG-025-BLOQUE-NORTE-LARGO')).toHaveClass('truncate', 'top-full');
  });

  it('si caben (parque disperso) se ven todas', () => {
    h.projector = ([lon]) => ({ x: 100 + Math.round((-94 - lon) / 0.001) * 80, y: 200 });
    render(<TurbineMap items={many} onOpenReport={() => {}} />);
    many.forEach((m) => expect(labelOf(m.name)).not.toHaveClass('turbine-label-hidden'));
  });
});

describe('TurbineMap: densidad (tamaño, punto y etiquetas según el espacio en pantalla)', () => {
  const many = Array.from({ length: 20 }, (_, i) =>
    make({
      id: `m${i}`,
      name: `D${i}.5`,
      severity: i % 4 === 0 ? 5 : 3,
      position: { lat: 16 + i * 0.001, lon: -94 - i * 0.001, source: 'registered' },
    }),
  );
  const spread = (gap) => ([lon]) => ({ x: 100 + Math.round((-94 - lon) / 0.001) * gap, y: 200 });
  const disc = (name) => markerBtn(name).querySelector('[data-part="disc"]');
  const labelOf = (name) => within(markerBtn(name)).getByText(name);

  it('parque disperso: círculos de 26px en modo icono, sin punto', () => {
    h.projector = spread(80);
    render(<TurbineMap items={many} onOpenReport={() => {}} />);
    expect(disc('D1.5')).toHaveAttribute('data-mode', 'icon');
    expect(disc('D1.5').style.getPropertyValue('--disc-rest')).toBe('1');
    expect(markerBtn('D1.5').style.width).toBe('26px');
    expect(disc('D1.5').querySelector('[data-part="dot"]')).toBeNull();
  });

  it('parque denso (los círculos se pisarían): se dibujan como puntos pequeños que no se solapan', () => {
    h.projector = spread(14);
    render(<TurbineMap items={many} onOpenReport={() => {}} />);
    const d = disc('D1.5');
    expect(d).toHaveAttribute('data-mode', 'dot');
    expect(d.querySelector('[data-part="dot"]')).toBeInTheDocument();
    const size = parseInt(markerBtn('D1.5').style.width, 10);
    expect(size).toBeLessThan(14); // menor que la separación: no se tocan
    expect(size).toBeGreaterThanOrEqual(10);
    expect(Number(d.style.getPropertyValue('--disc-rest'))).toBeCloseTo(size / 26, 2);
  });

  it('el punto usa el color de la categoría', () => {
    h.projector = spread(14);
    render(<TurbineMap items={many} onOpenReport={() => {}} />);
    expect(disc('D0.5').querySelector('[data-part="dot"]')).toHaveClass('bg-sev-5');
    expect(disc('D1.5').querySelector('[data-part="dot"]')).toHaveClass('bg-sev-3');
  });

  it('un tamaño intermedio mantiene el icono mientras se lea', () => {
    h.projector = spread(24);
    render(<TurbineMap items={many} onOpenReport={() => {}} />);
    expect(disc('D1.5')).toHaveAttribute('data-mode', 'icon');
    const size = parseInt(markerBtn('D1.5').style.width, 10);
    expect(size).toBeGreaterThanOrEqual(18);
    expect(size).toBeLessThan(26);
  });

  it('en un parque denso solo se muestran las etiquetas que no se pisan; el resto se revela con hover o foco', () => {
    h.projector = spread(14);
    render(<TurbineMap items={many} onOpenReport={() => {}} />);
    const hiddenCount = many.filter((m) => labelOf(m.name).classList.contains('turbine-label-hidden')).length;
    expect(hiddenCount).toBeGreaterThan(0);
    expect(hiddenCount).toBeLessThan(many.length);
  });

  it('las etiquetas visibles son las de mayor severidad', () => {
    h.projector = spread(14);
    render(<TurbineMap items={many} onOpenReport={() => {}} />);
    expect(labelOf('D0.5')).not.toHaveClass('turbine-label-hidden'); // Cat 5
    expect(labelOf('D1.5')).toHaveClass('turbine-label-hidden'); // Cat 3 pegada a una Cat 5
  });

  it('la etiqueta del marcador activo siempre se ve', () => {
    h.projector = spread(14);
    render(<TurbineMap items={many} onOpenReport={() => {}} />);
    expect(labelOf('D1.5')).toHaveClass('turbine-label-hidden');
    fireEvent.mouseEnter(markerBtn('D1.5'));
    expect(labelOf('D1.5')).not.toHaveClass('turbine-label-hidden');
  });

  it('el botón mide lo mismo que el círculo en reposo (el área de clic no tapa al vecino)', () => {
    h.projector = spread(14);
    render(<TurbineMap items={many} onOpenReport={() => {}} />);
    const size = parseInt(markerBtn('D1.5').style.width, 10);
    expect(markerBtn('D1.5').style.height).toBe(`${size}px`);
  });

  it('apilado: la categoría más grave queda arriba y el activo sobre todos', () => {
    render(<TurbineMap items={MIXED} onOpenReport={() => {}} />);
    const z = (name) => Number(markerBtn(name).closest('[data-testid="marker"]').getAttribute('data-z'));
    expect(z('T5')).toBeGreaterThan(z('T4'));
    expect(z('T4')).toBeGreaterThan(z('T1'));
    expect(z('T1')).toBeGreaterThan(z('T6')); // sin daños, al fondo
    fireEvent.mouseEnter(markerBtn('T1'));
    expect(z('T1')).toBeGreaterThan(z('T5'));
  });

  it('si el mapa no puede proyectar, no rompe: círculos de 26px', () => {
    h.projector = () => {
      throw new Error('mapa no listo');
    };
    render(<TurbineMap items={MIXED} onOpenReport={() => {}} />);
    expect(markerBtn('T3').querySelector('[data-part="disc"]')).toHaveAttribute('data-mode', 'icon');
  });
});

describe('turbine-map.css: etiquetas', () => {
  const css = fs.readFileSync(path.resolve(__dirname, 'turbine-map.css'), 'utf8');
  it('el popup de detalle queda por encima de cualquier marcador (z-index > 1000)', () => {
    const m = css.match(/\.maplibregl-popup\.turbine-map-popup\s*{[^}]*z-index:\s*(\d+)/);
    expect(m).not.toBeNull();
    expect(Number(m[1])).toBeGreaterThan(markerZIndex(1, true));
  });

  it('llevan un text-shadow oscuro para leerse sobre el mapa', () => {
    expect(css).toMatch(/\.turbine-marker-label\s*{[^}]*text-shadow:[^;]*surface-base/);
  });

  it('las ocultas por colisión se revelan con hover o foco', () => {
    expect(css).toMatch(/\.turbine-marker:hover\s+\.turbine-label-hidden/);
    expect(css).toMatch(/\.turbine-marker:focus-visible\s+\.turbine-label-hidden/);
  });

  it('el círculo crece a 2x con hover, foco o activo, y en reposo usa --disc-rest', () => {
    expect(css).toMatch(/\.turbine-disc\s*{[^}]*scale\(var\(--disc-rest/);
    expect(css).toMatch(/\.turbine-marker:hover\s+\.turbine-disc[\s\S]*?scale\(2\)/);
    expect(css).toMatch(/\.turbine-disc\[data-active='true'\]/);
  });

  it('en modo punto el icono queda oculto en reposo y el punto se oculta al crecer', () => {
    expect(css).toMatch(/\.turbine-disc\[data-mode='dot'\][^{]*\.wind-turbine-icon-wrap[^{]*{[^}]*opacity:\s*0/);
    expect(css).toMatch(/\.turbine-dot\b/);
  });
});

describe('TurbineMap: foto de la turbina en el popup', () => {
  const withPhoto = [make({ id: 'f', name: 'F', photoPath: 'LA BUFA/F/ID/foto.JPG' })];

  it('muestra la foto firmada (la URL se resuelve al abrir el popup)', async () => {
    const getPhotoUrl = vi.fn().mockResolvedValue('https://signed.example/foto.jpg');
    render(<TurbineMap items={withPhoto} onOpenReport={() => {}} getPhotoUrl={getPhotoUrl} />);
    expect(getPhotoUrl).not.toHaveBeenCalled(); // no se pide hasta abrir el popup
    fireEvent.click(markerBtn('F'));
    await waitFor(() => expect(getPhotoUrl).toHaveBeenCalledWith('LA BUFA/F/ID/foto.JPG'));
    expect(getPhotoUrl).toHaveBeenCalledTimes(1);
    const img = await within(screen.getByTestId('popup')).findByRole('img', { name: 'Foto de la turbina F' });
    expect(img).toHaveAttribute('src', 'https://signed.example/foto.jpg');
    expect(img).toHaveAttribute('loading', 'lazy');
  });

  it('mientras se firma la URL muestra un esqueleto', () => {
    const getPhotoUrl = vi.fn(() => new Promise(() => {}));
    render(<TurbineMap items={withPhoto} onOpenReport={() => {}} getPhotoUrl={getPhotoUrl} />);
    fireEvent.click(markerBtn('F'));
    expect(within(screen.getByTestId('popup')).getByRole('status', { name: 'Cargando foto' })).toBeInTheDocument();
  });

  it('sin foto no muestra imagen ni pide nada', () => {
    const getPhotoUrl = vi.fn();
    render(<TurbineMap items={MIXED} onOpenReport={() => {}} getPhotoUrl={getPhotoUrl} />);
    fireEvent.click(markerBtn('T1'));
    expect(within(screen.getByTestId('popup')).queryByRole('img')).not.toBeInTheDocument();
    expect(getPhotoUrl).not.toHaveBeenCalled();
  });

  it('con foto pero sin getPhotoUrl no rompe y no muestra imagen', () => {
    render(<TurbineMap items={withPhoto} onOpenReport={() => {}} />);
    fireEvent.click(markerBtn('F'));
    expect(within(screen.getByTestId('popup')).queryByRole('img')).not.toBeInTheDocument();
  });

  it('si la URL no se puede firmar (rechazo o vacía) el popup sigue funcionando sin foto', async () => {
    const getPhotoUrl = vi.fn().mockRejectedValue(new Error('denied'));
    render(<TurbineMap items={withPhoto} onOpenReport={() => {}} getPhotoUrl={getPhotoUrl} />);
    fireEvent.click(markerBtn('F'));
    await waitFor(() =>
      expect(within(screen.getByTestId('popup')).queryByRole('status', { name: 'Cargando foto' })).not.toBeInTheDocument(),
    );
    const popup = within(screen.getByTestId('popup'));
    expect(popup.queryByRole('img')).not.toBeInTheDocument();
    expect(popup.getByRole('heading', { name: 'F' })).toBeInTheDocument();
  });

  it('si la imagen no carga (error de red/permiso) se oculta en vez de mostrar un icono roto', async () => {
    const getPhotoUrl = vi.fn().mockResolvedValue('https://signed.example/rota.jpg');
    render(<TurbineMap items={withPhoto} onOpenReport={() => {}} getPhotoUrl={getPhotoUrl} />);
    fireEvent.click(markerBtn('F'));
    const img = await within(screen.getByTestId('popup')).findByRole('img');
    fireEvent.error(img);
    expect(within(screen.getByTestId('popup')).queryByRole('img')).not.toBeInTheDocument();
  });

  it('al cambiar de turbina no mezcla la foto de la anterior', async () => {
    const items = [
      make({ id: 'a', name: 'A', photoPath: 'a.jpg', position: { lat: 1, lon: 1, source: 'registered' } }),
      make({ id: 'b', name: 'B', photoPath: 'b.jpg', position: { lat: 2, lon: 2, source: 'registered' } }),
    ];
    const getPhotoUrl = vi.fn(async (p) => `https://signed.example/${p}`);
    render(<TurbineMap items={items} onOpenReport={() => {}} getPhotoUrl={getPhotoUrl} />);
    fireEvent.click(markerBtn('A'));
    expect(await screen.findByRole('img', { name: 'Foto de la turbina A' })).toHaveAttribute('src', 'https://signed.example/a.jpg');
    fireEvent.click(markerBtn('B'));
    const img = await screen.findByRole('img', { name: 'Foto de la turbina B' });
    expect(img).toHaveAttribute('src', 'https://signed.example/b.jpg');
    expect(screen.queryByRole('img', { name: 'Foto de la turbina A' })).not.toBeInTheDocument();
  });
});

describe('TurbineMap: leyenda y filtros', () => {
  it('muestra Cat 1–5 y "Sin daños" con su conteo (incluye las turbinas sin ubicación)', () => {
    render(<TurbineMap items={MIXED} onOpenReport={() => {}} />);
    [1, 2, 3, 4].forEach((n) => expect(legendBtn(`Cat ${n}`)).toHaveTextContent('1'));
    expect(legendBtn('Cat 5')).toHaveTextContent('2'); // T5 + T7 (sin ubicación)
    expect(legendBtn('Sin daños')).toHaveTextContent('1');
    expect(legendBtn('Cat 1')).toHaveAttribute('aria-pressed', 'true');
  });

  it('desactivar una categoría oculta sus marcadores; volver a activarla los restaura', () => {
    render(<TurbineMap items={MIXED} onOpenReport={() => {}} />);
    fireEvent.click(legendBtn('Cat 5'));
    expect(legendBtn('Cat 5')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByRole('button', { name: /^Turbina T5,/ })).not.toBeInTheDocument();
    expect(screen.getAllByTestId('marker')).toHaveLength(5);

    fireEvent.click(legendBtn('Cat 5'));
    expect(markerBtn('T5')).toBeInTheDocument();
    expect(screen.getAllByTestId('marker')).toHaveLength(6);
  });

  it('combina filtros y filtra "Sin daños"', () => {
    render(<TurbineMap items={MIXED} onOpenReport={() => {}} />);
    fireEvent.click(legendBtn('Sin daños'));
    fireEvent.click(legendBtn('Cat 1'));
    fireEvent.click(legendBtn('Cat 2'));
    expect(screen.getAllByTestId('marker')).toHaveLength(3);
    expect(screen.queryByRole('button', { name: /^Turbina T6,/ })).not.toBeInTheDocument();
    expect(markerBtn('T3')).toBeInTheDocument();
  });

  it('con todas las categorías desactivadas avisa de que ningún marcador coincide', () => {
    render(<TurbineMap items={MIXED} onOpenReport={() => {}} />);
    ['Cat 1', 'Cat 2', 'Cat 3', 'Cat 4', 'Cat 5', 'Sin daños'].forEach((l) => fireEvent.click(legendBtn(l)));
    expect(screen.queryAllByTestId('marker')).toHaveLength(0);
    expect(screen.getByRole('status')).toHaveTextContent('Ningún marcador coincide con el filtro');
  });

  it('filtrar cierra el popup de una turbina que deja de estar visible', () => {
    render(<TurbineMap items={MIXED} onOpenReport={() => {}} />);
    fireEvent.click(markerBtn('T5'));
    expect(screen.getByTestId('popup')).toBeInTheDocument();
    fireEvent.click(legendBtn('Cat 5'));
    expect(screen.queryByTestId('popup')).not.toBeInTheDocument();
  });
});

describe('TurbineMap: popup', () => {
  it('muestra origen de la coordenada, severidad máxima, daños, estado y abre el reporte', () => {
    const onOpenReport = vi.fn();
    render(<TurbineMap items={MIXED} onOpenReport={onOpenReport} />);
    fireEvent.click(markerBtn('T4'));
    const popup = within(screen.getByTestId('popup'));
    expect(popup.getByRole('heading', { name: 'T4' })).toBeInTheDocument();
    expect(popup.getByText('V150')).toBeInTheDocument();
    expect(popup.getByText('Completado')).toBeInTheDocument();
    expect(popup.getByText('Coordenada registrada')).toBeInTheDocument();
    expect(popup.getByText('Cat 4')).toBeInTheDocument();
    expect(popup.getByText('3')).toBeInTheDocument(); // daños

    fireEvent.click(popup.getByRole('button', { name: /Click para ver reporte/ }));
    expect(onOpenReport).toHaveBeenCalledTimes(1);
    expect(onOpenReport.mock.calls[0][0].id).toBe('t4');
  });

  it('indica "Estimada por fotos" cuando la posición no es la registrada', () => {
    render(<TurbineMap items={MIXED} onOpenReport={() => {}} />);
    fireEvent.click(markerBtn('T2'));
    expect(within(screen.getByTestId('popup')).getByText('Estimada por fotos')).toBeInTheDocument();
  });

  it('el contenido va ordenado: datos a todo el ancho (sin envolver), y el botón de ver reporte junto al de eliminar', () => {
    render(<TurbineMap items={MIXED} onOpenReport={() => {}} onDeleteReport={() => {}} />);
    fireEvent.click(markerBtn('T4'));
    const card = screen.getByTestId('popup').querySelector('[data-hover-card]');
    const rows = card.querySelectorAll('dl > div');
    expect(rows).toHaveLength(3); // posición, severidad máxima, daños
    rows.forEach((row) => expect(row.querySelector('dt')).toBeInTheDocument());
    expect(card.querySelector('dd.whitespace-nowrap, dd [class*="whitespace-nowrap"]')).toBeInTheDocument();
    const actions = card.querySelector('[data-actions]');
    expect(within(actions).getByRole('button', { name: /Click para ver reporte/ })).toBeInTheDocument();
    expect(within(actions).getByRole('button', { name: 'Eliminar reporte de T4' })).toBeInTheDocument();
  });

  it('una turbina sin daños dice "Ninguna" en severidad máxima', () => {
    render(<TurbineMap items={MIXED} onOpenReport={() => {}} />);
    fireEvent.click(markerBtn('T6'));
    const popup = within(screen.getByTestId('popup'));
    expect(popup.getByText('Ninguna')).toBeInTheDocument();
    expect(popup.queryByText('Sin daños registrados')).not.toBeInTheDocument();
  });

  it('se cierra con el botón de cierre del popup', () => {
    render(<TurbineMap items={MIXED} onOpenReport={() => {}} />);
    fireEvent.click(markerBtn('T1'));
    fireEvent.click(screen.getByText('__close-popup'));
    expect(screen.queryByTestId('popup')).not.toBeInTheDocument();
  });
});

describe('TurbineMap: permisos y disponibilidad del reporte', () => {
  it('solo lectura (sin onDeleteReport): no hay acción de eliminar ni en el popup ni en la bandeja', () => {
    render(<TurbineMap items={MIXED} onOpenReport={() => {}} />);
    fireEvent.click(markerBtn('T4'));
    expect(screen.queryByRole('button', { name: /Eliminar reporte/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/Eliminar/)).not.toBeInTheDocument();
  });

  it('con onDeleteReport (admin/dev) el popup y la bandeja ofrecen eliminar', () => {
    const onDeleteReport = vi.fn();
    render(<TurbineMap items={MIXED} onOpenReport={() => {}} onDeleteReport={onDeleteReport} />);
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar reporte de T7' })); // bandeja
    expect(onDeleteReport.mock.calls[0][0].id).toBe('t7');

    fireEvent.click(markerBtn('T4'));
    fireEvent.click(within(screen.getByTestId('popup')).getByRole('button', { name: 'Eliminar reporte de T4' }));
    expect(onDeleteReport.mock.calls[1][0].id).toBe('t4');
  });

  it('el botón de eliminar es rojo (estilo de peligro del Design System) para distinguirse, en el popup y en la bandeja', () => {
    render(<TurbineMap items={MIXED} onOpenReport={() => {}} onDeleteReport={() => {}} />);
    const tray = screen.getByRole('button', { name: 'Eliminar reporte de T7' });
    fireEvent.click(markerBtn('T4'));
    const popup = within(screen.getByTestId('popup')).getByRole('button', { name: 'Eliminar reporte de T4' });
    [tray, popup].forEach((btn) => {
      expect(btn).toHaveClass('border-error-border', 'bg-error-bg', 'text-error-text');
      expect(btn.className).not.toMatch(/text-ink-muted/); // ya no es gris
    });
  });

  it('el botón de eliminar mantiene el mismo tamaño de la fila de acciones (cuadrado de 40 px)', () => {
    render(<TurbineMap items={MIXED} onOpenReport={() => {}} onDeleteReport={() => {}} />);
    fireEvent.click(markerBtn('T4'));
    const btn = within(screen.getByTestId('popup')).getByRole('button', { name: 'Eliminar reporte de T4' });
    expect(btn).toHaveClass('w-10', 'shrink-0');
  });

  it('si el reporte aún no está completo no ofrece abrirlo y lo explica', () => {
    const items = [make({ id: 'p', name: 'P', canOpenReport: false, statusKey: 'progress', statusLabel: 'En progreso' })];
    render(<TurbineMap items={items} onOpenReport={() => {}} />);
    fireEvent.click(markerBtn('P'));
    const popup = within(screen.getByTestId('popup'));
    expect(popup.queryByRole('button', { name: /Click para ver reporte/ })).not.toBeInTheDocument();
    expect(popup.getByText('El reporte estará disponible al completar la inspección')).toBeInTheDocument();
  });

  it('en la bandeja, una turbina sin reporte disponible se lista pero no es accionable', () => {
    const onOpenReport = vi.fn();
    const items = [
      MIXED[0],
      make({ id: 'u', name: 'U', position: null, canOpenReport: false, statusKey: 'pending', statusLabel: 'Pendiente' }),
    ];
    render(<TurbineMap items={items} onOpenReport={onOpenReport} />);
    const tray = screen.getByRole('group', { name: /Turbinas sin ubicación/ });
    expect(within(tray).getByText('U')).toBeInTheDocument();
    expect(within(tray).queryByRole('button', { name: /^U/ })).not.toBeInTheDocument();
  });
});

describe('TurbineMap: bandeja "Turbinas sin ubicación"', () => {
  it('aparece solo cuando hay turbinas sin posición válida y las mantiene accesibles', () => {
    const onOpenReport = vi.fn();
    render(<TurbineMap items={MIXED} onOpenReport={onOpenReport} />);
    const tray = screen.getByRole('group', { name: /Turbinas sin ubicación/ });
    expect(tray).toHaveTextContent('Turbinas sin ubicación (1)');
    fireEvent.click(within(tray).getByRole('button', { name: /T7/ }));
    expect(onOpenReport.mock.calls[0][0].id).toBe('t7');
  });

  it('no aparece si todas las turbinas tienen ubicación', () => {
    render(<TurbineMap items={MIXED.filter((i) => i.position)} onOpenReport={() => {}} />);
    expect(screen.queryByText(/Turbinas sin ubicación/)).not.toBeInTheDocument();
  });

  it('sigue visible aunque el filtro oculte la categoría de esa turbina', () => {
    render(<TurbineMap items={MIXED} onOpenReport={() => {}} />);
    fireEvent.click(legendBtn('Cat 5'));
    expect(screen.getByRole('button', { name: /T7/ })).toBeInTheDocument();
  });
});

describe('TurbineMap: estados vacíos', () => {
  it('sin turbinas muestra el estado vacío y no crea el mapa', () => {
    render(<TurbineMap items={[]} onOpenReport={() => {}} />);
    expect(screen.getByText('No hay turbinas para mostrar en el mapa')).toBeInTheDocument();
    expect(screen.queryByTestId('map')).not.toBeInTheDocument();
  });

  it('si ninguna tiene ubicación, no crea el mapa pero deja la bandeja con todas', () => {
    render(<TurbineMap items={MIXED.filter((i) => !i.position)} onOpenReport={() => {}} />);
    expect(screen.getByText('Ninguna turbina tiene ubicación')).toBeInTheDocument();
    expect(screen.queryByTestId('map')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /T7/ })).toBeInTheDocument();
  });
});

describe('TurbineMap: error de tiles con reintento', () => {
  it('muestra el aviso, y "Reintentar" lo quita y recrea el mapa', () => {
    render(<TurbineMap items={MIXED} onOpenReport={() => {}} />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(h.mounts).toBe(1);

    fireEvent.click(screen.getByText('__tile-error'));
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('No se pudo cargar el mapa');

    fireEvent.click(within(alert).getByRole('button', { name: 'Reintentar' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(h.mounts).toBe(2);
  });

  it('registra en consola el detalle técnico del error (mensaje, estado, url, fuente)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(<TurbineMap items={MIXED} onOpenReport={() => {}} />);
    fireEvent.click(screen.getByText('__tile-error'));
    expect(warn).toHaveBeenCalledWith(
      '[TurbineMap] error del mapa',
      expect.objectContaining({ message: 'tile fail', sourceId: 'openmaptiles' }),
    );
    warn.mockRestore();
  });

  it('antes de que el mapa cargue, cualquier error cuenta como fallo', () => {
    render(<TurbineMap items={MIXED} onOpenReport={() => {}} />);
    fireEvent.click(screen.getByText('__other-error'));
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('con el mapa ya cargado, un error de un recurso suelto (glifo, sprite) no muestra el aviso', () => {
    render(<TurbineMap items={MIXED} onOpenReport={() => {}} />);
    fireEvent.click(screen.getByText('__load'));
    fireEvent.click(screen.getByText('__other-error'));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('con el mapa ya cargado, un error de teselas (fuente) sí muestra el aviso', () => {
    render(<TurbineMap items={MIXED} onOpenReport={() => {}} />);
    fireEvent.click(screen.getByText('__load'));
    fireEvent.click(screen.getByText('__tile-error'));
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('una petición cancelada (AbortError) se ignora', () => {
    render(<TurbineMap items={MIXED} onOpenReport={() => {}} />);
    fireEvent.click(screen.getByText('__abort-error'));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('el error del mapa no oculta la bandeja ni la leyenda', () => {
    render(<TurbineMap items={MIXED} onOpenReport={() => {}} />);
    fireEvent.click(screen.getByText('__tile-error'));
    expect(screen.getByRole('button', { name: /T7/ })).toBeInTheDocument();
    expect(legendBtn('Cat 1')).toBeInTheDocument();
  });
});

describe('TurbineMap: vista inicial, recentrar y estilo', () => {
  it('con varias turbinas se encuadra a todas con margen', () => {
    render(<TurbineMap items={MIXED} onOpenReport={() => {}} />);
    expect(h.last.initialViewState.bounds).toEqual([
      [-94.73, 16.56],
      [-94.68, 16.61],
    ]);
    expect(h.last.initialViewState.fitBoundsOptions).toEqual({ padding: 60, maxZoom: 14 });
  });

  it('con una sola turbina se centra en ella con zoom fijo', () => {
    render(<TurbineMap items={[MIXED[0]]} onOpenReport={() => {}} />);
    expect(h.last.initialViewState).toEqual({ longitude: -94.73, latitude: 16.56, zoom: 13 });
  });

  it('"Recentrar" vuelve a encuadrar a todas las turbinas (aunque haya un filtro activo)', () => {
    render(<TurbineMap items={MIXED} onOpenReport={() => {}} />);
    fireEvent.click(legendBtn('Cat 5'));
    fireEvent.click(screen.getByRole('button', { name: 'Recentrar mapa' }));
    expect(h.fitBounds).toHaveBeenCalledWith(
      [
        [-94.73, 16.56],
        [-94.68, 16.61],
      ],
      expect.objectContaining({ padding: 60, maxZoom: 14 }),
    );
  });

  it('"Recentrar" con una sola turbina vuela a ella', () => {
    render(<TurbineMap items={[MIXED[0]]} onOpenReport={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Recentrar mapa' }));
    expect(h.flyTo).toHaveBeenCalledWith(expect.objectContaining({ center: [-94.73, 16.56], zoom: 13 }));
  });

  it('usa el MapLibre de lib/maplibre (con el worker ya registrado) y no el import por defecto', () => {
    render(<TurbineMap items={MIXED} onOpenReport={() => {}} />);
    expect(h.last.mapLib).toEqual({ __fake: 'maplibre' });
  });

  it('el estilo viene de la configuración: oscuro por defecto, claro por prop', () => {
    const { unmount } = render(<TurbineMap items={MIXED} onOpenReport={() => {}} />);
    expect(h.last.mapStyle).toBe(MAP_STYLES.dark.url);
    unmount();
    render(<TurbineMap items={MIXED} onOpenReport={() => {}} styleKey="light" />);
    expect(h.last.mapStyle).toBe(MAP_STYLES.light.url);
  });
});

describe('TurbineMap: badges de alerta en Cat 4 y Cat 5', () => {
  const badgeOf = (name) => markerBtn(name).querySelector('[data-badge]');

  it('Cat 4 lleva un badge triangular de advertencia con pulso', () => {
    render(<TurbineMap items={MIXED} onOpenReport={() => {}} />);
    const badge = badgeOf('T4');
    expect(badge).toHaveAttribute('data-badge', 'warning');
    expect(badge).toHaveClass('turbine-badge-pulse', 'text-sev-4');
    expect(badge.querySelector('polygon, path')).toBeTruthy();
  });

  it('Cat 5 lleva un badge circular rojo con signo de exclamación y parpadeo', () => {
    render(<TurbineMap items={MIXED} onOpenReport={() => {}} />);
    const badge = badgeOf('T5');
    expect(badge).toHaveAttribute('data-badge', 'critical');
    expect(badge).toHaveClass('turbine-badge-blink', 'text-sev-5');
    expect(badge.querySelector('circle')).toBeTruthy();
  });

  it.each(['T1', 'T2', 'T3', 'T6'])('%s (Cat 1–3 o sin daños) no lleva badge', (name) => {
    render(<TurbineMap items={MIXED} onOpenReport={() => {}} />);
    expect(badgeOf(name)).toBeNull();
  });

  it('el badge es decorativo (la severidad ya va en la etiqueta del botón) y queda en la esquina superior derecha', () => {
    render(<TurbineMap items={MIXED} onOpenReport={() => {}} />);
    const badge = badgeOf('T5');
    expect(badge).toHaveAttribute('aria-hidden', 'true');
    expect(badge).toHaveClass('pointer-events-none', 'absolute', '-right-1', '-top-1');
  });
});

describe('turbine-map.css: animaciones de los badges', () => {
  const css = fs.readFileSync(path.resolve(__dirname, 'turbine-map.css'), 'utf8');
  const keyframes = (name) => {
    const start = css.indexOf(`@keyframes ${name}`);
    if (start < 0) return '';
    const open = css.indexOf('{', start);
    let depth = 0;
    for (let i = open; i < css.length; i += 1) {
      if (css[i] === '{') depth += 1;
      if (css[i] === '}' && --depth === 0) return css.slice(open + 1, i);
    }
    return '';
  };

  it.each(['turbine-badge-pulse', 'turbine-badge-blink'])('%s anima solo opacity y transform', (name) => {
    const body = keyframes(name);
    expect(body).not.toBe('');
    const props = [...body.matchAll(/([a-z-]+)\s*:/g)].map((m) => m[1]);
    expect(props.length).toBeGreaterThan(0);
    props.forEach((p) => expect(['opacity', 'transform']).toContain(p));
    expect(css).toContain(`animation: ${name}`);
  });

  it('no usa box-shadow ni drop-shadow en las animaciones de los badges', () => {
    ['turbine-badge-pulse', 'turbine-badge-blink'].forEach((name) => {
      expect(keyframes(name)).not.toMatch(/box-shadow|drop-shadow/);
    });
  });

  it('prefers-reduced-motion: reduce desactiva pulso y parpadeo', () => {
    const at = css.indexOf('@media (prefers-reduced-motion: reduce)');
    const reduced = css.slice(at, css.indexOf('/* Tema del popup'));
    expect(reduced).toContain('turbine-badge-pulse');
    expect(reduced).toContain('turbine-badge-blink');
    expect(reduced).toMatch(/animation:\s*none/);
  });
});
