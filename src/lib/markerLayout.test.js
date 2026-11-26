import { describe, it, expect } from 'vitest';
import {
  DISC_MAX,
  DOT_MIN,
  ICON_MIN,
  nearestNeighborDistances,
  chooseMarkerSize,
  markerMode,
  pickLabelIds,
  markerZIndex,
} from './markerLayout';

const row = (n, gap, y = 100) => Array.from({ length: n }, (_, i) => ({ id: `p${i}`, x: 50 + i * gap, y }));

describe('nearestNeighborDistances', () => {
  it('devuelve la distancia en píxeles al vecino más cercano de cada punto', () => {
    const d = nearestNeighborDistances([
      { id: 'a', x: 0, y: 0 },
      { id: 'b', x: 3, y: 4 },
      { id: 'c', x: 100, y: 0 },
    ]);
    expect(d[0]).toBe(5);
    expect(d[1]).toBe(5);
    expect(d[2]).toBeCloseTo(Math.hypot(97, 4), 5); // el vecino más cercano de c es b
  });

  it('con menos de 2 puntos no hay vecinos', () => {
    expect(nearestNeighborDistances([])).toEqual([]);
    expect(nearestNeighborDistances([{ id: 'a', x: 1, y: 1 }])).toEqual([]);
  });

  it('ignora puntos sin coordenadas de pantalla', () => {
    expect(nearestNeighborDistances([{ id: 'a', x: 0, y: 0 }, { id: 'b', x: NaN, y: 0 }, { id: 'c', x: 0, y: 10 }])).toEqual([10, 10]);
  });
});

describe('chooseMarkerSize', () => {
  it('sin vecinos (o mapa sin proyección) usa el tamaño máximo', () => {
    expect(chooseMarkerSize([])).toBe(DISC_MAX);
  });

  it('parque disperso: tamaño máximo', () => {
    expect(chooseMarkerSize(nearestNeighborDistances(row(10, 80)))).toBe(DISC_MAX);
  });

  it('parque denso: el círculo se reduce para no solaparse (distancia − holgura)', () => {
    const size = chooseMarkerSize(nearestNeighborDistances(row(30, 20)));
    expect(size).toBeLessThan(DISC_MAX);
    expect(size).toBeLessThanOrEqual(20 - 2);
  });

  it('nunca baja del mínimo (punto)', () => {
    expect(chooseMarkerSize(nearestNeighborDistances(row(30, 4)))).toBe(DOT_MIN);
  });

  it('no depende de un par aislado muy junto: usa un percentil bajo, no el mínimo', () => {
    const pts = [...row(40, 60), { id: 'x', x: 51, y: 100 }]; // un par casi pegado en un parque holgado
    expect(chooseMarkerSize(nearestNeighborDistances(pts))).toBe(DISC_MAX);
  });

  it('es monótono: más espacio nunca da un tamaño menor', () => {
    const sizes = [6, 10, 14, 18, 22, 26, 30, 40].map((g) => chooseMarkerSize(nearestNeighborDistances(row(20, g))));
    sizes.slice(1).forEach((s, i) => expect(s).toBeGreaterThanOrEqual(sizes[i]));
  });
});

describe('markerMode', () => {
  it('icono si el círculo es suficientemente grande para leerse; punto si no', () => {
    expect(markerMode(DISC_MAX)).toBe('icon');
    expect(markerMode(ICON_MIN)).toBe('icon');
    expect(markerMode(ICON_MIN - 1)).toBe('dot');
    expect(markerMode(DOT_MIN)).toBe('dot');
  });
});

describe('pickLabelIds', () => {
  const pts = (n, gap) => row(n, gap).map((p, i) => ({ ...p, name: `D${i}.5`, priority: 0 }));

  it('con espacio de sobra muestra todas', () => {
    expect(pickLabelIds({ points: pts(5, 80), size: 26 }).size).toBe(5);
  });

  it('en una fila apretada muestra solo las que no se pisan', () => {
    const ids = pickLabelIds({ points: pts(30, 14), size: 12 });
    expect(ids.size).toBeGreaterThan(0);
    expect(ids.size).toBeLessThan(30);
  });

  it('las etiquetas elegidas nunca se solapan entre sí', () => {
    const points = pts(30, 14);
    const ids = pickLabelIds({ points, size: 12 });
    const chosen = points.filter((p) => ids.has(p.id)).sort((a, b) => a.x - b.x);
    chosen.slice(1).forEach((p, i) => expect(p.x - chosen[i].x).toBeGreaterThanOrEqual(14 * 2)); // al menos el ancho de una etiqueta
  });

  it('da prioridad a la categoría más grave', () => {
    const points = [
      { id: 'leve', name: 'D1.1', x: 100, y: 100, priority: 1 },
      { id: 'grave', name: 'D1.2', x: 104, y: 100, priority: 5 },
    ];
    expect([...pickLabelIds({ points, size: 12 })]).toEqual(['grave']);
  });

  it('a igualdad de prioridad es estable (por nombre)', () => {
    const points = [
      { id: 'b', name: 'B', x: 100, y: 100, priority: 3 },
      { id: 'a', name: 'A', x: 102, y: 100, priority: 3 },
    ];
    expect([...pickLabelIds({ points, size: 12 })]).toEqual(['a']);
  });

  it('ignora puntos sin coordenadas de pantalla', () => {
    expect(pickLabelIds({ points: [{ id: 'a', name: 'A', x: NaN, y: 1, priority: 0 }], size: 12 }).size).toBe(0);
  });
});

describe('markerZIndex', () => {
  it('la categoría más grave queda arriba y el activo por encima de todos', () => {
    expect(markerZIndex(5, false)).toBeGreaterThan(markerZIndex(4, false));
    expect(markerZIndex(1, false)).toBeGreaterThan(markerZIndex(null, false));
    expect(markerZIndex(1, true)).toBeGreaterThan(markerZIndex(5, false));
  });
});
