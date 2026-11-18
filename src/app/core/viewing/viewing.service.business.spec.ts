import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { API_BASE_URL } from '@core/api-base-url';
import type { AuthContext } from '@core/auth/interfaces/auth.models';
import { ViewingService } from './viewing.service';

const ADMIN: AuthContext = { userId: 'a1', role: 'admin', clientId: null, fullName: 'Ana López' };

describe('ViewingService · negocio (HU-43)', () => {
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.setItem('mamut.user', JSON.stringify(ADMIN));
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
    sessionStorage.clear();
  });

  it('guarda el negocio de cada vendedor junto con su id y su nombre', () => {
    const service = TestBed.inject(ViewingService);
    TestBed.tick();
    service.load();
    httpMock.expectOne(`${API_BASE_URL}/api/sellers`).flush([
      { id: 'v-1', fullName: 'Víctor Vendedor', businessName: 'Gimnasio Fuerza Norte', units: 6 },
      { id: 'v-2', fullName: 'Valeria Vendedora', businessName: null, units: 0 },
    ]);
    expect(service.sellers()).toEqual([
      { id: 'v-2', fullName: 'Valeria Vendedora', businessName: null },
      { id: 'v-1', fullName: 'Víctor Vendedor', businessName: 'Gimnasio Fuerza Norte' },
    ]);
  });

  it('después de reload() la selección vigente trae el negocio nuevo', () => {
    sessionStorage.setItem('mamut.viewing.sellerId', 'v-1');
    const service = TestBed.inject(ViewingService);
    TestBed.tick();
    service.load();
    httpMock.expectOne(`${API_BASE_URL}/api/sellers`).flush([
      { id: 'v-1', fullName: 'Víctor Vendedor', businessName: null, units: 6 },
    ]);
    service.reload();
    httpMock.expectOne(`${API_BASE_URL}/api/sellers`).flush([
      { id: 'v-1', fullName: 'Víctor Vendedor', businessName: 'Café Centro', units: 6 },
    ]);
    expect(service.selectedSeller()).toEqual({ id: 'v-1', fullName: 'Víctor Vendedor', businessName: 'Café Centro' });
  });
});
