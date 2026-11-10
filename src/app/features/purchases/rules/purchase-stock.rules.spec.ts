import { stockAfterPurchase } from './purchase-stock.rules';

describe('stockAfterPurchase', () => {
  it('suma las piezas que entran a las actuales de la bodega', () => {
    expect(stockAfterPurchase(3, 5)).toBe(8);
    expect(stockAfterPurchase(0, 1)).toBe(1);
  });
});
