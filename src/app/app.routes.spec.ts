import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { routes } from './app.routes';
import type { AuthContext } from '@core/auth/interfaces/auth.models';

const ADMIN: AuthContext = { userId: 'a1', role: 'admin', clientId: null, fullName: 'Ana' };
const SELLER: AuthContext = { userId: 'v1', role: 'vendedor', clientId: null, fullName: 'Luis' };

function configure() {
  TestBed.configureTestingModule({
    providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter(routes)],
  });
  return TestBed.inject(Router);
}

describe('app.routes', () => {
  afterEach(() => {
    localStorage.clear();
  });

  it('la raíz redirige a /login', async () => {
    const router = configure();
    await router.navigateByUrl('/');
    expect(router.url).toBe('/login');
  });

  it('una ruta desconocida redirige a /login', async () => {
    const router = configure();
    await router.navigateByUrl('/esto-no-existe');
    expect(router.url).toBe('/login');
  });

  it('sin sesión, /admin y /vendedor redirigen a /login', async () => {
    const router = configure();
    await router.navigateByUrl('/admin');
    expect(router.url).toBe('/login');
    await router.navigateByUrl('/vendedor');
    expect(router.url).toBe('/login');
  });

  it('con sesión de administrador, /admin cae en /admin/stock', async () => {
    localStorage.setItem('mamut.user', JSON.stringify(ADMIN));
    const router = configure();
    await router.navigateByUrl('/admin');
    expect(router.url).toBe('/admin/stock');
  });

  it('con sesión de vendedor, /vendedor cae en /vendedor/mi-stock', async () => {
    localStorage.setItem('mamut.user', JSON.stringify(SELLER));
    const router = configure();
    await router.navigateByUrl('/vendedor');
    expect(router.url).toBe('/vendedor/mi-stock');
  });

  it('un vendedor que intenta /admin cae en la home de su propio rol', async () => {
    localStorage.setItem('mamut.user', JSON.stringify(SELLER));
    const router = configure();
    await router.navigateByUrl('/admin');
    expect(router.url).toBe('/vendedor/mi-stock');
  });

  it('un administrador que intenta /vendedor cae en la home de su propio rol', async () => {
    localStorage.setItem('mamut.user', JSON.stringify(ADMIN));
    const router = configure();
    await router.navigateByUrl('/vendedor');
    expect(router.url).toBe('/admin/stock');
  });

  it('/cuenta es accesible para cualquier rol con sesión', async () => {
    localStorage.setItem('mamut.user', JSON.stringify(SELLER));
    const router = configure();
    const ok = await router.navigateByUrl('/cuenta');
    expect(ok).toBe(true);
    expect(router.url).toBe('/cuenta');
  });
});
