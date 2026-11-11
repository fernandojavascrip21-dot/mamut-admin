import type { RestockBaseLines, RestockOrder, RestockProduct } from '../interfaces/restock.models';

// Renglones del formulario a partir de un pedido viejo y de los productos pedibles hoy.
export function baseLinesFrom(order: RestockOrder, products: RestockProduct[]): RestockBaseLines {
  throw new Error(`Sin implementar: ${order.id} ${products.length}`);
}
