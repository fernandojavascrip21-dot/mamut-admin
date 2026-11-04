import type { Route } from '@angular/router';
import { MY_STOCK_ROUTES } from '@features/my-stock/my-stock.routes';
import { CART_ROUTES, SELL_ROUTES } from '@features/sell/sell.routes';
import { ComingSoonPageComponent } from '@shared/pages/coming-soon-page/coming-soon-page.component';
import { SELLER_ROUTES } from './seller.routes';

const routeOf = (path: string) => SELLER_ROUTES.find((route) => route.path === path) as Route;

describe('SELLER_ROUTES', () => {
  it('«mi-stock» carga las rutas de la feature my-stock', async () => {
    const loaded = await (routeOf('mi-stock').loadChildren as () => Promise<unknown>)();
    expect(loaded).toBe(MY_STOCK_ROUTES);
  });

  it('«vender» carga las rutas del catálogo de la feature sell', async () => {
    const loaded = await (routeOf('vender').loadChildren as () => Promise<unknown>)();
    expect(loaded).toBe(SELL_ROUTES);
  });

  it('«carrito» carga las rutas del carrito de la feature sell', async () => {
    const loaded = await (routeOf('carrito').loadChildren as () => Promise<unknown>)();
    expect(loaded).toBe(CART_ROUTES);
  });

  it('«mi-corte» sigue siendo «Próximamente» hasta M4a', async () => {
    const route = routeOf('mi-corte');
    expect(route.data?.['title']).toBe('Mi corte');
    expect(await (route.loadComponent as () => Promise<unknown>)()).toBe(ComingSoonPageComponent);
  });
});
