import type { Route } from '@angular/router';
import { MODAL_OUTLET, MODAL_PURCHASE_PATH } from '@shared/constants/modal.constants';
import { modalSavingGuard } from '@shared/guards/modal-saving.guard';
import { PurchasePageComponent } from '@features/purchases/pages/purchase-page/purchase-page.component';
import { ADMIN_ROUTES } from './admin.routes';

describe('ADMIN_ROUTES · ventana «Entrada a bodega»', () => {
  const modalRoute = () =>
    ADMIN_ROUTES.find((route) => route.outlet === MODAL_OUTLET && route.path === MODAL_PURCHASE_PATH) as Route;

  it('«entrada» vive en el outlet «ventana» con el guard de guardado', () => {
    expect(modalRoute()).toBeDefined();
    expect(modalRoute().canDeactivate).toContain(modalSavingGuard);
  });

  it('carga la página de entrada con el título «Entrada a bodega»', async () => {
    expect(modalRoute().data?.['title']).toBe('Entrada a bodega');
    expect(await (modalRoute().loadComponent as () => Promise<unknown>)()).toBe(PurchasePageComponent);
  });
});
