import { vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AuthService } from './auth.service';
import { API_BASE_URL } from '@core/api-base-url';
import type { AuthContext, SessionResult } from '../interfaces/auth.models';

const USER: AuthContext = { userId: 'u1', role: 'admin', clientId: null, fullName: 'Ada' };
const SESSION: SessionResult = {
  accessToken: 'access-1',
  refreshToken: 'refresh-1',
  expiresAt: null,
  user: USER,
};

function configureTestBed() {
  TestBed.configureTestingModule({
    providers: [provideHttpClient(), provideHttpClientTesting()],
  });
}

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    configureTestBed();
    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
    sessionStorage.clear();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('arranca sin sesión cuando localStorage está vacío', () => {
    expect(service.isAuthenticated()).toBe(false);
    expect(service.currentUser()).toBeNull();
  });

  it('login() con «Recordarme» guarda la sesión en localStorage y actualiza los signals', () => {
    service.login('ada@mammut.local', 'secreta', true).subscribe();
    httpMock.expectOne(`${API_BASE_URL}/api/auth/login`).flush(SESSION);

    expect(service.isAuthenticated()).toBe(true);
    expect(service.currentUser()).toEqual(USER);
    expect(service.accessToken).toBe(SESSION.accessToken);
    expect(localStorage.getItem('mamut.user')).toBe(JSON.stringify(USER));
  });

  it('login() sin «Recordarme» guarda la sesión solo en sessionStorage', () => {
    service.login('ada@mammut.local', 'secreta').subscribe();
    httpMock.expectOne(`${API_BASE_URL}/api/auth/login`).flush(SESSION);

    expect(service.isAuthenticated()).toBe(true);
    expect(service.accessToken).toBe(SESSION.accessToken);
    expect(sessionStorage.getItem('mamut.user')).toBe(JSON.stringify(USER));
    expect(localStorage.getItem('mamut.user')).toBeNull();
    expect(localStorage.getItem('mamut.refreshToken')).toBeNull();
  });

  it('un login nuevo reemplaza la sesión del otro storage sin dejarla duplicada', () => {
    service.login('ada@mammut.local', 'secreta', true).subscribe();
    httpMock.expectOne(`${API_BASE_URL}/api/auth/login`).flush(SESSION);
    service.login('ada@mammut.local', 'secreta', false).subscribe();
    httpMock.expectOne(`${API_BASE_URL}/api/auth/login`).flush(SESSION);

    expect(localStorage.getItem('mamut.refreshToken')).toBeNull();
    expect(sessionStorage.getItem('mamut.refreshToken')).toBe(SESSION.refreshToken);
  });

  it('refresh() mantiene la sesión en el storage donde ya estaba', () => {
    service.login('ada@mammut.local', 'secreta').subscribe();
    httpMock.expectOne(`${API_BASE_URL}/api/auth/login`).flush(SESSION);

    service.refresh().subscribe();
    httpMock
      .expectOne(`${API_BASE_URL}/api/auth/refresh`)
      .flush({ ...SESSION, accessToken: 'access-2', refreshToken: 'refresh-2' });

    expect(sessionStorage.getItem('mamut.accessToken')).toBe('access-2');
    expect(localStorage.getItem('mamut.accessToken')).toBeNull();
  });

  it('recupera la sesión temporal de sessionStorage al crear una nueva instancia', () => {
    sessionStorage.setItem('mamut.accessToken', SESSION.accessToken);
    sessionStorage.setItem('mamut.refreshToken', SESSION.refreshToken);
    sessionStorage.setItem('mamut.user', JSON.stringify(USER));

    TestBed.resetTestingModule();
    configureTestBed();
    const fresh = TestBed.inject(AuthService);

    expect(fresh.currentUser()).toEqual(USER);
  });

  it('clearSession() borra la sesión de localStorage y deja los signals en null', () => {
    service.login('ada@mammut.local', 'secreta', true).subscribe();
    httpMock.expectOne(`${API_BASE_URL}/api/auth/login`).flush(SESSION);

    service.clearSession();

    expect(service.isAuthenticated()).toBe(false);
    expect(service.currentUser()).toBeNull();
    expect(localStorage.getItem('mamut.accessToken')).toBeNull();
    expect(localStorage.getItem('mamut.refreshToken')).toBeNull();
    expect(localStorage.getItem('mamut.user')).toBeNull();
  });

  it('recupera la sesión guardada al crear una nueva instancia (persistencia entre recargas)', () => {
    localStorage.setItem('mamut.accessToken', SESSION.accessToken);
    localStorage.setItem('mamut.refreshToken', SESSION.refreshToken);
    localStorage.setItem('mamut.user', JSON.stringify(USER));

    TestBed.resetTestingModule();
    configureTestBed();
    const fresh = TestBed.inject(AuthService);

    expect(fresh.isAuthenticated()).toBe(true);
    expect(fresh.currentUser()).toEqual(USER);
  });

  it('logout() llama al backend y limpia la sesión', () => {
    service.login('ada@mammut.local', 'secreta').subscribe();
    httpMock.expectOne(`${API_BASE_URL}/api/auth/login`).flush(SESSION);

    service.logout().subscribe();
    httpMock.expectOne(`${API_BASE_URL}/api/auth/logout`).flush(null);

    expect(service.isAuthenticated()).toBe(false);
    expect(localStorage.getItem('mamut.user')).toBeNull();
  });

  it('logout() limpia la sesión aunque el backend responda error, sin propagarlo', () => {
    service.login('ada@mammut.local', 'secreta').subscribe();
    httpMock.expectOne(`${API_BASE_URL}/api/auth/login`).flush(SESSION);

    const next = vi.fn();
    const error = vi.fn();
    service.logout().subscribe({ next, error });
    httpMock.expectOne(`${API_BASE_URL}/api/auth/logout`).error(new ProgressEvent('error'));

    expect(next).toHaveBeenCalledTimes(1);
    expect(error).not.toHaveBeenCalled();
    expect(service.isAuthenticated()).toBe(false);
    expect(localStorage.getItem('mamut.user')).toBeNull();
  });

  it('refresh() sin sesión previa lanza', () => {
    expect(() => service.refresh()).toThrow();
  });
});
