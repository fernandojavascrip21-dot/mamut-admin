import { API_BASE_URL } from '@core/api-base-url';

export const SHRINKAGES_URL = `${API_BASE_URL}/api/shrinkages`;

// Mensaje con el que el backend rechaza piezas de más (409). Igual que en «Fraccionar», se reconoce por
// texto porque el 409 de «sin piezas» comparte status con otros conflictos.
export const NO_UNITS_MESSAGE = 'No hay piezas suficientes';

// Nombre del titular cuando es la bodega (holder null), en la confirmación y en el resultado.
export const WAREHOUSE_HOLDER_NAME = 'la bodega';
