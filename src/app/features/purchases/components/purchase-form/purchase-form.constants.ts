import type { MotionOptions } from '@primeuix/motion';

// Movimiento del selector: con «reducir movimiento» el panel no anima (PrimeNG safe mode).
export const PURCHASE_SELECT_MOTION_OPTIONS = { safe: true } satisfies MotionOptions;

// Textos visibles del formulario (HU-27).
export const PURCHASE_FORM_TEXTS = {
  product: 'Producto',
  productPlaceholder: 'Busca o elige un producto',
  productFilter: 'Buscar por nombre',
  noProductMatch: 'No hay productos con ese nombre.',
  currentStock: 'Piezas actuales en bodega',
  stockAfter: 'Quedarán',
  qty: 'Piezas que entran',
  cancel: 'Cancelar',
  submit: 'Registrar entrada',
};

// Mensajes de cada campo al enviar. La clave es el error del validador que falló primero.
export const PURCHASE_FORM_MESSAGES = {
  product: 'Elige el producto',
  invalid: 'Revisa este campo',
  qty: {
    required: 'Escribe cuántas piezas entran',
    integer: 'Debe ser un número entero mayor a 0',
  },
};
