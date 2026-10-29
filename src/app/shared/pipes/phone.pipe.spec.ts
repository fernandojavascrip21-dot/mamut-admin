import { PhonePipe } from './phone.pipe';

describe('PhonePipe', () => {
  const pipe = new PhonePipe();

  it('muestra 10 dígitos como «55 2468 1357»', () => {
    expect(pipe.transform('5524681357')).toBe('55 2468 1357');
  });

  it('sin teléfono muestra vacío', () => {
    expect(pipe.transform(null)).toBe('');
  });
});
