import type { Route } from '@angular/router';
import { MODAL_OUTLET, MODAL_RESTOCK_HISTORY_PATH } from '@shared/constants/modal.constants';
import { unsavedRestockGuard } from '@features/restock/guards/unsaved-restock.guard';
import { RestockHistoryPageComponent } from '@features/restock/pages/restock-history-page/restock-history-page.component';
import { RestockOrderPageComponent } from '@features/restock/pages/restock-order-page/restock-order-page.component';
import { ADMIN_ROUTES } from './admin.routes';

describe('ADMIN_ROUTES · ventanas «Pedidos anteriores» (HU-32)', () => {
  const modalRoute = (path: string) =>
    ADMIN_ROUTES.find((route) => route.outlet === MODAL_OUTLET && route.path === path) as Route;

  describe('lista', () => {
    it('vive en el outlet «ventana» con la ruta «resurtir/pedidos»', () => {
      expect(modalRoute(MODAL_RESTOCK_HISTORY_PATH)).toBeDefined();
    });

    it('carga la página de pedidos anteriores con su título', async () => {
      const route = modalRoute(MODAL_RESTOCK_HISTORY_PATH);
      expect(await (route.loadComponent as () => Promise<unknown>)()).toBe(RestockHistoryPageComponent);
      expect(route.data?.['title']).toBe('Pedidos anteriores');
    });

    it('no lleva guard de salida: es solo lectura', () => {
      expect(modalRoute(MODAL_RESTOCK_HISTORY_PATH).canDeactivate ?? []).not.toContain(unsavedRestockGuard);
    });
  });

  describe('detalle', () => {
    const path = `${MODAL_RESTOCK_HISTORY_PATH}/:id`;

    it('vive en el outlet «ventana» con la ruta «resurtir/pedidos/:id»', () => {
      expect(modalRoute(path)).toBeDefined();
    });

    it('carga la página del pedido con su título', async () => {
      const route = modalRoute(path);
      expect(await (route.loadComponent as () => Promise<unknown>)()).toBe(RestockOrderPageComponent);
      expect(route.data?.['title']).toBe('Pedido de resurtir');
    });
  });

  it('las dos ventanas cuelgan de /admin, que ya está protegido por roleGuard', () => {
    expect(ADMIN_ROUTES.some((route) => route.path === 'resurtir/pedidos' && route.outlet === undefined)).toBe(false);
  });
});
