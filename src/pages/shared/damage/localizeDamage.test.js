import { describe, it, expect } from 'vitest';
import { getLocalizedDamageString } from './localizeDamage';

const en = { language: 'en-US' };
const es = { language: 'es' };

describe('getLocalizedDamageString', () => {
  it('en español devuelve el texto tal cual y vacío si no hay valor', () => {
    expect(getLocalizedDamageString('Arrugas', es)).toBe('Arrugas');
    expect(getLocalizedDamageString('', en)).toBe('');
    expect(getLocalizedDamageString(null, en)).toBe('');
  });

  it('traduce tipos conocidos, incluido el nuevo "Otro"', () => {
    expect(getLocalizedDamageString('Arrugas', en)).toBe('Wrinkles');
    expect(getLocalizedDamageString('Otros', en)).toBe('Others');
    expect(getLocalizedDamageString('Otro', en)).toBe('Other');
  });

  it('traduce las categorías genéricas', () => {
    expect(getLocalizedDamageString('Categoría 3', en)).toBe('Category 3');
    expect(getLocalizedDamageString('Categoria Desconocida', en)).toBe('Unknown Category');
  });

  it('"Tipo - Subdaño": traduce cada parte por separado', () => {
    expect(getLocalizedDamageString('Arrugas - Otro', en)).toBe('Wrinkles - Other');
  });

  it('un texto sin traducción se deja como está', () => {
    expect(getLocalizedDamageString('Algo inventado', en)).toBe('Algo inventado');
    expect(getLocalizedDamageString('Algo - inventado', en)).toBe('Algo - inventado');
  });
});
