import { normalizePhone, sortSellersByName, unitsLabel } from './seller.rules';

// Mismos casos que backend/tests/sellers.test.ts (contrato compartido).
describe('normalizePhone', () => {
  it.each(['55 2468 1357', '55-2468-1357', '(55) 2468 1357', '5524681357'])('«%s» queda como 5524681357', (raw) => {
    expect(normalizePhone(raw)).toBe('5524681357');
  });

  it.each(['+525524681357', '552468135', '55246813570', '55 2468 135a', ''])('«%s» no es válido', (raw) => {
    expect(normalizePhone(raw)).toBeNull();
  });
});


describe('sortSellersByName', () => {
  const seller = (fullName: string) => ({ id: fullName, fullName, units: 0 });

  it('ordena sin distinguir acentos ni mayúsculas', () => {
    const sorted = sortSellersByName([seller('Beto'), seller('ana'), seller('Ángel'), seller('Carla')]);
    expect(sorted.map((s) => s.fullName)).toEqual(['ana', 'Ángel', 'Beto', 'Carla']);
  });

  it('no modifica la lista original', () => {
    const original = [seller('Beto'), seller('Ana')];
    sortSellersByName(original);
    expect(original.map((s) => s.fullName)).toEqual(['Beto', 'Ana']);
  });
});

describe('unitsLabel', () => {
  it.each([
    [0, '0 piezas'],
    [1, '1 pieza'],
    [6, '6 piezas'],
  ])('%i → «%s»', (units, label) => {
    expect(unitsLabel(units)).toBe(label);
  });
});
