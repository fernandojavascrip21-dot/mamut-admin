import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { AuthService } from '@core/auth/services/auth.service';
import type { AuthContext } from '@core/auth/interfaces/auth.models';
import { LOW_STOCK_NOTICE_STORAGE_KEY } from './low-stock-notice.constants';
import { LowStockNoticeService } from './low-stock-notice.service';

const ADMIN: AuthContext = { userId: 'a1', role: 'admin', clientId: null, fullName: 'Ana López' };

describe('LowStockNoticeService', () => {
  function create(): LowStockNoticeService {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    const service = TestBed.inject(LowStockNoticeService);
    TestBed.tick();
    return service;
  }

  beforeEach(() => {
    localStorage.setItem('mamut.user', JSON.stringify(ADMIN));
  });

  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('empieza sin cerrar: la tarjeta se ve al iniciar sesión', () => {
    expect(create().dismissed()).toBe(false);
  });

  it('dismiss() la cierra y lo guarda en sessionStorage', () => {
    const service = create();
    service.dismiss();
    expect(service.dismissed()).toBe(true);
    expect(sessionStorage.getItem(LOW_STOCK_NOTICE_STORAGE_KEY)).toBe('1');
  });

  it('una instancia nueva (recargar la pestaña) la sigue viendo cerrada', () => {
    create().dismiss();
    expect(create().dismissed()).toBe(true);
  });

  it('al cerrar sesión se olvida: el siguiente inicio de sesión la vuelve a mostrar', () => {
    const service = create();
    service.dismiss();
    TestBed.inject(AuthService).clearSession();
    TestBed.tick();
    expect(service.dismissed()).toBe(false);
    expect(sessionStorage.getItem(LOW_STOCK_NOTICE_STORAGE_KEY)).toBeNull();
  });
});
