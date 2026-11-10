import type { Route, Routes } from '@angular/router';
import { unsavedRestockGuard } from '@features/restock/guards/unsaved-restock.guard';
import { RestockPageComponent } from '@features/restock/pages/restock-page/restock-page.component';
import { ADMIN_ROUTES } from './admin.routes';

describe('ADMIN_ROUTES · «Lista de resurtir»', () => {
  const mounted = () => ADMIN_ROUTES.find((route) => route.path === 'resurtir') as Route;
  const pageRoute = async (): Promise<Route> => {
    const children = await (mounted().loadChildren as () => Promise<Routes>)();
    return children.find((route) => route.path === '') as Route;
  };

  it('/admin/resurtir se monta con carga diferida, en el outlet principal', () => {
    expect(mounted()).toBeDefined();
    expect(mounted().loadChildren).toBeDefined();
    expect(mounted().outlet).toBeUndefined();
  });

  it('carga la página «Lista de resurtir»', async () => {
    const route = await pageRoute();
    expect(await (route.loadComponent as () => Promise<unknown>)()).toBe(RestockPageComponent);
    expect(route.data?.['title']).toBe('Lista de resurtir');
  });

  it('protege la salida con unsavedRestockGuard', async () => {
    expect((await pageRoute()).canDeactivate).toContain(unsavedRestockGuard);
  });
});
