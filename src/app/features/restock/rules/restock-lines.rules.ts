import type { RestockLineForm } from '../components/restock-form/restock-form.models';
import type { RestockLineView } from '../components/restock-line/restock-line.models';
import type { RestockProduct, RestockSuggestion } from '../interfaces/restock.models';
import type { RestockPageData } from '../models/restock-page.models';

// Renglones con los que arranca la pantalla: los del borrador (catálogo y luego escritos) o, sin
// borrador, las sugerencias con piezas vacías.
export function initialLines(data: RestockPageData): RestockLineForm[] {
  void data;
  return [];
}

// Vista de cada renglón a partir de los productos pedibles del backend.
export function lineViews(lines: RestockLineForm[], products: RestockProduct[]): RestockLineView[] {
  void lines;
  void products;
  return [];
}

// Productos que ofrece «Agregar producto»: los pedibles que no están ya en la lista.
export function addableProducts(products: RestockProduct[], lines: RestockLineForm[]): RestockProduct[] {
  void lines;
  return products;
}

// Sugerencias que todavía no están en la lista.
export function missingSuggestions(suggestions: RestockSuggestion[], lines: RestockLineForm[]): RestockSuggestion[] {
  void lines;
  return suggestions;
}

// ¿El nombre escrito coincide con un producto del catálogo (sin mayúsculas ni acentos)?
export function existsInCatalog(name: string, products: RestockProduct[]): boolean {
  void name;
  void products;
  return false;
}
