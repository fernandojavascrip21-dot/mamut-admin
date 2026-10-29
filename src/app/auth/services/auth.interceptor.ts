import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, defer, switchMap, throwError } from 'rxjs';
import { API_BASE_URL } from '@shared/api-base-url';
import { AuthService } from './auth.service';

const REFRESH_URL = `${API_BASE_URL}/api/auth/refresh`;

// Agrega el Bearer token a las peticiones a la API. Ante un 401, intenta refrescar la sesión
// una sola vez y reintenta la petición original; si el refresh también falla (o no hay sesión
// que refrescar), limpia la sesión y manda al login. Un 401 en la propia petición de refresh
// no vuelve a intentar refrescar (evita el ciclo infinito).
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const isApiRequest = req.url.startsWith(API_BASE_URL);
  const authorizedReq = withAuthHeader(req, isApiRequest ? auth.accessToken : null);

  return next(authorizedReq).pipe(
    catchError((error: unknown) => {
      const isUnauthorized = error instanceof HttpErrorResponse && error.status === 401;
      const isRefreshRequest = req.url === REFRESH_URL;
      if (!isApiRequest || !isUnauthorized || isRefreshRequest) {
        return throwError(() => error);
      }

      return defer(() => auth.refresh()).pipe(
        switchMap(() => next(withAuthHeader(req, auth.accessToken))),
        catchError((refreshError: unknown) => {
          auth.clearSession();
          router.navigateByUrl('/login');
          return throwError(() => refreshError);
        }),
      );
    }),
  );
};

function withAuthHeader(req: Parameters<HttpInterceptorFn>[0], token: string | null) {
  return token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;
}
