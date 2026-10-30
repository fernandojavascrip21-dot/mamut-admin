import { vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { authInterceptor } from './auth.interceptor';
import { AuthService } from './auth.service';
import { API_BASE_URL } from '@core/api-base-url';
import type { AuthContext, SessionResult } from '../interfaces/auth.models';

const USER: AuthContext = { userId: 'u1', role: 'vendedor', clientId: null, fullName: 'Luis' };
const SESSION: SessionResult = {
  accessToken: 'token-1',
  refreshToken: 'refresh-1',
  expiresAt: null,
  user: USER,
};
const SESSION_2: SessionResult = {
  accessToken: 'token-2',
  refreshToken: 'refresh-2',
  expiresAt: null,
  user: USER,
};
const REFRESH_URL = `${API_BASE_URL}/api/auth/refresh`;

describe('authInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let auth: AuthService;
  let router: Router;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  function login() {
    auth.login('luis@mammut.local', 'secreta').subscribe();
    httpMock.expectOne(`${API_BASE_URL}/api/auth/login`).flush(SESSION);
  }

  it('agrega Authorization con el access token a las peticiones a la API', () => {
    login();
    http.get(`${API_BASE_URL}/api/me`).subscribe();

    const req = httpMock.expectOne(`${API_BASE_URL}/api/me`);
    expect(req.request.headers.get('Authorization')).toBe(`Bearer ${SESSION.accessToken}`);
    req.flush(USER);
  });

  it('no agrega Authorization si no hay sesión', () => {
    http.get(`${API_BASE_URL}/api/health`).subscribe();

    const req = httpMock.expectOne(`${API_BASE_URL}/api/health`);
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({ ok: true });
  });

  it('no agrega Authorization a peticiones fuera de la API', () => {
    login();
    http.get('https://otro-servicio.example.com/x').subscribe();

    const req = httpMock.expectOne('https://otro-servicio.example.com/x');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({});
  });

  it('ante un 401 intenta refrescar y reintenta la petición original', () => {
    login();
    let result: unknown;
    http.get(`${API_BASE_URL}/api/me`).subscribe((r) => (result = r));

    httpMock
      .expectOne(`${API_BASE_URL}/api/me`)
      .flush('no autorizado', { status: 401, statusText: 'Unauthorized' });
    httpMock.expectOne(REFRESH_URL).flush(SESSION_2);

    const retried = httpMock.expectOne(`${API_BASE_URL}/api/me`);
    expect(retried.request.headers.get('Authorization')).toBe(`Bearer ${SESSION_2.accessToken}`);
    retried.flush(USER);

    expect(result).toEqual(USER);
    expect(auth.accessToken).toBe(SESSION_2.accessToken);
  });

  it('si el refresh también falla, limpia la sesión y redirige a /login', () => {
    login();
    let error: unknown;
    http.get(`${API_BASE_URL}/api/me`).subscribe({ error: (e) => (error = e) });

    httpMock
      .expectOne(`${API_BASE_URL}/api/me`)
      .flush('no autorizado', { status: 401, statusText: 'Unauthorized' });
    httpMock
      .expectOne(REFRESH_URL)
      .flush('sesión inválida', { status: 401, statusText: 'Unauthorized' });

    expect(error).toBeTruthy();
    expect(auth.isAuthenticated()).toBe(false);
    expect(router.navigateByUrl).toHaveBeenCalledWith('/login');
  });

  it('un 401 sin sesión que refrescar limpia la sesión y redirige a /login', () => {
    login();
    auth.clearSession(); // deja la sesión sin refreshToken, igual que tras un logout fallido

    let error: unknown;
    http.get(`${API_BASE_URL}/api/me`).subscribe({ error: (e) => (error = e) });

    httpMock
      .expectOne(`${API_BASE_URL}/api/me`)
      .flush('no autorizado', { status: 401, statusText: 'Unauthorized' });

    expect(error).toBeTruthy();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/login');
  });

  it('un 401 en la propia petición de refresh no intenta refrescar otra vez', () => {
    login();
    let error: unknown;
    http.post(REFRESH_URL, { refreshToken: 'x' }).subscribe({ error: (e) => (error = e) });

    httpMock
      .expectOne(REFRESH_URL)
      .flush('sesión inválida', { status: 401, statusText: 'Unauthorized' });

    httpMock.verify(); // no debe quedar pendiente una segunda petición de refresh
    expect(error).toBeTruthy();
  });
});
