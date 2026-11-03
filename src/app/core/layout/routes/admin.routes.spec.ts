import type { Route } from '@angular/router';
import { ComingSoonPageComponent } from '@shared/pages/coming-soon-page/coming-soon-page.component';
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
});
