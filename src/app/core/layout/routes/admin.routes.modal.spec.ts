import type { Route } from '@angular/router';
import { MODAL_FRACTION_PATH, MODAL_OUTLET } from '@shared/constants/modal.constants';
import { modalSavingGuard } from '@shared/guards/modal-saving.guard';
import { FractionPageComponent } from '@features/fraction/pages/fraction-page/fraction-page.component';
import { ADMIN_ROUTES } from './admin.routes';

describe('ADMIN_ROUTES · ventana «Fraccionar»', () => {
  const modalRoute = () =>
    ADMIN_ROUTES.find((route) => route.outlet === MODAL_OUTLET && route.path === MODAL_FRACTION_PATH) as Route;

  it('ya no hay ruta primaria «fraccionar»', () => {
    expect(ADMIN_ROUTES.find((route) => route.path === 'fraccionar' && !route.outlet)).toBeUndefined();
  });

  it('«fraccionar» vive en el outlet «ventana» con el guard de guardado', () => {
    expect(modalRoute()).toBeDefined();
    expect(modalRoute().canDeactivate).toContain(modalSavingGuard);
  });

  it('carga la página de fraccionar con el título «Fraccionar»', async () => {
    expect(modalRoute().data?.['title']).toBe('Fraccionar');
    expect(await (modalRoute().loadComponent as () => Promise<unknown>)()).toBe(FractionPageComponent);
  });
});
