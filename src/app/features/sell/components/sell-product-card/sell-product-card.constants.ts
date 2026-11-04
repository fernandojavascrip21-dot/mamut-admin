import type { CardPassThrough } from 'primeng/types/card';

// El marco es `p-card`; la distribución (foto + datos + control de piezas) va dentro, sin relleno propio.
export const SELL_PRODUCT_CARD_PASS_THROUGH = {
  body: { class: 'p-0' },
  content: { class: 'p-0' },
} satisfies CardPassThrough;
