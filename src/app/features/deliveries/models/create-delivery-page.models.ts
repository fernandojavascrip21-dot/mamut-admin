import type { DeliveryFailure } from '../interfaces/delivery.models';

// Estado de la ventana «Dejar a vendedor»: `not-found` cubre un producto o un vendedor de la URL que
// no existe o ya no está disponible; `error`, cualquier otra falla de carga; `no-sellers` y
// `no-units`, estados vacíos (sin vendedores; sin piezas en la bodega) que no son de error; `offline`,
// una entrega que no se pudo registrar y se puede reintentar.
export type CreateDeliveryState =
  | 'loading'
  | 'error'
  | 'not-found'
  | 'no-sellers'
  | 'no-units'
  | 'form'
  | 'saving'
  | 'offline';

// A dónde regresa «Listo» del resumen. Solo estos valores se aceptan del parámetro `volver`.
export type ReturnTarget = 'productos' | 'vendedor';

// Aviso fijo de un fallo que reintentar no arregla (datos distintos con la misma llave, producto o
// vendedor que ya no está, dato rechazado).
export interface DeliveryFailureNotice {
  reason: DeliveryFailure;
  message: string;
}
