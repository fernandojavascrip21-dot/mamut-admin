import type { RestockLineForm } from '../components/restock-form/restock-form.models';
import type { RestockCustomLine, RestockOrder, RestockOrderLine, RestockProduct, RestockSuggestion } from '../interfaces/restock.models';
import type { RestockPageData } from '../models/restock-page.models';
import { addableProducts, existsInCatalog, initialLines, lineViews, missingSuggestions } from './restock-lines.rules';

const PRODUCTS: RestockProduct[] = [
  { productId: 1, name: 'Creatina 300 g', image: 'c.jpg', units: 0, stockLevel: 'out', unitCost: '120.0000' },
  { productId: 2, name: 'Proteína 2 kg', image: null, units: 2, stockLevel: 'low', unitCost: '450.5000' },
  { productId: 3, name: 'Barra de avena', image: null, units: 40, stockLevel: 'ok', unitCost: '10.0000' },
];
const SUGGESTIONS: RestockSuggestion[] = [
  { productId: 1, name: 'Creatina 300 g', image: 'c.jpg', units: 0, stockLevel: 'out', unitCost: '120.0000' },
  { productId: 2, name: 'Proteína 2 kg', image: null, units: 2, stockLevel: 'low', unitCost: '450.5000' },
];
const catalogLine = (productId: number, qty = '', unitCost = '1.0000', name = 'x'): RestockLineForm =>
  ({ kind: 'catalog', productId, name, qty, unitCost });
const customLine = (name: string, qty = '', unitCost = ''): RestockLineForm =>
  ({ kind: 'custom', productId: null, name, qty, unitCost });

function draft(lines: RestockOrderLine[], customLines: RestockCustomLine[]): RestockOrder {
  return {
    id: 7, status: 'draft', note: 'Nota guardada', createdAt: '2026-11-09T18:00:00Z', updatedAt: '2026-11-10T01:00:00Z',
    closedAt: null, lineCount: lines.length + customLines.length, totalUnits: 0, estimatedTotal: '0.00',
    requestId: 'r-1', lines, customLines,
  };
}

describe('initialLines', () => {
  it('sin borrador parte de las sugerencias, en su orden, con piezas vacías y el costo actual', () => {
    const data: RestockPageData = { draft: null, suggestions: SUGGESTIONS, products: PRODUCTS };
    expect(initialLines(data)).toEqual([
      { kind: 'catalog', productId: 1, name: 'Creatina 300 g', qty: '', unitCost: '120.0000' },
      { kind: 'catalog', productId: 2, name: 'Proteína 2 kg', qty: '', unitCost: '450.5000' },
    ]);
  });

  it('con borrador pinta primero los de catálogo y después los escritos, con sus piezas y costos', () => {
    const data: RestockPageData = {
      draft: draft(
        [{ product: { id: 2, name: 'Proteína 2 kg', image: null }, qty: 3, unitCost: '400.0000' }],
        [{ id: 9, name: 'Shaker', qty: 2, unitCost: null }],
      ),
      suggestions: SUGGESTIONS,
      products: PRODUCTS,
    };
    expect(initialLines(data)).toEqual([
      { kind: 'catalog', productId: 2, name: 'Proteína 2 kg', qty: '3', unitCost: '400.0000' },
      { kind: 'custom', productId: null, name: 'Shaker', qty: '2', unitCost: '' },
    ]);
  });

  it('con borrador no mezcla las sugerencias', () => {
    const data: RestockPageData = { draft: draft([], []), suggestions: SUGGESTIONS, products: PRODUCTS };
    expect(initialLines(data)).toEqual([]);
  });
});

describe('lineViews', () => {
  it('un renglón de catálogo toma piezas, nivel e imagen de los productos pedibles', () => {
    const [view] = lineViews([catalogLine(1)], PRODUCTS);
    expect(view).toEqual({
      kind: 'catalog', productId: 1, name: 'Creatina 300 g', image: 'c.jpg', units: 0, stockLevel: 'out', orderable: true,
    });
  });

  it('un nivel ok también se entrega: la pantalla decide no pintar etiqueta', () => {
    expect(lineViews([catalogLine(3)], PRODUCTS)[0]).toMatchObject({ units: 40, stockLevel: 'ok', orderable: true });
  });

  it('un producto que ya no está en los pedibles (desactivado o bolsita) no es pedible y conserva su nombre', () => {
    const [view] = lineViews([catalogLine(99, '2', '5.0000', 'Bolsita vieja')], PRODUCTS);
    expect(view).toEqual({
      kind: 'catalog', productId: 99, name: 'Bolsita vieja', image: null, units: null, stockLevel: null, orderable: false,
    });
  });

  it('un renglón escrito no tiene foto, piezas en bodega ni nivel y siempre es pedible', () => {
    expect(lineViews([customLine('Shaker')], PRODUCTS)[0]).toEqual({
      kind: 'custom', productId: null, name: 'Shaker', image: null, units: null, stockLevel: null, orderable: true,
    });
  });

  it('devuelve una vista por renglón y en el mismo orden', () => {
    const views = lineViews([customLine('Shaker'), catalogLine(2)], PRODUCTS);
    expect(views.map((v) => v.name)).toEqual(['Shaker', 'Proteína 2 kg']);
  });
});

describe('addableProducts', () => {
  it('ofrece todos los pedibles, también con existencia suficiente', () => {
    expect(addableProducts(PRODUCTS, []).map((p) => p.productId)).toEqual([1, 2, 3]);
  });

  it('no ofrece los que ya están en la lista', () => {
    expect(addableProducts(PRODUCTS, [catalogLine(1), customLine('Shaker')]).map((p) => p.productId)).toEqual([2, 3]);
  });
});

describe('missingSuggestions', () => {
  it('trae las sugerencias que no están en la lista, en el orden del backend', () => {
    expect(missingSuggestions(SUGGESTIONS, [catalogLine(1)]).map((s) => s.productId)).toEqual([2]);
    expect(missingSuggestions(SUGGESTIONS, []).map((s) => s.productId)).toEqual([1, 2]);
  });

  it('con todas en la lista no queda ninguna', () => {
    expect(missingSuggestions(SUGGESTIONS, [catalogLine(1), catalogLine(2)])).toEqual([]);
  });
});

describe('existsInCatalog', () => {
  it('detecta el nombre de un producto del catálogo sin mayúsculas ni acentos', () => {
    expect(existsInCatalog('proteina 2 KG', PRODUCTS)).toBe(true);
    expect(existsInCatalog('  Creatina 300 g ', PRODUCTS)).toBe(true);
  });

  it('un nombre distinto o vacío no coincide', () => {
    expect(existsInCatalog('Shaker', PRODUCTS)).toBe(false);
    expect(existsInCatalog('', PRODUCTS)).toBe(false);
  });
});
