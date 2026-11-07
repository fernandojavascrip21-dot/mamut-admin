import { API_BASE_URL } from '@core/api-base-url';

// Endpoints de /api/fractions (HU-23).
export const FRACTIONS_URL = `${API_BASE_URL}/api/fractions`;

// Bolsitas: solo dígitos, sin signo, punto ni espacios interiores.
export const WHOLE_NUMBER = /^\d+$/;

// Mensaje que manda el backend cuando la bodega no tiene piezas (409).
export const NO_UNITS_MESSAGE = 'No hay piezas suficientes';

// Códigos de error del backend que se traducen a un motivo de la pantalla.
export const PRICE_BELOW_COST_CODE = 'PRICE_BELOW_COST';
export const PORTIONS_INVALID_CODES = ['PORTION_COST_ZERO', 'PORTIONS_OUT_OF_RANGE'];
