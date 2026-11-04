import type { CartLine } from '@core/cart/cart.models';
import type { SaleCatalogProduct } from '@core/sale-catalog/sale-catalog.models';
import { compareMoney, fromMinorUnits, toMinorUnits } from '@shared/utils/money';
import { normalizeText } from '@shared/utils/normalize-text';
import type { Product, ProductFormValue, ProductSummary, SaveFailureReason } from '../interfaces/product.models';

// true si el valor del formulario difiere de lo cargado (HU-06 §2). Nombre y porción se
// comparan sin espacios en los extremos y el dinero en unidades enteras (spec T-08), para que
// "450" contra el "450.00" de Postgres no cuente como cambio; un monto inválido cuenta como cambio. Una foto nueva cuenta siempre; quitarla solo
// cuenta si el producto tenía foto.
export function hasProductChanges(original: Product, value: ProductFormValue): boolean {
  const portionSize = value.fractionable ? value.portionSize?.trim() || null : null;
  return value.name.trim() !== original.name.trim() ||
    (value.categoryId ?? 0) !== (original.categoryId ?? 0) ||
    compareMoney(value.price.trim(), 2, original.price, 2) !== 0 ||
    compareMoney(value.unitCost.trim(), 4, original.unitCost, 4) !== 0 ||
    value.fractionable !== original.fractionable ||
    portionSize !== original.portionSize ||
    value.photo !== null ||
    (value.removePhoto && original.image !== '');
}

// Filtro de HU-05 §2: subcadena del nombre sin distinguir mayúsculas ni acentos; una búsqueda
// vacía (o solo espacios) devuelve la lista tal cual.
export function filterProductsByName(items: ProductSummary[], query: string): ProductSummary[] {
  const normalizedQuery = normalizeText(query);
  if (normalizedQuery === '') return items;
  return items.filter((item) => normalizeText(item.name).includes(normalizedQuery));
}

// Texto del aviso flotante cuando el guardado falla; acompaña al aviso del formulario
// (errores de campo o «Reintentar»), no lo sustituye.
export function saveFailureMessage(reason: SaveFailureReason): string {
  switch (reason) {
    case 'duplicate-name': return 'Ya existe un producto con ese nombre.';
    case 'category-missing': return 'La categoría ya no existe. Elige otra.';
    case 'not-found': return 'Este producto ya no está disponible.';
    case 'offline': return 'No se pudo guardar. Revisa tu conexión.';
  }
}

// Total de lo que hay en el carrito, con el precio del catálogo del titular (HU-17): piezas × precio
// en centavos enteros (T-08), como texto con 2 decimales. Solo cuentan los renglones que alcanzan; uno
// de más (un carrito viejo) o de un producto que ya no viene no suma, como en el carrito. Se escribe
// aquí y no se importa de `features/sell`, porque una feature no importa otra.
export function cartTotalOf(products: SaleCatalogProduct[], lines: CartLine[]): string {
  const byId = new Map(products.map((product) => [product.productId, product]));
  let cents = 0;
  for (const line of lines) {
    const product = byId.get(line.productId);
    if (!product || product.units <= 0 || line.units > product.units) continue;
    cents += line.units * (toMinorUnits(product.price, 2) ?? 0);
  }
  return fromMinorUnits(cents, 2);
}
