import { pluralize } from '@shared/utils/pluralize';

// Textos de la tarjeta de un cambio de costo (HU-42 §3).
export const PENDING_COST_CHANGE_CARD_TEXTS = {
  received: (qty: number) => `${qty} ${pluralize(qty, 'pieza', 'piezas')} recibidas`,
} as const;
