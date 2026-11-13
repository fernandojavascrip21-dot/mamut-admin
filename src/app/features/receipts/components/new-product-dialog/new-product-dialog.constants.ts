import type { NewProductField } from './new-product-dialog.models';

// Textos del pop-up «Dar de alta producto» (HU-42 §3).
export const NEW_PRODUCT_DIALOG_TEXTS = {
  title: 'Dar de alta producto',
  name: 'Nombre',
  price: 'Precio de venta',
  category: 'Categoría',
  unitCost: 'Costo de fábrica',
  noCategory: 'Sin categoría',
  belowCost: 'El precio es menor que el costo',
  cancel: 'Cancelar',
  submit: 'Dar de alta',
  stockNote: (qty: number) => `Entrarán ${qty} piezas a bodega. La foto se agrega después en Editar producto.`,
} as const;

// Mensaje por cada error de validación, según el campo y la clave que devolvió el validador.
export const NEW_PRODUCT_FIELD_ERRORS: Record<NewProductField, Record<string, string>> = {
  name: {
    required: 'Escribe el nombre del producto.',
    tooLong: 'El nombre no puede pasar de 200 caracteres.',
  },
  price: {
    required: 'Escribe el precio de venta.',
    money: 'Usa hasta 2 decimales, sin pasarse de 99999999.99.',
    positive: 'El precio tiene que ser mayor que 0.',
  },
  unitCost: {
    required: 'La remisión no trae costo: escribe el costo de fábrica.',
    cost: 'Usa hasta 4 decimales, de 0 a 999999.9999.',
  },
};
