import { API_BASE_URL } from '@core/api-base-url';
import type { ConfirmOptions } from '@core/confirm/confirm.models';

export const MAX_QTY = 2147483647;
export const RECEIPTS_URL = `${API_BASE_URL}/api/receipts`;
export const CATEGORIES_URL = `${API_BASE_URL}/api/categories`;

// Piezas escritas como texto: solo dígitos, sin signo ni decimales (el backend también las exige enteras).
export const QTY_DIGITS = /^\d+$/;

// Formatos que acepta la carga; el backend decide el resto (HU-42 §3).
export const RECEIPT_FILE_ACCEPT = '.xlsx,.pdf,.jpg,.jpeg,.png';

// Ruta de la página de pendientes, dentro de /admin (se pasa a leaveModalLink).
export const RECEIPT_PENDING_SEGMENTS = ['remisiones', 'pendientes'];

// El backend responde 409 con este mensaje cuando el mismo requestId llega con otros datos: el primer
// intento sí se registró. Es el único 409 que ofrece «Ver lo registrado» (ambos 409 llegan con code
// `conflict`, así que el texto es lo que los distingue).
export const REQUEST_MISMATCH_MESSAGE = 'Esta remisión ya se registró con otros datos.';

// Salir del pop-up con una revisión sin registrar: no se registra nada, así que se pide confirmar.
export const RECEIPT_LEAVE_CONFIRMATION: ConfirmOptions = {
  title: 'Descartar remisión',
  message: '¿Descartar la remisión? No se registró nada.',
  confirmLabel: 'Descartar',
  cancelLabel: 'Seguir revisando',
  tone: 'default',
};

// Fechas de las remisiones en la hora de la bodega (Intl, no el reloj del equipo).
export const RECEIPT_TIME_ZONE = 'America/Mexico_City';

// Largo máximo del nombre de un producto nuevo (mismo tope que el catálogo).
export const NEW_PRODUCT_NAME_MAX = 200;
