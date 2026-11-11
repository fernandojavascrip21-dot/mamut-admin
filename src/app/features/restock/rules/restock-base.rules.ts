import type {
  RestockBaseLines,
  RestockOrder,
  RestockProduct,
} from '../interfaces/restock.models';
import { closedOrSavedAt } from './restock-dates.rules';

// Renglones del formulario a partir de un pedido viejo y de los productos pedibles hoy.
// El costo de catálogo es el actual del producto: el guardado en el pedido viejo ya no aplica.
// Un producto que no está en la lista (desactivado o bolsita) se omite y se cuenta.
// La nota no se copia: es de aquel pedido.
export function baseLinesFrom(order: RestockOrder, products: RestockProduct[]): RestockBaseLines {
  const orderable = new Map(products.map((product) => [product.productId, product]));
  let skipped = 0;

  const catalog: RestockBaseLines['lines'] = [];
  for (const line of order.lines) {
    const product = orderable.get(line.product.id);
    if (product === undefined) {
      skipped++;
      continue;
    }
    catalog.push({ kind: 'catalog', productId: product.productId, qty: line.qty, unitCost: product.unitCost });
  }

  const custom: RestockBaseLines['lines'] = order.customLines.map((line) => ({
    kind: 'custom',
    name: line.name,
    qty: line.qty,
    unitCost: line.unitCost,
  }));

  return { lines: [...catalog, ...custom], skipped, baseClosedAt: closedOrSavedAt(order) };
}
