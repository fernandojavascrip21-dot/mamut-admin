import type { Route } from '@angular/router';
import { MODAL_EDIT_SELLER_PATH, MODAL_OUTLET, MODAL_SELLER_PASSWORD_PATH } from '@shared/constants/modal.constants';
import { modalSavingGuard } from '@shared/guards/modal-saving.guard';
import { SellerPasswordPageComponent } from '@features/sellers/pages/seller-password-page/seller-password-page.component';
import { ADMIN_ROUTES } from './admin.routes';

describe('ADMIN_ROUTES · cambiar contraseña del vendedor (HU-45)', () => {
  const modalRoute = () =>
    ADMIN_ROUTES.find(
      (route) =>
        route.outlet === MODAL_OUTLET &&
        route.path === `${MODAL_EDIT_SELLER_PATH}/:sellerId/${MODAL_SELLER_PASSWORD_PATH}`,
    ) as Route;

  it('la ventana «vendedor/:sellerId/contrasena» vive en el outlet «ventana» con modalSavingGuard', () => {
    expect(modalRoute()).toBeDefined();
    expect(modalRoute().canDeactivate).toContain(modalSavingGuard);
  });

  it('carga la página con el título «Cambiar contraseña»', async () => {
    expect(modalRoute().data?.['title']).toBe('Cambiar contraseña');
    expect(await (modalRoute().loadComponent as () => Promise<unknown>)()).toBe(SellerPasswordPageComponent);
  });
});
