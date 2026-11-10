import { API_BASE_URL } from '@core/api-base-url';

export const RESTOCK_ORDERS_URL = `${API_BASE_URL}/api/restock/orders`;
export const RESTOCK_SUGGESTIONS_URL = `${API_BASE_URL}/api/restock/suggestions`;
export const RESTOCK_PRODUCTS_URL = `${API_BASE_URL}/api/restock/products`;

// Mismos topes que el backend (T-36) para validar antes de enviar.
export const MAX_QTY = 2_147_483_647;
export const MAX_LINES = 200;
export const MAX_NOTE_LENGTH = 500;
export const MAX_CUSTOM_NAME_LENGTH = 120;
