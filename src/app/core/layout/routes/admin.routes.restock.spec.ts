import type { Route } from '@angular/router';
import { MODAL_OUTLET, MODAL_RESTOCK_PATH } from '@shared/constants/modal.constants';
import { unsavedRestockGuard } from '@features/restock/guards/unsaved-restock.guard';
import { RestockPageComponent } from '@features/restock/pages/restock-page/restock-page.component';
import { ADMIN_ROUTES } from './admin.routes';

describe('ADMIN_ROUTES · ventana «Lista de resurtir»', () => {
  const modalRoute = () =>
    ADMIN_ROUTES.find((route) => route.outlet === MODAL_OUTLET && route.path === MODAL_RESTOCK_PATH) as Route;

  it('«resurtir» vive en el outlet «ventana», ya no en el principal', () => {
    expect(modalRoute()).toBeDefined();
    expect(ADMIN_ROUTES.find((route) => route.path === 'resurtir' && route.outlet === undefined)).toBeUndefined();
  });

  it('carga la página «Lista de resurtir» con su título', async () => {
    expect(await (modalRoute().loadComponent as () => Promise<unknown>)()).toBe(RestockPageComponent);
    expect(modalRoute().data?.['title']).toBe('Lista de resurtir');
  });

  it('protege la salida con unsavedRestockGuard', () => {
    expect(modalRoute().canDeactivate).toContain(unsavedRestockGuard);
  });
});
