import type { Route } from '@angular/router';
import { MODAL_EDIT_SELLER_PATH, MODAL_OUTLET } from '@shared/constants/modal.constants';
import { unsavedSellerGuard } from '@features/sellers/guards/unsaved-seller.guard';
import { EditSellerPageComponent } from '@features/sellers/pages/edit-seller-page/edit-seller-page.component';
import { ADMIN_ROUTES } from './admin.routes';

describe('ADMIN_ROUTES · editar datos del vendedor (HU-43)', () => {
  const modalRoute = () =>
    ADMIN_ROUTES.find(
      (route) => route.outlet === MODAL_OUTLET && route.path === `${MODAL_EDIT_SELLER_PATH}/:sellerId`,
    ) as Route;

  it('la ventana «vendedor/:sellerId» vive en el outlet «ventana» con unsavedSellerGuard', () => {
    expect(modalRoute()).toBeDefined();
    expect(modalRoute().canDeactivate).toContain(unsavedSellerGuard);
  });

  it('carga la página con el título «Editar datos»', async () => {
    expect(modalRoute().data?.['title']).toBe('Editar datos');
    expect(await (modalRoute().loadComponent as () => Promise<unknown>)()).toBe(EditSellerPageComponent);
  });
});
