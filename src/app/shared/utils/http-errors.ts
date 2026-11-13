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

// Objeto `error` del formato del backend (`{ error: { code, message } }`), o null si la respuesta
// no lo trae (sin red, otro formato).
function backendErrorDetail(error: unknown): object | null {
  if (!(error instanceof HttpErrorResponse)) return null;
  const body: unknown = error.error;
  if (typeof body !== 'object' || body === null || !('error' in body)) return null;
  const detail: unknown = body.error;
  return typeof detail === 'object' && detail !== null ? detail : null;
}

// Mensaje que mandó el backend, o null. Sirve para mostrar un 422 tal cual lo redactó.
export function httpErrorMessage(error: unknown): string | null {
  const detail = backendErrorDetail(error);
  if (detail === null || !('message' in detail)) return null;
  return typeof detail.message === 'string' ? detail.message : null;
}

// Código que manda el backend (`DUPLICATE_NAME`, `COST_ABOVE_PRICE`…), o null. Sirve para distinguir dos
// respuestas con el mismo status, como un 409 de nombre repetido y uno de pendiente ya resuelto.
export function httpErrorCode(error: unknown): string | null {
  const detail = backendErrorDetail(error);
  if (detail === null || !('code' in detail)) return null;
  return typeof detail.code === 'string' ? detail.code : null;
}
