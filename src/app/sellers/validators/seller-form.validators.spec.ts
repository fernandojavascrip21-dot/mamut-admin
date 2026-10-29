import { FormControl } from '@angular/forms';
import { tenDigitPhone } from './seller-form.validators';

describe('tenDigitPhone', () => {
  const check = (value: string) => tenDigitPhone()(new FormControl(value));

  it('acepta 10 dígitos con o sin separadores', () => {
    expect(check('55 2468 1357')).toBeNull();
    expect(check('5524681357')).toBeNull();
  });

  it('rechaza +52, letras y otra cantidad de dígitos', () => {
    expect(check('+525524681357')).toEqual({ tenDigitPhone: true });
    expect(check('552468135')).toEqual({ tenDigitPhone: true });
  });

  it('vacío no da este error (lo marca notBlank)', () => {
    expect(check('')).toBeNull();
    expect(check('   ')).toBeNull();
  });
});
