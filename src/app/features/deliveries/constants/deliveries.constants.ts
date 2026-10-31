import type { ReturnTarget } from '../models/create-delivery-page.models';

// URLs de la feature. Productos y el detalle del vendedor enlazan a `DELIVERY_NEW_URL` con los
// parámetros `producto`, `vendedor` y `volver`.
export const DELIVERY_NEW_URL = '/admin/entregas/nueva';
export const DELIVERY_URL = '/admin/entregas';

export const PRODUCTS_URL = '/admin/productos';
export const SELLERS_URL = '/admin/vendedores';

// Valores de `volver` que se aceptan; cualquier otro cae en «productos» (nunca se navega a una URL
// que venga en el parámetro).
export const RETURN_TARGETS: readonly ReturnTarget[] = ['productos', 'vendedor'];
export const DEFAULT_RETURN_TARGET: ReturnTarget = 'productos';

// Texto del backend cuando la bodega no alcanza (409 de insertMovements).
export const NOT_ENOUGH_UNITS_MESSAGE = 'No hay piezas suficientes';

// Avisos flotantes cuando la entrega no se registra.
export const FAILURE_TOASTS = {
  'not-enough-units': 'No hay piezas suficientes en la bodega.',
  mismatch: 'Esta entrega ya se registró con otros datos. Revisa el detalle del vendedor.',
  'not-found': 'El producto o el vendedor ya no está disponible.',
  invalid: 'Revisa los datos de la entrega.',
  offline: 'No se pudo registrar la entrega. Revisa tu conexión.',
} as const;
