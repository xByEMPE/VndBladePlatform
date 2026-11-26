import { describe, it, expect, vi } from 'vitest';
import maplibre, { workerUrl } from './maplibre';

const h = vi.hoisted(() => ({ setWorkerUrl: vi.fn() }));

// MapLibre 6 deduce la URL de su worker de `import.meta.url` de su propio módulo; al empaquetarlo Vite el
// worker queda fuera de ese camino ("Worker failed to load"). `maplibre.js` lo registra de forma explícita.
vi.mock('maplibre-gl', () => ({ setWorkerUrl: h.setWorkerUrl, Map: class FakeMap {} }));
vi.mock('maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url', () => ({ default: '/assets/maplibre-gl-worker-abc123.js' }));

describe('lib/maplibre', () => {
  it('registra la URL del worker empaquetado por Vite al importarse', () => {
    expect(workerUrl).toBe('/assets/maplibre-gl-worker-abc123.js');
    expect(h.setWorkerUrl).toHaveBeenCalledTimes(1);
    expect(h.setWorkerUrl).toHaveBeenCalledWith('/assets/maplibre-gl-worker-abc123.js');
  });

  it('exporta MapLibre para pasarlo a react-map-gl como `mapLib`', () => {
    expect(typeof maplibre.Map).toBe('function');
    expect(maplibre.setWorkerUrl).toBe(h.setWorkerUrl);
  });

  it('el worker se registra antes de que nadie pueda crear un mapa (no usa una URL vacía)', () => {
    expect(workerUrl).toBeTruthy();
    expect(workerUrl).not.toMatch(/^data:/);
  });
});
