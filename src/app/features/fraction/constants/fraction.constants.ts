import { API_BASE_URL } from '@core/api-base-url';

// Endpoints de /api/fractions (HU-23).
export const FRACTIONS_URL = `${API_BASE_URL}/api/fractions`;

// Bolsitas: solo dígitos, sin signo, punto ni espacios interiores.
export const WHOLE_NUMBER = /^\d+$/;

// Mensaje que manda el backend cuando la bodega no tiene piezas (409).
export const NO_UNITS_MESSAGE = 'No hay piezas suficientes';

// El backend manda `code: 'validation'` para todo 422 de negocio, así que el 422 se reconoce por su
// mensaje (mismo texto que en backend/src/products/constants.ts y backend/src/fractions/constants.ts).
export const PRICE_BELOW_COST_MESSAGE = 'El precio no puede ser menor que el costo';
export const PORTION_COST_ZERO_MESSAGE = 'El costo por bolsita es demasiado bajo';
export const PORTIONS_OUT_OF_RANGE_MESSAGE = 'Las bolsitas van de 2 a 1000';
