import { describe, it, expect } from 'vitest';
import { MAP_STYLES, DEFAULT_MAP_STYLE, getMapStyle } from './mapStyles';

describe('mapStyles', () => {
  it('define los estilos claro y oscuro de OpenFreeMap', () => {
    expect(MAP_STYLES.light.url).toBe('https://tiles.openfreemap.org/styles/positron');
    expect(MAP_STYLES.dark.url).toBe('https://tiles.openfreemap.org/styles/dark');
  });

  it('cada entrada conserva su propia clave (para poder añadir capas nuevas sin tocar el componente)', () => {
    Object.entries(MAP_STYLES).forEach(([key, style]) => {
      expect(style.key).toBe(key);
      expect(style.label).toBeTruthy();
      expect(style.url).toBeTruthy();
    });
  });

  it('getMapStyle usa el estilo predeterminado si la clave es desconocida', () => {
    expect(DEFAULT_MAP_STYLE).toBe('dark');
    expect(getMapStyle('light')).toBe(MAP_STYLES.light);
    expect(getMapStyle('satellite')).toBe(MAP_STYLES[DEFAULT_MAP_STYLE]);
    expect(getMapStyle(undefined)).toBe(MAP_STYLES[DEFAULT_MAP_STYLE]);
  });
});
