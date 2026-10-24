import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { API_BASE_URL } from '../api-base-url';
import type { AuthContext, SessionResult } from './auth.models';

const ACCESS_TOKEN_KEY = 'mamut.accessToken';
const REFRESH_TOKEN_KEY = 'mamut.refreshToken';
const USER_KEY = 'mamut.user';

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
    return this.isBrowser ? localStorage.getItem(ACCESS_TOKEN_KEY) : null;
  }

  private get refreshToken(): string | null {
    return this.isBrowser ? localStorage.getItem(REFRESH_TOKEN_KEY) : null;
  }

  login(email: string, password: string): Observable<SessionResult> {
    return this.http
      .post<SessionResult>(`${API_BASE_URL}/api/auth/login`, { email, password })
      .pipe(tap((result) => this.storeSession(result)));
  }

  // Lanza si no hay refreshToken guardado: solo se llama cuando ya hubo una sesión.
  refresh(): Observable<SessionResult> {
    const refreshToken = this.refreshToken;
    if (!refreshToken) throw new Error('No hay sesión que refrescar');
    return this.http
      .post<SessionResult>(`${API_BASE_URL}/api/auth/refresh`, { refreshToken })
      .pipe(tap((result) => this.storeSession(result)));
  }

  logout(): Observable<void> {
    return this.http
      .post<void>(`${API_BASE_URL}/api/auth/logout`, {})
      .pipe(tap(() => this.clearSession()));
  }

  // Limpia la sesión local sin llamar al backend (token ya inválido, logout fallido, etc.).
  clearSession(): void {
    if (this.isBrowser) {
      localStorage.removeItem(ACCESS_TOKEN_KEY);
      localStorage.removeItem(REFRESH_TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    }
    this.currentUserSignal.set(null);
  }

  private storeSession(result: SessionResult): void {
    if (this.isBrowser) {
      localStorage.setItem(ACCESS_TOKEN_KEY, result.accessToken);
      localStorage.setItem(REFRESH_TOKEN_KEY, result.refreshToken);
      localStorage.setItem(USER_KEY, JSON.stringify(result.user));
    }
    this.currentUserSignal.set(result.user);
  }

  private readStoredUser(): AuthContext | null {
    if (!this.isBrowser) return null;
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as AuthContext;
    } catch {
      return null;
    }
  }
}
