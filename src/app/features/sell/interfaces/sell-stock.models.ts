// Un producto del catálogo de «Vender» (GET /api/me/stock?includeSoldOut=true, HU-15). `units` es lo
// que le queda al vendedor (0 = lo tuvo y se le acabó) y `price` ya viene resuelto por el backend (el
// propio o el general), texto con 2 decimales (T-08). La respuesta no trae costos ni ganancia (RNF-04).
export interface SellProduct {
  productId: number;
  name: string;
  image: string | null;
  units: number;
  price: string;
}

// Lo que el vendedor tiene y lo que tuvo, por nombre. `total` es la suma de `units`.
export interface SellStock {
  total: number;
  products: SellProduct[];
}
