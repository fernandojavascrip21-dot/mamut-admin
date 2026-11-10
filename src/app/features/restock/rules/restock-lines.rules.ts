import type { RestockLineForm } from '../components/restock-form/restock-form.models';
import type { RestockLineView } from '../components/restock-line/restock-line.models';
import type { RestockProduct, RestockSuggestion } from '../interfaces/restock.models';
import type { RestockPageData } from '../models/restock-page.models';
import { normalizeText } from '@shared/utils/normalize-text';

// Renglones con los que arranca la pantalla. Con borrador: primero los de catálogo y después los
// escritos, como los entrega el backend, sin mezclar sugerencias. Sin borrador: las sugerencias en
// su orden, con piezas vacías y el costo registrado actual.
export function initialLines(data: RestockPageData): RestockLineForm[] {
  if (data.draft === null) {
    return data.suggestions.map(
      (suggestion): RestockLineForm => ({
        kind: 'catalog',
        productId: suggestion.productId,
        name: suggestion.name,
        qty: '',
        unitCost: suggestion.unitCost,
      }),
    );
  }
  const catalog = data.draft.lines.map(
    (line): RestockLineForm => ({
      kind: 'catalog',
      productId: line.product.id,
      name: line.product.name,
      qty: String(line.qty),
      unitCost: line.unitCost,
    }),
  );
  const custom = data.draft.customLines.map(
    (line): RestockLineForm => ({
      kind: 'custom',
      productId: null,
      name: line.name,
      qty: String(line.qty),
      unitCost: line.unitCost ?? '',
    }),
  );
  return [...catalog, ...custom];
}

// Vista de cada renglón. Un renglón de catálogo que ya no está entre los pedibles (se desactivó o es
// bolsita) conserva su nombre guardado y no se puede pedir: no tiene piezas ni nivel que mostrar.
export function lineViews(lines: RestockLineForm[], products: RestockProduct[]): RestockLineView[] {
  return lines.map((line): RestockLineView => {
    if (line.kind === 'custom') {
      return { kind: 'custom', productId: null, name: line.name, image: null, units: null, stockLevel: null, orderable: true };
    }
    const product = products.find((candidate) => candidate.productId === line.productId);
    if (!product) {
      return { kind: 'catalog', productId: line.productId, name: line.name, image: null, units: null, stockLevel: null, orderable: false };
    }
    return {
      kind: 'catalog',
      productId: product.productId,
      name: product.name,
      image: product.image,
      units: product.units,
      stockLevel: product.stockLevel,
      orderable: true,
    };
  });
}

// «Agregar producto» ofrece todos los pedibles que todavía no están en la lista, tengan o no
// existencia suficiente: la baja existencia se ve en la opción, no se filtra.
export function addableProducts(products: RestockProduct[], lines: RestockLineForm[]): RestockProduct[] {
  const inList = catalogIds(lines);
  return products.filter((product) => !inList.has(product.productId));
}

// Sugerencias que todavía no están en la lista, en el orden del backend.
export function missingSuggestions(suggestions: RestockSuggestion[], lines: RestockLineForm[]): RestockSuggestion[] {
  const inList = catalogIds(lines);
  return suggestions.filter((suggestion) => !inList.has(suggestion.productId));
}

// Aviso «Ya existe en el catálogo»: se compara sin mayúsculas ni acentos, y un nombre vacío nunca coincide.
export function existsInCatalog(name: string, products: RestockProduct[]): boolean {
  const key = normalizeText(name);
  if (key === '') return false;
  return products.some((product) => normalizeText(product.name) === key);
}

function catalogIds(lines: RestockLineForm[]): Set<number | null> {
  return new Set(lines.filter((line) => line.kind === 'catalog').map((line) => line.productId));
}
