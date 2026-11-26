import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

/**
 * El calibrador (subproyecto aislado wtgwtgmgenerator/) conserva su JSX y su lógica; su CSS se
 * alinea con los tokens del Design System. Estas pruebas fijan ese contrato.
 */
const css = fs.readFileSync(
  path.resolve(__dirname, '../pages/wtgwtgmgenerator/src/WtgCalibrator.css'),
  'utf8',
);

// Bloque de variables de la raíz `.wc { ... }`
const rootBlock = css.match(/^\.wc \{([\s\S]*?)\n\}/m)?.[1] ?? '';
const rule = (selector) => {
  const esc = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return css.match(new RegExp(`${esc}\\s*\\{([^}]*)\\}`))?.[1] ?? '';
};

describe('WtgCalibrator.css alineado con los tokens', () => {
  it('encuentra el bloque de variables', () => {
    expect(rootBlock).toContain('--accent');
  });

  it.each([
    ['--bg', 'surface-base'],
    ['--panel', 'surface-panel'],
    ['--panel-2', 'surface-card'],
    ['--line', 'line-subtle'],
    ['--line-2', 'line-medium'],
    ['--text', 'ink'],
    ['--muted', 'ink-muted'],
    ['--accent', 'brand'],
    ['--ai', 'info'],
    ['--ok', 'status-done'],
    ['--warn', 'status-alert'],
    ['--tower', 'info'],
    ['--rotor', 'sev-4'],
    ['--blade', 'status-done'],
  ])('%s usa el token %s', (variable, token) => {
    expect(rootBlock).toMatch(new RegExp(`${variable}:\\s*hsl\\(var\\(--${token}\\)\\)`));
  });

  it('las variables de la raíz no contienen hex, salvo el violeta del botón de IA (--ai-violet, original)', () => {
    const withoutViolet = rootBlock.split('\n').filter((l) => !l.includes('--ai-violet')).join('\n');
    expect(withoutViolet).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(rootBlock).toMatch(/--ai-violet:\s*#a78bfa/i);
    expect(css).not.toMatch(/#f59e0b/i); // el ámbar anterior ya no existe
  });
});

// REGLA DE DISEÑO: los botones que ya eran amarillos (primary) usan el dorado nuevo; los que no
// (ghost gris, IA violeta) conservan su aspecto original.
describe('botones del calibrador', () => {
  const base = rule('.wc .wc-btn');
  const primary = rule('.wc .wc-btn--primary');

  it('la base y "ghost" conservan su aspecto ORIGINAL: gris neutro, sin dorado', () => {
    expect(base).toContain('border: 1px solid var(--line-2)');
    expect(base).toContain('background: var(--panel-2)');
    expect(base).not.toMatch(/--accent/);
    expect(rule('.wc .wc-btn--ghost')).toContain('background: transparent');
    expect(rule('.wc .wc-btn:hover:not(:disabled)')).toContain('border-color: var(--muted)');
    expect(rule('.wc .wc-btn:disabled')).toContain('opacity: 0.45');
  });

  it('"primary" (era ámbar sólido) usa el dorado nuevo: fondo tenue, texto y borde dorados', () => {
    expect(primary).toMatch(/color:\s*var\(--accent\)/);
    expect(primary).toMatch(/border-color:\s*color-mix\(in srgb, var\(--accent\) 40%, transparent\)/);
    expect(primary).toMatch(/background:\s*color-mix\(in srgb, var\(--accent\) 10%, transparent\)/);
    expect(primary).not.toMatch(/background:\s*var\(--accent\)/); // ya no es sólido
  });

  it('al hover el primary sube el fondo (25%) y conserva su borde dorado', () => {
    const hover = rule('.wc .wc-btn--primary:hover:not(:disabled)');
    expect(hover).toMatch(/color-mix\(in srgb, var\(--accent\) 25%, transparent\)/);
    expect(hover).toMatch(/border-color:\s*color-mix\(in srgb, var\(--accent\) 40%, transparent\)/);
  });

  it('gana en especificidad a `.wc button { color: inherit }`', () => {
    expect(css).toMatch(/\.wc button, \.wc input, \.wc select \{ font: inherit; color: inherit; \}/);
    expect(css).toMatch(/^\.wc \.wc-btn \{/m); // (0,2,0) > (0,1,1)
    expect(css).toMatch(/^\.wc \.wc-btn--primary \{/m);
  });

  it('el botón de IA conserva su violeta original (los puntos de IA siguen en celeste)', () => {
    const ai = rule('.wc .wc-btn--ai');
    expect(ai).toContain('var(--ai-violet)');
    expect(ai).not.toMatch(/var\(--ai\)/);
    expect(rootBlock).toMatch(/--ai:\s*hsl\(var\(--info\)\)/); // puntos de IA: celeste
  });

  it('los campos usan fondo de tarjeta y borde sutil', () => {
    const field = css.match(/\.wc-field input, \.wc-field select[^{]*\{([^}]*)\}/)?.[1] ?? '';
    expect(field).toContain('border: 1px solid var(--line)');
    expect(field).toContain('background: var(--panel-2)');
  });
});

describe('el JSX del calibrador no cambia (opción A: solo CSS)', () => {
  it('conserva las clases wc-btn que el CSS estiliza', () => {
    const jsx = fs.readFileSync(path.resolve(__dirname, '../pages/wtgwtgmgenerator/src/WtgCalibrator.jsx'), 'utf8');
    expect(jsx).toContain('wc-btn wc-btn--ghost');
    expect(jsx).toContain('wc-btn wc-btn--primary');
    expect(jsx).toContain('wc-btn wc-btn--ai');
  });
});
