import { FormControl } from '@angular/forms';
import { maxUnits, wholePositiveUnits } from './return-form.validators';

describe('wholePositiveUnits', () => {
  const run = (value: unknown) => wholePositiveUnits()(new FormControl(value));

  it('acepta un entero mayor a 0', () => {
    expect(run('2')).toBeNull();
    expect(run(' 12 ')).toBeNull();
    expect(run('2147483647')).toBeNull();
  });

  it('rechaza vacío, 0, negativos, decimales, texto y más que un integer', () => {
    for (const value of ['', '   ', null, '0', '-2', '1.5', '1,5', 'abc', '2 piezas', '2147483648']) {
      expect(run(value), String(value)).toEqual({ wholePositiveUnits: true });
    }
  });
});

describe('maxUnits', () => {
  const run = (value: unknown, max: number | null) => maxUnits(() => max)(new FormControl(value));

  it('acepta hasta las piezas del vendedor, ambas incluidas', () => {
    expect(run('6', 6)).toBeNull();
    expect(run('1', 6)).toBeNull();
  });

  it('rechaza más piezas que las del vendedor y dice el máximo', () => {
    expect(run('7', 6)).toEqual({ maxUnits: { max: 6 } });
  });

  it('no opina sin producto elegido ni con un texto que no es un entero', () => {
    expect(run('7', null)).toBeNull();
    for (const value of ['', 'abc', '1.5', '-1']) expect(run(value, 6), value).toBeNull();
  });

  it('lee el máximo en cada validación', () => {
    let max = 6;
    const control = new FormControl('5');
    const validator = maxUnits(() => max);
    expect(validator(control)).toBeNull();
    max = 3;
    expect(validator(control)).toEqual({ maxUnits: { max: 3 } });
  });
});
