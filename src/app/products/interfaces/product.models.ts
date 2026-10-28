export interface Category {
  id: number;
  name: string;
  slug: string;
}

export interface CreateProductInput {
  name: string;
  categoryId: number | null;
  price: number;
  unitCost: number;
  initialQty: number;
  fractionable: boolean;
  portionSize: string | null;
  image: string | null;
}

// Cuerpo de PATCH /api/products/:id. Las piezas solo cambian con movimientos.
export interface UpdateProductInput {
  name: string;
  categoryId: number | null;
  price: number;
  unitCost: number;
  fractionable: boolean;
  portionSize: string | null;
  image: string; // '' = sin foto
}

// Fila de GET /api/products (pantalla 03). Sin unitCost a propósito.
export interface ProductSummary {
  id: number;
  name: string;
  categoryId: number | null;
  price: string; // numeric de Postgres: llega como texto; se convierte con Number() solo para mostrarlo
  stock: number;
  fractionable: boolean;
  image: string;
}

// Fila completa que devuelve POST /api/products, para el resumen de "Product registrado".
export interface Product extends ProductSummary {
  unitCost: string;
  portionSize: string | null;
  active: boolean;
}
