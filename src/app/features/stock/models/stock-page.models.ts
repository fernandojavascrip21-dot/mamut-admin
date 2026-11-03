// Estado de la pantalla «Stock general»: «vacío» y «sin resultados» se derivan de los datos.
export type StockPageState = 'loading' | 'error' | 'ready';

// Una fila de la lista, ya resuelta para la vista activa: con «Yo» lleva el total del producto y el
// reparto; con un vendedor, sus piezas y sin reparto (`breakdown` vacío).
export interface StockRow {
  productId: number;
  name: string;
  image: string | null;
  units: number;
  breakdown: string;
}
