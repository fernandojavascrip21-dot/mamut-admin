// Vendedor tal como lo devuelve el backend (`AccountView` con rol 'vendedor'). `phone` viene
// solo con dígitos (10), porque así lo guarda la base (spec T-10).
export interface Seller {
  id: string;
  fullName: string;
  email: string | null;
  phone: string;
  active: boolean;
}

// Cuerpo de POST /api/sellers. El «usuario» del vendedor es su correo (spec T-10).
export interface CreateSellerInput {
  fullName: string;
  phone: string;
  email: string;
  password: string;
}

export type CreateSellerFailure = 'duplicate-email' | 'invalid' | 'offline';

// Resultado de SellerSaveService: la página decide qué pintar sin leer HttpErrorResponse.
// `message` trae el texto del backend en un 422 (p. ej. «El teléfono debe tener 10 dígitos»).
export type CreateSellerResult =
  { ok: true; seller: Seller } | { ok: false; reason: CreateSellerFailure; message?: string };

// Fila de «Mis vendedores» (GET /api/sellers, HU-09): total de piezas que tiene en mano.
export interface SellerSummary {
  id: string;
  fullName: string;
  units: number;
}

// Un producto del stock de un vendedor. `image` es null si el producto no tiene foto. `price` y
// `unitCost` son los generales del producto; `unitPrice` y `unitCostWithShipping` son los propios
// del vendedor (HU-11), y null significa que usa los generales. Solo los ve el administrador.
export interface SellerStockLine {
  productId: number;
  name: string;
  image: string | null;
  units: number;
  warehouseUnits: number;
  price: string;
  unitCost: string;
  unitPrice: string | null;
  unitCostWithShipping: string | null;
}

// Una entrega del historial «Últimas entregas» (GET /api/sellers/:id/deliveries, HU-11).
// `requestId` es null en las entregas anteriores a la llave de idempotencia: no tienen resumen.
export interface DeliveryHistoryItem {
  requestId: string | null;
  createdAt: string;
  productId: number;
  name: string;
  image: string | null;
  qty: number;
}

// Cuerpo de POST /api/sellers/:id/returns (HU-12). El `requestId` lo genera ReturnSaveService.
export interface NewReturnInput {
  requestId: string;
  productId: number;
  qty: number;
}

// Lo que emite el formulario de «Retirar producto»: producto elegido y piezas ya como entero.
export interface ReturnFormValue {
  productId: number;
  qty: number;
}

// Un retiro registrado (resumen y respuesta de POST). `qty` va en positivo: son las piezas que
// regresaron a la bodega. `before` y `after` salen de los movimientos, no del saldo actual.
export interface SellerReturn {
  requestId: string;
  createdAt: string;
  qty: number;
  seller: { id: string; fullName: string };
  product: { id: number; name: string; image: string | null };
  sellerStock: { before: number; after: number };
  warehouse: { before: number; after: number };
}

// Un retiro del historial «Últimos retiros» (GET /api/sellers/:id/returns, HU-12). `requestId` es
// null en un movimiento `return` creado fuera de este flujo: no tiene resumen.
export interface ReturnHistoryItem {
  requestId: string | null;
  createdAt: string;
  productId: number;
  name: string;
  image: string | null;
  qty: number;
}

export type ReturnFailure = 'not-enough-units' | 'mismatch' | 'not-found' | 'invalid' | 'offline';

// Resultado de ReturnSaveService: la página decide qué pintar sin leer HttpErrorResponse.
export type ReturnResult =
  { ok: true; sellerReturn: SellerReturn } | { ok: false; reason: ReturnFailure; message?: string };

// Detalle de un vendedor (GET /api/sellers/:id): sus datos, su total y solo los productos con piezas.
export interface SellerDetail extends Seller {
  units: number;
  stock: SellerStockLine[];
}
