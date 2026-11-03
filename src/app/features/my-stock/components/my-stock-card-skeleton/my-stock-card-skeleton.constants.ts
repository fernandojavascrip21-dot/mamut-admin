import type { CardPassThrough } from 'primeng/types/card';

// Mismo marco que `app-my-stock-card`, sin relleno propio: la distribución va dentro.
export const MY_STOCK_SKELETON_PASS_THROUGH = {
  body: { class: 'p-0' },
  content: { class: 'p-0' },
} satisfies CardPassThrough;
