import { deliveryModalLink } from '@shared/utils/modal-links';
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

export const YO_QUICK_ACTIONS: StockQuickAction[] = [
  { label: 'Entrada a bodega', link: WAREHOUSE_ENTRY_URL, icon: 'entry' },
  { label: 'Dejar a vendedor', link: deliveryModalLink(), icon: 'deliver' },
  { label: 'Nuevo producto', link: NEW_PRODUCT_URL, icon: 'new' },
];

// Con un vendedor en «Viendo»: «Dejar más a {nombre}» y «Retirarle producto».
export const SELLER_DELIVER_LABEL_PREFIX = 'Dejar más a';
export const SELLER_RETURN_LABEL = 'Retirarle producto';

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
} as const;
