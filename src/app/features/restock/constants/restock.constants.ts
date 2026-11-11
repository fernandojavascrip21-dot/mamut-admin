import { API_BASE_URL } from '@core/api-base-url';

export const RESTOCK_ORDERS_URL = `${API_BASE_URL}/api/restock/orders`;
export const RESTOCK_SUGGESTIONS_URL = `${API_BASE_URL}/api/restock/suggestions`;
export const RESTOCK_PRODUCTS_URL = `${API_BASE_URL}/api/restock/products`;
export const RESTOCK_DRAFTS_URL = `${RESTOCK_ORDERS_URL}?status=draft`;

// Mismos topes que el backend (T-36) para validar antes de enviar.
export const MAX_QTY = 2_147_483_647;
export const MAX_LINES = 200;
export const MAX_NOTE_LENGTH = 500;
export const MAX_CUSTOM_NAME_LENGTH = 120;

// Piezas enteras sin ceros a la izquierda ni signo: «25» sí, «2.5», «0», «-1» o «1e3» no.
export const RESTOCK_QTY_PATTERN = /^[1-9]\d*$/;

// Mensaje del backend al cerrar o editar un pedido ya cerrado (otra pestaña): el servicio lo
// distingue de otro 409 por texto, porque el backend no manda un código aparte.
export const CLOSED_ORDER_MESSAGE = 'Este pedido ya está cerrado.';
