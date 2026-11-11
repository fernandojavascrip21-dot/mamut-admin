import type { RestockLineForm } from '../components/restock-form/restock-form.models';
import { RESTOCK_PAGE_TEXTS } from '../constants/restock-page.constants';
import type {
  RestockBaseLines,
  RestockOrder,
  RestockOrderLookup,
  RestockProduct,
} from '../interfaces/restock.models';
import type { RestockBaseOutcome } from '../models/restock-page.models';
import { closedOrSavedAt } from './restock-dates.rules';

// El parámetro `base` llega como texto (`resurtir;base=4`): solo un id entero positivo cuenta.
export function parseBaseId(raw: string | null): number | null {
  if (raw === null) return null;
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// Aviso de los renglones omitidos del base: singular o plural según cuántos sean.
export function skippedNoticeText(count: number): string {
  return count === 1 ? RESTOCK_PAGE_TEXTS.skippedOne : `${count} ${RESTOCK_PAGE_TEXTS.skippedMany}`;
}

// Un pedido que no está cerrado (o que ya no existe) no sirve de base: la pantalla carga normal.
// Si sirve, sus renglones se pasan a los del formulario: el catálogo toma el nombre del producto actual.
export function baseOutcome(lookup: RestockOrderLookup, products: RestockProduct[]): RestockBaseOutcome {
  if (!lookup.found || lookup.order.status !== 'closed') return { kind: 'missing' };
  const base = baseLinesFrom(lookup.order, products);
  const names = new Map(products.map((product) => [product.productId, product.name]));
  const lines = base.lines.map(
    (line): RestockLineForm =>
      line.kind === 'catalog'
        ? {
            kind: 'catalog',
            productId: line.productId,
            name: names.get(line.productId) ?? '',
            qty: String(line.qty),
            unitCost: line.unitCost,
          }
        : { kind: 'custom', productId: null, name: line.name, qty: String(line.qty), unitCost: line.unitCost ?? '' },
  );
  return { kind: 'ready', lines, skipped: base.skipped, baseClosedAt: base.baseClosedAt };
}

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
