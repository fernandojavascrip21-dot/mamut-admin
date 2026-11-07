import type { Fraction } from '../interfaces/fraction.models';
import { fractionBeforeAfter, fractionPreview } from './fraction-preview.rules';

const FRACTION: Fraction = {
  id: 1,
  requestId: 'r-1',
  portions: 7,
  wholeUnitCost: '450.0000',
  portionUnitCost: '64.2857',
  createdAt: '2026-11-07T10:00:00Z',
  product: { id: 10, name: 'Creatina', stock: 2 },
  portionProduct: { id: 11, name: 'Creatina · bolsita 30 g', created: true, price: '85.00', stock: 7 },
};

describe('fractionPreview', () => {
  it('baja 1 entero (N → N−1) y suben B bolsitas', () => {
    expect(fractionPreview(3, 7)).toEqual({ wholeBefore: 3, wholeAfter: 2, portions: 7 });
  });
});

describe('fractionBeforeAfter', () => {
  it('entero stock + 1 → stock y bolsita stock − bolsitas → stock', () => {
    expect(fractionBeforeAfter(FRACTION, false)).toEqual({
      wholeBefore: 3,
      wholeAfter: 2,
      portionBefore: 0,
      portionAfter: 7,
    });
  });

  it('con replayed solo trae el «después»', () => {
    expect(fractionBeforeAfter(FRACTION, true)).toEqual({
      wholeBefore: null,
      wholeAfter: 2,
      portionBefore: null,
      portionAfter: 7,
    });
  });
});
