import type { Route } from '@angular/router';
import { ComingSoonPageComponent } from '@shared/pages/coming-soon-page/coming-soon-page.component';
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

  it('«entrada» carga la página «Próximamente»', async () => {
    const route = routeOf('entrada');
    expect(route.data?.['title']).toBe('Entrada a bodega');
    expect(await (route.loadComponent as () => Promise<unknown>)()).toBe(ComingSoonPageComponent);
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
