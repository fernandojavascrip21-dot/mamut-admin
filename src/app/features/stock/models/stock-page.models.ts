import type { StockLevel } from '@shared/constants/stock-level.constants';
import type { StockView } from '../interfaces/stock-history.models';

// Estado de la pantalla «Stock general»: «vacío» y «sin resultados» se derivan de los datos.
export type StockPageState = 'loading' | 'error' | 'ready';

// Estado de una lista de historial (mermas o fraccionados) dentro de «Stock general».
export type StockHistoryState = 'loading' | 'error' | 'ready';

// Una opción del selector de vista: la etiqueta visible y la vista que activa.
export interface StockViewOption {
  label: string;
  value: StockView;
}

// Una fila de la lista, ya resuelta para la vista activa: con «Yo» lleva el total del producto y el
// reparto; con un vendedor, sus piezas y sin reparto (`breakdown` vacío).
export interface StockRow {
  productId: number;
  name: string;
  image: string | null;
  units: number;
  breakdown: string;
  // Solo en el filtro «Baja existencia» (HU-18): 'out' pinta «Agotado» en texto. Sin él, no hay etiqueta.
  stockLevel?: StockLevel;
}
