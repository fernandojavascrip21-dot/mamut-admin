import type { CardPassThrough } from 'primeng/types/card';

// Mismo marco que `app-product-card`, sin relleno propio: la distribución va dentro.
export const SKELETON_CARD_PASS_THROUGH = {
  body: { class: 'p-0' },
  content: { class: 'p-0' },
} satisfies CardPassThrough;
