import type { HoldingFailure } from '../interfaces/delivery.models';

// Estado de la ventana «Editar lo dejado»: `not-found` cubre un producto o vendedor de la URL que no
// existe o ya no está disponible; `error`, cualquier otra falla de carga; `offline`, un cambio que
// no se pudo guardar y se puede reintentar.
export type EditHoldingState = 'loading' | 'error' | 'not-found' | 'form' | 'saving' | 'offline';

// Aviso fijo de un fallo que reintentar no arregla (producto o vendedor que ya no está, dato rechazado).
export interface HoldingFailureNotice {
  reason: HoldingFailure;
  message: string;
}
