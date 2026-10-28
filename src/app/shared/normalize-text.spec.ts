import { normalizarTexto } from './normalizar-texto';

describe('normalizarTexto', () => {
  it('quita espacios en los extremos y pasa a minúsculas', () => {
    expect(normalizarTexto('Cbúm ')).toBe('cbum');
  });

  it('quita acentos y diéresis', () => {
    expect(normalizarTexto('Proteína Ñandú')).toBe('proteina nandu');
  });

  it('con una cadena vacía devuelve una cadena vacía', () => {
    expect(normalizarTexto('')).toBe('');
  });
});
