import { TestBed } from '@angular/core/testing';
import { type ActivatedRouteSnapshot, type Route, Router, type UrlTree, provideRouter } from '@angular/router';
import { ADMIN_CASH_CUT_ROUTES } from '@features/cash-cut/cash-cut.routes';
import { ADMIN_CART_ROUTES, ADMIN_SALE_ROUTES } from '@features/sell/sell.routes';
import { STOCK_ROUTES } from '@features/stock/stock.routes';
import { ADMIN_ROUTES } from './admin.routes';

const routeOf = (path: string) => ADMIN_ROUTES.find((route) => route.path === path && !route.outlet) as Route;

describe('ADMIN_ROUTES', () => {
  it('«stock» carga las rutas de la feature stock', async () => {
    const loaded = await (routeOf('stock').loadChildren as () => Promise<unknown>)();
    expect(loaded).toBe(STOCK_ROUTES);
  });

  it('«entrada» redirige a la ventana «Entrada a bodega» sobre «Stock general»', () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const route = routeOf('entrada');
    expect(route.loadComponent).toBeUndefined();
    const redirect = route.redirectTo as (snapshot: ActivatedRouteSnapshot) => UrlTree;
    const tree = TestBed.runInInjectionContext(() => redirect({} as ActivatedRouteSnapshot));
    expect(TestBed.inject(Router).serializeUrl(tree)).toBe('/admin/(stock//ventana:entrada)');
  });

  it('«carrito» carga las rutas del carrito del administrador', async () => {
    const loaded = await (routeOf('carrito').loadChildren as () => Promise<unknown>)();
    expect(loaded).toBe(ADMIN_CART_ROUTES);
  });

  it('«venta» carga las rutas de «Venta confirmada» del administrador', async () => {
    const loaded = await (routeOf('venta').loadChildren as () => Promise<unknown>)();
    expect(loaded).toBe(ADMIN_SALE_ROUTES);
  });

  it('«corte» carga las rutas de la feature cash-cut', async () => {
    const loaded = await (routeOf('corte').loadChildren as () => Promise<unknown>)();
    expect(loaded).toBe(ADMIN_CASH_CUT_ROUTES);
  });
});
