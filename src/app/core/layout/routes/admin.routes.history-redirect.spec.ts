import { TestBed } from '@angular/core/testing';
import { type ActivatedRouteSnapshot, Router, type UrlTree, provideRouter } from '@angular/router';
import { ADMIN_ROUTES } from './admin.routes';

const routeOf = (path: string) => ADMIN_ROUTES.find((route) => route.path === path && !route.outlet);

describe('ADMIN_ROUTES · historiales dentro de «Stock general» (HU-26 §12)', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideRouter([])] }));

  const redirectUrl = (path: string): string => {
    const redirect = routeOf(path)?.redirectTo as ((snapshot: ActivatedRouteSnapshot) => UrlTree) | undefined;
    expect(typeof redirect).toBe('function');
    const tree = TestBed.runInInjectionContext(() => redirect!({} as ActivatedRouteSnapshot));
    return TestBed.inject(Router).serializeUrl(tree);
  };

  it('/admin/mermas redirige a /admin/stock?vista=mermas', () => {
    expect(redirectUrl('mermas')).toBe('/admin/stock?vista=mermas');
  });

  it('/admin/fraccionados redirige a /admin/stock?vista=fraccionados', () => {
    expect(redirectUrl('fraccionados')).toBe('/admin/stock?vista=fraccionados');
  });

  it('las dos rutas ya no cargan páginas propias', () => {
    expect(routeOf('mermas')?.loadChildren).toBeUndefined();
    expect(routeOf('fraccionados')?.loadChildren).toBeUndefined();
  });
});
