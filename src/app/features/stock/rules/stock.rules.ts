import { normalizeText } from '@shared/utils/normalize-text';
import { sortByName } from '@shared/utils/sort-by-name';
import {
  BREAKDOWN_SEPARATOR, INACTIVE_PART_KEY, INACTIVE_SELLERS_LABEL, SPLIT_PALETTE_SIZE,
  WAREHOUSE_LABEL, WAREHOUSE_PART_KEY,
} from '../constants/stock-page.constants';
import type {
  StockOverview, StockProduct, StockSellerTotal, StockSplitPart,
} from '../interfaces/stock-overview.models';

// Segmentos de la barra y entradas de la leyenda: «Bodega» primero, los vendedores activos por
// nombre (sin distinguir acentos) y «Vendedores inactivos» al final solo si tiene piezas. El color
// de cada vendedor rota por la paleta según su posición alfabética, así que la leyenda (con nombre
// y número) es lo que desambigua cuando hay más vendedores que colores.
export function splitParts(overview: StockOverview): StockSplitPart[] {
  const parts: StockSplitPart[] = [
    { key: WAREHOUSE_PART_KEY, label: WAREHOUSE_LABEL, units: overview.warehouse, colorIndex: null },
    ...sortByName(overview.sellers).map((seller, index) => ({
      key: seller.id,
      label: seller.fullName,
      units: seller.units,
      colorIndex: index % SPLIT_PALETTE_SIZE,
    })),
  ];
  if (overview.inactiveSellers > 0) {
    parts.push({
      key: INACTIVE_PART_KEY, label: INACTIVE_SELLERS_LABEL, units: overview.inactiveSellers, colorIndex: null,
    });
  }
  return parts;
}

// Reparto de un producto en una línea, «Bodega 4 · Luis 6»: solo los lugares con piezas, la bodega
// primero, los vendedores en el orden de `sellers` (por nombre) y «Vendedores inactivos» al final.
// Las piezas de un vendedor que no está en `sellers` no aparecen aquí, pero sí en `product.total`.
export function productBreakdown(product: StockProduct, sellers: StockSellerTotal[]): string {
  const unitsBySeller = new Map(product.sellers.map((entry) => [entry.sellerId, entry.units]));
  const places: [string, number][] = [
    [WAREHOUSE_LABEL, product.warehouse],
    ...sortByName(sellers).map((seller): [string, number] => [seller.fullName, unitsBySeller.get(seller.id) ?? 0]),
    [INACTIVE_SELLERS_LABEL, product.inactiveSellers],
  ];
  return places
    .filter(([, units]) => units > 0)
    .map(([label, units]) => `${label} ${units}`)
    .join(BREAKDOWN_SEPARATOR);
}

// Productos que un vendedor tiene en mano (piezas > 0), con sus piezas y en el orden de la respuesta.
export function sellerProducts(
  overview: StockOverview,
  sellerId: string,
): { product: StockProduct; units: number }[] {
  return overview.products.flatMap((product) => {
    const units = product.sellers.find((entry) => entry.sellerId === sellerId)?.units ?? 0;
    return units > 0 ? [{ product, units }] : [];
  });
}

// Total de piezas de un vendedor; un id que no está entre los activos vale 0.
export function sellerTotal(overview: StockOverview, sellerId: string): number {
  return overview.sellers.find((seller) => seller.id === sellerId)?.units ?? 0;
}

// Subcadena del nombre sin distinguir mayúsculas ni acentos; una búsqueda vacía (o solo espacios)
// devuelve la lista tal cual. Solo filtra la lista: no cambia el total ni la barra.
export function filterStockByName<T extends { name: string }>(items: T[], query: string): T[] {
  const normalizedQuery = normalizeText(query);
  if (normalizedQuery === '') return items;
  return items.filter((item) => normalizeText(item.name).includes(normalizedQuery));
}
