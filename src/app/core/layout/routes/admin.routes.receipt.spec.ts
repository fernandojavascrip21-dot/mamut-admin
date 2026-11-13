import type { Route } from '@angular/router';
import { MODAL_OUTLET, MODAL_RECEIPT_PATH } from '@shared/constants/modal.constants';
import { unsavedReceiptGuard } from '@features/receipts/guards/unsaved-receipt.guard';
import { ReceiptUploadPageComponent } from '@features/receipts/pages/receipt-upload-page/receipt-upload-page.component';
import { RECEIPT_ROUTES } from '@features/receipts/receipts.routes';
import { ReceiptPendingPageComponent } from '@features/receipts/pages/receipt-pending-page/receipt-pending-page.component';
import { ADMIN_ROUTES } from './admin.routes';

describe('ADMIN_ROUTES · remisiones (HU-42)', () => {
  const modalRoute = () =>
    ADMIN_ROUTES.find((route) => route.outlet === MODAL_OUTLET && route.path === MODAL_RECEIPT_PATH) as Route;
  const pagesRoute = () => ADMIN_ROUTES.find((route) => route.path === 'remisiones') as Route;

  it('la ventana «remision» vive en el outlet «ventana» con unsavedReceiptGuard', () => {
    expect(MODAL_RECEIPT_PATH).toBe('remision');
    expect(modalRoute()).toBeDefined();
    expect(modalRoute().canDeactivate).toContain(unsavedReceiptGuard);
  });

  it('carga la página de carga con el título «Cargar remisión»', async () => {
    expect(modalRoute().data?.['title']).toBe('Cargar remisión');
    expect(await (modalRoute().loadComponent as () => Promise<unknown>)()).toBe(ReceiptUploadPageComponent);
  });

  it('«remisiones» carga las rutas de la feature con loadChildren', async () => {
    expect(pagesRoute()).toBeDefined();
    expect(await (pagesRoute().loadChildren as () => Promise<unknown>)()).toBe(RECEIPT_ROUTES);
  });

  it('«remisiones» redirige a «pendientes» y «pendientes» carga la página con su título', async () => {
    expect(RECEIPT_ROUTES.find((route) => route.path === '')).toMatchObject({
      pathMatch: 'full', redirectTo: 'pendientes',
    });
    const pending = RECEIPT_ROUTES.find((route) => route.path === 'pendientes') as Route;
    expect(pending.title).toBe('Pendientes de remisiones');
    expect(await (pending.loadComponent as () => Promise<unknown>)()).toBe(ReceiptPendingPageComponent);
  });
});
