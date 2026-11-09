import { deliveryModalLink, fractionModalLink, shrinkageModalLink } from '@shared/utils/modal-links';
import type { StockQuickAction } from '../components/stock-quick-actions/stock-quick-actions.models';

// Etiquetas fijas de la barra dividida y del reparto por producto (HU-13).
export const WAREHOUSE_LABEL = 'Bodega';
export const INACTIVE_SELLERS_LABEL = 'Vendedores inactivos';

// Llaves de los segmentos que no son un vendedor; las de los vendedores son su id.
export const WAREHOUSE_PART_KEY = 'warehouse';
export const INACTIVE_PART_KEY = 'inactive';

// Colores de vendedor en `styles.css` (--color-split-1…5): rotan en orden alfabético.
export const SPLIT_PALETTE_SIZE = 5;

// Separador del reparto en una línea: «Bodega 4 · Luis 6».
export const BREAKDOWN_SEPARATOR = ' · ';

// Destinos de los movimientos rápidos con «Yo» (HU-13). «Entrada a bodega» abre «Próximamente»
// hasta que tenga su propia historia; «Dejar» abre la ventana sin vendedor fijo.
export const WAREHOUSE_ENTRY_URL = '/admin/entrada';
export const NEW_PRODUCT_URL = '/admin/productos/nuevo';
export const SELL_URL = '/admin/productos'; // «Vender» (HU-17): se arma la venta desde «Productos»
export const FRACTION_HISTORY_URL = '/admin/fraccionados'; // HU-24: enlace de texto, solo con «Yo · bodega»

export const YO_QUICK_ACTIONS: StockQuickAction[] = [
  { label: 'Entrada a bodega', link: WAREHOUSE_ENTRY_URL, icon: 'entry' },
  { label: 'Dejar a vendedor', link: deliveryModalLink(), icon: 'deliver' },
  { label: 'Vender', link: SELL_URL, icon: 'sell' },
  { label: 'Registrar merma', link: shrinkageModalLink(), icon: 'shrinkage' }, // M6-hu25: merma de la bodega
  { label: 'Fraccionar', link: fractionModalLink(), icon: 'fraction' }, // HU-23: abre la ventana, solo con «Yo · bodega»
  { label: 'Nuevo producto', link: NEW_PRODUCT_URL, icon: 'new' },
];

// Con un vendedor en «Viendo»: «Dejar más a {nombre}» y «Retirarle producto».
export const SELLER_DELIVER_LABEL_PREFIX = 'Dejar más a';
export const SELLER_RETURN_LABEL = 'Retirarle producto';
// Con un vendedor en «Viendo»: merma de sus piezas (M6-hu25), con él fijo en el enlace.
export const SELLER_SHRINKAGE_LABEL = 'Registrar su merma';

// Textos de la pantalla (los de los estados, del spec HU-13 §5).
export const STOCK_PAGE_TEXTS = {
  title: 'Stock general',
  sellerTitlePrefix: 'Resumen de',
  businessTotal: 'Total del negocio',
  sellerStockPrefix: 'Stock de',
  searchLabel: 'Buscar producto',
  searchPlaceholder: 'Buscar por nombre',
  loadingTitle: 'Cargando el stock…',
  loadingHint: 'Bodega y vendedores.',
  emptyTitle: 'Aún no hay productos',
  emptyHint: 'Agrega tu primer producto para ver aquí el stock.',
  emptyAction: 'Nuevo producto',
  errorTitle: 'No pudimos cargar el stock',
  errorHint: 'Revisa tu conexión e inténtalo de nuevo.',
  retry: 'Reintentar',
  noMatchTitle: 'No hay productos con ese nombre',
  noMatchHint: 'Revisa cómo lo escribiste.',
  clearSearch: 'Limpiar búsqueda',
  sellerEmpty: 'Todavía no tiene producto.',
  lowFilterLabel: 'Baja existencia',
  lowFilterEmpty: 'Sin productos con baja existencia',
  lowPopupSellerTitlePrefix: 'Baja existencia de',
  lowPopupWarehouse: 'Bodega',
  lowPopupEmptyWarehouse: 'Nada por resurtir en la bodega por ahora.',
  lowPopupEmptySeller: 'Nada por resurtir con este vendedor por ahora.',
  lowFilterAriaSingular: 'producto',
  lowFilterAriaPlural: 'productos',
  fractionHistoryLink: 'Ver fraccionados',
} as const;

// Piezas del título de la tarjeta de avisos (HU-18).
export const LOW_STOCK_TITLES = {
  singular: 'producto',
  plural: 'productos',
  businessSuffix: 'con baja existencia',
  sellerSuffix: 'por terminarse',
} as const;

// Titular de la bodega en un aviso.
export const LOW_STOCK_WAREHOUSE_HOLDER = WAREHOUSE_LABEL;

// Tope del número en el globo del botón «Baja existencia» (HU-18): con más avisos se ve «99+».
export const LOW_FILTER_BADGE_MAX = 99;
