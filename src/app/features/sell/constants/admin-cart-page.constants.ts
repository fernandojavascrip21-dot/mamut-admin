import { CART_PAGE_TEXTS } from './cart-page.constants';

// Destino de «Seguir vendiendo» e «Ir a Productos» en el carrito del administrador (HU-17).
export const ADMIN_PRODUCTS_URL = '/admin/productos';

// Textos de «Carrito» del administrador: los del vendedor, salvo los que hablan de «tu stock» o de
// «Vender», más el titular («Vendiendo de: Bodega») y la ganancia. Vacío y ganancia salen del canvas
// (tablero `EstadosCarritoAdmin` y `Productos` con venta); «Vendiendo de:» es el del spec, que ya lo fija.
export const ADMIN_CART_PAGE_TEXTS = {
  ...CART_PAGE_TEXTS,
  loadingTitle: 'Cargando el stock…',
  errorTitle: 'No pudimos cargar el stock',
  emptyHint: 'Toca «Vender» en los productos para agregarlos.',
  emptyAction: 'Ir a productos',
  soldOutHint: 'Ya no quedan piezas. Quítalo del carrito.',
  sellingFrom: 'Vendiendo de:',
  warehouse: 'Bodega',
  profit: 'Ganancia de esta venta',
  summaryTitle: 'Resumen de la venta',
} as const;
