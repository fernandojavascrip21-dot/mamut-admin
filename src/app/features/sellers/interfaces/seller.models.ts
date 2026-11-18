// Vendedor tal como lo devuelve el backend (`AccountView` con rol 'vendedor'). `phone` viene
// solo con dígitos (10), porque así lo guarda la base (spec T-10).
export interface Seller {
  id: string;
  fullName: string;
  businessName: string | null;
  email: string | null;
  phone: string;
  active: boolean;
  createdAt: string;
}

// Cuerpo de POST /api/sellers. El «usuario» del vendedor es su correo (spec T-10).
export interface CreateSellerInput {
  fullName: string;
  businessName: string | null;
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
  businessName: string | null;
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

// Una merma del vendedor (HU-26): GET /api/sellers/:id/shrinkages; mismo contrato que /api/shrinkages.
export interface ShrinkageHistoryItem {
  requestId: string | null;
  createdAt: string;
  qty: number;
  reason: string | null;
  reasonLabel: string | null;
  holder: { id: string; fullName: string } | null;
  product: { id: number; name: string; image: string | null };
}

// Cuerpo de PUT /api/sellers/:id (T-42): siempre los cuatro datos.
export interface UpdateSellerInput {
  fullName: string;
  businessName: string | null;
  phone: string;
  email: string;
}

export type UpdateSellerFailure = 'duplicate-email' | 'invalid' | 'not-found' | 'offline';

export type UpdateSellerResult =
  { ok: true; seller: Seller } | { ok: false; reason: UpdateSellerFailure; message?: string };

// Filtro de GET /api/sellers (T-42): sin parámetro = activos.
export type SellerListStatus = 'active' | 'inactive';

export type SellerStatusFailure = 'has-units' | 'has-history' | 'not-found' | 'offline';

// Cómo salió el aviso por correo de las dos rutas POST; null = el estado ya era ese y no se intentó.
export type EmailStatus = 'sent' | 'failed' | 'skipped';

// Resultado de desactivar / reactivar (con el vendedor y cómo salió el correo) o eliminar (seller: null).
export type SellerStatusResult =
  { ok: true; seller: Seller | null; emailStatus: EmailStatus | null } | { ok: false; reason: SellerStatusFailure };
