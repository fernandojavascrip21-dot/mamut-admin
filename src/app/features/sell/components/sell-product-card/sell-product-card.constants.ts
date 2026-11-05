import type { CardPassThrough } from 'primeng/types/card';

// El marco es `p-card`; la distribución (foto + datos + control de piezas) va dentro, sin relleno propio.
export const SELL_PRODUCT_CARD_PASS_THROUGH = {
  root: { class: 'h-full' },
  body: { class: 'h-full p-0' },
  content: { class: 'h-full p-0' },
} satisfies CardPassThrough;
