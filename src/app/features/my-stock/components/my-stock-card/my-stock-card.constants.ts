import type { CardPassThrough } from 'primeng/types/card';

// El marco es `p-card`; la distribución (foto + datos) va dentro, sin relleno propio del cuerpo.
export const MY_STOCK_CARD_PASS_THROUGH = {
  body: { class: 'p-0' },
  content: { class: 'p-0' },
} satisfies CardPassThrough;
