// Un producto del stock propio del vendedor (GET /api/me/stock, HU-14). `price` ya viene resuelto
// por el backend (el precio propio o, si no tiene, el general) y es texto con 2 decimales (T-08).
// La respuesta no trae costos ni ganancia (RF-02, RNF-04).
export interface MyStockProduct {
  productId: number;
  name: string;
  image: string | null;
  units: number;
  price: string;
}

// Lo que el vendedor tiene en mano: solo productos con piezas, por nombre. `total` es la suma de `units`.
export interface MyStock {
  total: number;
  products: MyStockProduct[];
}
