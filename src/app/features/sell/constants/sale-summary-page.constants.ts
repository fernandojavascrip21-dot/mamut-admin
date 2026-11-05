import { SELL_URL } from './cart-page.constants';

// Destino de «Ver mi stock» (HU-14).
export const MY_STOCK_URL = '/vendedor/mi-stock';

// Textos de «Venta confirmada» (HU-16). Son de partida y se confirman contra el canvas en el paso de
// diseño de su spec (tableros `Venta` pantalla 06c y `EstadosVender`).
export const SALE_SUMMARY_TEXTS = {
  title: 'Venta confirmada',
  replayedNotice: 'Esta venta ya se había registrado. Esto es lo que se vendió.',
  total: 'Total',
  newSale: 'Nueva venta',
  viewStock: 'Ver mi stock',
  loadingTitle: 'Cargando tu venta…',
  notFoundHint: 'Revisa el enlace o empieza una venta nueva.',
  notFoundTitle: 'No encontramos esta venta',
  notFoundAction: 'Ir a vender',
  errorTitle: 'No pudimos cargar tu venta',
  errorHint: 'Revisa tu conexión e inténtalo de nuevo.',
  retry: 'Reintentar',
  lowStockPrefix: 'Se avisó al administrador que te quedan pocas piezas de:',
} as const;

export const SALE_SUMMARY_LINKS = { sell: SELL_URL, stock: MY_STOCK_URL } as const;
