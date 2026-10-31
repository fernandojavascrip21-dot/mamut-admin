import {
  effectiveCost,
  effectivePrice,
  filterDeliverableProducts,
  isBelowCost,
  parseProductId,
  parseReturnTarget,
  previewBalances,
  profitPerUnit,
  returnUrl,
} from './delivery.rules';
import type { DeliveryProductSummary } from '../interfaces/delivery.models';

const product = (name: string, stock: number): DeliveryProductSummary => ({
  id: 1,
  name,
  image: '',
  stock,
  price: '450.00',
});

describe('effectivePrice y effectiveCost', () => {
  it('usan el propio si hay y el general si está vacío o ausente', () => {
    expect(effectivePrice('450.00', '520')).toBe('520');
    expect(effectivePrice('450.00', null)).toBe('450.00');
    expect(effectivePrice('450.00', '  ')).toBe('450.00');
    expect(effectiveCost('300.0000', '310.5')).toBe('310.5');
    expect(effectiveCost('300.0000', '')).toBe('300.0000');
  });

  it('un propio inválido (cero, decimales de más, texto) cae en el general', () => {
    expect(effectivePrice('450.00', '0')).toBe('450.00');
    expect(effectivePrice('450.00', '10.123')).toBe('450.00');
    expect(effectivePrice('450.00', 'abc')).toBe('450.00');
    expect(effectiveCost('300.0000', '1.23456')).toBe('300.0000');
    expect(effectiveCost('300.0000', '1000000')).toBe('300.0000');
  });
});

describe('profitPerUnit', () => {
  it('resta en unidades enteras y redondea a centavos al final', () => {
    expect(profitPerUnit('520.00', '310.5000')).toBe('209.50');
    expect(profitPerUnit('450.00', '300.0000')).toBe('150.00');
    expect(profitPerUnit('0.10', '0.0300')).toBe('0.07');
  });

  it('redondea la mitad hacia arriba', () => {
    expect(profitPerUnit('10.00', '9.9950')).toBe('0.01'); // 0.0050
    expect(profitPerUnit('10.00', '9.9951')).toBe('0.00'); // 0.0049
  });

  it('puede ser negativa', () => {
    expect(profitPerUnit('100.00', '110.0000')).toBe('-10.00');
  });
});

describe('isBelowCost', () => {
  it('es true solo con el precio estrictamente menor que el costo', () => {
    expect(isBelowCost('299.99', '300.0000')).toBe(true);
    expect(isBelowCost('300.00', '300.0000')).toBe(false);
    expect(isBelowCost('300.01', '300.0000')).toBe(false);
  });
});

describe('previewBalances', () => {
  it('baja la bodega y sube al vendedor', () => {
    expect(previewBalances(10, 0, 6)).toEqual({ warehouse: 4, seller: 6 });
    expect(previewBalances(10, 4, 10)).toEqual({ warehouse: 0, seller: 14 });
  });
});

describe('filterDeliverableProducts', () => {
  const list = [
    product('Creatina Ñandú', 5),
    product('Whey Proteína', 0),
    product('Proteína Vegana', 3),
  ];

  it('deja solo los que tienen piezas en la bodega', () => {
    expect(filterDeliverableProducts(list, '').map((p) => p.name)).toEqual([
      'Creatina Ñandú',
      'Proteína Vegana',
    ]);
  });

  it('busca sin distinguir mayúsculas ni acentos', () => {
    expect(filterDeliverableProducts(list, ' PROTEINA ').map((p) => p.name)).toEqual([
      'Proteína Vegana',
    ]);
    expect(filterDeliverableProducts(list, 'nandu').map((p) => p.name)).toEqual(['Creatina Ñandú']);
    expect(filterDeliverableProducts(list, 'zzz')).toEqual([]);
  });
});

describe('parseReturnTarget y returnUrl', () => {
  it('solo acepta «productos» y «vendedor»; cualquier otro valor cae en «productos»', () => {
    expect(parseReturnTarget('vendedor')).toBe('vendedor');
    expect(parseReturnTarget('productos')).toBe('productos');
    expect(parseReturnTarget('https://malo.test')).toBe('productos');
    expect(parseReturnTarget(null)).toBe('productos');
  });

  it('arma la URL de regreso', () => {
    expect(returnUrl('productos', 'v-1')).toBe('/admin/productos');
    expect(returnUrl('vendedor', 'v-1')).toBe('/admin/vendedores/v-1');
    expect(returnUrl('vendedor', null)).toBe('/admin/vendedores');
  });
});

describe('parseProductId', () => {
  it('acepta un entero positivo y rechaza el resto', () => {
    expect(parseProductId('10')).toBe(10);
    expect(parseProductId('0')).toBeNull();
    expect(parseProductId('-3')).toBeNull();
    expect(parseProductId('1.5')).toBeNull();
    expect(parseProductId('abc')).toBeNull();
    expect(parseProductId(null)).toBeNull();
  });
});
