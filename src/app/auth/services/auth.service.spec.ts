import { vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AuthService } from './auth.service';
import { API_BASE_URL } from '../../shared/api-base-url';
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
    configureTestBed();
    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('arranca sin sesión cuando localStorage está vacío', () => {
    expect(service.isAuthenticated()).toBe(false);
    expect(service.currentUser()).toBeNull();
  });

  it('login() guarda la sesión en localStorage y actualiza los signals', () => {
    service.login('ada@mammut.local', 'secreta').subscribe();
    httpMock.expectOne(`${API_BASE_URL}/api/auth/login`).flush(SESSION);

    expect(service.isAuthenticated()).toBe(true);
    expect(service.currentUser()).toEqual(USER);
    expect(service.accessToken).toBe(SESSION.accessToken);
    expect(localStorage.getItem('mamut.user')).toBe(JSON.stringify(USER));
  });

  it('clearSession() borra la sesión de localStorage y deja los signals en null', () => {
    service.login('ada@mammut.local', 'secreta').subscribe();
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
