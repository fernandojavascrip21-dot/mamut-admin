import type { CartLine } from '@core/cart/cart.models';
import type { SellProduct } from '../interfaces/sell-stock.models';
import {
  buildCartRows, canIncrement, cartNeedsFix, cartTotal, filterSellProductsByName, unitsLeft,
} from './sell.rules';

const product = (overrides: Partial<SellProduct> = {}): SellProduct => ({
  productId: 1, name: 'Proteína', image: null, units: 3, price: '750.00', ...overrides,
});
const line = (productId: number, units: number): CartLine => ({ productId, units });

describe('filterSellProductsByName', () => {
  const items = [{ name: 'Proteína Whey' }, { name: 'Creatina' }];

  it('«proteina» encuentra «Proteína»', () => {
    expect(filterSellProductsByName(items, 'proteina')).toEqual([{ name: 'Proteína Whey' }]);
  });

  it('no distingue mayúsculas', () => {
    expect(filterSellProductsByName(items, 'CREA')).toEqual([{ name: 'Creatina' }]);
  });

  it('una búsqueda vacía o de espacios devuelve la lista tal cual', () => {
    expect(filterSellProductsByName(items, '')).toBe(items);
    expect(filterSellProductsByName(items, '   ')).toBe(items);
  });

  it('sin coincidencias devuelve una lista vacía', () => {
    expect(filterSellProductsByName(items, 'xyz')).toEqual([]);
  });
});

describe('unitsLeft y canIncrement', () => {
  it('«Quedan N» es lo que tiene menos lo que ya está en el carrito', () => {
    expect(unitsLeft(product({ units: 3 }), 0)).toBe(3);
    expect(unitsLeft(product({ units: 3 }), 2)).toBe(1);
    expect(unitsLeft(product({ units: 3 }), 3)).toBe(0);
  });

  it('un carrito que pide de más no da un número negativo', () => {
    expect(unitsLeft(product({ units: 2 }), 5)).toBe(0);
  });

  it('el «+» funciona hasta el tope y ahí se detiene (criterio 3)', () => {
    const tub = product({ units: 3 });
    expect(canIncrement(tub, 0)).toBe(true);
    expect(canIncrement(tub, 2)).toBe(true);
    expect(canIncrement(tub, 3)).toBe(false);
    expect(canIncrement(tub, 4)).toBe(false);
  });

  it('un producto agotado no se puede incrementar', () => {
    expect(canIncrement(product({ units: 0 }), 0)).toBe(false);
  });
});

describe('buildCartRows', () => {
  const products = [
    product({ productId: 1, name: 'Whey', units: 6, price: '750.00' }),
    product({ productId: 2, name: 'Creatina', units: 2, price: '450.50' }),
    product({ productId: 3, name: 'Isolate', units: 0, price: '1650.00' }),
  ];

  it('un renglón por línea, en el orden del carrito, con piezas, disponibles y subtotal', () => {
    const rows = buildCartRows(products, [line(2, 1), line(1, 2)]);
    expect(rows.map((r) => r.product.name)).toEqual(['Creatina', 'Whey']);
    expect(rows[0]).toMatchObject({ units: 1, available: 2, subtotal: '450.50', status: 'ok' });
    expect(rows[1]).toMatchObject({ units: 2, available: 6, subtotal: '1500.00', status: 'ok' });
  });

  it('pedir exactamente lo que tiene sigue siendo «ok»', () => {
    expect(buildCartRows(products, [line(2, 2)])[0].status).toBe('ok');
  });

  it('pedir más de lo que tiene es «over» y conserva las piezas del carrito', () => {
    const [row] = buildCartRows(products, [line(2, 5)]);
    expect(row).toMatchObject({ status: 'over', units: 5, available: 2 });
  });

  it('un producto que tuvo y se acabó es «soldOut»', () => {
    const [row] = buildCartRows(products, [line(3, 1)]);
    expect(row).toMatchObject({ status: 'soldOut', available: 0 });
    expect(row.product.name).toBe('Isolate');
  });

  it('un producto que ya no viene en el stock es «soldOut» con 0 disponibles y sin precio', () => {
    const [row] = buildCartRows(products, [line(99, 2)]);
    expect(row).toMatchObject({ status: 'soldOut', available: 0, units: 2, subtotal: '0.00' });
    expect(row.product).toMatchObject({ productId: 99, image: null, units: 0 });
    expect(row.product.name).toBe('Producto no disponible');
  });

  it('un carrito vacío da cero renglones', () => {
    expect(buildCartRows(products, [])).toEqual([]);
  });

  it('el subtotal es exacto en centavos, sin errores de coma flotante', () => {
    const cheap = [product({ productId: 7, units: 10, price: '0.10' })];
    expect(buildCartRows(cheap, [line(7, 3)])[0].subtotal).toBe('0.30');
    const odd = [product({ productId: 8, units: 10, price: '19.99' })];
    expect(buildCartRows(odd, [line(8, 3)])[0].subtotal).toBe('59.97');
  });
});

describe('cartTotal y cartNeedsFix', () => {
  const products = [
    product({ productId: 1, units: 6, price: '750.00' }),
    product({ productId: 2, units: 2, price: '450.50' }),
    product({ productId: 3, units: 0, price: '1650.00' }),
    product({ productId: 4, units: 10, price: '0.10' }),
  ];

  it('suma los subtotales con centavos exactos (3 × 0.10 = 0.30)', () => {
    expect(cartTotal(buildCartRows(products, [line(4, 3)]))).toBe('0.30');
    expect(cartTotal(buildCartRows(products, [line(1, 2), line(2, 1), line(4, 3)]))).toBe('1950.80');
  });

  it('un carrito vacío vale 0.00', () => {
    expect(cartTotal([])).toBe('0.00');
  });

  it('los renglones de más o agotados no suman al total', () => {
    const rows = buildCartRows(products, [line(1, 1), line(2, 5), line(3, 1), line(99, 1)]);
    expect(cartTotal(rows)).toBe('750.00');
  });

  it('cartNeedsFix es false con todo en orden y true con cualquier renglón de más o agotado', () => {
    expect(cartNeedsFix(buildCartRows(products, [line(1, 2), line(2, 2)]))).toBe(false);
    expect(cartNeedsFix([])).toBe(false);
    expect(cartNeedsFix(buildCartRows(products, [line(1, 2), line(2, 5)]))).toBe(true);
    expect(cartNeedsFix(buildCartRows(products, [line(1, 2), line(3, 1)]))).toBe(true);
    expect(cartNeedsFix(buildCartRows(products, [line(99, 1)]))).toBe(true);
  });
});
