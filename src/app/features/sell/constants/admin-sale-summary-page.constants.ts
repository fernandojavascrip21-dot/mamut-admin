import { ADMIN_PRODUCTS_URL } from './admin-cart-page.constants';
import { SALE_SUMMARY_TEXTS } from './sale-summary-page.constants';

// Destino de «Ver stock general» (HU-17).
export const ADMIN_STOCK_URL = '/admin/stock';

// Textos de «Venta confirmada» del administrador: los del vendedor, salvo los que hablan de «mi stock»
// o de «vender», más el titular y la ganancia de la venta. Son de partida y se confirman contra el
// canvas en el paso de diseño del spec.
export const ADMIN_SALE_SUMMARY_TEXTS = {
  ...SALE_SUMMARY_TEXTS,
  soldFrom: 'Vendido de:',
  warehouse: 'Bodega',
  profit: 'Ganancia',
  viewStock: 'Ver stock general',
  loadingTitle: 'Cargando la venta…',
  notFoundAction: 'Ir a Productos',
  errorTitle: 'No pudimos cargar la venta',
} as const;

export const ADMIN_SALE_SUMMARY_LINKS = { sell: ADMIN_PRODUCTS_URL, stock: ADMIN_STOCK_URL } as const;
