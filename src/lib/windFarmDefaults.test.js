import { describe, it, expect } from 'vitest';
import { farmDefaults } from './windFarmDefaults';

describe('farmDefaults', () => {
  it('el conteo real de wind_turbines tiene prioridad sobre el total de referencia', () => {
    const farm = { metadata: { turbine_models: ['V80/2000'], expected_turbines: 51 }, wind_turbines: [{ count: 50 }] };
    expect(farmDefaults(farm)).toEqual({ turbine_count: '50', turbine_model: 'V80/2000' });
    const tizimin = { metadata: { turbine_models: ['G114/2100'], expected_turbines: 36 }, wind_turbines: [{ count: 40 }] };
    expect(farmDefaults(tizimin).turbine_count).toBe('40');
  });

  it('sin aerogeneradores cargados usa el total de referencia', () => {
    const farm = { metadata: { turbine_models: ['G52/850'], expected_turbines: 98 }, wind_turbines: [{ count: 0 }] };
    expect(farmDefaults(farm)).toEqual({ turbine_count: '98', turbine_model: 'G52/850' });
  });

  it('varios modelos se unen con " / "', () => {
    const farm = { metadata: { turbine_models: ['G80/2000', 'G87/2000'], expected_turbines: 35 }, wind_turbines: [{ count: 0 }] };
    expect(farmDefaults(farm).turbine_model).toBe('G80/2000 / G87/2000');
  });

  it('parque sin metadata ni turbinas deja los campos vacíos para llenarlos a mano', () => {
    expect(farmDefaults({ metadata: {}, wind_turbines: [{ count: 0 }] })).toEqual({ turbine_count: '', turbine_model: '' });
    expect(farmDefaults({ id: 1 })).toEqual({ turbine_count: '', turbine_model: '' });
    expect(farmDefaults(undefined)).toEqual({ turbine_count: '', turbine_model: '' });
  });

  it('PER IV: modelo del catálogo y conteo real, sin total de referencia', () => {
    const farm = { metadata: { turbine_models: ['V136/3450'] }, wind_turbines: [{ count: 63 }] };
    expect(farmDefaults(farm)).toEqual({ turbine_count: '63', turbine_model: 'V136/3450' });
  });
});
