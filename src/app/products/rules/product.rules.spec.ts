import { filterProductsByName, hasProductChanges, saveFailureMessage } from './product.rules';
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
    price: '450.00',
    unitCost: '300.00',
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
    expect(hasProductChanges(ORIGINAL, loadedValue({ price: ' 450 ', unitCost: '300.0000' }))).toBe(false);
  });

  it.each<[string, Partial<ProductFormValue>]>([
    ['nombre', { name: 'Creatina HCL' }],
    ['categoría', { categoryId: 8 }],
    ['sin categoría', { categoryId: null }],
    ['precio', { price: '500' }],
    ['precio por una centésima', { price: '450.01' }],
    ['costo', { unitCost: '310' }],
    ['costo por una diezmilésima', { unitCost: '300.0001' }],
    ['precio a un monto inválido', { price: '450.555' }],
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

describe('saveFailureMessage', () => {
  it.each([
    ['duplicate-name', 'Ya existe un producto con ese nombre.'],
    ['category-missing', 'La categoría ya no existe. Elige otra.'],
    ['not-found', 'Este producto ya no está disponible.'],
    ['offline', 'No se pudo guardar. Revisa tu conexión.'],
  ] as const)('«%s» da un texto para el aviso', (reason, message) => {
    expect(saveFailureMessage(reason)).toBe(message);
  });
});
