import { FormControl } from '@angular/forms';
import { portionsInRange, requiredMoney } from './fraction-form.validators';

describe('portionsInRange', () => {
  const validate = (value: string) => portionsInRange()(new FormControl(value));

  it.each(['2', '7', '1000'])('acepta %s', (value) => {
    expect(validate(value)).toBeNull();
  });

  it.each(['', '  ', '1', '0', '1001', '2.5', 'abc', '-3'])('rechaza «%s»', (value) => {
    expect(validate(value)).not.toBeNull();
  });
});

describe('requiredMoney(2, 99999999.99)', () => {
  const validate = (value: string) => requiredMoney(2, '99999999.99')(new FormControl(value));

  it.each(['85', '85.5', '85.50', '0.01', '99999999.99'])('acepta %s', (value) => {
    expect(validate(value)).toBeNull();
  });

  it.each(['', ' ', '0', '0.00', '85.123', 'abc', '12abc', '-5', '100000000.00'])('rechaza «%s»', (value) => {
    expect(validate(value)).not.toBeNull();
  });
});
