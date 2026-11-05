import type { MyStockAlert } from '../interfaces/my-stock.models';
import { filterMyStockByName, lowStockNotice, unitsLeftLabel } from './my-stock.rules';

describe('filterMyStockByName', () => {
  const items = [{ name: 'Proteína Whey' }, { name: 'Creatina' }];

  it('«proteina» encuentra «Proteína»', () => {
    expect(filterMyStockByName(items, 'proteina')).toEqual([{ name: 'Proteína Whey' }]);
  });

  it('no distingue mayúsculas', () => {
    expect(filterMyStockByName(items, 'CREA')).toEqual([{ name: 'Creatina' }]);
  });

  it('una búsqueda vacía o de espacios devuelve la lista tal cual', () => {
    expect(filterMyStockByName(items, '')).toBe(items);
    expect(filterMyStockByName(items, '   ')).toBe(items);
  });

  it('sin coincidencias devuelve una lista vacía', () => {
    expect(filterMyStockByName(items, 'xyz')).toEqual([]);
  });
});

describe('unitsLeftLabel', () => {
  it('dice «Cantidad N», también con 1 pieza', () => {
    expect(unitsLeftLabel(1)).toBe('Cantidad 1');
    expect(unitsLeftLabel(6)).toBe('Cantidad 6');
  });
});

describe('lowStockNotice', () => {
  const alert = (name: string, stockLevel: MyStockAlert['stockLevel']): MyStockAlert => ({
    productId: 1, name, units: stockLevel === 'out' ? 0 : 2, stockLevel,
  });

  it('sin avisos devuelve null', () => {
    expect(lowStockNotice([])).toBeNull();
  });

  it('une los nombres y marca los agotados', () => {
    expect(lowStockNotice([alert('Whey', 'out'), alert('Creatina', 'low')])).toBe(
      'Te quedan pocas piezas de: Whey (agotado), Creatina. Ya se le avisó al administrador.',
    );
  });

  it('con un solo producto no lleva comas', () => {
    expect(lowStockNotice([alert('Creatina', 'low')])).toBe(
      'Te quedan pocas piezas de: Creatina. Ya se le avisó al administrador.',
    );
  });
});
