import { pluralize } from './pluralize';

describe('pluralize', () => {
  it('solo 1 usa la forma singular', () => {
    expect(pluralize(1, 'pieza', 'piezas')).toBe('pieza');
  });

  it.each([
    [0, 'piezas'],
    [2, 'piezas'],
    [12, 'piezas'],
  ])('%i usa la forma plural', (count, word) => {
    expect(pluralize(count, 'pieza', 'piezas')).toBe(word);
  });

  it('no cambia la forma según la cantidad aparte de 1 (0 también va en plural)', () => {
    expect(pluralize(0, 'renglón', 'renglones')).toBe('renglones');
    expect(pluralize(1, 'renglón', 'renglones')).toBe('renglón');
  });
});
