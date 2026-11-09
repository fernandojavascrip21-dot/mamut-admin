import type { StockLevel } from '@shared/constants/stock-level.constants';

// Respuesta de GET /api/stock (HU-13): todo el inventario del negocio en una sola lectura.

// Un vendedor activo con sus piezas en total (también con 0).
export interface StockSellerTotal {
  id: string;
  fullName: string;
  units: number;
}

// Piezas de un vendedor activo en un producto.
export interface StockProductSellerUnits {
  sellerId: string;
  units: number;
  stockLevel: StockLevel;
}

// Un producto con piezas en algún lugar. `inactiveSellers` suma las de los vendedores
// desactivados, sin nombre; total = warehouse + Σ sellers + inactiveSellers.
export interface StockProduct {
  productId: number;
  name: string;
  image: string | null;
  warehouse: number;
  warehouseLevel: StockLevel;
  sellers: StockProductSellerUnits[];
  inactiveSellers: number;
  total: number;
  // Id del entero del que viene una bolsita; null en un entero (HU-26 §13). Opcional: no todos los fixtures lo traen.
  parentProductId?: number | null;
}

// Aviso de baja o nula existencia (HU-18): un producto con pocas piezas en un titular. `holder` null
// es la bodega; los vendedores desactivados no generan avisos.
export interface StockLowAlert {
  productId: number;
  name: string;
  image: string | null;
  holder: { id: string; fullName: string } | null;
  units: number;
  stockLevel: 'low' | 'out';
}

export interface StockOverview {
  warehouse: number;
  sellers: StockSellerTotal[];
  inactiveSellers: number;
  total: number;
  products: StockProduct[];
  lowStock: StockLowAlert[];
}

// Segmento de la barra y entrada de la leyenda, ya resuelto (nombre y color). `colorIndex` es la
// posición en la paleta de vendedores (0-based); null en «Bodega» y «Vendedores inactivos», que
// tienen su propio color.
export interface StockSplitPart {
  key: string;
  label: string;
  units: number;
  colorIndex: number | null;
}
