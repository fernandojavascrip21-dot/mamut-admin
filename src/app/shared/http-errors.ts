import { HttpErrorResponse } from '@angular/common/http';

// Sin respuesta HTTP real del servidor (red caída, DNS, CORS bloqueado...): Angular lo
// reporta como HttpErrorResponse con status 0, nunca como un 4xx/5xx del backend.
export function isOffline(error: unknown): boolean {
  return error instanceof HttpErrorResponse && error.status === 0;
}

// Status HTTP de un error, o null si el error no vino de HttpClient (p. ej. un throw propio).
// Así los servicios distinguen 404/409/422 sin que los componentes lean HttpErrorResponse.
export function httpStatus(error: unknown): number | null {
  return error instanceof HttpErrorResponse ? error.status : null;
}

// El backend respondió 404: el recurso pedido ya no existe (p. ej. un producto archivado).
export function isNotFound(error: unknown): boolean {
  return httpStatus(error) === 404;
}
