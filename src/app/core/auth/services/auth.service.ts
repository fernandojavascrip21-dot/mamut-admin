import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, map, of, tap } from 'rxjs';
import { API_BASE_URL } from '@core/api-base-url';
import { ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY, USER_KEY } from '../constants/auth.constants';
import type { AuthContext, SessionResult } from '../interfaces/auth.models';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly http = inject(HttpClient);
  // localStorage no existe en el render de servidor (SSR): en el servidor no hay sesión.
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly currentUserSignal = signal<AuthContext | null>(this.readStoredUser());
  readonly currentUser = this.currentUserSignal.asReadonly();
  readonly isAuthenticated = computed(() => this.currentUserSignal() !== null);

  get accessToken(): string | null {
    return this.isBrowser ? this.activeStorage().getItem(ACCESS_TOKEN_KEY) : null;
  }

  private get refreshToken(): string | null {
    return this.isBrowser ? this.activeStorage().getItem(REFRESH_TOKEN_KEY) : null;
  }

  // Llama a POST /api/auth/login y, si responde bien, guarda la sesión (storage + signal) antes
  // de que quien llamó reciba el resultado. «remember» solo decide dónde se guarda: marcado,
  // localStorage (sobrevive al cerrar el navegador); sin marcar, sessionStorage (muere con él).
  // No viaja al backend: es una decisión del cliente.
  login(email: string, password: string, remember = false): Observable<SessionResult> {
    return this.http
      .post<SessionResult>(`${API_BASE_URL}/api/auth/login`, { email, password })
      .pipe(tap((result) => this.storeSession(result, remember ? localStorage : sessionStorage)));
  }

  // Lanza si no hay refreshToken guardado: solo se llama cuando ya hubo una sesión.
  refresh(): Observable<SessionResult> {
    const refreshToken = this.refreshToken;
    if (!refreshToken) throw new Error('No hay sesión que refrescar');
    return this.http
      .post<SessionResult>(`${API_BASE_URL}/api/auth/refresh`, { refreshToken })
      .pipe(tap((result) => this.storeSession(result, this.activeStorage())));
  }

  // Invalida el token en el backend (Supabase) y limpia la sesión local. Si la petición falla
  // (p. ej. sin red), limpia igual y no propaga el error: quedarse adentro con un token que ya
  // no se pudo invalidar es peor que forzar la salida (regla de M0).
  logout(): Observable<void> {
    return this.http.post<void>(`${API_BASE_URL}/api/auth/logout`, {}).pipe(
      catchError(() => of(undefined)),
      map(() => undefined),
      tap(() => this.clearSession()),
    );
  }

  // Limpia la sesión local sin llamar al backend (token ya inválido, logout fallido, etc.).
  // Borra de ambos storages para no dejar restos de una sesión en el que no se está usando.
  clearSession(): void {
    if (this.isBrowser) this.removeSessionKeys();
    this.currentUserSignal.set(null);
  }

  // Punto único donde una sesión nueva (de login o de refresh) se persiste y se refleja en los
  // signals públicos, para que ambos caminos queden siempre sincronizados entre sí. Primero
  // limpia ambos storages: así la sesión nunca queda duplicada si cambia el «Recordarme».
  private storeSession(result: SessionResult, storage: Storage): void {
    if (this.isBrowser) {
      this.removeSessionKeys();
      storage.setItem(ACCESS_TOKEN_KEY, result.accessToken);
      storage.setItem(REFRESH_TOKEN_KEY, result.refreshToken);
      storage.setItem(USER_KEY, JSON.stringify(result.user));
    }
    this.currentUserSignal.set(result.user);
  }

  // Storage donde vive la sesión actual: sessionStorage si el login fue sin «Recordarme»; si no,
  // localStorage. Así un refresh de token no convierte una sesión temporal en persistente.
  private activeStorage(): Storage {
    return sessionStorage.getItem(REFRESH_TOKEN_KEY) !== null ? sessionStorage : localStorage;
  }

  private removeSessionKeys(): void {
    for (const storage of [localStorage, sessionStorage]) {
      storage.removeItem(ACCESS_TOKEN_KEY);
      storage.removeItem(REFRESH_TOKEN_KEY);
      storage.removeItem(USER_KEY);
    }
  }

  // Lee la sesión que haya quedado de una visita anterior, para que currentUser arranque con
  // el valor correcto desde el primer render (persistencia entre recargas).
  private readStoredUser(): AuthContext | null {
    if (!this.isBrowser) return null;
    const raw = this.activeStorage().getItem(USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as AuthContext;
    } catch {
      return null;
    }
  }
}
