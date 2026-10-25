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

// Fila de GET /api/products (pantalla 03). Sin unitCost a propósito.
export interface ProductoResumen {
  id: number;
  name: string;
  categoryId: number | null;
  price: string; // numeric de Postgres: llega como texto; se convierte con Number() solo para mostrarlo
  stock: number;
  fractionable: boolean;
  image: string;
}

// Fila completa que devuelve POST /api/products, para el resumen de "Producto registrado".
export interface Producto extends ProductoResumen {
  unitCost: string;
  portionSize: string | null;
  active: boolean;
}
