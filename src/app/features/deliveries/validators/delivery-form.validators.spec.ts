import { FormControl } from '@angular/forms';
import { MONEY_MAX } from '@shared/constants/money.constants';
import { optionalMoney, positiveInteger } from './delivery-form.validators';

describe('positiveInteger', () => {
  it.each(['1', '6', ' 12 ', '2147483647'])('«%s» es válido', (value) => {
    expect(positiveInteger()(new FormControl(value))).toBeNull();
  });

  it.each(['', '0', '-2', '1.5', '1e3', 'abc', '2147483648', null])(
    '«%s» no es válido',
    (value) => {
      expect(positiveInteger()(new FormControl(value))).toEqual({ positiveInteger: true });
    },
  );
});

describe('optionalMoney', () => {
  const price = optionalMoney(2, MONEY_MAX[2]);
  const cost = optionalMoney(4, MONEY_MAX[4]);

  it('vacío es válido: significa usar el general', () => {
    expect(price(new FormControl(''))).toBeNull();
    expect(price(new FormControl('   '))).toBeNull();
    expect(cost(new FormControl(null))).toBeNull();
  });

  it('acepta montos con los decimales de su escala', () => {
    expect(price(new FormControl('520'))).toBeNull();
    expect(price(new FormControl('480.50'))).toBeNull();
    expect(cost(new FormControl('310.5001'))).toBeNull();
    expect(price(new FormControl('99999999.99'))).toBeNull();
  });

  it('rechaza 0, texto, signo, coma y notación científica', () => {
    for (const value of ['0', '0.00', 'abc', '-5', '5,5', '1e2']) {
      expect(price(new FormControl(value)), value).toEqual({ notPositive: true });
    }
  });

  it('rechaza decimales de más sin redondear', () => {
    expect(price(new FormControl('10.123'))).toEqual({ maxDecimals: { scale: 2 } });
    expect(cost(new FormControl('1.23456'))).toEqual({ maxDecimals: { scale: 4 } });
  });

  it('rechaza montos fuera de la columna', () => {
    expect(price(new FormControl('100000000'))).toEqual({ maxMoney: true });
    expect(cost(new FormControl('1000000'))).toEqual({ maxMoney: true });
  });
});
