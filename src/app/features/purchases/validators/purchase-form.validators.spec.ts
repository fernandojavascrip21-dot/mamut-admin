import { FormControl } from '@angular/forms';
import { wholeQuantity } from './purchase-form.validators';

describe('wholeQuantity', () => {
  const errorsOf = (value: string) => wholeQuantity()(new FormControl(value));

  it('vacío → required', () => {
    expect(errorsOf('')).toEqual({ required: true });
    expect(errorsOf('  ')).toEqual({ required: true });
  });

  it('cero, negativo, decimal o no numérico → integer', () => {
    for (const value of ['0', '-3', '1.5', '2,5', 'abc', '1e3']) {
      expect(errorsOf(value)).toEqual({ integer: true });
    }
  });

  it('un entero mayor a 0 es válido', () => {
    expect(errorsOf('1')).toBeNull();
    expect(errorsOf(' 25 ')).toBeNull();
  });
});
