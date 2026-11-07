import type { MotionOptions } from '@primeuix/motion';
import type { FieldWithError, ProductCategoryOption } from './product-form.models';

export const NO_CATEGORY_OPTION: ProductCategoryOption = { label: 'Sin categoría', value: '' };
export const CATEGORY_SELECT_MOTION_OPTIONS = { safe: true } satisfies MotionOptions;

// Casilla y campo de la porción. La porción es del producto en general (texto libre, la unidad varía
// por producto: «30 g», «1 scoop»…), no de cada bolsita ni cuántas bolsitas salen. Va siempre visible y
// solo es obligatoria cuando el producto es para fraccionar.
export const FRACTIONABLE_LABEL = 'Producto para fraccionar';
export const PORTION_LABEL = 'Porción del producto';
export const PORTION_HINT = 'Cuánto trae una porción de este producto. Obligatoria si es para fraccionar. Ej.: 30 g';

// Mensajes de cada campo al enviar (HU-04 §2, HU-06 §2).
export const FIELD_MESSAGES: Record<FieldWithError, string> = {
  name: 'Escribe el nombre del producto',
  unitCost: 'El costo debe ser mayor a 0',
  price: 'El precio debe ser mayor a 0',
  units: 'Las piezas deben ser un número entero mayor a 0',
  portionSize: 'Escribe la porción',
};

// Decimales de más o monto fuera de la columna (spec T-08 §3): nunca se redondea en silencio.
export const MONEY_MESSAGES = {
  unitCost: { maxDecimals: 'El costo admite hasta 4 decimales', maxMoney: 'El costo es demasiado grande' },
  price: { maxDecimals: 'El precio admite hasta 2 decimales', maxMoney: 'El precio es demasiado grande' },
};
