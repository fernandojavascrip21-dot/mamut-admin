import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Route, Router, UrlTree, provideRouter } from '@angular/router';
import { ROLE_HOME, roleGuard } from './role.guard';
import type { AuthContext } from '../interfaces/auth.models';

const ADMIN: AuthContext = { userId: 'a1', role: 'admin', clientId: null, fullName: 'Ana' };
const SELLER: AuthContext = { userId: 'v1', role: 'vendedor', clientId: null, fullName: 'Luis' };
const CLIENT: AuthContext = { userId: 'c1', role: 'client', clientId: 7, fullName: 'Distribuidor' };

function storeUser(user: AuthContext) {
  localStorage.setItem('mamut.user', JSON.stringify(user));
}

function configure() {
  TestBed.configureTestingModule({
    providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
  });
}

// El tercer parámetro de CanMatchFn (snapshot parcial de la coincidencia en curso) no lo usa
// este guard; se pasa un valor vacío solo para cumplir la firma del tipo.
function runGuard(route: Route) {
  return TestBed.runInInjectionContext(() => roleGuard(route, [], {} as never));
}

describe('roleGuard', () => {
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('sin sesión redirige a /login', () => {
    configure();
    httpMock = TestBed.inject(HttpTestingController);
    const router = TestBed.inject(Router);

    const result = runGuard({ path: 'admin', data: { roles: ['admin'] } });
    expect(result).toBeInstanceOf(UrlTree);
    expect(router.serializeUrl(result as UrlTree)).toBe('/login');
  });

  it('con el rol permitido deja pasar', () => {
    storeUser(ADMIN);
    configure();
    httpMock = TestBed.inject(HttpTestingController);

    const result = runGuard({ path: 'admin', data: { roles: ['admin'] } });
    expect(result).toBe(true);
  });

  it('con el rol equivocado redirige a la home del propio rol', () => {
    storeUser(SELLER);
    configure();
    httpMock = TestBed.inject(HttpTestingController);
    const router = TestBed.inject(Router);

    const result = runGuard({ path: 'admin', data: { roles: ['admin'] } });
    expect(router.serializeUrl(result as UrlTree)).toBe(ROLE_HOME['vendedor']);
  });

  it('sin restricción de roles en la ruta, deja pasar a cualquier usuario con sesión', () => {
    storeUser(SELLER);
    configure();
    httpMock = TestBed.inject(HttpTestingController);

    const result = runGuard({ path: 'cuenta' });
    expect(result).toBe(true);
  });

  it('un rol sin home conocida en este frontend (client) cae al login si la ruta no lo permite', () => {
    storeUser(CLIENT);
    configure();
    httpMock = TestBed.inject(HttpTestingController);
    const router = TestBed.inject(Router);

    const result = runGuard({ path: 'admin', data: { roles: ['admin'] } });
    expect(router.serializeUrl(result as UrlTree)).toBe('/login');
  });
});
