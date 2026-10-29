export interface Category {
  id: number;
  name: string;
  slug: string;
}

// Precio y costo viajan como texto decimal ("450.50"), nunca como number (spec T-08).
export interface CreateProductInput {
  name: string;
  categoryId: number | null;
  price: string;
  unitCost: string;
  initialQty: number;
  fractionable: boolean;
  portionSize: string | null;
  image: string | null;
}

// Cuerpo de PATCH /api/products/:id. Las piezas solo cambian con movimientos.
export interface UpdateProductInput {
  name: string;
  categoryId: number | null;
  price: string;
  unitCost: string;
  fractionable: boolean;
  portionSize: string | null;
  image: string; // '' = sin foto
}

// Fila de GET /api/products (pantalla 03). Sin unitCost a propósito.
export interface ProductSummary {
  id: number;
  name: string;
  categoryId: number | null;
  price: string; // numeric de Postgres: llega como texto; Number() solo para el pipe currency al mostrarlo
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

// Valor que emite product-form al enviar. `units` solo existe en alta.
export interface ProductFormValue {
  name: string;
  categoryId: number | null;
  price: string; // texto tal cual se escribió, sin espacios (spec T-08)
  unitCost: string;
  units: number | null;
  fractionable: boolean;
  portionSize: string | null;
  photo: File | null; // archivo nuevo elegido, si hay
  removePhoto: boolean; // edición: quitar la foto actual
}

// Resultado de ProductSaveService: el componente decide qué pintar, no cómo leer HttpErrorResponse.
export type SaveFailureReason = 'duplicate-name' | 'category-missing' | 'not-found' | 'offline';

export type SaveResult =
  | { ok: true; product: Product }
  | { ok: false; reason: SaveFailureReason };
