import type { StockProduct } from '../interfaces/stock-overview.models';
import { portionRows } from './stock.rules';

const product = (productId: number, parentProductId?: number | null): StockProduct => ({
  productId, name: `P${productId}`, image: null, warehouse: 1, warehouseLevel: 'ok', sellers: [], inactiveSellers: 0, total: 1,
  ...(parentProductId === undefined ? {} : { parentProductId }),
});

describe('portionRows (HU-26 §13)', () => {
  it('deja solo los productos con parentProductId distinto de null', () => {
    const rows = [product(1, null), product(2, 1), product(3, 7)];
    expect(portionRows(rows).map((row) => row.productId)).toEqual([2, 3]);
  });

  it('quita los productos sin el campo (fixtures antiguos) y los de null', () => {
    expect(portionRows([product(1), product(2, null)])).toEqual([]);
  });

  it('conserva el orden recibido', () => {
    const rows = [product(9, 1), product(4, 1), product(6, 2)];
    expect(portionRows(rows).map((row) => row.productId)).toEqual([9, 4, 6]);
  });

  it('con una lista vacía devuelve una lista vacía', () => {
    expect(portionRows([])).toEqual([]);
  });

  it('no modifica la lista de entrada', () => {
    const rows = [product(1, null), product(2, 1)];
    portionRows(rows);
    expect(rows).toHaveLength(2);
  });
});
