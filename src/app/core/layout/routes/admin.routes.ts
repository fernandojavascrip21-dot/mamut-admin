import { inject } from '@angular/core';
import { Router, Routes } from '@angular/router';
import {
  MODAL_DELIVERY_PATH,
  MODAL_EDIT_HOLDING_PATH,
  MODAL_FRACTION_PATH,
  MODAL_OUTLET,
  MODAL_RETURN_PATH,
  MODAL_PURCHASE_PATH,
  MODAL_RESTOCK_PATH,
  MODAL_SHRINKAGE_PATH,
} from '@shared/constants/modal.constants';
import { modalSavingGuard } from '@shared/guards/modal-saving.guard';
import { unsavedRestockGuard } from '@features/restock/guards/unsaved-restock.guard';

// Hijos de /admin, cargados con loadChildren: este archivo (y cada feature) solo se descarga
// cuando roleGuard ya dejó pasar a un administrador, así que el vendedor nunca lo baja.
// Cada feature declara sus propias rutas; aquí solo se montan en su URL.
export const ADMIN_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'stock' },
  {
    path: 'stock',
    loadChildren: () => import('@features/stock/stock.routes').then((m) => m.STOCK_ROUTES),
  },
  // La dirección antigua de «Entrada a bodega» (HU-27) abre su ventana sobre «Stock general».
  {
    path: 'entrada',
    redirectTo: () =>
      inject(Router).createUrlTree(['/admin', { outlets: { primary: ['stock'], [MODAL_OUTLET]: [MODAL_PURCHASE_PATH] } }]),
  },
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
  // «Fraccionar» (HU-23): pop-up en el outlet `ventana`; el entero llega como parámetro `producto`.
  {
    path: MODAL_FRACTION_PATH,
    outlet: MODAL_OUTLET,
    canDeactivate: [modalSavingGuard],
    loadComponent: () =>
      import('@features/fraction/pages/fraction-page/fraction-page.component').then(
        (m) => m.FractionPageComponent,
      ),
    data: { title: 'Fraccionar' },
  },
  // «Registrar merma» (HU-25): pop-up en el outlet `ventana`; el titular llega como parámetro `vendedor`.
  {
    path: MODAL_SHRINKAGE_PATH,
    outlet: MODAL_OUTLET,
    canDeactivate: [modalSavingGuard],
    loadComponent: () =>
      import('@features/shrinkage/pages/shrinkage-page/shrinkage-page.component').then(
        (m) => m.ShrinkagePageComponent,
      ),
    data: { title: 'Registrar merma' },
  },
  // «Entrada a bodega» (HU-27): pop-up en el outlet `ventana`, sin parámetros.
  {
    path: MODAL_PURCHASE_PATH,
    outlet: MODAL_OUTLET,
    canDeactivate: [modalSavingGuard],
    loadComponent: () =>
      import('@features/purchases/pages/purchase-page/purchase-page.component').then(
        (m) => m.PurchasePageComponent,
      ),
    data: { title: 'Entrada a bodega' },
  },
  // «Lista de resurtir» (HU-31): pop-up en el outlet `ventana`, sin parámetros; no se sale con cambios sin guardar.
  {
    path: MODAL_RESTOCK_PATH,
    outlet: MODAL_OUTLET,
    canDeactivate: [unsavedRestockGuard],
    loadComponent: () =>
      import('@features/restock/pages/restock-page/restock-page.component').then((m) => m.RestockPageComponent),
    data: { title: 'Lista de resurtir' },
  },
  // Mermas y fraccionados (HU-26 §12) son vistas de «Stock general»: las direcciones antiguas solo
  // redirigen a la vista correspondiente.
  {
    path: 'mermas',
    redirectTo: () => inject(Router).createUrlTree(['/admin/stock'], { queryParams: { vista: 'mermas' } }),
  },
  {
    path: 'fraccionados',
    redirectTo: () => inject(Router).createUrlTree(['/admin/stock'], { queryParams: { vista: 'fraccionados' } }),
  },
  {
    path: 'vendedores',
    loadChildren: () => import('@features/sellers/sellers.routes').then((m) => m.SELLER_ADMIN_ROUTES),
  },
];
