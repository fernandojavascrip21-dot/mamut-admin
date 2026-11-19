import type { DataGridColumn, DataGridTexts } from '@shared/components/data-grid/data-grid.models';
import type { SellerDetailView } from '../models/seller-detail-page.models';

// El grid abre siempre en «Stock»; la elección no se recuerda al salir de la ficha.
export const DEFAULT_SELLER_DETAIL_VIEW: SellerDetailView = 'stock';

// Nombre accesible del filtro del grid.
export const SELLER_DETAIL_FILTER_LABEL = 'Qué mostrar en la tabla';

// Orden y nombre de cada opción del filtro.
export const SELLER_DETAIL_VIEWS: { value: SellerDetailView; label: string }[] = [
  { value: 'stock', label: 'Stock' },
  { value: 'deliveries', label: 'Entregas' },
  { value: 'returns', label: 'Retiros' },
  { value: 'shrinkages', label: 'Mermas' },
];

// Marca junto al precio o costo que el administrador fijó para este vendedor.
export const OWN_AMOUNT_BADGE = 'propio';

// «Piezas» es la única columna que se ve también en móvil; las demás bajan bajo el producto.
const UNITS_COLUMN: DataGridColumn = { key: 'units', header: 'Piezas', align: 'right', format: 'text', primary: true };
const DATE_COLUMN: DataGridColumn = { key: 'date', header: 'Fecha', align: 'left', format: 'date' };

// Columnas de cada lista además de «Producto».
export const SELLER_DETAIL_COLUMNS: Record<SellerDetailView, DataGridColumn[]> = {
  stock: [
    { key: 'price', header: 'Precio', align: 'right', format: 'money' },
    { key: 'cost', header: 'Costo', align: 'right', format: 'cost' },
    UNITS_COLUMN,
  ],
  deliveries: [DATE_COLUMN, UNITS_COLUMN],
  returns: [DATE_COLUMN, UNITS_COLUMN],
  shrinkages: [{ key: 'reason', header: 'Motivo', align: 'left', format: 'text' }, DATE_COLUMN, UNITS_COLUMN],
};

// Textos de cada lista; `stateClass` y `emptyClass` conservan las clases de prueba de las secciones
// anteriores (`empty`, `history-empty`, `retry-returns`…).
export const SELLER_DETAIL_TEXTS: Record<SellerDetailView, DataGridTexts> = {
  stock: {
    titleHeader: 'Producto',
    loading: '',
    error: '',
    empty: 'Todavía no tiene producto.',
    stateClass: 'stock',
    emptyClass: 'empty',
  },
  deliveries: {
    titleHeader: 'Producto',
    loading: 'Cargando entregas…',
    error: 'No pudimos cargar las entregas',
    empty: 'Todavía no le has dejado producto.',
    stateClass: 'history',
    emptyClass: 'history-empty',
  },
  returns: {
    titleHeader: 'Producto',
    loading: 'Cargando retiros…',
    error: 'No pudimos cargar los retiros',
    empty: 'Todavía no le has retirado producto.',
    stateClass: 'returns',
    emptyClass: 'returns-empty',
  },
  shrinkages: {
    titleHeader: 'Producto',
    loading: 'Cargando mermas…',
    error: 'No pudimos cargar las mermas',
    empty: 'Todavía no tiene mermas.',
    stateClass: 'shrinkages',
    emptyClass: 'shrinkages-empty',
  },
};

// Aviso de la ficha de un vendedor desactivado (HU-44).
export const SELLER_INACTIVE_TITLE = 'Está desactivado';
export const SELLER_INACTIVE_MESSAGE =
  'No puede entrar a la app ni recibir producto. Sus ventas y cortes se conservan. Reactívalo para dejarle producto o ver sus movimientos.';

// «Reactivar» y sus avisos.
export const REACTIVATE_LABEL = 'Reactivar';
export const REACTIVATING_LABEL = 'Reactivando…';
export const REACTIVATE_OFFLINE_NOTICE = 'No se pudo reactivar. Revisa tu conexión e inténtalo de nuevo.';

// «Cambiar contraseña» (HU-45): solo un activo lo tiene.
export const CHANGE_PASSWORD_LABEL = 'Cambiar contraseña';
