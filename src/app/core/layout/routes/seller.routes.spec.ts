import type { Route } from '@angular/router';
import { SELLER_CASH_CUT_ROUTES } from '@features/cash-cut/cash-cut.routes';
import { MY_STOCK_ROUTES } from '@features/my-stock/my-stock.routes';
import { CART_ROUTES, SALE_ROUTES, SELL_ROUTES } from '@features/sell/sell.routes';
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

  it('«venta» carga las rutas de «Venta confirmada» de la feature sell', async () => {
    const loaded = await (routeOf('venta').loadChildren as () => Promise<unknown>)();
    expect(loaded).toBe(SALE_ROUTES);
  });

  it('«mi-corte» carga las rutas de «Mi corte» de la feature cash-cut', async () => {
    const loaded = await (routeOf('mi-corte').loadChildren as () => Promise<unknown>)();
    expect(loaded).toBe(SELLER_CASH_CUT_ROUTES);
  });
});
