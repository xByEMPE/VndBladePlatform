import { describe, it, expect } from 'vitest';
import { choosePopupPlacement } from './popupPlacement';

// Figura de 76 px sobre la coordenada y etiqueta de ~20 px debajo; tarjeta de 372 × 260.
const base = {
  container: { w: 1300, h: 460 },
  card: { w: 372, h: 260 },
  figureHeight: 76,
  labelHeight: 20,
};
const place = (point, over = {}) => choosePopupPlacement({ ...base, point, ...over });

describe('choosePopupPlacement', () => {
  it('sin medidas conocidas (p. ej. el mapa aún no tiene tamaño) usa "bottom" y no limita el alto', () => {
    expect(choosePopupPlacement({ ...base, point: null })).toEqual({ anchor: 'bottom', maxHeight: undefined });
    expect(choosePopupPlacement({ ...base, point: { x: 10, y: 10 }, container: { w: 0, h: 0 } })).toEqual({
      anchor: 'bottom',
      maxHeight: undefined,
    });
  });

  it('con espacio arriba de la figura abre la tarjeta ARRIBA (ancla bottom)', () => {
    expect(place({ x: 650, y: 430 })).toMatchObject({ anchor: 'bottom' });
  });

  it('si arriba no cabe pero abajo sí, la abre ABAJO (ancla top)', () => {
    expect(place({ x: 650, y: 100 })).toMatchObject({ anchor: 'top' });
  });

  it('turbina al centro de un mapa ancho (no cabe ni arriba ni abajo): la abre a un LADO, a la derecha', () => {
    expect(place({ x: 650, y: 230 })).toMatchObject({ anchor: 'left' }); // ancla "left" = la tarjeta crece hacia la derecha
  });

  it('si a la derecha no cabe pero a la izquierda sí, la abre a la izquierda', () => {
    expect(place({ x: 1100, y: 230 })).toMatchObject({ anchor: 'right' });
  });

  it('cerca del borde izquierdo alinea la tarjeta para que crezca hacia la derecha (bottom-left)', () => {
    expect(place({ x: 80, y: 430 })).toMatchObject({ anchor: 'bottom-left' });
  });

  it('cerca del borde derecho alinea la tarjeta para que crezca hacia la izquierda (bottom-right)', () => {
    expect(place({ x: 1250, y: 430 })).toMatchObject({ anchor: 'bottom-right' });
  });

  it('abajo también se alinea en los bordes (top-left / top-right)', () => {
    const narrow = { container: { w: 700, h: 460 } };
    expect(place({ x: 60, y: 100 }, narrow)).toMatchObject({ anchor: 'top-left' });
    expect(place({ x: 650, y: 100 }, narrow)).toMatchObject({ anchor: 'top-right' });
  });

  it('el alto máximo de la tarjeta es el espacio disponible del lado elegido (para que desplace dentro, no se corte)', () => {
    // mapa bajo y estrecho: no cabe en ningún lado → elige el vertical con más espacio y limita el alto
    const r = place({ x: 400, y: 210 }, { container: { w: 800, h: 300 } });
    expect(r.anchor).toBe('bottom'); // arriba: 210 - 76 - 8 = 126 ; abajo: 300 - 210 - 20 - 8 = 62 → arriba tiene más
    expect(r.maxHeight).toBeGreaterThanOrEqual(160);
  });

  it('para un lado, el alto máximo es todo el alto del mapa menos los márgenes', () => {
    expect(place({ x: 650, y: 230 }).maxHeight).toBe(460 - 16);
  });

  it('nunca devuelve un alto máximo menor al mínimo legible (160 px)', () => {
    const r = place({ x: 400, y: 150 }, { container: { w: 800, h: 200 } });
    expect(r.maxHeight).toBeGreaterThanOrEqual(160);
  });

  it('si el mapa es más estrecho que la tarjeta, la centra (sin sufijo)', () => {
    expect(place({ x: 150, y: 430 }, { container: { w: 300, h: 460 } })).toMatchObject({ anchor: 'bottom' });
  });
});
