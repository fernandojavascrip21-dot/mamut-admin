import { ADMIN_PRODUCTS_URL } from './admin-cart-page.constants';
import { SALE_SUMMARY_TEXTS } from './sale-summary-page.constants';

// Destino de «Ver stock general» (HU-17).
export const ADMIN_STOCK_URL = '/admin/stock';

// Textos de «Venta confirmada» del administrador: los del vendedor, salvo los que hablan de «mi stock»
// o de «vender», más el titular y la ganancia de la venta («Total · ganancia» del tablero `Productos`).
// El canvas ofrece «Ver corte de hoy»; el spec fija «Ver stock general» (decisión del usuario).
export const ADMIN_SALE_SUMMARY_TEXTS = {
  ...SALE_SUMMARY_TEXTS,
  soldFrom: 'Vendido de:',
  warehouse: 'Bodega',
  profit: 'Ganancia',
  productSingular: 'producto',
  productPlural: 'productos',
  viewStock: 'Ver stock general',
  loadingTitle: 'Cargando la venta…',
  notFoundAction: 'Ir a productos',
  errorTitle: 'No pudimos cargar la venta',
} as const;

export const ADMIN_SALE_SUMMARY_LINKS = { sell: ADMIN_PRODUCTS_URL, stock: ADMIN_STOCK_URL } as const;
