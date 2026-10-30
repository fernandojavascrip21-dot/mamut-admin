import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { API_BASE_URL } from '@core/api-base-url';
import { AuthService } from '@core/auth/services/auth.service';
import type { AuthContext } from '@core/auth/interfaces/auth.models';
import { ViewingService } from './viewing.service';
import { VIEWING_STORAGE_KEY } from './constants/viewing.constants';

const SELLERS_URL = `${API_BASE_URL}/api/sellers`;
const ADMIN: AuthContext = { userId: 'a1', role: 'admin', clientId: null, fullName: 'Ana López' };
const VICTOR = { id: 'v-1', fullName: 'Víctor Vendedor', units: 6 };
const VALERIA = { id: 'v-2', fullName: 'Valeria Vendedora', units: 0 };
const ANGEL = { id: 'v-3', fullName: 'Ángel', units: 0 };

describe('ViewingService', () => {
  let httpMock: HttpTestingController;

  function create(): ViewingService {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    httpMock = TestBed.inject(HttpTestingController);
    const service = TestBed.inject(ViewingService);
    TestBed.tick();
    return service;
  }

  beforeEach(() => {
    localStorage.setItem('mamut.user', JSON.stringify(ADMIN));
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
    sessionStorage.clear();
  });

  it('load() pide la lista una sola vez y la deja en orden sin acentos, solo con id y nombre', () => {
    const service = create();
    service.load();
    service.load();
    httpMock.expectOne(SELLERS_URL).flush([VICTOR, VALERIA, ANGEL]);

    expect(service.listStatus()).toBe('ready');
    expect(service.sellers()).toEqual([
      { id: 'v-3', fullName: 'Ángel' },
      { id: 'v-2', fullName: 'Valeria Vendedora' },
      { id: 'v-1', fullName: 'Víctor Vendedor' },
    ]);
  });

  it('reload() vuelve a pedir la lista', () => {
    const service = create();
    service.load();
    httpMock.expectOne(SELLERS_URL).flush([VICTOR]);
    service.reload();
    expect(service.listStatus()).toBe('loading');
    httpMock.expectOne(SELLERS_URL).flush([VICTOR, VALERIA]);
    expect(service.sellers()).toHaveLength(2);
  });

  it('con error la lista queda vacía y la selección efectiva es «Yo», aunque haya un id guardado', () => {
    sessionStorage.setItem(VIEWING_STORAGE_KEY, 'v-1');
    const service = create();
    service.load();
    httpMock.expectOne(SELLERS_URL).error(new ProgressEvent('error'));

    expect(service.listStatus()).toBe('error');
    expect(service.sellers()).toEqual([]);
    expect(service.selectedSellerId()).toBeNull();
    expect(sessionStorage.getItem(VIEWING_STORAGE_KEY)).toBe('v-1');
  });

  it('pick() guarda en sessionStorage y emite picked', () => {
    const service = create();
    service.load();
    httpMock.expectOne(SELLERS_URL).flush([VICTOR]);
    const picked: (string | null)[] = [];
    service.picked.subscribe((id) => picked.push(id));

    service.pick('v-1');
    expect(service.selectedSellerId()).toBe('v-1');
    expect(service.selectedSeller()?.fullName).toBe('Víctor Vendedor');
    expect(sessionStorage.getItem(VIEWING_STORAGE_KEY)).toBe('v-1');

    service.pick(null);
    expect(service.selectedSellerId()).toBeNull();
    expect(sessionStorage.getItem(VIEWING_STORAGE_KEY)).toBeNull();
    expect(picked).toEqual(['v-1', null]);
  });

  it('select() guarda sin emitir picked', () => {
    const service = create();
    service.load();
    httpMock.expectOne(SELLERS_URL).flush([VICTOR]);
    const picked: (string | null)[] = [];
    service.picked.subscribe((id) => picked.push(id));

    service.select('v-1');
    expect(service.selectedSellerId()).toBe('v-1');
    expect(picked).toEqual([]);
  });

  it('recupera el id guardado, y cuenta en cuanto la lista lo incluye', () => {
    sessionStorage.setItem(VIEWING_STORAGE_KEY, 'v-2');
    const service = create();
    expect(service.selectedSellerId()).toBeNull();

    service.load();
    httpMock.expectOne(SELLERS_URL).flush([VICTOR, VALERIA]);
    expect(service.selectedSellerId()).toBe('v-2');
  });

  it('un id guardado que ya no está en la lista regresa a «Yo» y se borra', () => {
    sessionStorage.setItem(VIEWING_STORAGE_KEY, 'v-inactivo');
    const service = create();
    service.load();
    httpMock.expectOne(SELLERS_URL).flush([VICTOR]);

    expect(service.selectedSellerId()).toBeNull();
    expect(sessionStorage.getItem(VIEWING_STORAGE_KEY)).toBeNull();
  });

  it('al cerrar sesión vuelve a «Yo», quita la llave y la siguiente carga vuelve a pedir la lista', () => {
    const service = create();
    service.load();
    httpMock.expectOne(SELLERS_URL).flush([VICTOR]);
    service.pick('v-1');

    TestBed.inject(AuthService).clearSession();
    TestBed.tick();

    expect(service.selectedSellerId()).toBeNull();
    expect(sessionStorage.getItem(VIEWING_STORAGE_KEY)).toBeNull();
    expect(service.sellers()).toEqual([]);
    service.load();
    httpMock.expectOne(SELLERS_URL).flush([VICTOR]);
  });

  it('creado sin sesión (p. ej. en /login tras cerrar sesión y recargar) borra la llave que quedó', () => {
    localStorage.clear();
    sessionStorage.setItem(VIEWING_STORAGE_KEY, 'v-1');
    const service = create();

    expect(service.selectedSellerId()).toBeNull();
    expect(sessionStorage.getItem(VIEWING_STORAGE_KEY)).toBeNull();
  });
});
