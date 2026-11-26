import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import tailwindConfig from '../../tailwind.config.js';

const css = fs.readFileSync(path.resolve(__dirname, '../index.css'), 'utf8');

// Token → hex oficial de la paleta VINDGROUP.
const PALETTE = {
  'surface-base': '#070B11',
  'surface-panel': '#0D1420',
  'surface-card': '#121C2C',
  'line-subtle': '#19263A',
  'line-medium': '#243550',
  brand: '#DEAB47',
  ink: '#F8FAFC',
  'ink-muted': '#8FA2BF',
  'status-done': '#34D399',
  info: '#38BDF8',
  'status-alert': '#C99355',
  'error-bg': '#1E1215',
  'error-border': '#4C1D24',
  'error-text': '#E06C75',
  // sev-1/2/3 son alias (done, info, brand); sev-4 y sev-5 son tonos propios
  'sev-4': '#FB923C',
  'sev-5': '#EF4444',
};

const hslToHex = (h, s, l) => {
  s /= 100;
  l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return (
    '#' +
    [f(0), f(8), f(4)]
      .map((x) => Math.round(x * 255).toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
  );
};

const readToken = (name) => {
  const m = css.match(new RegExp(`--${name}:\\s*([\\d.]+)\\s+([\\d.]+)%\\s+([\\d.]+)%`));
  return m ? hslToHex(+m[1], +m[2], +m[3]) : null;
};

describe('tokens de color (index.css)', () => {
  it.each(Object.entries(PALETTE))('--%s equivale a %s', (name, hex) => {
    expect(readToken(name)).toBe(hex);
  });

  it('el scrollbar es claro y de 8px', () => {
    expect(css).toMatch(/--scroll-thumb:\s*#CBD5E1/i);
    expect(css).toMatch(/--scroll-thumb-hover:\s*#FFFFFF/i);
    expect(css).toMatch(/--scroll-track:\s*#0D1420/i);
    expect(css).toMatch(/--scroll-size:\s*8px/);
    expect(css).toMatch(/scrollbar-color:\s*var\(--scroll-thumb\)\s+var\(--scroll-track\)/);
    expect(css).toMatch(/border-radius:\s*9999px/);
  });

  it('no quedan !important fuera de @media print', () => {
    const withoutPrint = css.replace(/@media print\s*{[\s\S]*?\n}\n/, '');
    expect(withoutPrint).not.toMatch(/!important/);
  });

  it('el azul celeste es el token --info de "En progreso"; Cat 2 es un verde-lima propio (entre Cat 1 y Cat 3)', () => {
    expect(css).toMatch(/--status-progress:\s*var\(--info\)/);
    expect(css).not.toMatch(/--sev-2:\s*var\(--info\)/);
    expect(css).toMatch(/--sev-2:\s*90 62% 54%/);
    expect(css).toMatch(/--sev-1:\s*var\(--status-done\)/);
    expect(css).toMatch(/--sev-3:\s*var\(--brand\)/);
  });

  it('los alias shadcn apuntan a la paleta (sin valores duplicados)', () => {
    expect(css).toMatch(/--primary:\s*var\(--brand\)/);
    expect(css).toMatch(/--background:\s*var\(--surface-base\)/);
    expect(css).toMatch(/--border:\s*var\(--line-subtle\)/);
  });
});

describe('tailwind.config.js', () => {
  const colors = tailwindConfig.theme.extend.colors;

  it('expone los tokens semánticos con soporte de opacidad', () => {
    expect(colors.brand).toBe('hsl(var(--brand) / <alpha-value>)');
    expect(colors.surface.panel).toBe('hsl(var(--surface-panel) / <alpha-value>)');
    expect(colors.status.done).toBe('hsl(var(--status-done) / <alpha-value>)');
    expect(colors.error.text).toBe('hsl(var(--error-text) / <alpha-value>)');
  });

  it('conserva los tokens shadcn existentes', () => {
    ['border', 'input', 'ring', 'background', 'foreground'].forEach((k) => expect(colors[k]).toBeDefined());
    ['primary', 'secondary', 'destructive', 'muted', 'accent', 'popover', 'card'].forEach((k) =>
      expect(colors[k].DEFAULT).toBeDefined(),
    );
  });

  it('define la curva elástica del bento', () => {
    expect(tailwindConfig.theme.extend.transitionTimingFunction.elastic).toBe('cubic-bezier(0.16, 1, 0.3, 1)');
  });
});
