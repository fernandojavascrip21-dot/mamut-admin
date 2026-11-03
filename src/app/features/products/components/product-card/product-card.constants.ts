import type { CardPassThrough } from 'primeng/types/card';

// El marco es `p-card`; su cuerpo y su contenido se estiran para que el enlace de edición ocupe el
// alto de la tarjeta y «Dejar a vendedor» quede abajo, como antes con `surface-card`.
export const PRODUCT_CARD_PASS_THROUGH = {
  body: { class: 'flex min-h-0 flex-1 flex-col' },
  content: { class: 'flex min-h-0 min-w-0 flex-1 flex-col' },
} satisfies CardPassThrough;
