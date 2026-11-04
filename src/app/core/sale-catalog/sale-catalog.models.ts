import type { StockLevel } from '@shared/constants/stock-level.constants';

// Un producto que el administrador puede vender de un titular (HU-17). `units`, `price` y `unitCost`
// ya vienen resueltos por el backend para ese titular. Es compatible con `SellProduct` de
// `features/sell` (mismas llaves más `unitCost`).
export interface SaleCatalogProduct {
  productId: number;
  name: string;
  image: string | null;
  units: number;
  price: string;
  unitCost: string;
  // Existencia del titular (HU-18): la decide el backend, aquí solo se pinta.
  stockLevel: StockLevel;
}

// `holder` es null para la bodega.
export interface SaleCatalog {
  holder: { id: string; fullName: string } | null;
  products: SaleCatalogProduct[];
}
