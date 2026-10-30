import { normalizeText } from './normalize-text';

describe('normalizeText', () => {
  it('quita espacios en los extremos y pasa a minúsculas', () => {
    expect(normalizeText('Cbúm ')).toBe('cbum');
  });

  it('quita acentos y diéresis', () => {
    expect(normalizeText('Proteína Ñandú')).toBe('proteina nandu');
  });

  it('con una cadena vacía devuelve una cadena vacía', () => {
    expect(normalizeText('')).toBe('');
  });
});
