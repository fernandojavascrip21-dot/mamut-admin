import { filterProductsByName, hasProductChanges } from './product.rules';
import type { Product, ProductFormValue, ProductSummary } from '../interfaces/product.models';

const ORIGINAL: Product = {
  id: 1,
  name: 'Creatina',
  categoryId: 7,
  price: '450.00',
  unitCost: '300.00',
  stock: 10,
  fractionable: true,
  portionSize: '30 g',
  image: 'https://cdn.test/old.png',
  active: true,
};

// El valor que emitiría el formulario recién cargado con ORIGINAL.
function loadedValue(overrides: Partial<ProductFormValue> = {}): ProductFormValue {
  return {
    name: 'Creatina',
    categoryId: 7,
    price: 450,
    unitCost: 300,
    units: null,
    fractionable: true,
    portionSize: '30 g',
    photo: null,
    removePhoto: false,
    ...overrides,
  };
}

describe('hasProductChanges', () => {
  it('es falso con el formulario recién cargado', () => {
    expect(hasProductChanges(ORIGINAL, loadedValue())).toBe(false);
  });

  it('espacios de más y "450" contra "450.00" no cuentan como cambio', () => {
    expect(hasProductChanges(ORIGINAL, loadedValue({ name: '  Creatina ', portionSize: ' 30 g ' }))).toBe(false);
    expect(hasProductChanges({ ...ORIGINAL, price: '450' }, loadedValue({ price: 450.0 }))).toBe(false);
  });

  it.each<[string, Partial<ProductFormValue>]>([
    ['nombre', { name: 'Creatina HCL' }],
    ['categoría', { categoryId: 8 }],
    ['sin categoría', { categoryId: null }],
    ['precio', { price: 500 }],
    ['costo', { unitCost: 310 }],
    ['fracciona', { fractionable: false, portionSize: null }],
    ['porción', { portionSize: '25 g' }],
    ['foto nueva', { photo: new File(['x'], 'nueva.png') }],
    ['foto quitada', { removePhoto: true }],
  ])('es verdadero al cambiar %s', (_, overrides) => {
    expect(hasProductChanges(ORIGINAL, loadedValue(overrides))).toBe(true);
  });

  it('quitar la foto de un producto que no tenía no cuenta como cambio', () => {
    expect(hasProductChanges({ ...ORIGINAL, image: '' }, loadedValue({ removePhoto: true }))).toBe(false);
  });
});

describe('filterProductsByName', () => {
  const summary = (id: number, name: string): ProductSummary => ({
    id, name, categoryId: null, price: '1.00', stock: 1, fractionable: false, image: '',
  });
  const ITEMS = [summary(1, 'Cbum Pre'), summary(2, 'Creatina'), summary(3, 'Proteína CBÚM')];

  it.each(['cbum', 'CBUM', 'cbúm'])('«%s» encuentra los nombres sin importar mayúsculas ni acentos', (query) => {
    expect(filterProductsByName(ITEMS, query).map((item) => item.id)).toEqual([1, 3]);
  });

  it('vacío o solo espacios devuelve todos', () => {
    expect(filterProductsByName(ITEMS, '')).toBe(ITEMS);
    expect(filterProductsByName(ITEMS, '   ')).toBe(ITEMS);
  });
});
