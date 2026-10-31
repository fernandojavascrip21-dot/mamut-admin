import type { ReturnFailure } from '../interfaces/seller.models';

// Estado de la pantalla «Retirar producto»: `empty` es un vendedor sin piezas (no hay nada que
// retirar), `not-found` un 404 (no existe, no es vendedor o está desactivado) y `error` cualquier
// otra falla de carga, que se puede reintentar.
export type ReturnUnitsPageState = 'loading' | 'error' | 'not-found' | 'empty' | 'ready';

// Estado del guardado: `offline` es un fallo que se arregla reintentando (sin red o 5xx).
export type ReturnSaveState = 'idle' | 'saving' | 'offline';

// Aviso fijo cuando un fallo no se arregla reintentando (otros datos para el mismo requestId, un
// 404 o un 422), con el texto que se muestra.
export interface ReturnFailureNotice {
  reason: ReturnFailure;
  message: string;
}
