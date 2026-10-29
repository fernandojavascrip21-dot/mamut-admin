import { FormControl, FormGroup } from '@angular/forms';
import { MONEY_MAX } from '@shared/money';
import {
  maxDecimals, maxMoney, portionRequiredWhenFractionable, positiveInteger, positiveNumber, priceNotBelowCost,
} from './product-form.validators';

const check = (validator: ReturnType<typeof positiveNumber>, value: unknown) =>
  validator(new FormControl(value));

describe('product-form.validators', () => {
  describe('positiveNumber', () => {
    it.each(['100', '0.5', '100.00', ' 450 ', '0.0001'])('acepta %j', (value) => {
      expect(check(positiveNumber(), value)).toBeNull();
    });

    // El dinero se lee como texto (spec T-08): un number no es un valor del campo.
    it.each([null, '', '  ', '0', '0.00', '-5', 'abc', '1e3', '450,50', 100])('rechaza %j', (value) => {
      expect(check(positiveNumber(), value)).toEqual({ positiveNumber: true });
    });
  });

  describe('maxDecimals', () => {
    it('precio: hasta 2 decimales', () => {
      expect(check(maxDecimals(2), '450.55')).toBeNull();
      expect(check(maxDecimals(2), '450')).toBeNull();
      expect(check(maxDecimals(2), '450.555')).toEqual({ maxDecimals: { scale: 2 } });
    });

    it('costo: hasta 4 decimales', () => {
      expect(check(maxDecimals(4), '83.3333')).toBeNull();
      expect(check(maxDecimals(4), '1.00001')).toEqual({ maxDecimals: { scale: 4 } });
    });

    it('un texto que no es decimal lo reporta positiveNumber, no este validador', () => {
      expect(check(maxDecimals(2), 'abc')).toBeNull();
      expect(check(maxDecimals(2), '')).toBeNull();
    });
  });

  describe('maxMoney', () => {
    it('acepta hasta el máximo de la columna', () => {
      expect(check(maxMoney(MONEY_MAX[2], 2), '99999999.99')).toBeNull();
      expect(check(maxMoney(MONEY_MAX[4], 4), '999999.9999')).toBeNull();
    });

    it('rechaza lo que no cabe en la columna, aunque no quepa en un entero exacto', () => {
      expect(check(maxMoney(MONEY_MAX[2], 2), '100000000')).toEqual({ maxMoney: true });
      expect(check(maxMoney(MONEY_MAX[4], 4), '1000000')).toEqual({ maxMoney: true });
      expect(check(maxMoney(MONEY_MAX[2], 2), '99999999999999999999')).toEqual({ maxMoney: true });
    });

    it('con formato o decimales inválidos no opina (ese error es de otro validador)', () => {
      expect(check(maxMoney(MONEY_MAX[2], 2), 'abc')).toBeNull();
      expect(check(maxMoney(MONEY_MAX[2], 2), '100000000.555')).toBeNull();
    });
  });

  describe('positiveInteger', () => {
    it.each([1, 10, '10'])('acepta %s', (value) => {
      expect(check(positiveInteger(), value)).toBeNull();
    });

    it.each([null, '', 0, -1, 2.5])('rechaza %s', (value) => {
      expect(check(positiveInteger(), value)).toEqual({ positiveInteger: true });
    });
  });

  describe('portionRequiredWhenFractionable', () => {
    const group = (fractionable: boolean, portionSize: string) =>
      new FormGroup(
        { fractionable: new FormControl(fractionable), portionSize: new FormControl(portionSize) },
        { validators: portionRequiredWhenFractionable() },
      );

    it('sin fraccionar, la porción puede ir vacía', () => {
      expect(group(false, '').errors).toBeNull();
    });

    it('fraccionando, la porción es obligatoria', () => {
      expect(group(true, '  ').errors).toEqual({ portionRequired: true });
      expect(group(true, '30 g').errors).toBeNull();
    });
  });

  describe('priceNotBelowCost', () => {
    const group = (price: unknown, unitCost: unknown) =>
      new FormGroup(
        { price: new FormControl(price), unitCost: new FormControl(unitCost) },
        { validators: priceNotBelowCost() },
      );

    it('precio igual o mayor al costo es válido, también con escalas distintas', () => {
      expect(group('100', '100').errors).toBeNull();
      expect(group('200.00', '100.0000').errors).toBeNull();
      expect(group('83.33', '83.3300').errors).toBeNull();
    });

    it('precio menor que el costo es inválido, aunque sea por una diezmilésima', () => {
      expect(group('50', '100').errors).toEqual({ priceBelowCost: true });
      expect(group('83.33', '83.3301').errors).toEqual({ priceBelowCost: true });
    });

    it('con algún campo vacío, en 0 o inválido no opina (ese error es del campo)', () => {
      expect(group('', '100').errors).toBeNull();
      expect(group('0', '100').errors).toBeNull();
      expect(group('50.555', '100').errors).toBeNull();
    });
  });
});
