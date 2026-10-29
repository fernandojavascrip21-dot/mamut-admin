import { formatPhone } from './phone';

describe('formatPhone', () => {
  it('agrupa 10 dígitos como 2-4-4', () => {
    expect(formatPhone('5524681357')).toBe('55 2468 1357');
  });

  it('deja igual lo que no son 10 dígitos', () => {
    expect(formatPhone('123')).toBe('123');
  });

  it('null, undefined o vacío dan texto vacío', () => {
    expect(formatPhone(null)).toBe('');
    expect(formatPhone(undefined)).toBe('');
    expect(formatPhone('')).toBe('');
  });
});
