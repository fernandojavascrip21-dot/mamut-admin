import { initialsOf } from './initials';

describe('initialsOf', () => {
  it('con una sola palabra usa sus primeras dos letras', () => {
    expect(initialsOf('Administrador')).toBe('AD');
    expect(initialsOf('Luis')).toBe('LU');
  });

  it('con dos o más palabras usa la primera letra de cada una de las dos primeras', () => {
    expect(initialsOf('Ana López')).toBe('AL');
    expect(initialsOf('Ana María López')).toBe('AM');
  });

  it('ignora espacios de más y es insensible a mayúsculas', () => {
    expect(initialsOf('  luis   vendedor  ')).toBe('LV');
  });

  it('con una cadena vacía devuelve una cadena vacía', () => {
    expect(initialsOf('')).toBe('');
  });
});
