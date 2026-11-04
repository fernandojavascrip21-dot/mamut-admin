import { CART_PAGE_TEXTS } from './cart-page.constants';

// Destino de «Seguir vendiendo» e «Ir a Productos» en el carrito del administrador (HU-17).
export const ADMIN_PRODUCTS_URL = '/admin/productos';

// Textos de «Carrito» del administrador: los del vendedor, salvo los que hablan de «tu stock» o de
// «Vender», más el titular («Vendiendo de: Bodega») y la ganancia. Son de partida y se confirman
// contra el canvas en el paso de diseño del spec (HU-17 §5 paso 8).
export const ADMIN_CART_PAGE_TEXTS = {
  ...CART_PAGE_TEXTS,
  loadingTitle: 'Cargando el stock…',
  errorTitle: 'No pudimos cargar el stock',
  emptyHint: 'Agrega productos desde Productos.',
  emptyAction: 'Ir a Productos',
  soldOutHint: 'Ya no quedan piezas. Quítalo del carrito.',
  sellingFrom: 'Vendiendo de:',
  warehouse: 'Bodega',
  profit: 'Ganancia',
} as const;
