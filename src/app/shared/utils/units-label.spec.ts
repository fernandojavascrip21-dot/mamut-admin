import { unitsLabel } from './units-label';

describe('unitsLabel', () => {
  it.each([
    [0, '0 piezas'],
    [1, '1 pieza'],
    [6, '6 piezas'],
  ])('%i → «%s»', (units, label) => {
    expect(unitsLabel(units)).toBe(label);
  });
});
