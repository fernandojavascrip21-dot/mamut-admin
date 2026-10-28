import { normalizeText } from '../../shared/normalize-text';
import type { Product, ProductFormValue, ProductSummary } from '../interfaces/product.models';

// true si el valor del formulario difiere de lo cargado (HU-06 §2). Nombre y porción se
// comparan sin espacios en los extremos y los números con Number(), para que "450" contra el
// "450.00" de Postgres no cuente como cambio. Una foto nueva cuenta siempre; quitarla solo
// cuenta si el producto tenía foto.
export function hasProductChanges(original: Product, value: ProductFormValue): boolean {
  const portionSize = value.fractionable ? value.portionSize?.trim() || null : null;
  return value.name.trim() !== original.name.trim() ||
    (value.categoryId ?? 0) !== (original.categoryId ?? 0) ||
    Number(value.price) !== Number(original.price) ||
    Number(value.unitCost) !== Number(original.unitCost) ||
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
