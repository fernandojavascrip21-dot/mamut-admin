import type { RestockOrder, RestockProduct } from '../interfaces/restock.models';
import { baseLinesFrom } from './restock-base.rules';

const PRODUCTS: RestockProduct[] = [
  { productId: 1, name: 'Creatina 300 g', image: null, units: 0, stockLevel: 'out', unitCost: '12.5000' },
  { productId: 2, name: 'Proteína 2 kg', image: null, units: 2, stockLevel: 'low', unitCost: '10.0000' },
];
const BASE: RestockOrder = {
  id: 4, status: 'closed', note: 'Nota del pedido viejo', createdAt: '2026-10-18T18:00:00Z',
  updatedAt: '2026-10-20T18:00:00Z', closedAt: '2026-10-20T18:00:00Z', lineCount: 5, totalUnits: 13,
  estimatedTotal: '100.00', requestId: 'r-4',
  lines: [
    { product: { id: 1, name: 'Creatina 300 g', image: null }, qty: 5, unitCost: '9.0000' },
    { product: { id: 9, name: 'Producto desactivado', image: null }, qty: 3, unitCost: '4.0000' },
    { product: { id: 10, name: 'Bolsita', image: null }, qty: 1, unitCost: '1.0000' },
  ],
  customLines: [
    { id: 1, name: 'Shaker', qty: 2, unitCost: '15.0000' },
    { id: 2, name: 'Bolsas', qty: 1, unitCost: null },
  ],
};

describe('baseLinesFrom', () => {
  it('un renglón de catálogo conserva las piezas y toma el costo actual del producto, no el guardado', () => {
    const { lines } = baseLinesFrom(BASE, PRODUCTS);
    expect(lines[0]).toEqual({ kind: 'catalog', productId: 1, qty: 5, unitCost: '12.5000' });
  });

  it('omite los de catálogo que ya no se pueden pedir y cuenta cuántos fueron', () => {
    const result = baseLinesFrom(BASE, PRODUCTS);
    expect(result.skipped).toBe(2);
    expect(result.lines.filter((line) => line.kind === 'catalog')).toHaveLength(1);
  });

  it('los escritos a mano conservan nombre, piezas y su costo guardado, también null', () => {
    const { lines } = baseLinesFrom(BASE, PRODUCTS);
    expect(lines.slice(1)).toEqual([
      { kind: 'custom', name: 'Shaker', qty: 2, unitCost: '15.0000' },
      { kind: 'custom', name: 'Bolsas', qty: 1, unitCost: null },
    ]);
  });

  it('conserva la fecha de cierre del base y no copia la nota', () => {
    const result = baseLinesFrom(BASE, PRODUCTS);
    expect(result.baseClosedAt).toBe('2026-10-20T18:00:00Z');
    expect(Object.keys(result).sort()).toEqual(['baseClosedAt', 'lines', 'skipped']);
    expect(JSON.stringify(result)).not.toContain('Nota del pedido viejo');
  });

  it('con todos los productos pedibles no omite ninguno', () => {
    const result = baseLinesFrom({ ...BASE, lines: [BASE.lines[0]], customLines: [] }, PRODUCTS);
    expect(result.skipped).toBe(0);
    expect(result.lines).toHaveLength(1);
  });
});
