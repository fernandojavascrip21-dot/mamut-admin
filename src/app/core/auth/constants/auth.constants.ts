import { API_BASE_URL } from '@core/api-base-url';
import type { AuthContext } from '../interfaces/auth.models';

// Llaves de localStorage donde AuthService guarda la sesión.
export const ACCESS_TOKEN_KEY = 'mamut.accessToken';
export const REFRESH_TOKEN_KEY = 'mamut.refreshToken';
export const USER_KEY = 'mamut.user';

// Petición que authInterceptor nunca intenta refrescar (evita el ciclo infinito ante un 401).
export const REFRESH_URL = `${API_BASE_URL}/api/auth/refresh`;

// A dónde manda el guard cuando el rol de quien entra no es el que la ruta permite.
// Un rol sin entrada aquí (p. ej. 'client', ajeno a este frontend) cae al login.
export const ROLE_HOME: Partial<Record<AuthContext['role'], string>> = {
  admin: '/admin',
  vendedor: '/vendedor',
};
