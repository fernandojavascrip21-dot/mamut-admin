// Fila de GET /api/products que usa el buscador de la ventana «Dejar a vendedor» (HU-11). Sin costo.
export interface DeliveryProductSummary {
  id: number;
  name: string;
  image: string; // '' = sin foto
  stock: number; // piezas en la bodega
  price: string; // precio general, texto decimal (spec T-08)
}

// Producto elegido, con su costo de fábrica (GET /api/products/:id, solo administrador).
export interface DeliveryProduct extends DeliveryProductSummary {
  unitCost: string;
}

// Lo que el vendedor ya tiene de un producto (GET /api/sellers/:id/stock/:productId): sus piezas y
// sus precios propios. null = usa el precio general / el costo de fábrica.
export interface SellerHolding {
  units: number;
  unitPrice: string | null;
  unitCostWithShipping: string | null;
}

// Cuerpo de POST /api/sellers/:id/deliveries. `requestId` es la llave que evita registrar la
// entrega dos veces si hay que reintentar.
export interface NewDeliveryInput {
  requestId: string;
  productId: number;
  qty: number;
  unitPrice: string | null;
  unitCostWithShipping: string | null;
}

// Valor que emite delivery-form al enviar: lo que escribió el administrador, ya sin espacios.
export interface DeliveryFormValue {
  sellerId: string;
  productId: number;
  qty: number;
  unitPrice: string | null;
  unitCostWithShipping: string | null;
}

// Entrega registrada (POST y GET /api/deliveries/:requestId). `price` y `unitCost` son los
// generales del producto; `unitPrice` y `unitCostWithShipping`, los propios del vendedor.
export interface Delivery {
  requestId: string;
  createdAt: string;
  qty: number;
  seller: { id: string; fullName: string };
  product: { id: number; name: string; image: string | null; price: string; unitCost: string };
  unitPrice: string | null;
  unitCostWithShipping: string | null;
  warehouse: { before: number; after: number };
  sellerStock: { before: number; after: number };
}

// Por qué no se registró la entrega. `message` trae el texto del backend en un 422.
export type DeliveryFailure = 'not-enough-units' | 'mismatch' | 'not-found' | 'invalid' | 'offline';

// Resultado de DeliverySaveService: la página decide qué pintar sin leer HttpErrorResponse.
export type DeliveryResult =
  { ok: true; delivery: Delivery } | { ok: false; reason: DeliveryFailure; message?: string };
