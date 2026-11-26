import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import {
  SEVERITY,
  SEVERITY_LEVELS,
  NEUTRAL_SEVERITY,
  parseSeverity,
  getSeverity,
  severityHex,
  severityLabel,
} from './severity';

const css = fs.readFileSync(path.resolve(__dirname, '../index.css'), 'utf8');

describe('parseSeverity', () => {
  it('acepta número, texto y formato "Cat N"', () => {
    expect(parseSeverity(3)).toBe(3);
    expect(parseSeverity('3')).toBe(3);
    expect(parseSeverity('Cat 4')).toBe(4);
    expect(parseSeverity('cat5')).toBe(5);
    expect(parseSeverity(' Cat 1 ')).toBe(1);
  });

  it('devuelve null para valores no válidos', () => {
    [null, undefined, '', 0, 6, '6', 'Cat 0', 'Cat 7', 'alta', {}, NaN].forEach((v) =>
      expect(parseSeverity(v)).toBeNull(),
    );
  });
});

describe('getSeverity / severityHex / severityLabel', () => {
  it('cada categoría tiene su color y clases propias', () => {
    SEVERITY_LEVELS.forEach((n) => {
      expect(getSeverity(n)).toBe(SEVERITY[n]);
      expect(SEVERITY[n].bg).toBe(`bg-sev-${n}`);
      expect(SEVERITY[n].text).toBe(`text-sev-${n}`);
      expect(severityLabel(n)).toBe(`Cat ${n}`);
    });
    expect(new Set(SEVERITY_LEVELS.map((n) => SEVERITY[n].hex)).size).toBe(5);
  });

  it('los valores desconocidos usan el color neutro', () => {
    expect(getSeverity(null)).toBe(NEUTRAL_SEVERITY);
    expect(getSeverity('Cat 9')).toBe(NEUTRAL_SEVERITY);
    expect(severityHex(undefined)).toBe(NEUTRAL_SEVERITY.hex);
    expect(severityLabel('x')).toBeNull();
  });
});

describe('Cat 2 intermedia entre Cat 1 y Cat 3', () => {
  const hue = (hex) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
    const max = Math.max(r, g, b);
    const d = max - Math.min(r, g, b);
    const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return (h * 60 + 360) % 360;
  };

  it('ya no es el azul celeste', () => {
    expect(SEVERITY[2].hex.toUpperCase()).not.toBe('#38BDF8');
  });

  it('su tono (verde-lima) queda entre el de Cat 1 (verde) y el de Cat 3 (ámbar), y la escala baja de forma continua', () => {
    const [h1, h2, h3, h4, h5] = SEVERITY_LEVELS.map((n) => hue(SEVERITY[n].hex));
    expect(h2).toBeLessThan(h1);
    expect(h2).toBeGreaterThan(h3);
    expect(h1 > h2 && h2 > h3 && h3 > h4 && h4 > h5).toBe(true);
  });
});

describe('sincronía con los tokens de index.css', () => {
  it.each(SEVERITY_LEVELS)('el hex de Cat %i coincide con el comentario de --sev-%i', (n) => {
    const line = css.split('\n').find((l) => l.includes(`--sev-${n}:`));
    expect(line, `falta --sev-${n} en index.css`).toBeTruthy();
    expect(line.toUpperCase()).toContain(SEVERITY[n].hex.toUpperCase());
  });
});

// Contraste WCAG: el texto sobre cada categoría (surface-base #070B11) y la categoría sobre el
// fondo del mapa/tarjeta (surface-panel #0D1420) deben superar 4.5:1 (texto) y 3:1 (gráfico).
const luminance = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

describe('contraste (WCAG 2.1 AA)', () => {
  it.each(SEVERITY_LEVELS.map((n) => [`Cat ${n}`, SEVERITY[n].hex]))(
    'texto oscuro sobre %s ≥ 4.5:1 y el color sobre el panel ≥ 3:1',
    (_name, hex) => {
      expect(contrast('#070B11', hex)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(hex, '#0D1420')).toBeGreaterThanOrEqual(3);
    },
  );

  it('neutro: texto claro (ink) sobre tarjeta ≥ 4.5:1 y borde gris sobre el panel ≥ 3:1', () => {
    expect(contrast('#F8FAFC', '#121C2C')).toBeGreaterThanOrEqual(4.5);
    expect(contrast(NEUTRAL_SEVERITY.hex, '#0D1420')).toBeGreaterThanOrEqual(3);
  });

  it('el neutro usa los tokens de tarjeta y texto claro', () => {
    expect(NEUTRAL_SEVERITY.bg).toBe('bg-surface-card');
    expect(NEUTRAL_SEVERITY.onColor).toBe('text-ink');
  });
});
