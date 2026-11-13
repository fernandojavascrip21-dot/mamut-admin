import { API_BASE_URL } from '@core/api-base-url';

export const MAX_QTY = 2147483647;
export const RECEIPTS_URL = `${API_BASE_URL}/api/receipts`;
export const CATEGORIES_URL = `${API_BASE_URL}/api/categories`;

// Piezas escritas como texto: solo dígitos, sin signo ni decimales (el backend también las exige enteras).
export const QTY_DIGITS = /^\d+$/;
