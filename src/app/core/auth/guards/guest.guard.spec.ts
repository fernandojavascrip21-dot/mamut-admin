import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Route, Router, UrlTree, provideRouter } from '@angular/router';
import { guestGuard } from './guest.guard';
import { ROLE_HOME } from '../constants/auth.constants';
import type { AuthContext } from '../interfaces/auth.models';

const ADMIN: AuthContext = { userId: 'a1', role: 'admin', clientId: null, fullName: 'Ana' };
const SELLER: AuthContext = { userId: 'v1', role: 'vendedor', clientId: null, fullName: 'Luis' };

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
function runGuard(route: Route = { path: 'login' }) {
  return TestBed.runInInjectionContext(() => guestGuard(route, [], {} as never));
}

describe('guestGuard', () => {
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('con sesión de administrador redirige a /admin', () => {
    storeUser(ADMIN);
    configure();
    httpMock = TestBed.inject(HttpTestingController);
    const router = TestBed.inject(Router);

    const result = runGuard();
    expect(result).toBeInstanceOf(UrlTree);
    expect(router.serializeUrl(result as UrlTree)).toBe(ROLE_HOME['admin']);
  });

  it('con sesión de vendedor redirige a /vendedor', () => {
    storeUser(SELLER);
    configure();
    httpMock = TestBed.inject(HttpTestingController);
    const router = TestBed.inject(Router);

    const result = runGuard();
    expect(result).toBeInstanceOf(UrlTree);
    expect(router.serializeUrl(result as UrlTree)).toBe(ROLE_HOME['vendedor']);
  });

  it('sin sesión deja pasar', () => {
    configure();
    httpMock = TestBed.inject(HttpTestingController);

    const result = runGuard();
    expect(result).toBe(true);
  });
});
