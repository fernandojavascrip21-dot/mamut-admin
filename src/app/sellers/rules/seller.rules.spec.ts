import { formatPhone, normalizePhone } from './seller.rules';

// Mismos casos que backend/tests/sellers.test.ts (contrato compartido).
describe('normalizePhone', () => {
  it.each(['55 2468 1357', '55-2468-1357', '(55) 2468 1357', '5524681357'])('«%s» queda como 5524681357', (raw) => {
    expect(normalizePhone(raw)).toBe('5524681357');
  });

  it.each(['+525524681357', '552468135', '55246813570', '55 2468 135a', ''])('«%s» no es válido', (raw) => {
    expect(normalizePhone(raw)).toBeNull();
  });
});

describe('formatPhone', () => {
  it('agrupa 10 dígitos como 2-4-4', () => {
    expect(formatPhone('5524681357')).toBe('55 2468 1357');
  });

  it('deja igual lo que no son 10 dígitos', () => {
    expect(formatPhone('123')).toBe('123');
  });
});
