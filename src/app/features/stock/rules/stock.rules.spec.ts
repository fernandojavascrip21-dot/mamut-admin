import type { StockOverview, StockProduct, StockSellerTotal } from '../interfaces/stock-overview.models';
import {
  filterStockByName, productBreakdown, sellerProducts, sellerTotal, splitParts,
} from './stock.rules';

const seller = (fullName: string, units = 0): StockSellerTotal => ({ id: fullName, fullName, units });
const product = (overrides: Partial<StockProduct> = {}): StockProduct => ({
  productId: 1, name: 'Proteína', image: null, warehouse: 0, sellers: [], inactiveSellers: 0, total: 0, ...overrides,
});
const overview = (overrides: Partial<StockOverview> = {}): StockOverview => ({
  warehouse: 0, sellers: [], inactiveSellers: 0, total: 0, products: [], ...overrides,
});

describe('splitParts', () => {
  it('pone Bodega primero y los vendedores por nombre sin distinguir acentos', () => {
    const parts = splitParts(overview({
      warehouse: 4,
      sellers: [seller('Beto', 1), seller('Ángel', 2), seller('ana', 3)],
    }));
    expect(parts.map((p) => p.label)).toEqual(['Bodega', 'ana', 'Ángel', 'Beto']);
    expect(parts.map((p) => p.units)).toEqual([4, 3, 2, 1]);
  });

  it('incluye a los vendedores con 0 piezas', () => {
    const parts = splitParts(overview({ sellers: [seller('Luis', 0)] }));
    expect(parts.find((p) => p.label === 'Luis')?.units).toBe(0);
  });

  it('agrega «Vendedores inactivos» al final solo si tiene piezas', () => {
    expect(splitParts(overview({ sellers: [seller('Luis')] })).map((p) => p.label)).toEqual(['Bodega', 'Luis']);
    const parts = splitParts(overview({ sellers: [seller('Luis')], inactiveSellers: 3 }));
    expect(parts.map((p) => p.label)).toEqual(['Bodega', 'Luis', 'Vendedores inactivos']);
    expect(parts.at(-1)?.units).toBe(3);
  });

  it('Bodega e inactivos no usan color de vendedor', () => {
    const parts = splitParts(overview({ sellers: [seller('Luis')], inactiveSellers: 1 }));
    expect(parts[0].colorIndex).toBeNull();
    expect(parts.at(-1)?.colorIndex).toBeNull();
  });

  it('los colores rotan a partir del sexto vendedor', () => {
    const names = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
    const parts = splitParts(overview({ sellers: names.map((name) => seller(name)) }));
    expect(parts.slice(1).map((p) => p.colorIndex)).toEqual([0, 1, 2, 3, 4, 0, 1]);
  });

  it('la llave de cada vendedor es su id', () => {
    const parts = splitParts(overview({ sellers: [{ id: 'uuid-1', fullName: 'Luis', units: 1 }] }));
    expect(parts[1].key).toBe('uuid-1');
  });
});

describe('productBreakdown', () => {
  const sellers = [seller('Luis'), seller('Valeria')];

  it('muestra bodega y vendedor: «Bodega 4 · Luis 6»', () => {
    const row = product({ warehouse: 4, sellers: [{ sellerId: 'Luis', units: 6 }], total: 10 });
    expect(productBreakdown(row, sellers)).toBe('Bodega 4 · Luis 6');
  });

  it('omite los lugares con 0 piezas', () => {
    expect(productBreakdown(product({ warehouse: 0, sellers: [{ sellerId: 'Luis', units: 6 }] }), sellers)).toBe('Luis 6');
    expect(productBreakdown(product({ warehouse: 3 }), sellers)).toBe('Bodega 3');
  });

  it('ordena los vendedores por nombre, no por el orden de la respuesta', () => {
    const row = product({ warehouse: 1, sellers: [{ sellerId: 'Valeria', units: 2 }, { sellerId: 'Luis', units: 5 }] });
    expect(productBreakdown(row, sellers)).toBe('Bodega 1 · Luis 5 · Valeria 2');
  });

  it('pone «Vendedores inactivos» al final', () => {
    const row = product({ warehouse: 2, sellers: [{ sellerId: 'Luis', units: 1 }], inactiveSellers: 3 });
    expect(productBreakdown(row, sellers)).toBe('Bodega 2 · Luis 1 · Vendedores inactivos 3');
  });
});

describe('sellerProducts y sellerTotal', () => {
  const whey = product({ productId: 1, name: 'Whey', warehouse: 4, sellers: [{ sellerId: 'Luis', units: 6 }], total: 10 });
  const creatine = product({ productId: 2, name: 'Creatina', warehouse: 2, total: 2 });
  const data = overview({
    warehouse: 6, sellers: [seller('Luis', 6), seller('Valeria', 0)], total: 12, products: [creatine, whey],
  });

  it('un vendedor con piezas ve solo sus productos y sus piezas', () => {
    expect(sellerProducts(data, 'Luis')).toEqual([{ product: whey, units: 6 }]);
    expect(sellerTotal(data, 'Luis')).toBe(6);
  });

  it('un vendedor sin piezas no tiene productos y su total es 0', () => {
    expect(sellerProducts(data, 'Valeria')).toEqual([]);
    expect(sellerTotal(data, 'Valeria')).toBe(0);
  });

  it('un id desconocido vale 0', () => {
    expect(sellerProducts(data, 'nadie')).toEqual([]);
    expect(sellerTotal(data, 'nadie')).toBe(0);
  });
});

describe('filterStockByName', () => {
  const items = [{ name: 'Proteína Whey' }, { name: 'Creatina' }];

  it('«proteina» encuentra «Proteína»', () => {
    expect(filterStockByName(items, 'proteina')).toEqual([{ name: 'Proteína Whey' }]);
  });

  it('una búsqueda vacía o de espacios devuelve la lista tal cual', () => {
    expect(filterStockByName(items, '')).toBe(items);
    expect(filterStockByName(items, '   ')).toBe(items);
  });

  it('sin coincidencias devuelve una lista vacía', () => {
    expect(filterStockByName(items, 'xyz')).toEqual([]);
  });
});
