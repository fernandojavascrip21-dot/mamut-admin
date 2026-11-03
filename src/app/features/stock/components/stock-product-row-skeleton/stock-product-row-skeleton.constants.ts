import type { CardPassThrough } from 'primeng/types/card';

// La fila pone su propio relleno; el cuerpo y el contenido de `p-card` no añaden el suyo.
export const STOCK_PRODUCT_ROW_SKELETON_PASS_THROUGH = {
  body: { class: 'p-0' },
  content: { class: 'p-0' },
} satisfies CardPassThrough;
