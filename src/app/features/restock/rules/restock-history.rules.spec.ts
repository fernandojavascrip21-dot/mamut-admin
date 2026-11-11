import type { RestockOrderSummary } from '../interfaces/restock.models';
import { historyItemView, sortClosedOrders } from './restock-history.rules';

const order = (id: number, closedAt: string, extra: Partial<RestockOrderSummary> = {}): RestockOrderSummary => ({
  id, status: 'closed', note: null, createdAt: '2026-11-01T18:00:00Z', updatedAt: closedAt, closedAt,
  lineCount: 3, totalUnits: 42, estimatedTotal: '1234.50', ...extra,
});

describe('sortClosedOrders', () => {
  it('ordena por closedAt descendente, sin importar el orden de createdAt del backend', () => {
    const sorted = sortClosedOrders([order(1, '2026-11-01T18:00:00Z'), order(2, '2026-11-09T18:00:00Z'), order(3, '2026-11-05T18:00:00Z')]);
    expect(sorted.map((o) => o.id)).toEqual([2, 3, 1]);
  });

  it('en un empate de closedAt gana el id mayor', () => {
    const sorted = sortClosedOrders([order(4, '2026-11-09T18:00:00Z'), order(9, '2026-11-09T18:00:00Z'), order(6, '2026-11-09T18:00:00Z')]);
    expect(sorted.map((o) => o.id)).toEqual([9, 6, 4]);
  });

  it('no modifica la lista original', () => {
    const original = [order(1, '2026-11-01T18:00:00Z'), order(2, '2026-11-09T18:00:00Z')];
    sortClosedOrders(original);
    expect(original.map((o) => o.id)).toEqual([1, 2]);
  });
});

describe('historyItemView', () => {
  it('arma «Cerrado el …», «N productos · M piezas» y el total del backend', () => {
    expect(historyItemView(order(5, '2026-11-12T05:30:00Z', { note: 'Urgente' }))).toEqual({
      id: 5,
      closedLabel: 'Cerrado el 11 nov 2026',
      countsLabel: '3 productos · 42 piezas',
      estimatedTotal: '1234.50',
      note: 'Urgente',
    });
  });

  it('un pedido sin nota deja note en null', () => {
    expect(historyItemView(order(5, '2026-11-12T05:30:00Z')).note).toBeNull();
  });
});
