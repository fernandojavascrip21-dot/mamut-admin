import type { CartLine } from '@core/cart/cart.models';
import { fromMinorUnits, toMinorUnits } from '@shared/utils/money';
import { normalizeText } from '@shared/utils/normalize-text';
import { UNAVAILABLE_PRODUCT_NAME } from '../constants/cart-page.constants';
import type { SellProduct } from '../interfaces/sell-stock.models';
import type { CartRow, CartRowStatus } from '../models/cart-page.models';

// Subcadena del nombre sin distinguir mayúsculas ni acentos; una búsqueda vacía (o solo espacios)
// devuelve la lista tal cual. Solo filtra la lista: no cambia el carrito. Se reescribe aquí y no se
// importa de `features/my-stock`, porque una feature no importa otra.
export function filterSellProductsByName<T extends { name: string }>(items: T[], query: string): T[] {
  const normalizedQuery = normalizeText(query);
  if (normalizedQuery === '') return items;
  return items.filter((item) => normalizeText(item.name).includes(normalizedQuery));
}

// Piezas que quedan para agregar: las que tiene menos las que ya están en el carrito, sin bajar de 0
// (un carrito viejo puede pedir más de las que hay).
export function unitsLeft(product: SellProduct, unitsInCart: number): number {
  return Math.max(0, product.units - unitsInCart);
}

// El «+» solo funciona mientras el carrito tenga menos piezas de las que el vendedor tiene (tope).
export function canIncrement(product: SellProduct, unitsInCart: number): boolean {
  return unitsInCart < product.units;
}

// Piezas × precio en centavos enteros (sin flotantes, T-08), como texto con 2 decimales. Un precio
// ilegible cuenta como 0: el backend siempre manda texto válido, así que no debería pasar.
function subtotalOf(units: number, price: string): string {
  const cents = toMinorUnits(price, 2) ?? 0;
  return fromMinorUnits(units * cents, 2);
}

// Un renglón por línea del carrito, en el orden en que se agregaron, resuelto contra el stock de
// ahora. Un producto que ya no viene se trata como agotado, con un producto de relleno. El subtotal se
// calcula siempre; qué renglones cuentan para el total lo decide `cartTotal`.
export function buildCartRows(products: SellProduct[], lines: CartLine[]): CartRow[] {
  const byId = new Map(products.map((product) => [product.productId, product]));
  return lines.map((line) => {
    const product: SellProduct = byId.get(line.productId) ?? {
      productId: line.productId,
      name: UNAVAILABLE_PRODUCT_NAME,
      image: null,
      units: 0,
      price: '0.00',
    };
    const status: CartRowStatus = product.units <= 0 ? 'soldOut' : line.units > product.units ? 'over' : 'ok';
    return {
      product,
      units: line.units,
      available: product.units,
      subtotal: subtotalOf(line.units, product.price),
      status,
    };
  });
}

// Total de la venta: solo suman los renglones que alcanzan. Los de más o agotados no cuentan, porque
// no se pueden confirmar tal cual.
export function cartTotal(rows: CartRow[]): string {
  const cents = rows
    .filter((row) => row.status === 'ok')
    .reduce((sum, row) => sum + (toMinorUnits(row.subtotal, 2) ?? 0), 0);
  return fromMinorUnits(cents, 2);
}

// Hay que corregir el carrito mientras algún renglón pida de más o ya no tenga piezas.
export function cartNeedsFix(rows: CartRow[]): boolean {
  return rows.some((row) => row.status !== 'ok');
}
