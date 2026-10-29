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

// Mensaje que mandó el backend en su formato `{ error: { code, message } }`, o null si la
// respuesta no lo trae (sin red, otro formato). Sirve para mostrar un 422 tal cual lo redactó.
export function httpErrorMessage(error: unknown): string | null {
  if (!(error instanceof HttpErrorResponse)) return null;
  const body: unknown = error.error;
  if (typeof body !== 'object' || body === null || !('error' in body)) return null;
  const detail: unknown = body.error;
  if (typeof detail !== 'object' || detail === null || !('message' in detail)) return null;
  return typeof detail.message === 'string' ? detail.message : null;
}
