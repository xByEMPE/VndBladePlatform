import { describe, it, expect } from 'vitest';
import { buildMapItems } from './mapItems';

const status = () => ({ key: 'done', label: 'Completado' });
const turbine = (over) => ({ id: 'a', turbine_name: '25', model: 'V150', coordinates: {}, ...over });
const build = (turbines, mapRows, opts = {}) =>
  buildMapItems({ turbines, mapRows, resolveStatus: status, canOpenReport: () => true, ...opts });

describe('buildMapItems', () => {
  it('prioriza la coordenada registrada sobre la estimada por fotos', () => {
    const [item] = build(
      [turbine({ coordinates: { lat: 17, lng: -95 } })],
      [{ turbine_id: 'a', est_lat: 16.5, est_lon: -94.7, max_severity: null, damage_count: 0 }],
    );
    expect(item.position).toEqual({ lat: 17, lon: -95, source: 'registered' });
  });

  it('usa la estimada por fotos si no hay coordenada registrada (turbina 25 real)', () => {
    const [item] = build(
      [turbine()],
      [{ turbine_id: 'a', est_lat: 16.5636319583333, est_lon: -94.7367270972222, max_severity: null, damage_count: 0, gps_samples: 212 }],
    );
    expect(item.position).toEqual({ lat: 16.5636319583333, lon: -94.7367270972222, source: 'estimated' });
  });

  it('sin coordenada ni estimación la posición es null (bandeja "sin ubicación")', () => {
    expect(build([turbine()], [])[0].position).toBeNull();
    expect(build([turbine()], null)[0].position).toBeNull();
    expect(build([turbine()], [{ turbine_id: 'a', est_lat: null, est_lon: null }])[0].position).toBeNull();
  });

  it('copia severidad máxima y número de daños de la RPC', () => {
    const [item] = build([turbine()], [{ turbine_id: 'a', max_severity: 4, damage_count: 3, est_lat: 1, est_lon: 1 }]);
    expect(item.severity).toBe(4);
    expect(item.damageCount).toBe(3);
  });

  it('sin fila de la RPC o con la RPC caída: severidad null y 0 daños (color neutro)', () => {
    [build([turbine()], []), build([turbine()], null)].forEach(([item]) => {
      expect(item.severity).toBeNull();
      expect(item.damageCount).toBe(0);
    });
  });

  it('descarta severidades fuera de 1–5', () => {
    expect(build([turbine()], [{ turbine_id: 'a', max_severity: 9, damage_count: 1 }])[0].severity).toBeNull();
  });

  it('solo incluye las turbinas recibidas (p. ej. un cliente solo recibe las aprobadas)', () => {
    const rows = [
      { turbine_id: 'a', max_severity: 5, damage_count: 1 },
      { turbine_id: 'b', max_severity: 5, damage_count: 1 },
    ];
    const items = build([turbine({ id: 'a' })], rows);
    expect(items.map((i) => i.id)).toEqual(['a']);
  });

  it('usa el estado y la disponibilidad del reporte que calcula la pantalla', () => {
    const items = buildMapItems({
      turbines: [turbine({ id: 'a' }), turbine({ id: 'b', turbine_name: '26' })],
      mapRows: [],
      resolveStatus: (t) => (t.id === 'a' ? { key: 'done', label: 'Completado' } : { key: 'progress', label: 'En progreso' }),
      canOpenReport: (t) => t.id === 'a',
    });
    expect(items[0]).toMatchObject({ id: 'a', name: '25', model: 'V150', statusKey: 'done', statusLabel: 'Completado', canOpenReport: true });
    expect(items[1]).toMatchObject({ id: 'b', statusKey: 'progress', statusLabel: 'En progreso', canOpenReport: false });
  });

  it('incluye la ruta de la foto de identificación si la turbina la tiene', () => {
    const [con] = build([turbine({ id_image_path: 'LA BUFA/25/ID/foto.JPG' })], []);
    const [sin] = build([turbine({ id_image_path: null })], []);
    const [vacia] = build([turbine({ id_image_path: '' })], []);
    expect(con.photoPath).toBe('LA BUFA/25/ID/foto.JPG');
    expect(sin.photoPath).toBeNull();
    expect(vacia.photoPath).toBeNull();
  });

  it('conserva el orden recibido y tolera listas vacías o nulas', () => {
    const items = build([turbine({ id: 'b', turbine_name: 'B' }), turbine({ id: 'a', turbine_name: 'A' })], []);
    expect(items.map((i) => i.name)).toEqual(['B', 'A']);
    expect(build([], [])).toEqual([]);
    expect(build(null, [])).toEqual([]);
  });
});
