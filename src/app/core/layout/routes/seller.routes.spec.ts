import type { Route } from '@angular/router';
import { MY_STOCK_ROUTES } from '@features/my-stock/my-stock.routes';
import { ComingSoonPageComponent } from '@shared/pages/coming-soon-page/coming-soon-page.component';
import { SELLER_ROUTES } from './seller.routes';

const routeOf = (path: string) => SELLER_ROUTES.find((route) => route.path === path) as Route;

describe('SELLER_ROUTES', () => {
  it('«mi-stock» carga las rutas de la feature my-stock', async () => {
    const loaded = await (routeOf('mi-stock').loadChildren as () => Promise<unknown>)();
    expect(loaded).toBe(MY_STOCK_ROUTES);
  });

  it('«vender» sigue siendo «Próximamente» hasta HU-15', async () => {
    const route = routeOf('vender');
    expect(route.data?.['title']).toBe('Vender');
    expect(await (route.loadComponent as () => Promise<unknown>)()).toBe(ComingSoonPageComponent);
  });
});
