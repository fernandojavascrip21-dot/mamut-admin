import { pluralize } from '@shared/utils/pluralize';

// Textos de la tarjeta de un producto nuevo (HU-42 §3).
export const PENDING_NEW_PRODUCT_CARD_TEXTS = {
  pieces: (qty: number) => `${qty} ${pluralize(qty, 'pieza', 'piezas')}`,
} as const;
