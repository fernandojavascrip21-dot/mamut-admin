import { FormControl } from '@angular/forms';
import { receiptQty, receiptUnitCost } from './receipt-line.validators';

describe('receiptQty', () => {
  const errorsOf = (value: string) => receiptQty()(new FormControl(value));

  it('vacío → required', () => {
    expect(errorsOf('')).toEqual({ required: true });
  });

  it('decimal, 0, negativo o texto → integer', () => {
    for (const value of ['1.5', '0', '-2', 'abc']) expect(errorsOf(value)).toEqual({ integer: true });
  });

  it('más de 2 147 483 647 → tooLarge', () => {
    expect(errorsOf('2147483648')).toEqual({ tooLarge: true });
  });

  it('de 1 al tope es válido', () => {
    expect(errorsOf('1')).toBeNull();
    expect(errorsOf('2147483647')).toBeNull();
  });
});

describe('receiptUnitCost', () => {
  const errorsOf = (value: string) => receiptUnitCost()(new FormControl(value));

  it('vacío (sin costo) es válido', () => {
    expect(errorsOf('')).toBeNull();
  });

  it('de 0 a 999999.9999 con hasta 4 decimales es válido', () => {
    for (const value of ['0', '12.5', '12.3456', '999999.9999']) expect(errorsOf(value)).toBeNull();
  });

  it('más de 4 decimales, negativo, texto o fuera de rango → cost', () => {
    for (const value of ['1.23456', '-1', 'abc', '1000000']) expect(errorsOf(value)).toEqual({ cost: true });
  });
});
