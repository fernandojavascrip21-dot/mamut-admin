import { FormControl } from '@angular/forms';
import {
  duplicateNameIndexes, restockCustomName, restockNote, restockQty, restockUnitCost,
} from './restock-form.validators';

describe('restockQty', () => {
  const errorsOf = (value: string) => restockQty()(new FormControl(value));

  it('vacío → required', () => {
    expect(errorsOf('')).toEqual({ required: true });
    expect(errorsOf('  ')).toEqual({ required: true });
  });

  it('decimal, 0, negativo o texto → integer', () => {
    for (const value of ['1.5', '0', '-2', 'abc', '2,5', '1e3']) {
      expect(errorsOf(value)).toEqual({ integer: true });
    }
  });

  it('más de 2 147 483 647 → tooLarge', () => {
    expect(errorsOf('2147483648')).toEqual({ tooLarge: true });
  });

  it('de 1 al tope es válido', () => {
    expect(errorsOf('1')).toBeNull();
    expect(errorsOf(' 25 ')).toBeNull();
    expect(errorsOf('2147483647')).toBeNull();
  });
});

describe('restockUnitCost', () => {
  const errorsOf = (value: string, required: boolean) => restockUnitCost({ required })(new FormControl(value));

  it('vacío es required en un renglón de catálogo y válido en uno escrito', () => {
    expect(errorsOf('', true)).toEqual({ required: true });
    expect(errorsOf('  ', true)).toEqual({ required: true });
    expect(errorsOf('', false)).toBeNull();
  });

  it('más de 4 decimales, negativo, fuera de rango o texto → cost', () => {
    for (const value of ['1.23456', '-1', '1000000', 'abc', '1,5']) {
      expect(errorsOf(value, true)).toEqual({ cost: true });
      expect(errorsOf(value, false)).toEqual({ cost: true });
    }
  });

  it('de 0 a 999999.9999 con hasta 4 decimales es válido', () => {
    for (const value of ['0', '0.0000', '12', '12.5', '999999.9999']) {
      expect(errorsOf(value, true)).toBeNull();
    }
  });
});

describe('restockCustomName', () => {
  const errorsOf = (value: string) => restockCustomName()(new FormControl(value));

  it('vacío o solo espacios → required', () => {
    expect(errorsOf('')).toEqual({ required: true });
    expect(errorsOf('    ')).toEqual({ required: true });
  });

  it('más de 120 caracteres tras recortar → maxlength', () => {
    expect(errorsOf('x'.repeat(121))).toEqual({ maxlength: true });
    expect(errorsOf(` ${'x'.repeat(120)} `)).toBeNull();
  });

  it('un nombre normal es válido', () => {
    expect(errorsOf('Shaker')).toBeNull();
  });
});

describe('restockNote', () => {
  const errorsOf = (value: string) => restockNote()(new FormControl(value));

  it('vacía o de hasta 500 caracteres es válida', () => {
    expect(errorsOf('')).toBeNull();
    expect(errorsOf('x'.repeat(500))).toBeNull();
  });

  it('más de 500 caracteres → maxlength', () => {
    expect(errorsOf('x'.repeat(501))).toEqual({ maxlength: true });
  });
});

describe('duplicateNameIndexes', () => {
  it('sin repetidos no marca nada', () => {
    expect(duplicateNameIndexes(['Shaker', 'Toalla'])).toEqual([]);
  });

  it('marca las apariciones posteriores, sin mayúsculas ni acentos', () => {
    expect(duplicateNameIndexes(['Cinturón', 'Toalla', 'CINTURON', ' toalla '])).toEqual([2, 3]);
  });

  it('los nombres vacíos no cuentan como repetidos', () => {
    expect(duplicateNameIndexes(['', '  ', 'Toalla'])).toEqual([]);
  });
});
