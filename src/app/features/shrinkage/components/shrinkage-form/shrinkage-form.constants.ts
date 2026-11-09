import type { MotionOptions } from '@primeuix/motion';

// Movimiento de los selectores: con «reducir movimiento» el panel no anima (PrimeNG safe mode).
export const SHRINKAGE_SELECT_MOTION_OPTIONS = { safe: true } satisfies MotionOptions;

// Textos visibles del formulario (spec M6-hu25 §5).
export const SHRINKAGE_FORM_TEXTS = {
  product: 'Producto',
  productPlaceholder: 'Busca o elige un producto',
  productFilter: 'Buscar por nombre',
  noProductMatch: 'No hay productos con ese nombre.',
  holds: 'Tiene',
  onlyHolds: 'Solo tiene',
  qty: 'Piezas',
  reason: 'Motivo',
  reasonPlaceholder: 'Elige un motivo',
  cancel: 'Cancelar',
  submit: 'Registrar merma',
};

// Mensajes de cada campo al enviar. La clave es el error del validador que falló primero.
export const SHRINKAGE_FORM_MESSAGES = {
  product: 'Elige el producto',
  reason: 'Elige el motivo',
  invalid: 'Revisa este campo',
  qty: {
    required: 'Escribe cuántas piezas',
    integer: 'Debe ser un número entero mayor a 0',
  },
};
