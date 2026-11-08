import type { FractionHistoryItem } from '../interfaces/fraction.models';
import { filterFractionHistory } from './fraction-history.rules';

const item = (id: number, whole: string, bag: string): FractionHistoryItem => ({
  id,
  requestId: `r-${id}`,
  createdAt: '2026-11-07T16:00:00Z',
  portions: 7,
  wholeUnitCost: '450.0000',
  portionUnitCost: '64.2857',
  portionPrice: '85.00',
  product: { id: id * 10, name: whole },
  portionProduct: { id: id * 10 + 1, name: bag },
  createdBy: { id: 'a-1', name: 'Ana Admin' },
});
const ITEMS = [
  item(3, 'Proteína Whey', 'Proteína Whey · bolsita 40 g'),
  item(2, 'Creatina 300 g', 'Creatina 300 g · bolsita 30 g'),
  item(1, 'Pre-entreno', 'Pre-entreno · bolsita 20 g'),
];
const ids = (rows: FractionHistoryItem[]) => rows.map((row) => row.id);

describe('filterFractionHistory', () => {
  it('con búsqueda vacía o de espacios devuelve todo en el mismo orden', () => {
    expect(ids(filterFractionHistory(ITEMS, ''))).toEqual([3, 2, 1]);
    expect(ids(filterFractionHistory(ITEMS, '   '))).toEqual([3, 2, 1]);
  });

  it('filtra por el nombre del entero', () => {
    expect(ids(filterFractionHistory(ITEMS, 'creatina'))).toEqual([2]);
  });

  it('filtra por el nombre de la bolsita', () => {
    expect(ids(filterFractionHistory(ITEMS, 'bolsita 20'))).toEqual([1]);
  });

  it('ignora acentos y mayúsculas', () => {
    expect(ids(filterFractionHistory(ITEMS, 'PROTEINA'))).toEqual([3]);
    expect(ids(filterFractionHistory(ITEMS, 'proteína'))).toEqual([3]);
  });

  it('sin coincidencias devuelve una lista vacía', () => {
    expect(filterFractionHistory(ITEMS, 'zzz')).toEqual([]);
  });

  it('no modifica la lista original', () => {
    const copy = [...ITEMS];
    filterFractionHistory(ITEMS, 'creatina');
    expect(ITEMS).toEqual(copy);
  });
});
