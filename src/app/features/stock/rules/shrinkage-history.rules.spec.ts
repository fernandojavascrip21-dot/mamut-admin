import type { ShrinkageHistoryItem } from '../interfaces/stock-history.models';
import { filterShrinkageHistory } from './stock-history.rules';

const item = (id: number, name: string): ShrinkageHistoryItem => ({
  requestId: `r-${id}`,
  createdAt: '2026-11-08T10:00:00Z',
  qty: 1,
  reason: 'lost',
  reasonLabel: 'Se perdió',
  holder: null,
  product: { id, name, image: null },
});
const ITEMS = [item(3, 'Proteína Whey'), item(2, 'Creatina 300 g'), item(1, 'Pre-entreno')];
const ids = (rows: ShrinkageHistoryItem[]) => rows.map((row) => row.product.id);

describe('filterShrinkageHistory', () => {
  it('con búsqueda vacía o de espacios devuelve todo en el mismo orden', () => {
    expect(ids(filterShrinkageHistory(ITEMS, ''))).toEqual([3, 2, 1]);
    expect(ids(filterShrinkageHistory(ITEMS, '   '))).toEqual([3, 2, 1]);
  });

  it('filtra por el nombre del producto', () => {
    expect(ids(filterShrinkageHistory(ITEMS, 'creatina'))).toEqual([2]);
  });

  it('ignora acentos y mayúsculas', () => {
    expect(ids(filterShrinkageHistory(ITEMS, 'PROTEINA'))).toEqual([3]);
    expect(ids(filterShrinkageHistory(ITEMS, 'proteína'))).toEqual([3]);
  });

  it('sin coincidencias devuelve una lista vacía', () => {
    expect(filterShrinkageHistory(ITEMS, 'zzz')).toEqual([]);
  });

  it('con lista vacía devuelve una lista vacía', () => {
    expect(filterShrinkageHistory([], 'creatina')).toEqual([]);
  });

  it('no modifica la lista original', () => {
    const copy = [...ITEMS];
    filterShrinkageHistory(ITEMS, 'creatina');
    expect(ITEMS).toEqual(copy);
  });
});
