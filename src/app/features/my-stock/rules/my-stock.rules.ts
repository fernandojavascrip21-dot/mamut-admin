import { normalizeText } from '@shared/utils/normalize-text';

// Subcadena del nombre sin distinguir mayúsculas ni acentos; una búsqueda vacía (o solo espacios)
// devuelve la lista tal cual. Solo filtra la lista: el total de piezas no cambia. Se reescribe aquí
// y no se importa de `features/stock`, porque una feature no importa otra.
export function filterMyStockByName<T extends { name: string }>(items: T[], query: string): T[] {
  const normalizedQuery = normalizeText(query);
  if (normalizedQuery === '') return items;
  return items.filter((item) => normalizeText(item.name).includes(normalizedQuery));
}

// Piezas que le quedan al vendedor, en primera persona: «Me queda 1» / «Me quedan N». Con 1 va en
// singular, y no se parece a `unitsLabel` («1 pieza»), que es para totales.
export function unitsLeftLabel(units: number): string {
  return units === 1 ? 'Me queda 1' : `Me quedan ${units}`;
}
