import type { MotionOptions } from '@primeuix/motion';
import { MAX_PORTIONS, MIN_PORTIONS } from '../../constants/fraction-page.constants';

// Movimiento del selector: con «reducir movimiento» el panel no anima (PrimeNG safe mode).
export const FRACTION_SELECT_MOTION_OPTIONS = { safe: true } satisfies MotionOptions;

// Textos visibles del formulario (spec M5-hu23 §8).
export const FRACTION_FORM_TEXTS = {
  product: 'Producto a abrir',
  placeholder: 'Elige un entero',
  portions: 'Bolsitas que salieron',
  price: 'Precio de venta de la bolsita',
  portionSize: 'Porción',
  warehouseUnits: 'Piezas en bodega',
  unitCost: 'Costo de fábrica',
  submit: 'Fraccionar',
  submitting: 'Fraccionando…',
};

// Mensajes de cada campo al enviar. La clave es el error del validador que falló primero.
export const FRACTION_FORM_MESSAGES = {
  productRequired: 'Elige el entero a fraccionar',
  invalid: 'Revisa este campo',
  portions: {
    required: 'Escribe cuántas bolsitas salen',
    integer: 'Las bolsitas deben ser un número entero',
    range: `Las bolsitas van de ${MIN_PORTIONS} a ${MAX_PORTIONS}`,
  },
  price: {
    required: 'Escribe el precio de la bolsita',
    min: 'El precio debe ser mayor a 0',
    decimals: 'El precio admite hasta 2 decimales',
    money: 'El precio debe ser un número',
    max: 'El precio es demasiado grande',
  },
};
