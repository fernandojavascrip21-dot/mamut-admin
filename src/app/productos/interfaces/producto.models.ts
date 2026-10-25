export interface Categoria {
  id: number;
  name: string;
  slug: string;
}

export interface NuevoProductoInput {
  name: string;
  categoryId: number | null;
  price: number;
  unitCost: number;
  initialQty: number;
  fractionable: boolean;
  portionSize: string | null;
  image: string | null;
}

// Fila mínima que devuelve GET /api/products (la lista de productos-page).
export interface ProductoResumen {
  id: number;
  name: string;
  categoryId: number | null;
  stock: number;
  active: boolean;
}

// Fila completa que devuelve POST /api/products, para el resumen de "Producto registrado".
export interface Producto extends ProductoResumen {
  price: string; // numeric de Postgres: llega como texto; se convierte con Number() solo para mostrarlo
  unitCost: string;
  fractionable: boolean;
  portionSize: string | null;
  image: string;
}
