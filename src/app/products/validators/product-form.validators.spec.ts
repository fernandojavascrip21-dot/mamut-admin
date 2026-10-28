import { FormControl, FormGroup } from '@angular/forms';
import {
  portionRequiredWhenFractionable, positiveInteger, positiveNumber, priceNotBelowCost,
} from './product-form.validators';

const check = (validator: ReturnType<typeof positiveNumber>, value: unknown) =>
  validator(new FormControl(value));

describe('product-form.validators', () => {
  describe('positiveNumber', () => {
    it.each([100, 0.5, '100.00'])('acepta %s', (value) => {
      expect(check(positiveNumber(), value)).toBeNull();
    });

    it.each([null, '', '  ', 0, -5, 'abc'])('rechaza %s', (value) => {
      expect(check(positiveNumber(), value)).toEqual({ positiveNumber: true });
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

    it('precio igual o mayor al costo es válido', () => {
      expect(group(100, 100).errors).toBeNull();
      expect(group('200.00', '100.00').errors).toBeNull();
    });

    it('precio menor que el costo es inválido', () => {
      expect(group(50, 100).errors).toEqual({ priceBelowCost: true });
    });

    it('con algún campo vacío o en 0 no opina (ese error es del campo)', () => {
      expect(group(null, 100).errors).toBeNull();
      expect(group(0, 100).errors).toBeNull();
    });
  });
});
