import type { RestockLineForm } from '../components/restock-form/restock-form.models';
import { estimateTotal } from './restock-estimate.rules';

const catalog = (qty: string, unitCost: string, productId = 1): RestockLineForm =>
  ({ kind: 'catalog', productId, name: 'Producto', qty, unitCost });
const custom = (qty: string, unitCost: string, name = 'Escrito'): RestockLineForm =>
  ({ kind: 'custom', productId: null, name, qty, unitCost });

describe('estimateTotal', () => {
  it('una lista vacía suma 0.00 y ninguno sin costo', () => {
    expect(estimateTotal([])).toEqual({ total: '0.00', withoutCost: 0 });
  });

  it('suma piezas por costo de cada renglón: 2 × 10.5000 + 1 × 10.0000 = 31.00', () => {
    expect(estimateTotal([catalog('2', '10.5000', 1), catalog('1', '10.0000', 2)]).total).toBe('31.00');
  });

  it('redondea una sola vez, sobre la suma: 3 × 10.3333 = 30.9999 → 31.00', () => {
    expect(estimateTotal([catalog('3', '10.3333')]).total).toBe('31.00');
  });

  it('el redondeo es de la suma y no de cada renglón: 15.5025 + 15.5025 = 31.005 → 31.01', () => {
    expect(estimateTotal([catalog('1', '15.5025', 1), catalog('1', '15.5025', 2)]).total).toBe('31.01');
  });

  it('mitad hacia arriba: 31.0050 → 31.01 y 31.0049 → 31.00', () => {
    expect(estimateTotal([catalog('1', '31.0050')]).total).toBe('31.01');
    expect(estimateTotal([catalog('1', '31.0049')]).total).toBe('31.00');
  });

  it('un renglón escrito sin costo cuenta 0 y se avisa «sin costo»', () => {
    expect(estimateTotal([catalog('2', '10.5000'), custom('5', '', 'A'), custom('1', '  ', 'B')]))
      .toEqual({ total: '21.00', withoutCost: 2 });
  });

  it('un renglón escrito con costo suma igual que uno de catálogo y no cuenta como sin costo', () => {
    expect(estimateTotal([custom('4', '2.5000')])).toEqual({ total: '10.00', withoutCost: 0 });
  });

  it('las piezas inválidas no suman', () => {
    for (const qty of ['', '0', '-1', '1.5', 'abc']) {
      expect(estimateTotal([catalog(qty, '10.0000', 1), catalog('1', '1.0000', 2)]).total).toBe('1.00');
    }
  });

  it('un costo inválido no suma', () => {
    for (const unitCost of ['abc', '-1', '1.23456', '1000000']) {
      expect(estimateTotal([catalog('2', unitCost, 1), catalog('1', '1.0000', 2)]).total).toBe('1.00');
    }
  });

  it('no usa números flotantes: 0.1 × 3 = 0.30', () => {
    expect(estimateTotal([catalog('3', '0.1000')]).total).toBe('0.30');
  });
});
