import { Routes } from '@angular/router';
import {
  MODAL_DELIVERY_PATH,
  MODAL_EDIT_HOLDING_PATH,
  MODAL_OUTLET,
  MODAL_RETURN_PATH,
} from '@shared/constants/modal.constants';
import { modalSavingGuard } from '@shared/guards/modal-saving.guard';

const comingSoon = () =>
  import('@shared/pages/coming-soon-page/coming-soon-page.component').then((m) => m.ComingSoonPageComponent);

// Hijos de /admin, cargados con loadChildren: este archivo (y cada feature) solo se descarga
// cuando roleGuard ya dejó pasar a un administrador, así que el vendedor nunca lo baja.
// Cada feature declara sus propias rutas; aquí solo se montan en su URL.
export const ADMIN_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'stock' },
  {
    path: 'stock',
    loadChildren: () => import('@features/stock/stock.routes').then((m) => m.STOCK_ROUTES),
  },
  // «Entrada a bodega» (movimiento rápido de «Stock general», HU-13): su pantalla va en otra historia.
  { path: 'entrada', loadComponent: comingSoon, data: { title: 'Entrada a bodega' } },
  {
    path: 'productos',
    loadChildren: () => import('@features/products/products.routes').then((m) => m.PRODUCT_ROUTES),
  },
  {
    path: 'carrito',
    loadChildren: () => import('@features/sell/sell.routes').then((m) => m.ADMIN_CART_ROUTES),
  },
  {
    path: 'venta',
    loadChildren: () => import('@features/sell/sell.routes').then((m) => m.ADMIN_SALE_ROUTES),
  },
  {
    path: 'corte',
    loadChildren: () => import('@features/cash-cut/cash-cut.routes').then((m) => m.ADMIN_CASH_CUT_ROUTES),
  },
  {
    path: 'fraccionar',
    loadChildren: () => import('@features/fraction/fraction.routes').then((m) => m.FRACTION_ROUTES),
  },
  {
    path: 'entregas',
    loadChildren: () => import('@features/deliveries/deliveries.routes').then((m) => m.DELIVERY_ROUTES),
  },
  // Pop-ups de «Dejar» y «Retirar» (spec T-16): viven en el outlet `ventana` de admin-shell, sobre la
  // página actual. Se montan aquí porque esta es la única capa de core que puede cargar features.
  {
    path: MODAL_DELIVERY_PATH,
    outlet: MODAL_OUTLET,
    canDeactivate: [modalSavingGuard],
    loadComponent: () =>
      import('@features/deliveries/pages/create-delivery-page/create-delivery-page.component').then(
        (m) => m.CreateDeliveryPageComponent,
      ),
    data: { title: 'Dejar a vendedor' },
  },
  {
    path: `${MODAL_RETURN_PATH}/:sellerId`,
    outlet: MODAL_OUTLET,
    canDeactivate: [modalSavingGuard],
    loadComponent: () =>
      import('@features/sellers/pages/return-units-page/return-units-page.component').then(
        (m) => m.ReturnUnitsPageComponent,
      ),
    data: { title: 'Retirar producto' },
  },
  // Corregir lo ya dejado a un vendedor (piezas, precio y costo con envío): ventana `editar`.
  {
    path: `${MODAL_EDIT_HOLDING_PATH}/:sellerId/:productId`,
    outlet: MODAL_OUTLET,
    canDeactivate: [modalSavingGuard],
    loadComponent: () =>
      import('@features/deliveries/pages/edit-holding-page/edit-holding-page.component').then(
        (m) => m.EditHoldingPageComponent,
      ),
    data: { title: 'Editar lo dejado' },
  },
  {
    path: 'vendedores',
    loadChildren: () => import('@features/sellers/sellers.routes').then((m) => m.SELLER_ADMIN_ROUTES),
  },
];
